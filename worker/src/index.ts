/* =====================================================================
   EDEN GLOW — INSTAGRAM WORKER (Cloudflare Workers, Free plan)
   ---------------------------------------------------------------------
   Public:
     GET  /gallery.json              front: total, page ids in order, featured posts
     GET  /gallery/page/<id>         one page of published posts (≈50)
   Owner only (Firebase ID token + admins/{uid}; CORS: ADMIN_ORIGINS):
     POST /instagram/connect         → Instagram approval URL
     POST /instagram/disconnect
     POST /instagram/sync            { retryOf?, full? }  "Sync now" / "Retry"
     POST /gallery/revalidate        { ids (≤5), refreshLinks? } after admin changes
   Instagram redirect:
     GET  /instagram/callback        ?code&state
   Cron (wrangler.toml): every 5 minutes → engine.cronTick (incremental
   check at :00/:15/:30/:45; refresh/import steps in between when due).
   No Instagram token, bot credential or secret is ever returned.
   ===================================================================== */
import { createBudget, type Budget } from './budget.js';
import { emulatorHosts, OAUTH_CONFIG, SYNC_CONFIG, missingConfig, type Env } from './env.js';
import { adminCors, errorResponse, HttpError, json, PUBLIC_CORS, readJson, SECURITY_HEADERS } from './http.js';
import { requireOwner, type AuthDiag } from './auth/ownerAuth.js';
import { createFirestoreRest } from './firestore/rest.js';
import { botSession, type BotSession } from './firestore/botSession.js';
import { createRestRepo } from './firestore/galleryRepo.js';
import { createGraphClient } from './instagram/graph.js';
import { importKey } from './instagram/tokenCrypto.js';
import { allowedOrigin, isStateShaped, newState, parseOrigins, returnUrl, STATE_TTL_MS, type ConnectResult } from './instagram/oauth.js';
import { FRONT_KEY, isPageId, pageKey } from './cache/galleryCache.js';
import { K, loadConnection, loadManifest, putState, saveConnection, takeState, type Connection } from './store/kv.js';
import { classify, cronTick, disconnect, manualSync, revalidate, REVALIDATE_MAX, runRefreshStep, SyncError, type SyncContext } from './sync/engine.js';

interface ExecutionCtx {
  waitUntil(p: Promise<unknown>): void;
}

const EMPTY_FRONT = '{"v":2,"builtAt":null,"total":0,"pages":[],"featured":[]}';

/** Everything a request or cron run needs, sharing one request budget. */
export async function makeContext(env: Env, budget: Budget) {
  const key = await importKey(env.TOKEN_KEY);
  const fs = createFirestoreRest({ projectId: env.FIREBASE_PROJECT_ID, emulatorHost: emulatorHosts(env).firestore, fetch: budget.fetch });
  let bot: Promise<BotSession> | null = null;
  const repo = createRestRepo(fs, () => (bot ??= botSession(env, key, budget.fetch)).then((b) => b.token));
  const graph = createGraphClient({ appId: env.INSTAGRAM_APP_ID || '', appSecret: env.INSTAGRAM_APP_SECRET || '', redirectUri: env.INSTAGRAM_REDIRECT_URI || '', fetch: budget.fetch });
  const ctx: SyncContext = { kv: env.IG_KV, repo, graph, budget, key };
  return { ctx, fs, key };
}

const syncStatus = (e: SyncError) => ({ 'not-connected': 409, 'needs-reconnect': 409, 'too-soon': 429, 'rate-limited': 429, 'instagram-error': 502, firestore: 502, 'bot-sign-in': 502, internal: 500 })[e.code];

function requireConfig(env: Env, keys: (keyof Env)[]) {
  const missing = missingConfig(env, keys);
  if (missing.length) throw new HttpError(503, 'not-configured', `The Instagram service is not configured yet (missing: ${missing.join(', ')}).`);
}

