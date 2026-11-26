/* =====================================================================
   FIREBASE WEB CONFIG — read from VITE_FIREBASE_* (see .env.example).
   ---------------------------------------------------------------------
   Kept apart from firebase.ts (Auth + full Firestore, admin only) so the
   public gallery can read published posts with the much smaller
   Firestore Lite SDK without loading anything else. These values
   identify the project; they are not secrets.
   ===================================================================== */
const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/** Use the local emulators (`npm run emulators`) instead of the real project. */
export const usingEmulators = env.VITE_FIREBASE_USE_EMULATORS === 'true';
export const emulatorHost = env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
/**
 * The Instagram Worker (Cloudflare), e.g. https://eden-glow-instagram.<subdomain>.workers.dev.
 * Serves the public gallery cache and the owner's Instagram actions. Empty = not set up yet.
 */
export const instagramApiUrl = (env.VITE_INSTAGRAM_API_URL || '').trim().replace(/\/+$/, '');

const REQUIRED: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'appId'];
/** Names of the VITE_FIREBASE_* variables that are still empty. */
export const missingFirebaseConfig = (): string[] =>
  REQUIRED.filter((k) => {
    const v = firebaseConfig[k];
    return !v || /^(your|<|xxx|placeholder)/i.test(v);
  }).map(
    (k) => `VITE_FIREBASE_${k.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`,
  );
export const firebaseConfigured = (): boolean => usingEmulators || missingFirebaseConfig().length === 0;

/** The config to initialise with (emulators accept a demo project and key). */
export const appConfig = () =>
  usingEmulators ? { ...firebaseConfig, projectId: firebaseConfig.projectId || 'demo-eden-glow', apiKey: firebaseConfig.apiKey || 'demo-key' } : firebaseConfig;
