/* =====================================================================
   FIREBASE — the one place the app connects to Firebase.
   ---------------------------------------------------------------------
   The web config comes from environment variables (see .env.example).
   These values identify the Firebase project; they are not secrets.
   What protects the data is Firebase Authentication plus the rules in
   firestore.rules. Never put a service-account key or the Admin SDK in
   frontend code.

   Only the admin panel imports this file, so public visitors never
   download the Firebase SDK.
   ===================================================================== */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

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

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let services: FirebaseServices | null = null;

/** { app, auth, db }, created on first use. Throws if the config is missing. */
export function firebase(): FirebaseServices {
  if (services) return services;
  if (!firebaseConfigured()) {
    throw new Error(`Firebase is not configured. Set ${missingFirebaseConfig().join(', ')} in .env.local.`);
  }
  const config = usingEmulators ? { ...firebaseConfig, projectId: firebaseConfig.projectId || 'demo-eden-glow', apiKey: firebaseConfig.apiKey || 'demo-key' } : firebaseConfig;
  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  // Default (in-memory) Firestore cache: customer details are not kept on the device after the tab closes.
  const db = getFirestore(app);
  if (usingEmulators) {
    const host = env.VITE_FIREBASE_EMULATOR_HOST || '127.0.0.1';
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
  }
  services = { app, auth, db };
  return services;
}
