/* =====================================================================
   GALLERY REPOSITORY — the only Firestore operations the sync performs.
   ---------------------------------------------------------------------
   Implemented over REST as the Sync Bot (createRestRepo, below) and in
   memory for tests (test/memoryRepo.ts, which also counts reads,
   writes and requests for the free-tier budget tests).
   Every write here is one firestore.rules explicitly allows the bot.
   ===================================================================== */
import { initialAdminFields, mediaDocId, SYNC_FIELDS, type SyncedMediaFields } from '../instagram/media.js';
import { toCachedPost, type CachedPost } from '../cache/galleryCache.js';
import { COMMIT_MAX, FirestoreError, Ts, type FirestoreRest, type WriteOp } from './rest.js';

export interface IntegrationStatus {
  connected?: boolean;
  accountId?: string;
  username?: string;
  accountType?: string;
  connectedAt?: string;
  disconnectedAt?: string;
  tokenExpiresAt?: string | null;
  tokenRefreshedAt?: string;
  lastSyncAt?: string;
  lastCheckedAt?: string;
  lastSyncStatus?: 'success' | 'failed';
  lastSyncRunId?: string;
  lastError?: { code: string; message: string; at: string } | null;
  needsReconnect?: boolean;
  lastManualSyncAt?: string;
}
/** The fields the Sync Bot may write on integrations/instagram (mirrors firestore.rules). */
export const BOT_STATUS_FIELDS: (keyof IntegrationStatus)[] = [
  'connected', 'accountId', 'username', 'accountType', 'connectedAt', 'disconnectedAt', 'tokenExpiresAt', 'tokenRefreshedAt',
  'lastSyncAt', 'lastCheckedAt', 'lastSyncStatus', 'lastSyncRunId', 'lastError', 'needsReconnect', 'lastManualSyncAt',
];

export interface SyncRunRecord {
  id: string;
  trigger: 'manual' | 'scheduled' | 'retry' | 'connect' | 'refresh';
  retryOf: string | null;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  pages: number;
  fetched: number;
  created: number;
  updated: number;
  removed: number;
  skipped: number;
  complete: boolean;
  error: { code: string; message: string } | null;
}

export interface GalleryRepo {
  /** Create posts that don't exist yet. Returns igIds that already existed (to update instead). */
  createPosts(items: SyncedMediaFields[], opts: { autoPublish: boolean; now: Date }): Promise<{ created: string[]; existed: string[] }>;
  /** Write only the Instagram-owned fields of existing posts. */
  updateSynced(items: SyncedMediaFields[], now: Date): Promise<number>;
  markUnavailable(igIds: string[], now: Date): Promise<number>;
  /**
   * Posts the owner changed after `since` (their ownerUpdatedAt), oldest change first: the safety
   * net that keeps the public cache right even if a change notification from the admin was lost.
   */
  ownerChangedSince(since: string | null, limit: number): Promise<{ id: string; ownerUpdatedAt: string; post: CachedPost | null }[]>;
  /** Any post by document id, with its status (the bot may read hidden posts). */
  getPost(id: string): Promise<{ status: string; available: boolean; igId: string; post: CachedPost | null } | null>;
  readIntegration(): Promise<{ autoPublish: boolean }>;
  writeStatus(patch: IntegrationStatus): Promise<void>;
  writeRun(run: SyncRunRecord): Promise<void>;
  /** Keep the newest `keep` runs. */
  pruneRuns(keep: number): Promise<number>;
}

export class RepoWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepoWriteError';
  }
}

const SYNC_MASK = [...SYNC_FIELDS, 'syncedAt', 'unavailableSince'];

