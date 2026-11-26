import { describe, expect, it } from 'vitest';
import { fingerprint, initialAdminFields, mapMedia } from '../src/instagram/media.ts';
import { decryptText, encryptText, importKey, toBase64 } from '../src/instagram/tokenCrypto.ts';
import { allowedOrigin, isStateShaped, newState, parseOrigins, returnUrl } from '../src/instagram/oauth.ts';
import { CacheTx, likesChanged, linkExpiry, linksExpireBefore, pageKey, PAGE_MAX, toCachedPost, type CachedPost, type GalleryPage } from '../src/cache/galleryCache.ts';
import { fromFields, toFields } from '../src/firestore/rest.ts';
import { createBudget, BudgetExceeded } from '../src/budget.ts';
import { memoryKV, publicCache, TEST_KEY_B64 } from './helpers.ts';
import { getJson, K, loadConnection, loadManifest, saveConnection, saveManifest } from '../src/store/kv.ts';
import { emulatorHosts, type Env } from '../src/env.ts';
import { handle } from '../src/index.ts';

const rnd = (n: number) => toBase64(crypto.getRandomValues(new Uint8Array(n)));

describe('mapMedia', () => {
  const base = { id: '1', media_type: 'IMAGE', permalink: 'https://www.instagram.com/p/1/', media_url: 'https://cdn.example/1.jpg', timestamp: '2026-11-01T10:00:00+0000' };
  it('keeps Instagram fields only, with safe URLs', () => {
    const m = mapMedia(base, 'acct')!;
    expect(m).toMatchObject({ source: 'instagram', igId: '1', accountId: 'acct', kind: 'image', productType: 'FEED', isReel: false, mediaUrl: 'https://cdn.example/1.jpg', thumbnailUrl: 'https://cdn.example/1.jpg', available: true });
    expect(m.takenAt).toBe('2026-11-01T10:00:00.000Z');
    expect(Object.keys(m)).not.toContain('status');
  });
  it('rejects posts without an instagram.com permalink and drops non-https or javascript: URLs', () => {
    expect(mapMedia({ ...base, permalink: 'javascript:alert(1)' }, 'a')).toBeNull();
    expect(mapMedia({ ...base, permalink: 'https://instagram.com.evil.example/p/1' }, 'a')).toBeNull();
    expect(mapMedia({ ...base, media_url: 'javascript:alert(1)' }, 'a')!.mediaUrl).toBeNull();
    expect(mapMedia({ ...base, id: '' }, 'a')).toBeNull();
  });
  it('a video without a file (licensed audio) is still kept, with its cover', () => {
    const m = mapMedia({ ...base, media_type: 'VIDEO', media_product_type: 'REELS', media_url: undefined, thumbnail_url: 'https://cdn.example/t.jpg' }, 'a')!;
    expect(m).toMatchObject({ kind: 'video', isReel: true, mediaUrl: null, thumbnailUrl: 'https://cdn.example/t.jpg' });
  });
  it('new posts are published by default (hidden with auto-publish off), ordered by post time', () => {
    const m = mapMedia(base, 'a')!;
    expect(initialAdminFields(m)).toEqual({ status: 'published', category: null, featured: false, altText: '', sortOrder: Date.parse('2026-11-01T10:00:00Z') });
    expect(initialAdminFields(m, false).status).toBe('hidden');
  });
});

describe('like counts', () => {
  const base = { id: '1', media_type: 'IMAGE', permalink: 'https://www.instagram.com/p/1/', media_url: 'https://cdn.example/1.jpg' };
  it('keeps only a real, non-negative count from Instagram', () => {
    expect(mapMedia({ ...base, like_count: 42 }, 'a')!.likeCount).toBe(42);
    expect(mapMedia(base, 'a')!.likeCount).toBeNull();
    expect(mapMedia({ ...base, like_count: -3 }, 'a')!.likeCount).toBeNull();
  });
  it('does not change the fingerprint (likes alone never cause a Firestore write)', () => {
    expect(fingerprint(mapMedia({ ...base, like_count: 1 }, 'a')!)).toBe(fingerprint(mapMedia({ ...base, like_count: 999 }, 'a')!));
  });
  it('updates the public count only on a noticeable change', () => {
    expect(likesChanged(100, 103)).toBe(false);
    expect(likesChanged(100, 110)).toBe(true);
    expect(likesChanged(2, 7)).toBe(true);
    expect(likesChanged(null, 5)).toBe(true);
    expect(likesChanged(5, null)).toBe(true);
  });
});

