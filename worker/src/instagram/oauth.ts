/* =====================================================================
   OAUTH HELPERS — pure, unit-tested.
   ---------------------------------------------------------------------
   `state` is a random one-time value stored in Workers KV (10-minute
   expiry) with the owner's uid; the callback accepts a code only with a
   matching, unexpired, unused state (CSRF protection). After connecting, the browser is sent
   back only to an origin on the ADMIN_ORIGINS allow-list, never to an
   arbitrary URL (no open redirect), and never with a token in the URL.
   ===================================================================== */
import { toBase64Url } from './tokenCrypto.js';

export const STATE_TTL_MS = 10 * 60 * 1000;

/** 24 random bytes as base64url (32 characters). Web Crypto: works in Workers and Node. */
export const newState = (): string => toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
export const isStateShaped = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{32}$/.test(s);

/** "https://a.com, http://localhost:5173" → normalised origins. */
export function parseOrigins(list: string): string[] {
  return String(list || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        return new URL(s).origin;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

/** The origin to return to, if it is allowed; otherwise null. */
export function allowedOrigin(candidate: unknown, allowed: string[]): string | null {
  if (typeof candidate !== 'string') return null;
  try {
    const origin = new URL(candidate).origin;
    return allowed.includes(origin) ? origin : null;
  } catch {
    return null;
  }
}

export type ConnectResult = 'connected' | 'denied' | 'expired' | 'error' | 'not-business';

/** Where the admin lands after the Instagram screens: /admin/gallery?instagram=<result>. */
export const returnUrl = (origin: string, result: ConnectResult): string => `${origin}/admin/gallery?instagram=${result}`;
