import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { JWKS_TIMEOUT_MS, requireOwner, verifyFirebaseToken } from '../src/auth/ownerAuth.ts';
import { HttpError } from '../src/http.ts';
import { FirestoreError, type FirestoreRest } from '../src/firestore/rest.ts';
import { handle, localDiag } from '../src/index.ts';
import type { Env } from '../src/env.ts';
import { memoryKV, TEST_KEY_B64 } from './helpers.ts';
import { FRONT_KEY } from '../src/cache/galleryCache.ts';
import { K } from '../src/store/kv.ts';

const PROJECT = 'eden-glow-studio';
let keys: ReturnType<typeof createLocalJWKSet>;
let sign: (claims: Record<string, unknown>, opts?: { iss?: string; aud?: string; exp?: string | number }) => Promise<string>;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  keys = createLocalJWKSet({ keys: [jwk] });
  sign = (claims, o = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(o.iss ?? `https://securetoken.google.com/${PROJECT}`)
      .setAudience(o.aud ?? PROJECT)
      .setIssuedAt()
      .setExpirationTime(o.exp ?? '1h')
      .sign(privateKey);
});

describe('Firebase ID token verification', () => {
  it('accepts a valid token for this project', async () => {
    expect(await verifyFirebaseToken(await sign({ sub: 'owner-uid' }), { projectId: PROJECT, keys })).toBe('owner-uid');
  });
  it('refuses another project, another issuer, an expired token, a token without a user, and garbage', async () => {
    const bad = [
      await sign({ sub: 'u' }, { aud: 'other-project' }),
      await sign({ sub: 'u' }, { iss: 'https://securetoken.google.com/other-project' }),
      await sign({ sub: 'u' }, { exp: Math.floor(Date.now() / 1000) - 60 }),
      await sign({}),
      'not.a.token',
    ];
    for (const t of bad) await expect(verifyFirebaseToken(t, { projectId: PROJECT, keys })).rejects.toBeInstanceOf(HttpError);
  });
  it('never accepts an unsigned (alg: none) token outside the emulator', async () => {
    const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'u', aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, exp: 9999999999 })}.`;
    await expect(verifyFirebaseToken(unsigned, { projectId: PROJECT, keys })).rejects.toBeInstanceOf(HttpError);
    expect(await verifyFirebaseToken(unsigned, { projectId: PROJECT, emulator: true })).toBe('u'); // local emulator only
  });
});

describe('owner check', () => {
  const fs = (admins: string[]): FirestoreRest => ({
    get: async (path: string) => (admins.some((a) => path === `admins/${a}`) ? { id: path, data: {} } : null),
    query: async () => [],
    batchGet: async () => new Map(),
    commit: async () => {},
  });
  const req = (token?: string) => new Request('https://w.example/instagram/sync', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
  it('lets the owner in, and nobody else', async () => {
    expect(await requireOwner(req(await sign({ sub: 'owner' })), fs(['owner']), { projectId: PROJECT, keys })).toBe('owner');
    await expect(requireOwner(req(await sign({ sub: 'customer' })), fs(['owner']), { projectId: PROJECT, keys })).rejects.toMatchObject({ status: 403 });
    await expect(requireOwner(req(), fs(['owner']), { projectId: PROJECT, keys })).rejects.toMatchObject({ status: 401 });
  });
});

/* Regression: under `wrangler dev`, Google's key download took 7.7 s (jose's default limit is 5 s) and
   the real owner was answered "session expired"; a slow Firestore read was answered "not authorised". */
describe('owner check on a slow or failing network', () => {
  const timeout = () => Object.assign(new Error('request timed out'), { code: 'ERR_JWKS_TIMEOUT' });
  const fsWith = (get: FirestoreRest['get']): FirestoreRest => ({ get, query: async () => [], batchGet: async () => new Map(), commit: async () => {} });
  const ownerDoc = fsWith(async (p) => (p === 'admins/owner' ? { id: 'owner', data: {} } : null));
  const req = (token: string) => new Request('http://127.0.0.1:8787/instagram/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });

  it('waits long enough for Google’s keys (not jose’s 5 s default)', () => {
    expect(JWKS_TIMEOUT_MS).toBeGreaterThanOrEqual(15_000);
  });
  it('retries once when Google’s keys time out, and then lets the owner in', async () => {
    let calls = 0;
    const flaky: typeof keys = (async (...a: Parameters<typeof keys>) => (++calls === 1 ? Promise.reject(timeout()) : keys(...a))) as typeof keys;
    expect(await requireOwner(req(await sign({ sub: 'owner' })), ownerDoc, { projectId: PROJECT, keys: flaky })).toBe('owner');
    expect(calls).toBe(2);
  });
  it('answers 503 "try again", not "session expired", when Google stays unreachable', async () => {
    const down = (async () => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof keys;
    await expect(requireOwner(req(await sign({ sub: 'owner' })), ownerDoc, { projectId: PROJECT, keys: down })).rejects.toMatchObject({ status: 503, code: 'unavailable' });
  });
  it('tells Firestore failures apart instead of calling every one "not authorised"', async () => {
    const token = await sign({ sub: 'owner' });
    const opts = { projectId: PROJECT, keys };
    const failing = (e: unknown) => fsWith(async () => Promise.reject(e));
    await expect(requireOwner(req(token), failing(new FirestoreError(401, 'x', 'UNAUTHENTICATED')), opts)).rejects.toMatchObject({ status: 401 });
    await expect(requireOwner(req(token), failing(new FirestoreError(503, 'x', 'UNAVAILABLE')), opts)).rejects.toMatchObject({ status: 503 });
    await expect(requireOwner(req(token), failing(new TypeError('network')), opts)).rejects.toMatchObject({ status: 503 });
    await expect(requireOwner(req(token), failing(new FirestoreError(403, 'x', 'PERMISSION_DENIED')), opts)).rejects.toMatchObject({ status: 403 });
    await expect(requireOwner(req(token), fsWith(async () => null), opts)).rejects.toMatchObject({ status: 403 });
  });
  it('local diagnostics name the stage, status and reason, and never contain the token', async () => {
    const lines: string[] = [];
    const diag = (stage: string, info: object) => lines.push(`${stage} ${JSON.stringify(info)}`);
    const token = await sign({ sub: 'owner' });
    await requireOwner(req(token), fsWith(async () => Promise.reject(new FirestoreError(503, 'x', 'UNAVAILABLE'))), { projectId: PROJECT, keys, diag }).catch(() => null);
    await requireOwner(req(token), ownerDoc, { projectId: PROJECT, keys, diag });
    const bad = await sign({ sub: 'owner' }, { aud: 'other-project' });
    await requireOwner(req(bad), ownerDoc, { projectId: PROJECT, keys, diag }).catch(() => null);
    expect(lines[0]).toMatch(/^admin-read-failed .*"status":503.*"reason":"UNAVAILABLE"/);
    expect(lines[0]).toContain('"database":"(default)"');
    expect(lines[1]).toMatch(/^owner-ok .*"uid":"owner"/);
    expect(lines[2]).toMatch(/^token-rejected .*"audienceMatches":false/);
    for (const l of lines) for (const t of [token, bad]) expect(l).not.toContain(t.split('.')[2]);
  });
  it('diagnostics are on only for wrangler dev (127.0.0.1 / localhost), never when deployed', () => {
    expect(localDiag(new Request('http://127.0.0.1:8787/instagram/sync'))).toBeTypeOf('function');
    expect(localDiag(new Request('http://localhost:8787/instagram/sync'))).toBeTypeOf('function');
    expect(localDiag(new Request('https://eden-glow-instagram.example.workers.dev/instagram/sync'))).toBeUndefined();
  });
});

describe('HTTP endpoints', () => {
  const env = (): Env & { kvm: ReturnType<typeof memoryKV> } => {
    const kvm = memoryKV();
    return {
      kvm, IG_KV: kvm.kv, FIREBASE_PROJECT_ID: PROJECT, FIREBASE_API_KEY: 'k', INSTAGRAM_APP_ID: 'APP', INSTAGRAM_REDIRECT_URI: 'https://w.example/instagram/callback',
      ADMIN_ORIGINS: 'https://edenglow.example', INSTAGRAM_APP_SECRET: 's', TOKEN_KEY: TEST_KEY_B64, SYNC_BOT_EMAIL: 'bot@example.com', SYNC_BOT_PASSWORD: 'p',
    };
  };
  afterEach(() => vi.unstubAllGlobals());

  it('serves the public gallery cache to anyone, cached for a minute, without touching Firestore', async () => {
    const e = env();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    let res = await handle(new Request('https://w.example/gallery.json'), e);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
    expect(await res.json()).toMatchObject({ pages: [], featured: [], total: 0 });
    await e.IG_KV.put(FRONT_KEY, '{"v":2,"total":1,"pages":["p0"],"featured":[]}');
    await e.IG_KV.put('gallery:page:p0', '{"v":2,"id":"p0","items":[{"id":"ig_1"}]}');
    res = await handle(new Request('https://w.example/gallery.json'), e);
    expect(((await res.json()) as { pages: string[] }).pages).toEqual(['p0']);
    res = await handle(new Request('https://w.example/gallery/page/p0'), e);
    expect(((await res.json()) as { items: { id: string }[] }).items[0].id).toBe('ig_1');
    expect((await handle(new Request('https://w.example/gallery/page/p7'), e)).status).toBe(404);
    expect((await handle(new Request('https://w.example/gallery/page/meta'), e)).status).toBe(404);
    expect((await handle(new Request('https://w.example/gallery/page/..%2Fmeta'), e)).status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('owner endpoints refuse other websites, answer the allowed one’s preflight, and require sign-in', async () => {
    const e = env();
    const fromEvil = new Request('https://w.example/instagram/sync', { method: 'POST', headers: { Origin: 'https://evil.example' } });
    expect((await handle(fromEvil, e)).status).toBe(403);
    const pre = await handle(new Request('https://w.example/instagram/sync', { method: 'OPTIONS', headers: { Origin: 'https://edenglow.example' } }), e);
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('https://edenglow.example');
    const noToken = await handle(new Request('https://w.example/instagram/sync', { method: 'POST', headers: { Origin: 'https://edenglow.example' } }), e);
    expect(noToken.status).toBe(401);
    expect(await noToken.json()).toMatchObject({ error: { code: 'unauthenticated' } });
  });

  it('the Instagram callback refuses forged, reused and expired states', async () => {
    const e = env();
    expect((await handle(new Request('https://w.example/instagram/callback?state=../x&code=c'), e)).status).toBe(400);
    const s = 'A'.repeat(32);
    expect((await handle(new Request(`https://w.example/instagram/callback?state=${s}&code=c`), e)).status).toBe(400); // unknown
    await e.IG_KV.put(K.state(s), JSON.stringify({ uid: 'owner', origin: 'https://edenglow.example', expiresAt: new Date(Date.now() - 1000).toISOString() }));
    const expired = await handle(new Request(`https://w.example/instagram/callback?state=${s}&code=c`), e);
    expect(expired.status).toBe(303);
    expect(expired.headers.get('Location')).toBe('https://edenglow.example/admin/gallery?instagram=expired');
    expect((await handle(new Request(`https://w.example/instagram/callback?state=${s}&code=c`), e)).status).toBe(400); // used once
  });

  it('a cancelled Instagram approval returns the owner to the admin without any token exchange', async () => {
    const e = env();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const s = 'B'.repeat(32);
    await e.IG_KV.put(K.state(s), JSON.stringify({ uid: 'owner', origin: 'https://edenglow.example', expiresAt: new Date(Date.now() + 60000).toISOString() }));
    const res = await handle(new Request(`https://w.example/instagram/callback?state=${s}&error=access_denied`), e);
    expect(res.headers.get('Location')).toBe('https://edenglow.example/admin/gallery?instagram=denied');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports missing configuration by name only', async () => {
    const e = { ...env(), TOKEN_KEY: '', SYNC_BOT_PASSWORD: '' };
    const res = await handle(new Request('https://w.example/instagram/sync', { method: 'POST', headers: { Origin: 'https://edenglow.example' } }), e);
    expect(res.status).toBe(503);
    const body = JSON.stringify(await res.json());
    expect(body).toContain('TOKEN_KEY');
    expect(body).not.toContain('bot@example.com');
  });
});
