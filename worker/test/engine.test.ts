import { describe, expect, it } from 'vitest';
import { harness, post, publicCache } from './helpers.ts';
import { cronTick, disconnect, manualSync, REFRESH_PAGE_SIZE, revalidate, runIncremental, runRefreshStep, TOKEN_REFRESH_AFTER_MS, type SyncContext } from '../src/sync/engine.ts';
import { K, loadConnection, loadManifest, saveConnection, type Connection } from '../src/store/kv.ts';
import { PAGE_MAX } from '../src/cache/galleryCache.ts';
import { GraphError } from '../src/instagram/graph.ts';
import type { RawMedia } from '../src/instagram/graph.ts';

const T0 = Date.parse('2026-11-15T01:00:00Z');
const oe = (ms: number) => Math.floor(ms / 1000).toString(16).toUpperCase();
/** Links that expire `hours` after T0 (Instagram's `oe` parameter). */
const expiring = (hours: number) => ({ media_url: `https://scontent.cdninstagram.com/x.jpg?sig=1&oe=${oe(T0 + hours * 3600e3)}` });
const conn = (over: Partial<Connection> = {}): Connection => ({
  accessToken: 'TOKEN', accountId: 'acct', username: 'edenglow', accountType: 'BUSINESS', refreshedAt: new Date(T0).toISOString(), expiresAt: null, ...over,
});
const posts = (n: number, over: Partial<RawMedia> = {}) => Array.from({ length: n }, (_, i) => post(`p${i}`, over, T0 - (i + 1) * 3600e3));
let idn = 0;

async function connected(raw: RawMedia[], opts: { now?: () => Date; limit?: number } = {}) {
  const h = await harness(raw, { now: opts.now ?? (() => new Date(T0)), limit: opts.limit });
  await saveConnection(h.kv.kv, h.key, conn());
  const c = (): SyncContext => ({ ...h.ctx(), newId: () => `run_t${(idn += 1).toString().padStart(6, '0')}` });
  /** Run refresh/import steps until the cycle completes (each step = a new invocation). */
  const untilComplete = async () => {
    let steps = 0;
    for (;;) {
      const r = await runRefreshStep(c(), conn());
      h.nextRun();
      steps += 1;
      if (r.complete || r.status === 'failed' || steps > 500) return { run: r, steps };
    }
  };
  return { ...h, c, untilComplete, pub: () => publicCache(h.kv) };
}

describe('first import', () => {
  it('imports every post once over several small steps, publishes them and builds the paged cache', async () => {
    const h = await connected(posts(120));
    const first = await runIncremental(h.c(), conn()); // no manifest yet → starts the complete import
    expect(first.complete).toBe(false);
    expect(h.kv.data.has(K.refreshDue)).toBe(true);
    const { run, steps } = await h.untilComplete();
    expect(run).toMatchObject({ status: 'success', complete: true, created: 120 });
    expect(steps + 1).toBe(Math.ceil(120 / REFRESH_PAGE_SIZE)); // one Instagram page per step
    expect(h.fs.docs.size).toBe(120);
    expect(h.fs.doc('p0')).toMatchObject({ status: 'published', featured: false, category: null });
    const { front, items } = h.pub();
    expect(front.total).toBe(120);
    expect(items).toHaveLength(120);
    expect(items[0].id).toBe('ig_p0'); // newest first
    expect(items.map((p) => p.sortOrder)).toEqual([...items.map((p) => p.sortOrder)].sort((a, b) => b - a));
    expect(front.pages.length).toBeGreaterThan(1); // paged
    expect(h.kv.data.has(K.refresh) || h.kv.data.has(K.refreshDue)).toBe(false);
  });

  it('with auto-publish off, imports hidden posts and keeps them out of the public cache', async () => {
    const h = await connected(posts(5));
    h.fs.owner.autoPublish(false);
    await runIncremental(h.c(), conn());
    expect(h.fs.doc('p0')!.status).toBe('hidden');
    expect(h.pub().items).toHaveLength(0);
  });
});