/* ---------- public gallery cache ---------- */
async function serveCache(env: Env, key: string): Promise<Response> {
  const body = (await env.IG_KV.get(key)) ?? (key === FRONT_KEY ? EMPTY_FRONT : null);
  if (body === null) return json({ error: { code: 'not-found', message: 'Not found.' } }, 404, PUBLIC_CORS);
  return new Response(body, {
    headers: { ...SECURITY_HEADERS, ...PUBLIC_CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
  });
}

/* ---------- Instagram redirect ---------- */
async function callback(request: Request, env: Env): Promise<Response> {
  const plain = (status: number, text: string) => new Response(text, { status, headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  requireConfig(env, OAUTH_CONFIG);
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  if (!isStateShaped(state)) return plain(400, 'This Instagram link is not valid. Return to the Eden Glow admin and press "Connect Instagram" again.');
  const saved = await takeState(env.IG_KV, state);
  const origin = saved && allowedOrigin(saved.origin, parseOrigins(env.ADMIN_ORIGINS));
  if (!saved || !origin) return plain(400, 'This Instagram link has already been used or has expired. Return to the Eden Glow admin and press "Connect Instagram" again.');
  const back = (r: ConnectResult) => new Response(null, { status: 303, headers: { ...SECURITY_HEADERS, Location: returnUrl(origin, r), 'Cache-Control': 'no-store' } });
  if (Date.parse(saved.expiresAt) < Date.now()) return back('expired');
  const code = url.searchParams.get('code');
  if (url.searchParams.get('error') || !code) return back('denied'); // the owner pressed "Cancel"

  const { ctx, key } = await makeContext(env, createBudget());
  try {
    const short = await ctx.graph.exchangeCode(code);
    const long = await ctx.graph.longLived(short.accessToken);
    const profile = await ctx.graph.profile(long.accessToken);
    if (!['BUSINESS', 'MEDIA_CREATOR', 'CREATOR'].includes(profile.accountType.toUpperCase()) || !profile.userId) return back('not-business');

    const now = new Date();
    const previous = await loadConnection(env.IG_KV, key).catch(() => null);
    const conn: Connection = {
      accessToken: long.accessToken, accountId: profile.userId, username: profile.username, accountType: profile.accountType,
      refreshedAt: now.toISOString(), expiresAt: long.expiresIn ? new Date(now.getTime() + long.expiresIn * 1000).toISOString() : null,
    };
    await saveConnection(env.IG_KV, key, conn);
    if (previous && previous.accountId !== conn.accountId) {
      // A different account: its posts leave the site; the new account is imported from scratch.
      const old = await loadManifest(env.IG_KV, previous.accountId);
      if (old) await ctx.repo.markUnavailable([...old.posts.keys()], now);
      await env.IG_KV.delete(K.manifest);
      await env.IG_KV.delete(K.refresh);
    }
    await ctx.repo.writeStatus({
      connected: true, accountId: conn.accountId, username: conn.username, accountType: conn.accountType, connectedAt: now.toISOString(),
      tokenRefreshedAt: conn.refreshedAt, tokenExpiresAt: conn.expiresAt, needsReconnect: false, lastError: null,
    });
    await env.IG_KV.put(K.refreshDue, '1');
    // First import now, as far as this request's budget allows; the cron continues it within 15 minutes.
    await runRefreshStep(ctx, conn, 'connect').catch(() => null);
    return back('connected');
  } catch (e) {
    console.error('Instagram connection failed', classify(e).code);
    return back('error');
  }
}

/* ---------- owner endpoints ---------- */
/** Owner-check diagnostics for `wrangler dev` only (requests to 127.0.0.1 / localhost). Logs the
    stage, HTTP status and reason code: never the token, password or any secret. Off when deployed. */
export function localDiag(request: Request): AuthDiag | undefined {
  const host = new URL(request.url).hostname;
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(host)) return undefined;
  return (stage, info) => console.log(`[owner-auth] ${stage} ${JSON.stringify(info)}`);
}

async function ownerRoute(request: Request, env: Env, path: string, cors: Record<string, string>): Promise<Response> {
  requireConfig(env, path === '/instagram/connect' ? OAUTH_CONFIG : SYNC_CONFIG);
  const budget = createBudget();
  const { ctx, fs, key } = await makeContext(env, budget);
  const emulator = !!emulatorHosts(env).auth; // never true for the real project
  const uid = await requireOwner(request, fs, { projectId: env.FIREBASE_PROJECT_ID, emulator, diag: localDiag(request) });
  const conn = await loadConnection(env.IG_KV, key);

  if (path === '/instagram/connect') {
    const body = await readJson<{ returnTo?: unknown }>(request);
    const origin = allowedOrigin(body.returnTo, parseOrigins(env.ADMIN_ORIGINS));
    if (!origin) throw new HttpError(400, 'invalid-argument', 'This admin address is not on the ADMIN_ORIGINS list for Instagram connections.');
    const state = newState();
    await putState(env.IG_KV, state, { uid, origin, expiresAt: new Date(Date.now() + STATE_TTL_MS).toISOString() });
    return json({ url: ctx.graph.authorizeUrl(state) }, 200, cors);
  }
  if (path === '/instagram/disconnect') {
    const hidden = await disconnect(ctx, conn);
    return json({ ok: true, hidden }, 200, cors);
  }
  if (path === '/instagram/sync') {
    const body = await readJson<{ retryOf?: unknown; full?: unknown }>(request);
    const retryOf = typeof body.retryOf === 'string' && /^run_[a-z0-9]{6,30}$/.test(body.retryOf) ? body.retryOf : null;
    try {
      const run = await manualSync(ctx, conn, { retryOf, full: body.full === true });
      return json(run, 200, cors);
    } catch (e) {
      const err = classify(e);
      throw new HttpError(syncStatus(err), err.code, err.message);
    }
  }
  if (path === '/gallery/revalidate') {
    const body = await readJson<{ ids?: unknown; refreshLinks?: unknown }>(request);
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string' && /^ig_[A-Za-z0-9_]{1,64}$/.test(x)).slice(0, REVALIDATE_MAX) : [];
    if (!ids.length) throw new HttpError(400, 'invalid-argument', 'No posts to update.');
    return json(await revalidate(ctx, conn, ids, body.refreshLinks === true), 200, cors);
  }
  if (path === '/api/media/upload') {
    if (!env.MEDIA_BUCKET) throw new HttpError(503, 'not-configured', 'Cloudflare R2 MEDIA_BUCKET binding is not configured.');
    const storageKey = request.headers.get('X-Storage-Key') || '';
    if (!storageKey || !/^gallery\/(images|videos)\/[A-Za-z0-9_.-]+$/.test(storageKey)) {
      throw new HttpError(400, 'invalid-key', 'Invalid or missing storage key.');
    }
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
    await env.MEDIA_BUCKET.put(storageKey, request.body, {
      httpMetadata: { contentType },
    });
    return json({ ok: true, storageKey }, 200, cors);
  }
  if (path === '/api/media/delete') {
    if (!env.MEDIA_BUCKET) throw new HttpError(503, 'not-configured', 'Cloudflare R2 MEDIA_BUCKET binding is not configured.');
    const body = await readJson<{ storageKey?: unknown }>(request);
    const storageKey = typeof body.storageKey === 'string' ? body.storageKey : '';
    if (!storageKey || !/^gallery\/(images|videos)\/[A-Za-z0-9_.-]+$/.test(storageKey)) {
      throw new HttpError(400, 'invalid-key', 'Invalid storage key.');
    }
    await env.MEDIA_BUCKET.delete(storageKey);
    return json({ ok: true }, 200, cors);
  }
  throw new HttpError(404, 'not-found', 'Not found.');
}

const OWNER_PATHS = ['/instagram/connect', '/instagram/disconnect', '/instagram/sync', '/gallery/revalidate', '/api/media/upload', '/api/media/delete'];

export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  try {
    if (path === '/gallery.json' || path.startsWith('/gallery/page/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: PUBLIC_CORS });
      if (request.method !== 'GET') throw new HttpError(405, 'method', 'Method not allowed.');
      if (path === '/gallery.json') return serveCache(env, FRONT_KEY);
      const id = path.slice('/gallery/page/'.length);
      if (!isPageId(id)) throw new HttpError(404, 'not-found', 'Not found.');
      return serveCache(env, pageKey(id));
    }
    if (path === '/instagram/callback' && request.method === 'GET') return await callback(request, env);
    if (OWNER_PATHS.includes(path)) {
      const cors = adminCors(request, env.ADMIN_ORIGINS || '');
      if (!cors) return json({ error: { code: 'forbidden-origin', message: 'This website is not allowed to use the Instagram service.' } }, 403);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (request.method !== 'POST') throw new HttpError(405, 'method', 'Method not allowed.');
      try {
        return await ownerRoute(request, env, path, cors);
      } catch (e) {
        if (e instanceof HttpError) return errorResponse(e, cors);
        console.error('Owner request failed', classify(e).code);
        return errorResponse(new HttpError(500, 'internal', 'Something went wrong. Please try again.'), cors);
      }
    }
    throw new HttpError(404, 'not-found', 'Not found.');
  } catch (e) {
    if (e instanceof HttpError) return errorResponse(e);
    console.error('Request failed', classify(e).code);
    return errorResponse(new HttpError(500, 'internal', 'Something went wrong.'));
  }
}

/** The 5-minute cron. */
export async function scheduledRun(env: Env): Promise<unknown> {
  if (missingConfig(env, SYNC_CONFIG).length) return { skipped: 'not-configured' };
  const { ctx, key } = await makeContext(env, createBudget());
  const result = await cronTick(ctx, () => loadConnection(env.IG_KV, key));
  if ('status' in result && result.status === 'failed') console.warn('Scheduled sync failed', result.error?.code);
  return result;
}

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
  scheduled: (_controller: unknown, env: Env, ctx: ExecutionCtx) => ctx.waitUntil(scheduledRun(env)),
};
