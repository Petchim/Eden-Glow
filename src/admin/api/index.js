/* =====================================================================
   ADMIN API — the only module the admin screens talk to.
   ---------------------------------------------------------------------
   Today every call is answered by the in-browser mock in
   src/admin/mock/ (demo data, NOT secure). When the backend is ready:

     1. implement the same functions with fetch() against the server
        (credentials: 'include' so the secure session cookie is sent),
     2. change the import below to that client,
     3. delete src/admin/mock/.

   Nothing else in the admin needs to change. Contract (all async):

   auth.login({ email, password, remember }) → { name, email }
   auth.logout() · auth.me() → { name, email } | null
   search(q) → { customers, invoices, appointments }
   notifications() → [{ id, text, to }]
   dashboard({ range }) → summary cards, charts and lists
   customers.list({ q, segment, status, sort, page, pageSize }) → { items, total, summary }
   customers.get(id) · customers.create(data) · customers.update(id, data) · customers.lookup(q)
   services.list({ q, category, includeInactive }) · services.save(data)
   appointments.list({ from, to, status, q }) · appointments.save(data) · appointments.setStatus(id, status)
   invoices.list({ q, status, from, to, page, pageSize }) · invoices.get(id) · invoices.nextNumber(date)
   invoices.saveDraft(payload) · invoices.issue(payload, idempotencyKey)
   invoices.addPayment(id, { amount, method, reference }, idempotencyKey)
   invoices.saveNote(id, note) · invoices.discardDraft(id)
   expenses.list({ from, to, category }) · expenses.save(data) · expenses.remove(id)
   report({ from, to, group, compare })
   settings.get() · settings.update(data) · settings.resetDemoData()

   Errors are thrown as ApiError { status, message, fields? }; a 401
   sends the admin back to the login screen.
   ===================================================================== */
import { mockApi, ApiError } from '../mock/mockApi.js';
import { DEMO_ADMIN } from '../mock/seed.js';

export const api = mockApi;
export { ApiError };

/** True while the admin runs on demo data (shown as a badge in the header). */
export const USING_MOCK = true;
/** Demo sign-in shown on the login screen while the mock is in use. Set to null with the real backend. */
export const DEMO_LOGIN = { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password };

/** A fresh key per submission attempt, so a double-click can't create two invoices or payments. */
export const newIdempotencyKey = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
