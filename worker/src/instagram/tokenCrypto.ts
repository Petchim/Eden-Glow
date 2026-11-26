/* =====================================================================
   TOKEN ENCRYPTION — AES-256-GCM via Web Crypto (Workers and Node).
   ---------------------------------------------------------------------
   The Instagram access token (and the Sync Bot's short-lived Firebase
   session) are stored only in Workers KV, encrypted with TOKEN_KEY, a
   Worker secret. KV alone never reveals a usable token, and nothing
   here is ever written to Firestore or sent to the browser.
   ===================================================================== */

export interface EncryptedValue {
  v: 2;
  /** 12-byte IV, base64. */
  iv: string;
  /** Ciphertext with the GCM tag appended, base64. */
  data: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}
export const toBase64Url = (bytes: Uint8Array): string => toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const keys = new Map<string, Promise<CryptoKey>>();

/** TOKEN_KEY is 32 random bytes, base64-encoded (`openssl rand -base64 32`). */
export function importKey(secret: string): Promise<CryptoKey> {
  const s = String(secret || '').trim();
  let k = keys.get(s);
  if (!k) {
    let raw: Uint8Array;
    try {
      raw = fromBase64(s);
    } catch {
      raw = new Uint8Array(0);
    }
    if (raw.length !== 32) return Promise.reject(new Error('TOKEN_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32).'));
    k = crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    keys.set(s, k);
  }
  return k;
}

export async function encryptText(text: string, key: CryptoKey): Promise<EncryptedValue> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)));
  return { v: 2, iv: toBase64(iv), data: toBase64(data) };
}

export async function decryptText(value: EncryptedValue, key: CryptoKey): Promise<string> {
  if (!value || value.v !== 2) throw new Error('Unsupported encrypted value.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(value.iv) }, key, fromBase64(value.data));
  return dec.decode(plain);
}
