/* Test doubles that COUNT what the free tiers limit: KV operations, outgoing requests
   (subrequests), Firestore reads/writes/deletes. No network, no Firebase. */
import { createBudget, type Budget, type Fetch } from '../src/budget.ts';
import type { KVLike } from '../src/env.ts';
import { createGraphClient, type RawMedia } from '../src/instagram/graph.ts';
import { initialAdminFields, mediaDocId, type SyncedMediaFields } from '../src/instagram/media.ts';
import { FRONT_KEY, pageKey, toCachedPost, type CachedPost, type GalleryFront, type GalleryPage } from '../src/cache/galleryCache.ts';
import { importKey } from '../src/instagram/tokenCrypto.ts';
import type { GalleryRepo, IntegrationStatus, SyncRunRecord } from '../src/firestore/galleryRepo.ts';
import type { SyncContext } from '../src/sync/engine.ts';

export const TEST_KEY_B64 = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => (i * 7 + 3) & 255)));
export const testKey = () => importKey(TEST_KEY_B64);

/* ---------- Workers KV ---------- */
export function memoryKV() {
  const data = new Map<string, string>();
  const stats = { reads: 0, writes: 0, deletes: 0, bytesWritten: 0 };
  const kv: KVLike = {
    async get(k) {
      stats.reads += 1;
      return data.get(k) ?? null;
    },
    async put(k, v) {
      stats.writes += 1;
      stats.bytesWritten += v.length;
      data.set(k, v);
    },
    async delete(k) {
      stats.deletes += 1;
      data.delete(k);
    },
  };
  return { kv, data, stats, json: <T>(k: string) => (data.has(k) ? (JSON.parse(data.get(k)!) as T) : null) };
}

/* ---------- Instagram ---------- */
export const post = (id: string, over: Partial<RawMedia> = {}, at = Date.parse('2026-11-01T10:00:00Z')): RawMedia => ({
  id,
  media_type: 'IMAGE',
  media_product_type: 'FEED',
  media_url: `https://scontent.cdninstagram.com/${id}.jpg?sig=1`,
  permalink: `https://www.instagram.com/p/${id}/`,
  caption: `Post ${id}`,
  timestamp: new Date(at).toISOString(),
  ...over,
});

/** A fake Instagram account, newest first. `sig` changes every "6 hours" like real signed links. */
/** linkTtlHours: like real Instagram links, each fetched link expires that long after the fetch (oe=…). */
export function fakeInstagram(initial: RawMedia[], opts: { now?: () => Date; linkTtlHours?: number } = {}) {
  const state = { posts: [...initial], sig: 1, calls: { pages: 0, single: 0, refresh: 0, other: 0 } };
  const link = (u: string | undefined) => {
    if (!u) return u;
    let out = u.replace(/sig=\d+/, `sig=${state.sig}`);
    if (opts.linkTtlHours !== undefined) {
      const oe = Math.floor(((opts.now?.() ?? new Date()).getTime() + opts.linkTtlHours * 3600e3) / 1000).toString(16).toUpperCase();
      out = out.replace(/[?&]oe=[0-9A-F]+/, '') + `${out.includes('?') ? '&' : '?'}oe=${oe}`;
    }
    return out;
  };
  const withSig = (p: RawMedia): RawMedia => ({ ...p, media_url: link(p.media_url), thumbnail_url: link(p.thumbnail_url) });
  const fetch: Fetch = async (url) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/me/media')) {
      state.calls.pages += 1;
      // Like Instagram: the cursor points at the last post returned, so new posts at the top don't shift later pages.
      const after = u.searchParams.get('after');
      const start = after ? state.posts.findIndex((p) => p.id === after) + 1 : 0;
      const limit = Number(u.searchParams.get('limit') || 50);
      const page = state.posts.slice(start, start + limit);
      const more = start + limit < state.posts.length;
      return Response.json({ data: page.map(withSig), paging: { cursors: { after: page[page.length - 1]?.id ?? '' }, ...(more ? { next: 'https://graph.instagram.com/next' } : {}) } });
    }
    if (u.pathname.endsWith('/refresh_access_token')) {
      state.calls.refresh += 1;
      return Response.json({ access_token: 'REFRESHED', expires_in: 5184000 });
    }
    const single = /\/v[\d.]+\/(\w+)$/.exec(u.pathname);
    if (single) {
      state.calls.single += 1;
      const p = state.posts.find((x) => x.id === single[1]);
      return p ? Response.json(withSig(p)) : Response.json({ error: { message: 'not found', code: 100 } }, { status: 400 });
    }
    state.calls.other += 1;
    return Response.json({ error: { message: 'unexpected' } }, { status: 500 });
  };
  return { state, fetch };
}

