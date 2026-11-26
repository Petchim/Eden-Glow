import { describe, expect, it } from 'vitest';
import { harness, post, publicCache } from './helpers.ts';
import { cronTick, revalidate, runIncremental, runRefreshStep } from '../src/sync/engine.ts';
import { K, loadConnection, saveConnection, type Connection } from '../src/store/kv.ts';
import { SUBREQUEST_LIMIT } from '../src/budget.ts';

/* A simulated day against the real free-tier limits:
   Workers Free: 50 subrequests and 10 ms CPU per invocation, 100,000 requests/day;
   KV Free: 100,000 reads, 1,000 writes, 1,000 deletes per day;
   Firestore Spark: 50,000 reads, 20,000 writes, 20,000 deletes per day.
   Day = 288 cron runs (every 5 min from 00:00 UTC: 96 incremental checks + refresh steps when a
   cycle runs, 4 cycles/day), 3 new posts, 20 admin edits (each a revalidate call), Sync Bot
   sign-in at most hourly, 2,000 gallery visits (front + first page = 2 Worker requests, 2 KV reads). */
const DAY0 = Date.parse('2026-11-16T00:00:00Z');
const VISITS = 2000;

async function simulateDay(size: number, linkTtlHours: number) {
  let now = DAY0 - 12 * 3600e3;
  const posts = Array.from({ length: size }, (_, i) =>
    post(`p${i}`, { like_count: 50 + i, ...(i % 5 === 0 ? { media_type: 'VIDEO', media_product_type: 'REELS', media_url: undefined, thumbnail_url: `https://cdn.example/t${i}.jpg?sig=1` } : {}) }, DAY0 - (i + 13) * 3600e3),
  );
  const h = await harness(posts, { now: () => new Date(now), linkTtlHours });
  const conn: Connection = { accessToken: 'T', accountId: 'acct', username: 'edenglow', accountType: 'BUSINESS', refreshedAt: new Date(DAY0 - 86400e3).toISOString(), expiresAt: null };
  await saveConnection(h.kv.kv, h.key, conn);

  // Before the day: the complete first import (one page per step), then the owner hides a
  // quarter of the posts and the incremental checks apply those changes.
  await runIncremental(h.ctx(), conn);
  for (let guard = 0; h.kv.data.has(K.refresh) || h.kv.data.has(K.refreshDue); guard += 1) {
    h.nextRun();
    await runRefreshStep(h.ctx(), conn);
    if (guard > 500) throw new Error('import did not finish');
  }
  for (let i = 1; i < size; i += 4) h.fs.owner.set(`ig_p${i}`, { status: 'hidden' });
  while ((await runIncremental(h.ctx(), conn)) && Object.values(h.fs.docs).length >= 0) {
    h.nextRun();
    const pending = [...h.fs.docs.values()].filter((d) => d.status === 'hidden').length;
    if (publicCache(h.kv).front.total === size - pending) break;
  }
  h.nextRun();

  // Count from the start of the day.
  const fs0 = { ...h.fs.stats };
  const kv0 = { ...h.kv.stats };
  let botSignIns = 0;
  let botSessionUntil = 0;
  const perRun: { used: number; ms: number; kind: string; idle: boolean }[] = [];
  const invocation = async (kind: string, fn: () => Promise<unknown>) => {
    const t0 = performance.now();
    const result = (await fn()) as { skipped?: string };
    const ms = performance.now() - t0;
    const idle = result?.skipped === 'idle';
    if (!idle) {
      // the Sync Bot session lives in KV for an hour: sign-in = 1 subrequest + 1 KV write
      if (now > botSessionUntil - 5 * 60e3) (await h.budget().fetch('mem://bot-sign-in'), (botSessionUntil = now + 3600e3), botSignIns++, await h.kv.kv.put(K.bot, 'x'));
      else await h.kv.kv.get(K.bot);
    }
    perRun.push({ kind, used: h.nextRun(), ms, idle });
  };

  let edits = 0;
  for (let tick = 0; tick < 288; tick += 1) {
    now = DAY0 + tick * 5 * 60e3;
    if ([60, 150, 240].includes(tick)) h.ig.state.posts.unshift(post(`new${tick}`, {}, now - 60e3));
    // pessimistic engagement: before each refresh cycle a third of all posts gain 20% more likes
    if (tick % 72 === 0) h.ig.state.posts = h.ig.state.posts.map((p, i) => (i % 3 === (tick / 72) % 3 ? { ...p, like_count: Math.ceil((p.like_count ?? 0) * 1.2) + 5 } : p));
    await invocation('cron', () => cronTick(h.ctx(), () => loadConnection(h.kv.kv, h.key)));
    if (tick % 14 === 7 && edits < 20) {
      // an admin edit: alternately publish a hidden post (its links refreshed) and feature/reorder a published one
      edits += 1;
      const publishing = edits % 2 === 1;
      const id = publishing ? `ig_p${(edits * 4 + 1) % size}` : `ig_p${(edits * 4) % size}`;
      h.fs.owner.set(id, publishing ? { status: 'published' } : { featured: true, sortOrder: now });
      await invocation('admin', () => revalidate(h.ctx(), conn, [id], publishing));
    }
  }

  const work = perRun.filter((r) => !r.idle);
  const day = {
    posts: size,
    linkTtlHours,
    workerRequests: 288 + edits + VISITS * 2,
    busyRuns: work.length,
    maxSubrequestsPerRun: Math.max(...perRun.map((r) => r.used)),
    maxWallMsPerRunInclTestDoubles: Math.round(Math.max(...work.map((r) => r.ms)) * 10) / 10,
    kvReads: h.kv.stats.reads - kv0.reads + VISITS * 2,
    kvWrites: h.kv.stats.writes - kv0.writes,
    kvDeletes: h.kv.stats.deletes - kv0.deletes,
    fsReads: h.fs.stats.reads - fs0.reads,
    fsWrites: h.fs.stats.writes - fs0.writes,
    fsDeletes: h.fs.stats.deletes - fs0.deletes,
    botSignIns,
    publicFirestoreReads: 0,
    cachePages: publicCache(h.kv).front.pages.length,
  };
  return { day, h };
}

describe('a simulated day stays inside the free tiers', () => {
  for (const size of [200, 1000, 2000]) {
    for (const ttl of [72, 20]) {
      it(`${size} posts, links valid ${ttl} h${ttl < 24 ? ' (worst case: every published link rewritten each cycle)' : ''}`, async () => {
        const { day, h } = await simulateDay(size, ttl);
        console.log(`[budget] ${JSON.stringify(day)}`);
        expect(day.maxSubrequestsPerRun).toBeLessThanOrEqual(SUBREQUEST_LIMIT); // Workers Free: 50
        expect(day.workerRequests).toBeLessThan(100_000);
        expect(day.kvReads).toBeLessThan(100_000);
        expect(day.kvWrites).toBeLessThan(1_000);
        expect(day.kvDeletes).toBeLessThan(1_000);
        expect(day.fsReads).toBeLessThan(50_000);
        expect(day.fsWrites).toBeLessThan(20_000);
        expect(day.fsDeletes).toBeLessThan(20_000);
        // the 3 new posts arrived and are public (the owner's reordering may have put others above them)
        const onSite = new Set(publicCache(h.kv).items.map((p) => p.id));
        for (const t of [60, 150, 240]) {
          expect(h.fs.doc(`new${t}`)).toMatchObject({ status: 'published' });
          expect(onSite.has(`ig_new${t}`)).toBe(true);
        }
      }, 300_000);
    }
  }
});
