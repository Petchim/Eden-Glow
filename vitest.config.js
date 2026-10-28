import { defineConfig } from 'vitest/config';

// Tests run in Node. Firebase tests talk to the local emulators started by `npm test`
// (firebase emulators:exec), never to the real project.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      VITE_FIREBASE_USE_EMULATORS: 'true',
      VITE_FIREBASE_PROJECT_ID: 'demo-eden-glow',
      VITE_ADMIN_DEMO: 'false',
    },
  },
});