async function imported(n: number, over: Partial<RawMedia> = {}, opts: { now?: () => Date } = {}) {
  const h = await connected(posts(n, over), opts);
  await runIncremental(h.c(), conn());
  await h.untilComplete();
  return h;
}

describe('15-minute incremental check', () => {
  it('writes NOTHING when nothing changed (no Firestore writes, no KV writes, 2 requests)', async () => {
    const h = await imported(80);
    h.nextRun();
    const w0 = h.fs.stats.writes;
    const kv0 = h.kv.stats.writes;
    const run = await runIncremental(h.c(), conn());
    expect(run).toMatchObject({ status: 'success', created: 0, updated: 0, pages: 1 });
    expect(h.fs.stats.writes - w0).toBe(0);
    expect(h.kv.stats.writes - kv0).toBe(0);
    expect(h.nextRun()).toBe(2); // one Instagram page + the owner-change check
  });

  it('writes only the new post, puts it first on the site, and keeps the owner’s settings', async () => {
    const h = await imported(80);
    h.fs.owner.set('ig_p1', { featured: true, category: 'Nails' });
    await revalidate(h.c(), conn(), ['ig_p1'], false);
    h.ig.state.posts.unshift(post('new1', {}, T0 + 60e3));
    const before = h.fs.stats.writes;
    const run = await runIncremental(h.c(), conn());
    expect(run).toMatchObject({ created: 1, updated: 0 });
    expect(h.fs.stats.writes - before).toBe(3); // the post + run record + status
    expect(h.pub().items[0].id).toBe('ig_new1');
    expect(h.pub().front.featured.map((p) => p.id)).toEqual(['ig_p1']);
    expect(h.fs.doc('p1')).toMatchObject({ featured: true, category: 'Nails' });
  });

  it('updates a post whose caption changed, and only that post', async () => {
    const h = await imported(30);
    h.fs.owner.set('ig_p0', { altText: 'Owner alt' });
    h.ig.state.posts[0] = { ...h.ig.state.posts[0], caption: 'Edited caption' };
    const run = await runIncremental(h.c(), conn());
    expect(run).toMatchObject({ created: 0, updated: 1 });
    expect(h.fs.doc('p0')).toMatchObject({ caption: 'Edited caption', altText: 'Owner alt' });
    expect(h.pub().items[0].caption).toBe('Edited caption');
  });

  it('is duplicate-safe even if the KV manifest is lost', async () => {
    const h = await imported(60);
    await h.kv.kv.delete(K.manifest);
    await runIncremental(h.c(), conn());
    const { run } = await h.untilComplete();
    expect(run).toMatchObject({ status: 'success', created: 0 });
    expect(h.fs.docs.size).toBe(60);
    expect(h.pub().front.total).toBe(60);
  });

  it('safety net: corrects the public cache within one check when an admin notification was lost', async () => {
    const h = await imported(10);
    h.fs.owner.set('ig_p3', { status: 'hidden' }); // the admin changed it; the Worker was never told
    h.fs.owner.set('ig_p4', { featured: true });
    expect(h.pub().items.map((p) => p.id)).toContain('ig_p3');
    await runIncremental(h.c(), conn());
    expect(h.pub().items.map((p) => p.id)).not.toContain('ig_p3');
    expect(h.pub().front.featured.map((p) => p.id)).toEqual(['ig_p4']);
    // and the next check has nothing left to apply
    const w = h.kv.stats.writes;
    await runIncremental(h.c(), conn());
    expect(h.kv.stats.writes).toBe(w);
  });
});

