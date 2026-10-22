import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: '/'` so assets resolve from nested routes such as /hair or /book-appointment.
// If the site is deployed in a sub-folder (e.g. example.com/studio/), set base to '/studio/'
// and pass the same value to <BrowserRouter basename="/studio">.
export default defineConfig({
  plugins: [react()],
  base: '/',
});
