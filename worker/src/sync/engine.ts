/* =====================================================================
   INSTAGRAM SYNC ENGINE — runs inside the Cloudflare Worker.
   ---------------------------------------------------------------------
   Sized for the Workers Free plan: ≤ 45 outgoing requests and ~10 ms of
   CPU per invocation, ≤ 1,000 KV writes per day.

   INCREMENTAL (cron, every 15 minutes):
     reads the newest Instagram page(s) and compares each post's
     fingerprint (everything except file links) with the KV manifest.
     Nothing new or changed → nothing is written anywhere. New posts are
     created (published or hidden per auto-publish), changed posts get
     their Instagram fields updated. Then the SAFETY NET: posts the owner
     changed since the last check (ownerUpdatedAt) are re-applied to the
     public cache, so a lost admin notification is corrected within 15
     minutes. Usually that query returns nothing (1 read).

   REFRESH / IMPORT (cron, in the 5-minute slots between incremental
   checks, only while a cycle is running; a cycle starts every 6 hours):
     ONE Instagram page (25 posts) per step, resumable. Rewrites a post
     only if it is new, changed, or published with file links that
     expire within EXPIRY_MARGIN (Instagram links carry their expiry);
     hidden posts' links are refreshed only when the owner publishes
     them (revalidate). After the last page, posts no longer on
     Instagram are marked unavailable (never deleted). The first import
     after connecting uses the same steps.

   Duplicate-safe: the document id is the Instagram media id and new
   posts are written with "must not exist".
   ===================================================================== */
import type { KVLike } from '../env.js';
import { BudgetExceeded } from '../budget.js';
import { GraphError, type GraphClient } from '../instagram/graph.js';
import { fingerprint, initialAdminFields, mapMedia, mediaDocId, type SyncedMediaFields } from '../instagram/media.js';
import { CacheTx, likesChanged, linksExpireBefore, STAMP_KEY, toCachedPost, type CachedPost } from '../cache/galleryCache.js';
import { emptyManifest, getJson, K, loadManifest, putJson, saveConnection, saveManifest, type Connection, type RefreshState } from '../store/kv.js';
import { RepoWriteError, type GalleryRepo, type SyncRunRecord } from '../firestore/galleryRepo.js';
import { BotSignInError } from '../firestore/botSession.js';
import { FirestoreError } from '../firestore/rest.js';

/** Incremental: at most this many Instagram pages (it normally stops after the first). */
export const INCREMENTAL_MAX_PAGES = 2;
/** Refresh/import: posts per step. 25 keeps the worst step (every post published and expiring)
 *  under the Free plan's 10 ms CPU for a 2,000-post account (measured in test/cpu.test.ts). */
export const REFRESH_PAGE_SIZE = 25;
/** Refresh: rewrite published posts whose file links expire within this window. */
export const EXPIRY_MARGIN_MS = 24 * 3600 * 1000;
/** Safety net: owner changes applied per check (each may touch a cache page; the rest follow next check). */
export const OWNER_CHANGES_PER_RUN = 5;
export const REVALIDATE_MAX = 5;
export const KEEP_RUNS = 50;
export const MANUAL_COOLDOWN_MS = 30 * 1000;
/** Renew the ~60-day token once it is this old (Meta requires ≥ 24 h). */
export const TOKEN_REFRESH_AFTER_MS = 7 * 24 * 3600 * 1000;

export interface SyncContext {
  kv: KVLike;
  repo: GalleryRepo;
  graph: GraphClient;
  budget: { remaining(): number };
  key: CryptoKey;
  now?: () => Date;
  newId?: () => string;
}

export type ErrorCode = 'not-connected' | 'needs-reconnect' | 'rate-limited' | 'instagram-error' | 'firestore' | 'bot-sign-in' | 'too-soon' | 'internal';
export class SyncError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