/* ---------- Firestore (as the Sync Bot), in memory ---------- */
type DocData = Record<string, unknown>;
export function memoryRepo(budget: Budget) {
  const docs = new Map<string, DocData>(); // 'galleryMedia/ig_1' → data
  const stats = { reads: 0, writes: 0, deletes: 0, ruleReads: 0, requests: 0 };
  const integration: DocData = { autoPublish: true };
  let clockTick = 0;
  const runs = new Map<string, SyncRunRecord>();
  /** One REST call = one subrequest; firestore.rules' exists(syncBots/uid) = one billed read per call. */
  const call = async () => {
    await budget.fetch('mem://firestore');
    stats.requests += 1;
    stats.ruleReads += 1;
    stats.reads += 1;
  };
  const chunks = async (n: number) => {
    for (let i = 0; i < n; i += 100) await call();
  };
  const media = (igId: string) => `galleryMedia/${mediaDocId(igId)}`;

  const repo: GalleryRepo = {
    async createPosts(items, { autoPublish, now }) {
      if (!items.length) return { created: [], existed: [] };
      await chunks(items.length);
      const created: string[] = [];
      const existed: string[] = [];
      for (const m of items) {
        if (docs.has(media(m.igId))) existed.push(m.igId);
        else {
          docs.set(media(m.igId), { ...m, ...initialAdminFields(m, autoPublish), syncedAt: now.toISOString() });
          stats.writes += 1;
          created.push(m.igId);
        }
      }
      return { created, existed };
    },
    async updateSynced(items, now) {
      if (!items.length) return 0;
      await chunks(items.length);
      for (const m of items) {
        const d = docs.get(media(m.igId));
        if (!d) continue;
        const { unavailableSince: _u, ...rest } = d;
        docs.set(media(m.igId), { ...rest, ...m, syncedAt: now.toISOString() }); // owner fields untouched
        stats.writes += 1;
      }
      return items.length;
    },
    async markUnavailable(igIds, now) {
      if (!igIds.length) return 0;
      await chunks(igIds.length);
      for (const id of igIds) {
        const d = docs.get(media(id));
        if (d) (docs.set(media(id), { ...d, available: false, unavailableSince: now.toISOString() }), (stats.writes += 1));
      }
      return igIds.length;
    },
    async ownerChangedSince(since, limit) {
      await call();
      const rows = [...docs.entries()]
        .filter(([, d]) => typeof d.ownerUpdatedAt === 'string' && (since === null || (d.ownerUpdatedAt as string) > since))
        .sort(([, a], [, b]) => String(a.ownerUpdatedAt).localeCompare(String(b.ownerUpdatedAt)))
        .slice(0, limit)
        .map(([k, d]) => ({ id: k.slice('galleryMedia/'.length), ownerUpdatedAt: String(d.ownerUpdatedAt), post: toCachedPost(k.slice('galleryMedia/'.length), d) }));
      stats.reads += Math.max(rows.length, 1); // an empty query result is billed as one read
      return rows;
    },
    async getPost(id) {
      await call();
      stats.reads += 1;
      const d = docs.get(`galleryMedia/${id}`);
      return d ? { status: String(d.status), available: d.available === true, igId: String(d.igId), post: toCachedPost(id, d) } : null;
    },
    async readIntegration() {
      await call();
      stats.reads += 1;
      return { autoPublish: integration.autoPublish !== false };
    },
    async writeStatus(patch: IntegrationStatus) {
      await call();
      Object.assign(integration, patch);
      stats.writes += 1;
    },
    async writeRun(run) {
      await call();
      runs.set(run.id, { ...run });
      stats.writes += 1;
    },
    async pruneRuns(keep) {
      await call();
      const sorted = [...runs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      const old = sorted.slice(keep, keep + 50);
      stats.reads += Math.min(sorted.length, keep + 50); // offset documents are billed too
      if (old.length) {
        await call();
        old.forEach((r) => runs.delete(r.id));
        stats.deletes += old.length;
      }
      return old.length;
    },
  };
  /** What the owner does in the admin (not counted as bot traffic). */
  const owner = {
    /** Like the admin: changes owner fields and stamps ownerUpdatedAt (server time, always increasing). */
    set(id: string, patch: DocData) {
      const k = `galleryMedia/${id}`;
      clockTick += 1;
      docs.set(k, { ...docs.get(k)!, ...patch, ownerUpdatedAt: new Date(Date.UTC(2030, 0, 1) + clockTick).toISOString() });
    },
    autoPublish(on: boolean) {
      integration.autoPublish = on;
    },
  };
  return { repo, docs, stats, runs, integration, owner, doc: (igId: string) => docs.get(media(igId)) };
}

/** A complete sync context: fake Instagram + memory Firestore + memory KV, all on one budget. */
export async function harness(posts: RawMedia[], opts: { now?: () => Date; limit?: number; linkTtlHours?: number } = {}) {
  const ig = fakeInstagram(posts, { now: opts.now, linkTtlHours: opts.linkTtlHours });
  const kv = memoryKV();
  const key = await testKey();
  const fresh = () => {
    const budget = createBudget(opts.limit, (url, init) => (url.startsWith('mem://') ? Promise.resolve(new Response('{}')) : ig.fetch(url, init)));
    return budget;
  };
  let budget = fresh();
  const fs = memoryRepo({ fetch: (u, i) => budget.fetch(u, i), used: () => budget.used(), remaining: () => budget.remaining() });
  const ctx = (): SyncContext => ({
    kv: kv.kv,
    repo: fs.repo,
    graph: createGraphClient({ appId: 'APP', appSecret: 'SECRET', redirectUri: 'https://w.example/cb', fetch: (u, i) => budget.fetch(u, i) }),
    budget: { remaining: () => budget.remaining() },
    key,
    now: opts.now,
  });
  /** Start a new "invocation" (new 50-subrequest budget); returns how many the previous one used. */
  const nextRun = () => {
    const used = budget.used();
    budget = fresh();
    return used;
  };
  return { ig, kv, fs, key, ctx, nextRun, budget: () => budget };
}

export const synced = (m: Partial<SyncedMediaFields> & { igId: string }): SyncedMediaFields => ({
  source: 'instagram', accountId: 'acct', kind: 'image', productType: 'FEED', isReel: false, mediaUrl: null, thumbnailUrl: null,
  permalink: `https://www.instagram.com/p/${m.igId}/`, caption: '', takenAt: '2026-11-01T00:00:00.000Z', children: [], available: true, likeCount: null, ...m,
});

/** The public gallery exactly as the website assembles it: front + every page, in display order. */
export function publicCache(kv: { json: <T>(k: string) => T | null }): { front: GalleryFront; items: CachedPost[] } {
  const front = kv.json<GalleryFront>(FRONT_KEY) ?? { v: 2, builtAt: '', total: 0, pages: [], featured: [] };
  const items = front.pages.flatMap((id) => kv.json<GalleryPage>(pageKey(id))?.items ?? []);
  return { front, items };
}
