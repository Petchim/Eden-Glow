/* =====================================================================
   OWNER AUTHENTICATION — who may connect, disconnect and sync.
   ---------------------------------------------------------------------
   The admin sends its Firebase Auth ID token. The Worker verifies it
   (RS256 signature against Google's published keys, issuer, audience =
   the Firebase project, expiry) and then reads admins/{uid} WITH THAT
   TOKEN: firestore.rules let a user read only their own admins record,
   so the same owner check as the admin panel decides.

   Failures are told apart (a slow network used to read as "session
   expired" or "not authorised" for the real owner):
     token invalid/expired, or Firestore rejects it  → 401 sign in again
     admins/{uid} missing or rules deny it           → 403 not the owner
     Google keys or Firestore unreachable / slow     → 503 try again
   Optional `diag` receives the stage, HTTP status and Firestore/jose
   reason code for local troubleshooting: never the token or a secret.
   ===================================================================== */
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { FirestoreError, type FirestoreRest } from '../firestore/rest.js';
import { HttpError } from '../http.js';

const GOOGLE_KEYS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
/** jose's default is 5 s. Measured from `wrangler dev` on the studio PC, Google's key download took
    up to 7.7 s cold (and once failed after 12.9 s), so the valid owner was told "session expired". */
export const JWKS_TIMEOUT_MS = 15_000;
let googleKeys: JWTVerifyGetKey | null = null;

/** Google's signing keys could not be downloaded (timeout / network): not the owner's fault. */
function keyFetchFailed(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code;
  const name = (e as { name?: unknown })?.name;
  return code === 'ERR_JWKS_TIMEOUT' || code === 'ERR_JWKS_INVALID' || e instanceof TypeError || name === 'AbortError' || name === 'TimeoutError';
}

/** Safe diagnostic fields only: stage names, status codes, reason codes, the uid. */
export type AuthDiag = (stage: string, info: Record<string, string | number | boolean | null>) => void;

export interface VerifyOptions {
  projectId: string;
  /** Tests pass local keys; production uses Google's (cached per Worker instance). */
  keys?: JWTVerifyGetKey;
  /** Only for a local demo- project (see emulatorHosts): emulator tokens are unsigned. */
  emulator?: boolean;
  diag?: AuthDiag;
}

/** What the token claims, without trusting it: lets a log say WHY verification failed. */
function claimHints(token: string, projectId: string): Record<string, string | boolean | null> {
  try {
    const p = decodeJwt(token);
    return {
      tokenProject: typeof p.aud === 'string' ? p.aud : null,
      issuerMatches: p.iss === `https://securetoken.google.com/${projectId}`,
      audienceMatches: p.aud === projectId,
      expired: typeof p.exp === 'number' ? p.exp * 1000 < Date.now() : null,
      uid: typeof p.sub === 'string' ? p.sub : null,
    };
  } catch {
    return { decodable: false };
  }
}

/** The verified user id, or an HttpError(401). */
export async function verifyFirebaseToken(token: string, { projectId, keys, emulator, diag }: VerifyOptions): Promise<string> {
  const issuer = `https://securetoken.google.com/${projectId}`;
  try {
    let payload: { sub?: unknown; aud?: unknown; iss?: unknown; exp?: unknown };
    if (emulator) {
      payload = decodeJwt(token);
      if (payload.iss !== issuer || payload.aud !== projectId) throw new Error('wrong project');
    } else {
      googleKeys ??= createRemoteJWKSet(new URL(GOOGLE_KEYS), { timeoutDuration: JWKS_TIMEOUT_MS });
      const verify = () => jwtVerify(token, keys ?? googleKeys!, { issuer, audience: projectId, algorithms: ['RS256'] });
      try {
        ({ payload } = await verify());
      } catch (e) {
        if (!keyFetchFailed(e)) throw e;
        diag?.('google-keys-retry', { code: String((e as { code?: unknown }).code || (e as Error).name) });
        ({ payload } = await verify()); // one retry: a slow first connection is common locally
      }
    }
    const uid = payload.sub;
    if (typeof uid !== 'string' || !uid || uid.length > 128) throw new Error('no subject');
    return uid;
  } catch (e) {
    const err = e as { code?: unknown; claim?: unknown; name?: unknown };
    if (keyFetchFailed(e)) {
      diag?.('google-keys-unavailable', { code: typeof err.code === 'string' ? err.code : String(err.name || 'Error') });
      throw new HttpError(503, 'unavailable', 'Could not check your sign-in with Google right now. Please try again in a moment.');
    }
    diag?.('token-rejected', {
      expectedProject: projectId,
      code: typeof err.code === 'string' ? err.code : String(err.name || 'Error'),
      claim: typeof err.claim === 'string' ? err.claim : null,
      ...claimHints(token, projectId),
    });
    throw new HttpError(401, 'unauthenticated', 'Your session has expired. Please sign in again.');
  }
}

export function bearer(request: Request, diag?: AuthDiag): string {
  const h = request.headers.get('Authorization') || '';
  const m = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(h);
  if (!m) {
    diag?.('no-bearer', { hasHeader: !!h, startsWithBearer: h.startsWith('Bearer '), length: h.length });
    throw new HttpError(401, 'unauthenticated', 'Please sign in again.');
  }
  return m[1];
}

/** The owner's uid, or an HttpError (401 sign in again, 403 not the owner, 503 Firestore unreachable). */
export async function requireOwner(request: Request, fs: FirestoreRest, opts: VerifyOptions): Promise<string> {
  const { diag, projectId } = opts;
  const token = bearer(request, diag);
  const uid = await verifyFirebaseToken(token, opts);
  const path = `admins/${uid}`;
  let admin;
  try {
    admin = await fs.get(path, token);
  } catch (e) {
    const status = e instanceof FirestoreError ? e.status : 0;
    const reason = e instanceof FirestoreError ? e.reason || null : String((e as Error)?.name || 'Error');
    diag?.('admin-read-failed', { uid, project: projectId, database: '(default)', path, status, reason });
    if (status === 401 || reason === 'UNAUTHENTICATED') throw new HttpError(401, 'unauthenticated', 'Your session has expired. Please sign in again.');
    if (!(e instanceof FirestoreError) || status >= 500 || status === 429) {
      throw new HttpError(503, 'unavailable', 'Could not check your admin access right now. Please try again in a moment.');
    }
    // 403 PERMISSION_DENIED and other client errors: not authorised
    admin = null;
  }
  if (!admin) {
    diag?.('not-owner', { uid, project: projectId, database: '(default)', path, documentFound: false });
    throw new HttpError(403, 'permission-denied', 'This account is not authorised to use the Eden Glow admin.');
  }
  diag?.('owner-ok', { uid, project: projectId });
  return uid;
}
