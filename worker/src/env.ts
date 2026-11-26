/* =====================================================================
   WORKER ENVIRONMENT — bindings, settings and secrets.
   ---------------------------------------------------------------------
   Settings (wrangler.toml [vars], not secret):
     FIREBASE_PROJECT_ID, FIREBASE_API_KEY (public web key),
     INSTAGRAM_APP_ID, INSTAGRAM_REDIRECT_URI, ADMIN_ORIGINS
   Secrets (`wrangler secret put …`, never in files or Git):
     INSTAGRAM_APP_SECRET, TOKEN_KEY, SYNC_BOT_EMAIL, SYNC_BOT_PASSWORD
   Local development only (.dev.vars):
     FIRESTORE_EMULATOR_HOST, AUTH_EMULATOR_HOST
   ===================================================================== */

/** The subset of Workers KV the Worker uses (lets tests count every operation). */
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface R2Like {
  put(key: string, value: any, options?: any): Promise<any>;
  get(key: string): Promise<any>;
  delete(key: string | string[]): Promise<void>;
}

export interface Env {
  IG_KV: KVLike;
  MEDIA_BUCKET?: R2Like;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_API_KEY: string;
  INSTAGRAM_APP_ID: string;
  INSTAGRAM_REDIRECT_URI: string;
  ADMIN_ORIGINS: string;
  INSTAGRAM_APP_SECRET: string;
  TOKEN_KEY: string;
  SYNC_BOT_EMAIL: string;
  SYNC_BOT_PASSWORD: string;
  FIRESTORE_EMULATOR_HOST?: string;
  AUTH_EMULATOR_HOST?: string;
}

/** Names of required settings/secrets that are empty (never their values). */
export function missingConfig(env: Env, keys: (keyof Env)[]): string[] {
  return keys.filter((k) => typeof env[k] !== 'string' || !(env[k] as string).trim());
}

/** The local emulator addresses, honoured ONLY for a Firebase "demo-" project on this machine.
    In production (a real project id) they are ignored even if set by mistake, so unsigned
    emulator tokens and plain-HTTP sign-ins can never be accepted there. */
export function emulatorHosts(env: Env): { firestore?: string; auth?: string } {
  const local = /^demo-[a-z0-9-]+$/.test(env.FIREBASE_PROJECT_ID || '');
  const ok = (h?: string) => (local && h && /^(127\.0\.0\.1|localhost|\[::1\]):\d{2,5}$/.test(h.trim()) ? h.trim() : undefined);
  return { firestore: ok(env.FIRESTORE_EMULATOR_HOST), auth: ok(env.AUTH_EMULATOR_HOST) };
}

export const SYNC_CONFIG: (keyof Env)[] = ['FIREBASE_PROJECT_ID', 'FIREBASE_API_KEY', 'TOKEN_KEY', 'SYNC_BOT_EMAIL', 'SYNC_BOT_PASSWORD'];
export const OAUTH_CONFIG: (keyof Env)[] = [...SYNC_CONFIG, 'INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'INSTAGRAM_REDIRECT_URI', 'ADMIN_ORIGINS'];