describe('link refresh (every 6 hours, one page per step)', () => {
  it('rewrites only PUBLISHED posts whose links expire soon; hidden and still-valid ones are untouched', async () => {
    // 20 posts with links valid for 3 days, 20 expiring in 5 hours
    const raw = [...posts(20, expiring(72)), ...posts(20, expiring(5)).map((p, i) => ({ ...p, id: `q${i}`, permalink: `https://www.instagram.com/p/q${i}/` }))];
    const h = await connected(raw);
    await runIncremental(h.c(), conn());
    await h.untilComplete();
    for (let i = 0; i < 5; i += 1) h.fs.owner.set(`ig_q${i}`, { status: 'hidden' });
    await revalidate(h.c(), conn(), [0, 1, 2, 3, 4].map((i) => `ig_q${i}`), false);
    h.ig.state.sig = 2;
    const before = h.fs.stats.writes;
    const { run } = await h.untilComplete();
    expect(run).toMatchObject({ status: 'success', complete: true, created: 0, updated: 15 }); // 15 published + expiring
    expect(h.fs.stats.writes - before).toBe(15 + 2); // + run record + status
    expect(h.fs.doc('p0')!.mediaUrl).toContain('sig=1'); // still valid for days: not rewritten
    expect(h.fs.doc('q0')!.mediaUrl).toContain('sig=1'); // hidden: not rewritten
    expect(h.fs.doc('q9')!.mediaUrl).toContain('sig=2');
    expect(h.pub().items.find((p) => p.id === 'ig_q9')!.mediaUrl).toContain('sig=2');
  });

  it('is resumable: every step is one Instagram page, the place is kept between runs', async () => {
    const h = await imported(260);
    expect(h.pub().front.total).toBe(260);
    const { steps } = await h.untilComplete();
    expect(steps).toBe(Math.ceil(260 / REFRESH_PAGE_SIZE)); // one Instagram page per step
    expect(h.kv.data.has(K.refresh)).toBe(false);
  });

  it('marks posts deleted on Instagram as unavailable (never deleted) and takes them off the site', async () => {
    const h = await imported(20);
    h.ig.state.posts = h.ig.state.posts.filter((p) => p.id !== 'p5');
    const { run } = await h.untilComplete();
    expect(run.removed).toBe(1);
    expect(h.fs.doc('p5')).toMatchObject({ available: false });
    expect(h.pub().items.map((p) => p.id)).not.toContain('ig_p5');
    expect((await loadManifest(h.kv.kv, 'acct'))!.posts.has('p5')).toBe(false);
  });
});

describe('paged public cache', () => {
  it('stays complete and in order as posts are added, reordered and removed (pages split as they grow)', async () => {
    const h = await imported(150);
    for (let i = 0; i < 70; i += 1) h.ig.state.posts.unshift(post(`n${i}`, {}, T0 + (i + 1) * 60e3));
    await runIncremental(h.c(), conn()); // 2 pages max per check
    await runIncremental(h.c(), conn());
    h.fs.owner.set('ig_p140', { sortOrder: T0 + 10 * 3600e3 }); // moved to the top
    h.fs.owner.set('ig_p10', { status: 'hidden' });
    await revalidate(h.c(), conn(), ['ig_p140', 'ig_p10'], false);
    const { front, items } = h.pub();
    expect(items).toHaveLength(219);
    expect(front.total).toBe(219);
    expect(new Set(items.map((p) => p.id)).size).toBe(219); // no duplicates
    expect(items[0].id).toBe('ig_p140');
    expect(items.map((p) => p.sortOrder)).toEqual([...items.map((p) => p.sortOrder)].sort((a, b) => b - a));
    for (const id of front.pages) expect(h.kv.json<{ items: unknown[] }>(`gallery:page:${id}`)!.items.length).toBeLessThanOrEqual(PAGE_MAX);
  });
});