/** Any failure → a code and a message safe to show the owner (never tokens or URLs). */
export function classify(e: unknown): SyncError {
  if (e instanceof SyncError) return e;
  if (e instanceof GraphError) {
    if (e.isAuthError) return new SyncError('needs-reconnect', 'Instagram no longer accepts the saved connection. Please reconnect Instagram.');
    if (e.isRateLimit) return new SyncError('rate-limited', 'Instagram is limiting requests right now. The next check will try again.');
    return new SyncError('instagram-error', `Instagram returned an error: ${e.message}`);
  }
  if (e instanceof BotSignInError) return new SyncError('bot-sign-in', 'The Sync Bot could not sign in to Firebase. Check its email and password in the Worker secrets.');
  if (e instanceof RepoWriteError || e instanceof FirestoreError) return new SyncError('firestore', `Firestore: ${e.message.slice(0, 160)}`);
  if (e instanceof BudgetExceeded) return new SyncError('internal', 'The run used up its request budget; the next run continues.');
  return new SyncError('internal', 'The sync failed unexpectedly. The next run will try again.');
}

const defaultId = () => `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const clock = (ctx: SyncContext) => ctx.now ?? (() => new Date());

function newRun(ctx: SyncContext, trigger: SyncRunRecord['trigger'], retryOf: string | null, id?: string): SyncRunRecord {
  return {
    id: id ?? (ctx.newId ?? defaultId)(), trigger, retryOf, status: 'running', startedAt: clock(ctx)().toISOString(), finishedAt: null,
    pages: 0, fetched: 0, created: 0, updated: 0, removed: 0, skipped: 0, complete: false, error: null,
  };
}

/** A new post as the public cache shows it (null if not published). */
const asCached = (m: SyncedMediaFields, autoPublish: boolean): CachedPost | null =>
  toCachedPost(mediaDocId(m.igId), { ...m, ...initialAdminFields(m, autoPublish) });

/** Fresh Instagram fields merged into a cached post (owner fields kept). */
const mergeSynced = (p: CachedPost, m: SyncedMediaFields): CachedPost => ({
  ...p, kind: m.kind, isReel: m.isReel, mediaUrl: m.mediaUrl, thumbnailUrl: m.thumbnailUrl, permalink: m.permalink, caption: m.caption, takenAt: m.takenAt,
  children: m.children.map(({ kind, mediaUrl, thumbnailUrl }) => ({ kind, mediaUrl, thumbnailUrl })),
  likeCount: m.likeCount,
});

/** Record a failed run in the history and on the connection status; flag the token if Instagram refused it. */
async function failRun(ctx: SyncContext, conn: Connection, run: SyncRunRecord, e: unknown): Promise<SyncRunRecord> {
  const err = classify(e);
  run.status = 'failed';
  run.finishedAt = clock(ctx)().toISOString();
  run.error = { code: err.code, message: err.message };
  if (err.code === 'needs-reconnect') await saveConnection(ctx.kv, ctx.key, { ...conn, needsReconnect: true }).catch(() => {});
  await ctx.repo.writeRun(run).catch(() => {});
  await ctx.repo
    .writeStatus({ lastSyncStatus: 'failed', lastSyncRunId: run.id, lastError: { ...run.error, at: run.finishedAt }, ...(err.code === 'needs-reconnect' ? { needsReconnect: true } : {}) })
    .catch(() => {});
  return run;
}

/** Re-apply posts the owner changed since the last check. Returns the cache tx if it changed anything. */
async function applyOwnerChanges(ctx: SyncContext, tx: CacheTx | null): Promise<CacheTx | null> {
  const stamp = await ctx.kv.get(STAMP_KEY);
  const rows = await ctx.repo.ownerChangedSince(stamp, OWNER_CHANGES_PER_RUN);
  if (!rows.length) return tx;
  const t = tx ?? (await CacheTx.open(ctx.kv));
  for (const r of rows) {
    if (r.post) await t.upsert(r.post);
    else await t.remove(r.id);
  }
  await ctx.kv.put(STAMP_KEY, rows[rows.length - 1].ownerUpdatedAt);
  return t;
}

/* ===================================================================== */
/** Every 15 minutes: import new posts and changes. Writes nothing when nothing changed. */
export async function runIncremental(ctx: SyncContext, conn: Connection, trigger: SyncRunRecord['trigger'] = 'scheduled', retryOf: string | null = null): Promise<SyncRunRecord> {
  const manifest = await loadManifest(ctx.kv, conn.accountId);
  if (!manifest) {
    // Nothing imported yet for this account: start the complete import (continued by the cron).
    await ctx.kv.put(K.refreshDue, '1');
    return runRefreshStep(ctx, conn, trigger === 'scheduled' ? 'connect' : trigger, retryOf);
  }
  const run = newRun(ctx, trigger, retryOf);
  try {
    const fresh: SyncedMediaFields[] = [];
    const changed: SyncedMediaFields[] = [];
    const seen = new Set<string>();
    let after: string | null = null;
    do {
      const page = await ctx.graph.mediaPage(conn.accessToken, after);
      run.pages += 1;
      run.fetched += page.items.length;
      let news = 0;
      for (const raw of page.items) {
        const m = mapMedia(raw, conn.accountId);
        if (!m) {
          run.skipped += 1;
          continue;
        }
        if (seen.has(m.igId)) continue;
        seen.add(m.igId);
        const known = manifest.posts.get(m.igId);
        if (known === undefined) (fresh.push(m), (news += 1));
        else if (known !== fingerprint(m)) (changed.push(m), (news += 1));
      }
      after = page.after;
      if (!news) break; // newest first: a page with nothing new means everything older is known
    } while (after && run.pages < INCREMENTAL_MAX_PAGES);
    run.complete = !after;

    const now = clock(ctx)();
    let tx: CacheTx | null = null;
    if (fresh.length || changed.length) {
      const autoPublish = fresh.length ? (await ctx.repo.readIntegration()).autoPublish : true;
      const { created, existed } = await ctx.repo.createPosts(fresh, { autoPublish, now });
      const toUpdate = [...changed, ...fresh.filter((m) => existed.includes(m.igId))];
      await ctx.repo.updateSynced(toUpdate, now);
      run.created = created.length;
      run.updated = toUpdate.length;
      for (const m of [...fresh, ...changed]) manifest.posts.set(m.igId, fingerprint(m));
      await saveManifest(ctx.kv, manifest);
      // A refresh cycle in progress has already walked past the newest posts: record these as seen
      // in that cycle, or its last step would think they were deleted on Instagram.
      const cycle = fresh.length ? await getJson<RefreshState>(ctx.kv, K.refresh) : null;
      if (cycle?.v === 2) {
        cycle.seen += (cycle.seen ? ',' : '') + fresh.map((m) => m.igId).join(',');
        await putJson(ctx.kv, K.refresh, cycle);
      }

      tx = await CacheTx.open(ctx.kv);
      const createdSet = new Set(created);
      for (const m of fresh) {
        const p = createdSet.has(m.igId) ? asCached(m, autoPublish) : null;
        if (p) await tx.upsert(p);
      }
      for (const m of toUpdate) {
        const p = await tx.get(mediaDocId(m.igId));
        if (p) await tx.upsert(mergeSynced(p, m));
      }
    }
    tx = await applyOwnerChanges(ctx, tx);
    if (tx) await tx.commit(now);

    run.status = 'success';
    run.finishedAt = clock(ctx)().toISOString();
    // Only runs that changed something are recorded: 96 quiet checks a day write nothing.
    if (run.created || run.updated || trigger !== 'scheduled') {
      await ctx.repo.writeRun(run);
      await ctx.repo.writeStatus({ lastSyncAt: run.finishedAt, lastSyncStatus: 'success', lastSyncRunId: run.id, lastError: null, needsReconnect: false, ...(trigger === 'manual' || trigger === 'retry' ? { lastManualSyncAt: run.startedAt } : {}) });
    }
    return run;
  } catch (e) {
    return failRun(ctx, conn, run, e);
  }
}

/* ===================================================================== */
/** One step (one Instagram page) of a link refresh or the complete import. Resumable. */
export async function runRefreshStep(ctx: SyncContext, conn: Connection, trigger: SyncRunRecord['trigger'] = 'refresh', retryOf: string | null = null): Promise<SyncRunRecord> {
  const now = clock(ctx);
  const started = now();
  let st = await getJson<RefreshState>(ctx.kv, K.refresh);
  if (st?.v !== 2) st = null;
  const run = newRun(ctx, (st?.trigger as SyncRunRecord['trigger']) ?? trigger, retryOf, st?.runId);
  st ??= { v: 2, cycleStartedAt: run.startedAt, runId: run.id, trigger: run.trigger, after: null, pages: 0, seen: '', counts: { fetched: 0, created: 0, updated: 0, skipped: 0 } };
  run.startedAt = st.cycleStartedAt;
  try {
    const manifest = (await loadManifest(ctx.kv, conn.accountId)) ?? emptyManifest(conn.accountId);
    const tx = await CacheTx.open(ctx.kv);
    // ids seen on this page only; the cycle's list is appended to as text and parsed once, at the end
    const seen = new Set<string>();
    const expiringBefore = started.getTime() + EXPIRY_MARGIN_MS;

    const page = await ctx.graph.mediaPage(conn.accessToken, st.after, REFRESH_PAGE_SIZE);
    st.pages += 1;
    st.counts.fetched += page.items.length;
    const create: SyncedMediaFields[] = [];
    const update: SyncedMediaFields[] = [];
    const likesOnly: [CachedPost, SyncedMediaFields][] = [];
    for (const raw of page.items) {
      const m = mapMedia(raw, conn.accountId);
      if (!m) {
        st.counts.skipped += 1;
        continue;
      }
      if (seen.has(m.igId)) continue;
      seen.add(m.igId);
      const id = mediaDocId(m.igId);
      const known = manifest.posts.get(m.igId);
      if (known === undefined) create.push(m);
      else if (known !== fingerprint(m)) update.push(m);
      else if (tx.has(id)) {
        // published: rewrite only if its cached links expire soon; a changed like count only
        // updates the public cache (no Firestore write)
        const cached = await tx.get(id);
        if (cached && linksExpireBefore(cached, expiringBefore)) update.push(m);
        else if (cached && likesChanged(cached.likeCount, m.likeCount)) likesOnly.push([cached, m]);
      }
    }
    for (const [cached, m] of likesOnly) await tx.upsert({ ...cached, likeCount: m.likeCount });

    const autoPublish = create.length ? (await ctx.repo.readIntegration()).autoPublish : true;
    const { created, existed } = await ctx.repo.createPosts(create, { autoPublish, now: started });
    const toUpdate = [...update, ...create.filter((m) => existed.includes(m.igId))];
    await ctx.repo.updateSynced(toUpdate, started);
    st.counts.created += created.length;
    st.counts.updated += toUpdate.length;
    const createdSet = new Set(created);
    for (const m of create) {
      const p = createdSet.has(m.igId) ? asCached(m, autoPublish) : null;
      if (p) await tx.upsert(p);
    }
    for (const m of toUpdate) {
      const p = await tx.get(mediaDocId(m.igId));
      if (p) await tx.upsert(mergeSynced(p, m));
    }
    let manifestChanged = false;
    for (const m of [...create, ...update]) {
      const fp = fingerprint(m);
      if (manifest.posts.get(m.igId) !== fp) (manifest.posts.set(m.igId, fp), (manifestChanged = true));
    }
    st.after = page.after;
    if (seen.size) st.seen += (st.seen ? ',' : '') + [...seen].join(',');

    if (st.after) {
      // More pages: save the place; the next 5-minute step continues.
      await putJson(ctx.kv, K.refresh, st);
      if (manifestChanged) await saveManifest(ctx.kv, manifest);
      await tx.commit(started);
      Object.assign(run, { pages: st.pages, fetched: st.counts.fetched, created: st.counts.created, updated: st.counts.updated, skipped: st.counts.skipped, complete: false });
      return run;
    }

    // Last page: posts no longer on Instagram leave the site (never deleted).
    const seenAll = new Set(st.seen.split(','));
    const missing = [...manifest.posts.keys()].filter((igId) => !seenAll.has(igId));
    run.removed = await ctx.repo.markUnavailable(missing, started);
    for (const igId of missing) {
      manifest.posts.delete(igId);
      await tx.remove(mediaDocId(igId));
      manifestChanged = true;
    }
    if (manifestChanged) await saveManifest(ctx.kv, manifest);
    await tx.commit(started);
    await ctx.kv.delete(K.refresh);
    if (await ctx.kv.get(K.refreshDue)) await ctx.kv.delete(K.refreshDue);

    Object.assign(run, { pages: st.pages, fetched: st.counts.fetched, created: st.counts.created, updated: st.counts.updated, skipped: st.counts.skipped, complete: true, status: 'success', finishedAt: now().toISOString() });
    await ctx.repo.writeRun(run);
    await ctx.repo.writeStatus({ lastSyncAt: run.finishedAt!, lastCheckedAt: run.finishedAt!, lastSyncStatus: 'success', lastSyncRunId: run.id, lastError: null, needsReconnect: false });
    if (started.getUTCHours() < 6) await ctx.repo.pruneRuns(KEEP_RUNS).catch(() => 0); // about once a day
    return run;
  } catch (e) {
    return failRun(ctx, conn, run, e); // the saved place is unchanged: the next step retries this page
  }
}

/* ===================================================================== */
/**
 * After the owner changes posts in the admin: update the public cache for those posts. Posts just
 * published get fresh Instagram links first (hidden posts' links are not refreshed on schedule).
 */
export async function revalidate(ctx: SyncContext, conn: Connection | null, ids: string[], refreshLinks: boolean): Promise<{ updated: number; removed: number }> {
  const tx = await CacheTx.open(ctx.kv);
  const now = clock(ctx)();
  let updated = 0;
  let removed = 0;
  for (const id of ids.slice(0, REVALIDATE_MAX)) {
    const p = await ctx.repo.getPost(id);
    if (!p || !p.post) {
      await tx.remove(id);
      removed += 1;
      continue;
    }
    let post = p.post;
    if (refreshLinks && conn && !conn.needsReconnect && p.igId && linksExpireBefore(post, now.getTime() + EXPIRY_MARGIN_MS)) {
      try {
        const m = mapMedia(await ctx.graph.mediaById(conn.accessToken, p.igId), conn.accountId);
        if (m) {
          await ctx.repo.updateSynced([m], now);
          post = mergeSynced(post, m);
        }
      } catch {
        /* keep the stored links; the next refresh cycle updates them */
      }
    }
    await tx.upsert(post);
    updated += 1;
  }
  await tx.commit(now);
  return { updated, removed };
}

/** Disconnect: forget the token; imported posts stay in Firestore but leave the website. */
export async function disconnect(ctx: SyncContext, conn: Connection | null): Promise<number> {
  const manifest = conn ? await loadManifest(ctx.kv, conn.accountId) : null;
  const t = clock(ctx)();
  const hidden = await ctx.repo.markUnavailable(manifest ? [...manifest.posts.keys()] : [], t);
  await (await CacheTx.open(ctx.kv)).clear(t);
  for (const k of [K.token, K.manifest, K.refresh, K.refreshDue]) await ctx.kv.delete(k);
  await ctx.repo.writeStatus({ connected: false, disconnectedAt: t.toISOString(), needsReconnect: false, tokenExpiresAt: null });
  return hidden;
}

/**
 * A token past its expiry date can't be renewed (Meta refuses), so stop using it: flag the
 * connection, tell the admin (it shows "Reconnect Instagram") and skip syncing until then.
 * Returns true when the token has expired.
 */
export async function expireIfPast(ctx: SyncContext, conn: Connection): Promise<boolean> {
  const t = clock(ctx)();
  if (!conn.expiresAt || Date.parse(conn.expiresAt) > t.getTime()) return false;
  await saveConnection(ctx.kv, ctx.key, { ...conn, needsReconnect: true });
  await ctx.repo
    .writeStatus({ needsReconnect: true, lastSyncStatus: 'failed', lastError: { code: 'needs-reconnect', message: 'The Instagram connection has expired. Please reconnect Instagram.', at: t.toISOString() } })
    .catch(() => {});
  return true;
}

/** Renew the long-lived token when it is due. Cheap when not due (no requests). */
export async function refreshTokenIfDue(ctx: SyncContext, conn: Connection): Promise<Connection> {
  const t = clock(ctx)();
  if (t.getTime() - Date.parse(conn.refreshedAt) < TOKEN_REFRESH_AFTER_MS) return conn;
  try {
    const r = await ctx.graph.refresh(conn.accessToken);
    const next: Connection = { ...conn, accessToken: r.accessToken, refreshedAt: t.toISOString(), expiresAt: r.expiresIn ? new Date(t.getTime() + r.expiresIn * 1000).toISOString() : null, needsReconnect: false };
    await saveConnection(ctx.kv, ctx.key, next);
    await ctx.repo.writeStatus({ tokenRefreshedAt: next.refreshedAt, tokenExpiresAt: next.expiresAt }).catch(() => {});
    return next;
  } catch (e) {
    const err = classify(e);
    if (err.code === 'needs-reconnect') {
      await saveConnection(ctx.kv, ctx.key, { ...conn, needsReconnect: true });
      await ctx.repo.writeStatus({ needsReconnect: true, lastError: { code: err.code, message: `Token renewal failed: ${err.message}`, at: t.toISOString() } }).catch(() => {});
    }
    return conn; // still valid for now; renewal is retried on the next run
  }
}

/**
 * The cron runs every 5 minutes. Slots at :00 :15 :30 :45 are the incremental check; the other
 * slots do one refresh/import step while a cycle is running (a cycle starts every 6 hours, and
 * after connecting) and otherwise end after two KV reads.
 */
export async function cronTick(ctx: SyncContext, loadConn: () => Promise<Connection | null>): Promise<SyncRunRecord | { skipped: string }> {
  const t = clock(ctx)();
  const incrementalSlot = Math.floor(t.getUTCMinutes() / 5) % 3 === 0;
  if (!incrementalSlot) {
    const busy = !!(await ctx.kv.get(K.refresh)) || !!(await ctx.kv.get(K.refreshDue));
    const cycleStart = t.getUTCHours() % 6 === 0 && Math.floor(t.getUTCMinutes() / 5) === 1; // :05 after 00/06/12/18
    if (!busy && !cycleStart) return { skipped: 'idle' };
  }
  const conn = await loadConn();
  if (!conn) return { skipped: 'not-connected' };
  if (conn.needsReconnect || (await expireIfPast(ctx, conn))) return { skipped: 'needs-reconnect' };
  const live = await refreshTokenIfDue(ctx, conn);
  return incrementalSlot ? runIncremental(ctx, live, 'scheduled') : runRefreshStep(ctx, live, 'refresh');
}

/** "Sync now" / "Retry": incremental (or start a complete refresh with `full`), with a 30-second cooldown. */
export async function manualSync(ctx: SyncContext, conn: Connection | null, opts: { retryOf?: string | null; full?: boolean }): Promise<SyncRunRecord> {
  if (!conn) throw new SyncError('not-connected', 'Instagram is not connected yet.');
  if (conn.needsReconnect || (await expireIfPast(ctx, conn))) throw new SyncError('needs-reconnect', 'Instagram no longer accepts the saved connection. Please reconnect Instagram.');
  const t = clock(ctx)();
  const last = await ctx.kv.get(K.manual);
  if (last && t.getTime() - Date.parse(last) < MANUAL_COOLDOWN_MS) throw new SyncError('too-soon', 'A sync was just started. Please wait a few seconds before trying again.');
  await ctx.kv.put(K.manual, t.toISOString(), { expirationTtl: 120 });
  const trigger = opts.retryOf ? 'retry' : 'manual';
  if (opts.full) {
    await ctx.kv.put(K.refreshDue, '1');
    return runRefreshStep(ctx, conn, trigger, opts.retryOf ?? null);
  }
  return runIncremental(ctx, conn, trigger, opts.retryOf ?? null);
}
