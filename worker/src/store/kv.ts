/* =====================================================================
   WORKER KV — private state, never in Firestore or the browser.
   ---------------------------------------------------------------------
   ig:token          Instagram long-lived token (AES-GCM encrypted) + account
   ig:state:<state>  one-time OAuth state, expires after 10 minutes
   ig:manifest       igId → fingerprint of every imported post (plain text)
   ig:refresh        position of a link refresh / import that is mid-way
   ig:refresh-due    set after connecting: run a full import next
   ig:manual         time of the last manual sync (30-second cooldown)
   bot:session       the Sync Bot's 1-hour Firebase session (encrypted)
   gallery:*         the public gallery cache (see cache/galleryCache.ts)
   Free plan: 1,000 KV writes/day, so nothing here is written unless it
   actually changed.
   ===================================================================== */
import type { KVLike } from '../env.js';
import { decryptText, encryptText, type EncryptedValue } from '../instagram/tokenCrypto.js';

export const K = {
  token: 'ig:token',
  state: (s: string) => `ig:state:${s}`,
  manifest: 'ig:manifest',
  refresh: 'ig:refresh',
  refreshDue: 'ig:refresh-due',
  manual: 'ig:manual',
  bot: 'bot:session',
} as const;

export async function getJson<T>(kv: KVLike, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
export const putJson = (kv: KVLike, key: string, value: unknown, ttl?: number) => kv.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : undefined);

/* ---------- Instagram connection ---------- */
export interface Connection {
  accessToken: string;
  accountId: string;
  username: string;
  accountType: string;
  /** When the token was issued or last refreshed (ISO). */
  refreshedAt: string;
  expiresAt: string | null;
  /** Instagram refused the token: stop syncing until the owner reconnects. */
  needsReconnect?: boolean;
}
interface StoredConnection extends Omit<Connection, 'accessToken'> {
  token: EncryptedValue;
}

export async function loadConnection(kv: KVLike, key: CryptoKey): Promise<Connection | null> {
  const s = await getJson<StoredConnection>(kv, K.token);
  if (!s) return null;
  const { token, ...rest } = s;
  return { ...rest, accessToken: await decryptText(token, key) };
}
export async function saveConnection(kv: KVLike, key: CryptoKey, c: Connection): Promise<void> {
  const { accessToken, ...rest } = c;
  await putJson(kv, K.token, { ...rest, token: await encryptText(accessToken, key) } satisfies StoredConnection);
}

/* ---------- OAuth state ---------- */
export interface OAuthState {
  uid: string;
  origin: string;
  expiresAt: string;
}
export const putState = (kv: KVLike, state: string, v: OAuthState) => putJson(kv, K.state(state), v, 600);
/** Read and delete: a state can be used once. */
export async function takeState(kv: KVLike, state: string): Promise<OAuthState | null> {
  const v = await getJson<OAuthState>(kv, K.state(state));
  if (v) await kv.delete(K.state(state));
  return v;
}

/* ---------- what has been imported ---------- */
export interface Manifest {
  accountId: string;
  /** igId → fingerprint */
  posts: Map<string, string>;
}
export const emptyManifest = (accountId: string): Manifest => ({ accountId, posts: new Map() });

/* Stored as plain text ("v2 <accountId>" then one "igId:fingerprint" per line): several times
   cheaper to parse than JSON, which matters on the 10 ms CPU budget for large accounts. */
export async function loadManifest(kv: KVLike, accountId: string): Promise<Manifest | null> {
  const raw = await kv.get(K.manifest);
  if (!raw) return null;
  const lines = raw.split('\n');
  if (lines[0] !== `v2 ${accountId}`) return null;
  const posts = new Map<string, string>();
  for (let i = 1; i < lines.length; i += 1) {
    const c = lines[i].indexOf(':');
    if (c > 0) posts.set(lines[i].slice(0, c), lines[i].slice(c + 1));
  }
  return { accountId, posts };
}
export function saveManifest(kv: KVLike, m: Manifest): Promise<void> {
  let s = `v2 ${m.accountId}`;
  for (const [id, fp] of m.posts) s += `\n${id}:${fp}`;
  return kv.put(K.manifest, s);
}

/* ---------- link refresh / full import, resumable ---------- */
export interface RefreshState {
  v: 2;
  cycleStartedAt: string;
  runId: string;
  trigger: string;
  /** Instagram cursor for the next page; null = start from the newest. */
  after: string | null;
  pages: number;
  /** igIds seen so far in this cycle, comma-separated (for removal detection at the end). */
  seen: string;
  counts: { fetched: number; created: number; updated: number; skipped: number };
}