describe('admin changes → public cache', () => {
  it('hide removes, publish adds (refreshing expiring links), feature is reflected', async () => {
    const h = await connected(posts(12, expiring(2)));
    h.fs.owner.autoPublish(false);
    await runIncremental(h.c(), conn());
    await h.untilComplete();
    expect(h.pub().items).toHaveLength(0);
    h.ig.state.sig = 7;
    h.fs.owner.set('ig_p2', { status: 'published', featured: true });
    await revalidate(h.c(), conn(), ['ig_p2'], true);
    expect(h.ig.state.calls.single).toBe(1);
    expect(h.pub().items[0]).toMatchObject({ id: 'ig_p2', featured: true });
    expect(h.pub().items[0].mediaUrl).toContain('sig=7');
    expect(h.pub().front.featured.map((p) => p.id)).toEqual(['ig_p2']);
    h.fs.owner.set('ig_p2', { status: 'hidden' });
    await revalidate(h.c(), conn(), ['ig_p2'], false);
    expect(h.pub().items).toHaveLength(0);
    expect(h.pub().front.featured).toHaveLength(0);
  });
});

describe('the 5-minute cron', () => {
  const at = (iso: string) => async (h: Awaited<ReturnType<typeof connected>>) => cronTick({ ...h.c(), now: () => new Date(iso) }, () => loadConnection(h.kv.kv, h.key));
  it('checks for new posts at :00/:15/:30/:45; idle slots end after two KV reads', async () => {
    const h = await imported(10);
    const r0 = h.kv.stats.reads;
    expect(await at('2026-11-15T03:20:00Z')(h)).toEqual({ skipped: 'idle' });
    expect(h.kv.stats.reads - r0).toBe(2);
    expect(await at('2026-11-15T03:30:00Z')(h)).toMatchObject({ trigger: 'scheduled', status: 'success' });
  });
  it('starts a refresh cycle at :05 after 00/06/12/18 and continues it in the in-between slots', async () => {
    const h = await imported(REFRESH_PAGE_SIZE * 3);
    expect(await at('2026-11-15T06:05:00Z')(h)).toMatchObject({ trigger: 'refresh', complete: false });
    expect(await at('2026-11-15T06:10:00Z')(h)).toMatchObject({ trigger: 'refresh', complete: false });
    expect(await at('2026-11-15T06:15:00Z')(h)).toMatchObject({ trigger: 'scheduled' }); // incremental slot
    expect(await at('2026-11-15T06:20:00Z')(h)).toMatchObject({ trigger: 'refresh', complete: true });
    expect(await at('2026-11-15T06:25:00Z')(h)).toEqual({ skipped: 'idle' });
  });
  it('a post published on Instagram DURING a refresh cycle is imported and NOT mistaken for a deleted one', async () => {
    const h = await imported(REFRESH_PAGE_SIZE * 3);
    await at('2026-11-15T06:05:00Z')(h); // the cycle passes the newest page
    h.ig.state.posts.unshift(post('during', {}, Date.parse('2026-11-15T06:07:00Z')));
    await at('2026-11-15T06:10:00Z')(h);
    await at('2026-11-15T06:15:00Z')(h); // incremental imports it
    expect(await at('2026-11-15T06:20:00Z')(h)).toMatchObject({ trigger: 'refresh', complete: true, removed: 0 });
    expect(h.fs.doc('during')).toMatchObject({ status: 'published', available: true });
    expect(h.pub().items.map((p) => p.id)).toContain('ig_during');
  });
});