describe('fingerprint (what decides a write)', () => {
  const base = { id: '1', media_type: 'IMAGE', permalink: 'https://www.instagram.com/p/1/', media_url: 'https://cdn.example/1.jpg?sig=1', timestamp: '2026-11-01T10:00:00Z', caption: 'Hi' };
  it('ignores re-signed file links but changes with the caption, type or slides', () => {
    const fp = fingerprint(mapMedia(base, 'a')!);
    expect(fingerprint(mapMedia({ ...base, media_url: 'https://cdn.example/1.jpg?sig=2' }, 'a')!)).toBe(fp);
    expect(fingerprint(mapMedia({ ...base, caption: 'Hello' }, 'a')!)).not.toBe(fp);
    expect(fingerprint(mapMedia({ ...base, media_type: 'VIDEO' }, 'a')!)).not.toBe(fp);
  });
});

describe('token encryption (Web Crypto, AES-256-GCM)', () => {
  it('round-trips and never stores the token in the clear', async () => {
    const key = await importKey(rnd(32));
    const enc = await encryptText('IGQVJ-secret-token', key);
    expect(JSON.stringify(enc)).not.toContain('IGQVJ');
    expect(await decryptText(enc, key)).toBe('IGQVJ-secret-token');
    expect((await encryptText('same', key)).iv).not.toBe((await encryptText('same', key)).iv);
  });
  it('detects tampering and the wrong key', async () => {
    const key = await importKey(rnd(32));
    const enc = await encryptText('token', key);
    const bytes = Uint8Array.from(atob(enc.data), (c) => c.charCodeAt(0));
    bytes[0] ^= 1;
    await expect(decryptText({ ...enc, data: toBase64(bytes) }, key)).rejects.toThrow();
    await expect(decryptText(enc, await importKey(rnd(32)))).rejects.toThrow();
  });
  it('insists on a 32-byte key', async () => {
    await expect(importKey('short')).rejects.toThrow(/32 random bytes/);
  });
  it('the Instagram connection in KV holds only ciphertext', async () => {
    const key = await importKey(TEST_KEY_B64);
    const { kv, data } = memoryKV();
    await saveConnection(kv, key, { accessToken: 'IGQVJ-very-secret', accountId: 'a', username: 'u', accountType: 'BUSINESS', refreshedAt: 'x', expiresAt: null });
    expect(data.get(K.token)).not.toContain('IGQVJ');
    expect((await loadConnection(kv, key))!.accessToken).toBe('IGQVJ-very-secret');
    expect(await getJson(kv, 'missing')).toBeNull();
  });
});

describe('oauth helpers', () => {
  it('state is random and URL-safe', () => {
    const a = newState();
    expect(isStateShaped(a)).toBe(true);
    expect(newState()).not.toBe(a);
    expect(isStateShaped('../../etc')).toBe(false);
  });
  it('returns only to allow-listed admin origins', () => {
    const allowed = parseOrigins(' https://edenglow.example ,http://localhost:5173, not a url');
    expect(allowed).toEqual(['https://edenglow.example', 'http://localhost:5173']);
    expect(allowedOrigin('https://edenglow.example/admin/gallery', allowed)).toBe('https://edenglow.example');
    expect(allowedOrigin('https://evil.example', allowed)).toBeNull();
    expect(allowedOrigin('https://edenglow.example.evil.example', allowed)).toBeNull();
    expect(allowedOrigin(undefined, allowed)).toBeNull();
    expect(returnUrl('https://edenglow.example', 'connected')).toBe('https://edenglow.example/admin/gallery?instagram=connected');
  });
});

