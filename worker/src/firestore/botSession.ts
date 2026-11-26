/* =====================================================================
   SYNC BOT SESSION — the Worker's identity in Firestore.
   ---------------------------------------------------------------------
   A dedicated Firebase Auth user (email/password, credentials in Worker
   secrets) listed at syncBots/{uid}. firestore.rules let it write ONLY
   the Instagram fields of gallery posts, the connection status and the
   sync history: no customer, billing or admin data. No service-account
   key exists. The 1-hour ID token is cached in KV (encrypted), so a
   sign-in costs one request at most once an hour.
   ===================================================================== */
import type { Fetch } from '../budget.js';
import { emulatorHosts, type Env } from '../env.js';
import { decryptText, encryptText, type EncryptedValue } from '../instagram/tokenCrypto.js';
import { getJson, K, putJson } from '../store/kv.js';

export interface BotSession {
  token: string;
  uid: string;
}

export class BotSignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BotSignInError';
  }
}

export async function botSession(env: Env, key: CryptoKey, fetch: Fetch, now = Date.now()): Promise<BotSession> {
  const cached = await getJson<{ uid: string; exp: number; token: EncryptedValue }>(env.IG_KV, K.bot);
  if (cached && cached.exp - now > 5 * 60 * 1000) return { uid: cached.uid, token: await decryptText(cached.token, key) };

  const path = `identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`;
  const authEmulator = emulatorHosts(env).auth;
  const url = authEmulator ? `http://${authEmulator}/${path}` : `https://${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.SYNC_BOT_EMAIL, password: env.SYNC_BOT_PASSWORD, returnSecureToken: true }),
  });
  const b = (await res.json().catch(() => ({}))) as { idToken?: string; localId?: string; expiresIn?: string; error?: { message?: string } };
  // Firebase's code (e.g. INVALID_LOGIN_CREDENTIALS) only; never the email or password
  if (!res.ok || !b.idToken || !b.localId) throw new BotSignInError(`Sync Bot sign-in failed: ${String(b.error?.message || res.status).slice(0, 80)}`);
  const exp = now + Number(b.expiresIn || 3600) * 1000;
  await putJson(env.IG_KV, K.bot, { uid: b.localId, exp, token: await encryptText(b.idToken, key) }, 3600);
  return { uid: b.localId, token: b.idToken };
}