describe('connection health', () => {
  it('renews the token once it is a week old', async () => {
    const later = new Date(T0 + TOKEN_REFRESH_AFTER_MS + 1000);
    const h = await imported(3, {}, { now: () => later });
    await cronTick({ ...h.c(), now: () => new Date(Date.UTC(2026, 10, 22, 3, 0)) }, () => loadConnection(h.kv.kv, h.key));
    expect(h.ig.state.calls.refresh).toBe(1);
    expect((await loadConnection(h.kv.kv, h.key))!.accessToken).toBe('REFRESHED');
  });

  it('a revoked token pauses syncing until the owner reconnects', async () => {
    const h = await connected(posts(3));
    const ctx = h.c();
    ctx.graph = { ...ctx.graph, mediaPage: async () => { throw new GraphError('Invalid OAuth access token', 400, 190); } };
    const run = await runRefreshStep(ctx, conn());
    expect(run).toMatchObject({ status: 'failed', error: { code: 'needs-reconnect' } });
    expect(h.fs.integration.needsReconnect).toBe(true);
    expect((await loadConnection(h.kv.kv, h.key))!.needsReconnect).toBe(true);
    expect(await cronTick({ ...h.c(), now: () => new Date('2026-11-15T03:30:00Z') }, () => loadConnection(h.kv.kv, h.key))).toEqual({ skipped: 'needs-reconnect' });
  });

  it('"Sync now" has a 30-second cooldown', async () => {
    const h = await imported(3);
    await manualSync(h.c(), conn(), {});
    await expect(manualSync(h.c(), conn(), {})).rejects.toMatchObject({ code: 'too-soon' });
  });

  it('disconnect forgets the token and takes every imported post off the site (kept in Firestore)', async () => {
    const h = await imported(8);
    const hidden = await disconnect(h.c(), conn());
    expect(hidden).toBe(8);
    expect(h.fs.docs.size).toBe(8);
    expect(h.fs.doc('p0')!.available).toBe(false);
    expect(h.pub().items).toHaveLength(0);
    expect(h.pub().front.total).toBe(0);
    expect(h.kv.data.has(K.token)).toBe(false);
    expect(h.fs.integration.connected).toBe(false);
  });
});

describe('like counts (only what Instagram returns)', () => {
  it('stores the count on import, and the refresh updates the public cache only when it changed noticeably', async () => {
    const h = await connected(posts(10, { like_count: 100, ...expiring(72) }));
    await runIncremental(h.c(), conn());
    await h.untilComplete();
    expect(h.fs.doc('p0')!.likeCount).toBe(100);
    expect(h.pub().items[0].likeCount).toBe(100);
    h.ig.state.posts[0] = { ...h.ig.state.posts[0], like_count: 103 }; // small change: not worth a write
    h.ig.state.posts[1] = { ...h.ig.state.posts[1], like_count: 180 }; // noticeable
    const fsWrites = h.fs.stats.writes;
    await h.untilComplete();
    expect(h.pub().items.find((p) => p.id === 'ig_p0')!.likeCount).toBe(100);
    expect(h.pub().items.find((p) => p.id === 'ig_p1')!.likeCount).toBe(180);
    expect(h.fs.stats.writes - fsWrites).toBe(2); // only the run record + status: likes never cost a Firestore write
  });
  it('shows no count when Instagram does not return one', async () => {
    const h = await imported(3);
    expect(h.pub().items[0].likeCount).toBeNull();
  });
});

describe('expired token', () => {
  it('stops syncing, flags "reconnect" for the admin, and a new connection clears it', async () => {
    const h = await imported(3);
    await saveConnection(h.kv.kv, h.key, conn({ expiresAt: new Date(T0 - 1000).toISOString() }));
    const calls = h.ig.state.calls.pages;
    expect(await cronTick({ ...h.c(), now: () => new Date('2026-11-15T03:30:00Z') }, () => loadConnection(h.kv.kv, h.key))).toEqual({ skipped: 'needs-reconnect' });
    expect(h.ig.state.calls.pages).toBe(calls); // Instagram was not called with the expired token
    expect(h.fs.integration).toMatchObject({ needsReconnect: true, lastError: { code: 'needs-reconnect' } });
    await expect(manualSync(h.c(), await loadConnection(h.kv.kv, h.key), {})).rejects.toMatchObject({ code: 'needs-reconnect' });
    // reconnecting saves a fresh token without the flag
    await saveConnection(h.kv.kv, h.key, conn({ expiresAt: new Date(T0 + 60 * 86400e3).toISOString() }));
    expect(await cronTick({ ...h.c(), now: () => new Date('2026-11-15T03:45:00Z') }, () => loadConnection(h.kv.kv, h.key))).toMatchObject({ status: 'success' });
  });
});