describe('public cache', () => {
  const p = (i: number, over: Partial<CachedPost> = {}): CachedPost => ({
    id: `ig_${i}`, kind: 'image', isReel: false, mediaUrl: null, thumbnailUrl: null, permalink: 'https://www.instagram.com/p/x/', caption: '', takenAt: '',
    children: [], category: null, featured: false, altText: '', sortOrder: 10000 - i, likeCount: null, ...over,
  });
  it('contains only published, available posts and no private fields', () => {
    const doc = { status: 'published', available: true, kind: 'image', accountId: 'SECRET_ACCOUNT', igId: '1', permalink: 'https://www.instagram.com/p/1/', sortOrder: 1 };
    const c = toCachedPost('ig_1', doc)!;
    expect(JSON.stringify(c)).not.toContain('SECRET_ACCOUNT');
    expect(toCachedPost('ig_1', { ...doc, status: 'hidden' })).toBeNull();
    expect(toCachedPost('ig_1', { ...doc, available: false })).toBeNull();
  });
  it('splits pages as they grow and keeps every post exactly once, in order', async () => {
    const kv = memoryKV();
    const tx = await CacheTx.open(kv.kv);
    for (let i = 0; i < 500; i += 1) await tx.upsert(p(i, i === 400 ? { featured: true } : {}));
    await tx.commit(new Date());
    const { front, items } = publicCache(kv);
    expect(front.total).toBe(500);
    expect(items.map((x) => x.id)).toEqual(Array.from({ length: 500 }, (_, i) => `ig_${i}`));
    expect(front.featured.map((x) => x.id)).toEqual(['ig_400']);
    for (const id of front.pages) expect(kv.json<GalleryPage>(pageKey(id))!.items.length).toBeLessThanOrEqual(PAGE_MAX);
  });
  it('one change rewrites only the page that holds the post', async () => {
    const kv = memoryKV();
    const tx = await CacheTx.open(kv.kv);
    for (let i = 0; i < 300; i += 1) await tx.upsert(p(i));
    await tx.commit(new Date());
    const before = kv.stats.writes;
    const tx2 = await CacheTx.open(kv.kv);
    await tx2.upsert(p(150, { caption: 'new caption' }));
    await tx2.commit(new Date());
    expect(kv.stats.writes - before).toBe(1);
  });
  it('reads the Instagram link expiry (oe) and treats links without one as expiring', () => {
    const at = Date.parse('2026-11-20T00:00:00Z');
    const url = `https://scontent.cdninstagram.com/x.jpg?stp=1&oe=${Math.floor(at / 1000).toString(16).toUpperCase()}&_nc_sid=1`;
    expect(linkExpiry(url)).toBe(at);
    expect(linkExpiry('https://cdn.example/x.jpg')).toBeNull();
    expect(linksExpireBefore({ mediaUrl: url, thumbnailUrl: null, children: [] }, at - 1)).toBe(false);
    expect(linksExpireBefore({ mediaUrl: url, thumbnailUrl: null, children: [] }, at + 1)).toBe(true);
    expect(linksExpireBefore({ mediaUrl: 'https://cdn.example/no-expiry.jpg', thumbnailUrl: null, children: [] }, 0)).toBe(true);
  });
  it('the fingerprint list round-trips in its compact form', async () => {
    const kv = memoryKV();
    await saveManifest(kv.kv, { accountId: 'acct', posts: new Map([['17841', 'ab1'], ['17842', 'cd2']]) });
    expect([...(await loadManifest(kv.kv, 'acct'))!.posts]).toEqual([['17841', 'ab1'], ['17842', 'cd2']]);
    expect(await loadManifest(kv.kv, 'other-account')).toBeNull();
  });
});

describe('Firestore value encoding', () => {
  it('round-trips the shapes the sync writes', () => {
    const o = { s: 'x', n: 1731700000000, f: 1.5, b: true, z: null, a: [1, 'two'], m: { k: 'v' } };
    expect(fromFields(toFields(o))).toEqual(o);
    expect(toFields({ n: 1731700000000 }).n).toEqual({ integerValue: '1731700000000' });
  });
});

describe('production safety', () => {
  const env = (over: Partial<Env>) => ({ FIREBASE_PROJECT_ID: 'eden-glow-studio', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', AUTH_EMULATOR_HOST: '127.0.0.1:9099', ...over }) as Env;
  it('emulator shortcuts are ignored for the real project, even if set by mistake', () => {
    expect(emulatorHosts(env({}))).toEqual({ firestore: undefined, auth: undefined });
  });
  it('they work only for a demo- project on this machine', () => {
    expect(emulatorHosts(env({ FIREBASE_PROJECT_ID: 'demo-eden-glow' }))).toEqual({ firestore: '127.0.0.1:8080', auth: '127.0.0.1:9099' });
    expect(emulatorHosts(env({ FIREBASE_PROJECT_ID: 'demo-eden-glow', AUTH_EMULATOR_HOST: 'evil.example:9099' })).auth).toBeUndefined();
  });
  it('every Worker response forbids framing and active content', async () => {
    const kv = memoryKV();
    const res = await handle(new Request('https://w.example/gallery.json'), { IG_KV: kv.kv } as unknown as Env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const missing = await handle(new Request('https://w.example/nothing'), { IG_KV: kv.kv } as unknown as Env);
    expect(missing.status).toBe(404);
    expect(missing.headers.get('X-Frame-Options')).toBe('DENY');
  });
});

describe('request budget', () => {
  it('refuses to go past the limit', async () => {
    const b = createBudget(2, async () => new Response('{}'));
    await b.fetch('a');
    await b.fetch('b');
    expect(b.remaining()).toBe(0);
    await expect(b.fetch('c')).rejects.toBeInstanceOf(BudgetExceeded);
  });
});