export function createRestRepo(fs: FirestoreRest, botToken: () => Promise<string>): GalleryRepo {
  /** Commit in chunks; a refused write (rules) becomes a RepoWriteError with Firestore's reason. */
  const commitAll = async (ops: WriteOp[], token: string) => {
    for (let i = 0; i < ops.length; i += COMMIT_MAX) {
      try {
        await fs.commit(ops.slice(i, i + COMMIT_MAX), token);
      } catch (e) {
        if (e instanceof FirestoreError && e.isPrecondition) throw e; // the caller resolves these
        throw new RepoWriteError(`Firestore refused a write: ${e instanceof Error ? e.message.slice(0, 160) : 'unknown error'}`);
      }
    }
  };
  /** Which of these paths exist (one request per 100). */
  const existing = async (paths: string[], token: string) => {
    const found = new Set<string>();
    for (let i = 0; i < paths.length; i += COMMIT_MAX) {
      for (const [p, d] of await fs.batchGet(paths.slice(i, i + COMMIT_MAX), token)) if (d) found.add(p);
    }
    return found;
  };
  /** Commit; if a "must (not) exist" check fails (rare: lost manifest), keep only the writes whose condition holds. */
  const commitWhere = async (ops: WriteOp[], keep: (exists: boolean) => boolean, token: string): Promise<WriteOp[]> => {
    try {
      await commitAll(ops, token);
      return ops;
    } catch (e) {
      if (!(e instanceof FirestoreError && e.isPrecondition)) throw e;
      const found = await existing(ops.map((o) => o.path), token);
      const ok = ops.filter((o) => keep(found.has(o.path)));
      await commitAll(ok, token);
      return ok;
    }
  };
  const path = (igId: string) => `galleryMedia/${mediaDocId(igId)}`;

  return {
    async createPosts(items, { autoPublish, now }) {
      if (!items.length) return { created: [], existed: [] };
      const token = await botToken();
      const ops: WriteOp[] = items.map((m) => ({
        path: path(m.igId),
        data: { ...m, ...initialAdminFields(m, autoPublish), syncedAt: now.toISOString(), createdAt: now.toISOString() },
        mustNotExist: true,
        serverTime: ['updatedAt'],
      }));
      const done = new Set((await commitWhere(ops, (exists) => !exists, token)).map((o) => o.path));
      const created: string[] = [];
      const existed: string[] = [];
      for (const m of items) (done.has(path(m.igId)) ? created : existed).push(m.igId);
      return { created, existed };
    },

    async updateSynced(items, now) {
      if (!items.length) return 0;
      const ops: WriteOp[] = items.map((m) => ({
        path: path(m.igId),
        // unavailableSince is in the mask but not in the data, so it is removed (the post is back)
        data: { ...m, syncedAt: now.toISOString() },
        mask: SYNC_MASK,
        mustExist: true,
        serverTime: ['updatedAt'],
      }));
      return (await commitWhere(ops, (exists) => exists, await botToken())).length;
    },

    async markUnavailable(igIds, now) {
      if (!igIds.length) return 0;
      const ops: WriteOp[] = igIds.map((igId) => ({
        path: path(igId),
        data: { available: false, unavailableSince: now.toISOString() },
        mask: ['available', 'unavailableSince'],
        mustExist: true,
        serverTime: ['updatedAt'],
      }));
      return (await commitWhere(ops, (exists) => exists, await botToken())).length;
    },

    async ownerChangedSince(since, limit) {
      const docs = await fs.query(
        {
          collection: 'galleryMedia',
          where: [['ownerUpdatedAt', 'GREATER_THAN', new Ts(since ?? '1970-01-01T00:00:00Z')]],
          orderBy: [['ownerUpdatedAt', 'ASCENDING']],
          limit,
        },
        await botToken(),
      );
      return docs.map((d) => ({ id: d.id, ownerUpdatedAt: String(d.data.ownerUpdatedAt), post: toCachedPost(d.id, d.data) }));
    },

    async getPost(id) {
      const d = await fs.get(`galleryMedia/${id}`, await botToken());
      if (!d) return null;
      return { status: String(d.data.status), available: d.data.available === true, igId: String(d.data.igId || ''), post: toCachedPost(d.id, d.data) };
    },

    async readIntegration() {
      const d = await fs.get('integrations/instagram', await botToken());
      return { autoPublish: d?.data.autoPublish !== false };
    },

    async writeStatus(patch) {
      const keys = Object.keys(patch).filter((k) => BOT_STATUS_FIELDS.includes(k as keyof IntegrationStatus));
      if (!keys.length) return;
      await commitAll([{ path: 'integrations/instagram', data: patch as Record<string, unknown>, mask: keys, serverTime: ['updatedAt'] }], await botToken());
    },

    async writeRun(run) {
      await commitAll([{ path: `syncRuns/${run.id}`, data: run as unknown as Record<string, unknown> }], await botToken());
    },

    async pruneRuns(keep) {
      const token = await botToken();
      const old = await fs.query({ collection: 'syncRuns', orderBy: [['startedAt', 'DESCENDING']], offset: keep, limit: 50 }, token);
      if (!old.length) return 0;
      await commitAll(old.map((d) => ({ path: `syncRuns/${d.id}`, delete: true })), token);
      return old.length;
    },
  };
}
