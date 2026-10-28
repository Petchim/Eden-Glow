/* =====================================================================
   ADMIN API — the only module the admin screens talk to.
   ---------------------------------------------------------------------
   Normally every call goes to Firebase (./firestoreApi.js): Firebase
   Authentication for the owner's sign-in and Cloud Firestore for the
   data, protected by firestore.rules.

   With VITE_ADMIN_DEMO=true in .env.local the admin instead runs on the
   in-browser demo data in src/admin/mock/ (NOT secure, for trying the
   screens without a Firebase project). Both backends share the rules
   in ./engine.js, so the screens behave the same.

   Contract (all async):

   auth.login({ email, password, remember }) → { name, email }
   auth.logout() · auth.me() → { name, email } | null · auth.resetPassword(email)
   search(q) → { customers, invoices, appointments }
   notifications() → [{ id, text, to }]
   dashboard({ range }) → summary cards, charts and lists
   customers.list({ q, segment, status, sort, page, pageSize }) → { items, total, summary }
   customers.get(id) · customers.create(data) · customers.update(id, data) · customers.lookup(q)
   services.list({ q, category, includeInactive }) · services.save(data) · services.importMenu(items)
   appointments.list({ from, to, status, q }) · appointments.save(data) · appointments.setStatus(id, status)
   invoices.list({ q, status, from, to, page, pageSize }) · invoices.get(id) · invoices.nextNumber(date)
   invoices.saveDraft(payload) · invoices.issue(payload, idempotencyKey)
   invoices.addPayment(id, { amount, method, reference }, idempotencyKey)
   invoices.saveNote(id, note) · invoices.discardDraft(id)
   expenses.list({ from, to, category }) · expenses.save(data) · expenses.remove(id)
   report({ from, to, group, compare })
   settings.get() · settings.update(data) · settings.resetDemoData() (demo only)

   Errors are thrown as ApiError { status, message, fields? }; a 401
   sends the admin back to the login screen.
   ===================================================================== */
import { ApiError } from './engine.js';
import { firestoreApi } from './firestoreApi.js';
import { mockApi } from '../mock/mockApi.js';
import { DEMO_ADMIN } from '../mock/seed.js';

/** True while the admin runs on demo data (shown as a badge in the header). */
export const USING_MOCK = import.meta.env.VITE_ADMIN_DEMO === 'true';

export const api = USING_MOCK ? mockApi : firestoreApi;
export { ApiError };

/** Demo sign-in shown on the login screen while the mock is in use. */
export const DEMO_LOGIN = USING_MOCK ? { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password } : null;

/** A fresh key per submission attempt, so a double-click can't create two invoices or payments. */
export const newIdempotencyKey = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
