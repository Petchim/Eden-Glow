import { describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from 'jose';
import { memoryKV, post, TEST_KEY_B64 } from './helpers.ts';
import { fingerprint, initialAdminFields, mapMedia, mediaDocId } from '../src/instagram/media.ts';
import { CacheTx, toCachedPost, type CachedPost } from '../src/cache/galleryCache.ts';
import { fromFields, toFields } from '../src/firestore/rest.ts';
import { decryptText, encryptText, importKey } from '../src/instagram/tokenCrypto.ts';
import { verifyFirebaseToken } from '../src/auth/ownerAuth.ts';
import { loadManifest, saveManifest } from '../src/store/kv.ts';
import { OWNER_CHANGES_PER_RUN, REFRESH_PAGE_SIZE, REVALIDATE_MAX } from '../src/sync/engine.ts';

/* CPU time of the Worker's own work per invocation, at 2,000 posts (the Free plan allows 10 ms;
   waiting for Instagram/Firestore/KV does not count). The real Worker code paths are timed
   against an in-memory KV (a Map: negligible); the fake Instagram/Firestore servers used by the
   other tests are NOT included, as they don't exist in the real Worker. Measured on this
   machine; confirm on Cloudflare's dashboard (Workers → Metrics → CPU time) after deploying. */
export const CPU_LIMIT_MS = 10;

/** Fastest of several batches: other processes on the test machine only ever add time. */
async function ms(fn: () => unknown | Promise<unknown>, reps = 20, batches = 5): Promise<number> {
  for (let i = 0; i < 5; i += 1) await fn(); // warm up (JIT)
  let best = Infinity;
  for (let b = 0; b < batches; b += 1) {
    const t0 = performance.now();
    for (let i = 0; i < reps; i += 1) await fn();
    best = Math.min(best, (performance.now() - t0) / reps);
  }
  return best;
}

const longUrl = (i: number) => `https://scontent-del1-1.cdninstagram.com/v/t51.29350-15/4${i}_n.jpg?stp=dst-jpg_e35&_nc_cat=103&ccb=1-7&_nc_sid=18de74&_nc_ohc=abcDEF&oh=00_AYD${i}xyz&oe=6745A1B2`;
const raw = (i: number) => post(`17841${String(i).padStart(10, '0')}`, { caption: 'Soft bridal glam for a winter wedding ✨ Skin prep, lashes and a rose-gold lip. Book via WhatsApp. #bridal #makeup #lashes', media_url: longUrl(i) });
const pageJson = JSON.stringify({ data: Array.from({ length: 50 }, (_, i) => raw(i)), paging: { cursors: { after: 'QVFIUnh' }, next: 'https://graph.instagram.com/next' } });
const cachedPost = (i: number): CachedPost => {
  const m = mapMedia(raw(i), 'acct')!;
  return { ...toCachedPost(mediaDocId(m.igId), { ...m, ...initialAdminFields(m) })!, sortOrder: 2e12 - i, featured: i % 50 === 0 };
};

async function measure(N: number) {
  {
    // a realistic KV state for 2,000 published posts
    const kv = memoryKV();
    const all = Array.from({ length: N }, (_, i) => cachedPost(i));
    const build = await CacheTx.open(kv.kv);
    for (const p of all) await build.upsert(p);
    await build.commit(new Date());
    await saveManifest(kv.kv, { accountId: 'acct', posts: new Map(all.map((p, i) => [p.id.slice(3), `fp${i}`])) });
    const key = await importKey(TEST_KEY_B64);
    const enc = await encryptText('IGQVJ'.padEnd(220, 'x'), key);
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k', alg: 'RS256' }] });
    const jwt = await new SignJWT({ sub: 'owner' }).setProtectedHeader({ alg: 'RS256', kid: 'k' }).setIssuer('https://securetoken.google.com/p').setAudience('p').setExpirationTime('1h').sign(privateKey);
    const seenCsv = all.map((p) => p.id.slice(3)).join(',');
    const firestoreDocs = (n: number) => JSON.stringify(all.slice(0, n).map((p) => ({ document: { name: `projects/p/databases/(default)/documents/galleryMedia/${p.id}`, fields: toFields({ ...p, status: 'published', available: true } as unknown as Record<string, unknown>) } })));
    const docs5 = firestoreDocs(5);

    const step = {
      decryptToken: await ms(() => decryptText(enc, key)),
      verifyOwnerToken: await ms(() => verifyFirebaseToken(jwt, { projectId: 'p', keys })),
      loadManifest2000: await ms(() => loadManifest(kv.kv, 'acct')),
      saveManifest2000: await ms(async () => saveManifest(kv.kv, (await loadManifest(kv.kv, 'acct'))!)),
      openCacheMeta2000: await ms(() => CacheTx.open(kv.kv)),
      seenState2000: await ms(() => new Set(seenCsv.split(',')).size + [...new Set(seenCsv.split(','))].join(',').length),
      instagramPage50: await ms(() => {
        for (const r of (JSON.parse(pageJson) as { data: ReturnType<typeof raw>[] }).data) fingerprint(mapMedia(r, 'acct')!);
      }),
      commitBody50: await ms(() => JSON.stringify({ writes: Array.from({ length: 50 }, (_, i) => ({ update: { name: 'x', fields: toFields({ ...mapMedia(raw(i), 'acct')! }) } })) })),
      firestoreRead5: await ms(() => (JSON.parse(docs5) as { document: { fields: never } }[]).map((d) => fromFields(d.document.fields))),
      // the real cache code: update one post, and five posts on different pages (load, change, write)
      cacheUpdate1: await ms(async () => {
        const tx = await CacheTx.open(kv.kv);
        await tx.upsert({ ...all[1000], caption: `c${Math.random()}` });
        await tx.commit(new Date());
      }),
      cacheUpdate5Pages: await ms(async () => {
        const tx = await CacheTx.open(kv.kv);
        for (const i of [10, 400, 800, 1200, 1600]) await tx.upsert({ ...all[i], caption: `c${Math.random()}` });
        await tx.commit(new Date());
      }, 15),
      // a refresh step where every post on the Instagram page is published with expiring links
      cacheRefreshStep: await ms(async () => {
        const tx = await CacheTx.open(kv.kv);
        for (let i = 600; i < 600 + REFRESH_PAGE_SIZE; i += 1) {
          const p = await tx.get(all[i].id);
          if (p) await tx.upsert({ ...p, mediaUrl: longUrl(i + Math.random()) });
        }
        await tx.commit(new Date());
      }, 15),
    };

    const runs = {
      // 96x/day: decrypt, manifest, one Instagram page, owner-change query (usually empty)
      quietCheck: step.decryptToken + step.loadManifest2000 + step.instagramPage50,
      // a new post: + write it, manifest, cache insert (meta + page + front)
      newPostCheck: step.decryptToken + step.loadManifest2000 + step.instagramPage50 + step.commitBody50 / 50 + step.saveManifest2000 + step.cacheUpdate1,
      // safety net applying the maximum owner changes on different pages
      ownerChangesCheck: step.decryptToken + step.loadManifest2000 + step.instagramPage50 + step.firestoreRead5 * (OWNER_CHANGES_PER_RUN / 5) + step.cacheUpdate5Pages,
      // worst refresh step: every post on the page (REFRESH_PAGE_SIZE) published and expiring
      refreshStepWorst: step.decryptToken + step.loadManifest2000 + (step.instagramPage50 + step.commitBody50) * (REFRESH_PAGE_SIZE / 50) + step.cacheRefreshStep,
      // the last step of a cycle also parses the cycle's seen list once and saves the fingerprint list
      refreshFinalStep: step.decryptToken + step.loadManifest2000 + (step.instagramPage50 + step.commitBody50) * (REFRESH_PAGE_SIZE / 50) + step.cacheRefreshStep + step.seenState2000 + step.saveManifest2000,
      // admin change notification with the maximum number of posts, links refreshed
      adminRevalidate: step.verifyOwnerToken + step.decryptToken + step.firestoreRead5 * (REVALIDATE_MAX / 5) + step.instagramPage50 / 10 + step.cacheUpdate5Pages,
    };
    const round = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));
    console.log(`[cpu-steps ${N}] ${JSON.stringify(round(step))}`);
    console.log(`[cpu-runs ${N}] ${JSON.stringify(round(runs))}`);
    return runs;
  }
}

describe('Worker CPU per invocation (Free plan: 10 ms)', () => {
  it('1,000 posts: every kind of run fits', async () => {
    for (const [name, v] of Object.entries(await measure(1000))) expect(v, name).toBeLessThan(CPU_LIMIT_MS);
  }, 300_000);
  it('2,000 posts: measured and reported (verify on the Cloudflare dashboard if the account grows this large)', async () => {
    const runs = await measure(2000);
    expect(runs.quietCheck).toBeLessThan(CPU_LIMIT_MS); // the check that runs 96 times a day
  }, 300_000);
});
