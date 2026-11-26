/* =====================================================================
   FIREBASE — the one place the admin connects to Firebase.
   ---------------------------------------------------------------------
   The web config comes from environment variables (see .env.example and
   ./firebaseConfig.ts). These values identify the Firebase project; they
   are not secrets. What protects the data is Firebase Authentication
   plus the rules in firestore.rules. Never put a service-account key or
   the Admin SDK in frontend code.

   Only the admin panel imports this file, so public visitors never
   download the Auth / full Firestore SDK. (The public gallery uses
   Firestore Lite via ./publicGallery.ts.)
   ===================================================================== */
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { appConfig, emulatorHost, firebaseConfigured, missingFirebaseConfig, usingEmulators } from './firebaseConfig.ts';

export { firebaseConfig, firebaseConfigured, missingFirebaseConfig, usingEmulators } from './firebaseConfig.ts';

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
  const app = getApps().length ? getApp() : initializeApp(appConfig());
  const auth = getAuth(app);
  // Default (in-memory) Firestore cache: customer details are not kept on the device after the tab closes.
  const db = getFirestore(app);
  if (usingEmulators) {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulatorHost, 8080);
  }
  services = { app, auth, db };
  return services;
}
