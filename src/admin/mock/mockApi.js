/* =====================================================================
   MOCK BACKEND — FOR FRONTEND DEVELOPMENT ONLY. NOT SECURE.
   ---------------------------------------------------------------------
   Used only when VITE_ADMIN_DEMO=true (see src/admin/api/index.js).
   Implements the API contract against demo data kept in this browser's
   localStorage, with the same rules as the Firestore backend (both use
   src/admin/api/engine.js), but:
     • the "login" is checked in the browser and protects nothing;
     • data lives only in this browser and can be edited by anyone.
   ===================================================================== */
import { createSeed, DEMO_ADMIN } from './seed.js';
import { ApiError, applyPayments, createEngine, fail } from '../api/engine.js';
import { today } from '../lib/format.js';

export { ApiError };

const DB_KEY = 'edenglow.admin.mockdb.v1';
const SESSION_KEY = 'edenglow.admin.mocksession';
const LATENCY = 180;

/* ---------- storage ---------- */
let db = null;
function load() {
  if (db) return db;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) db = JSON.parse(raw);
  } catch {
    db = null;
  }
  if (!db || db.version !== 1) {
    db = createSeed();
    save();
  }
  return db;
}
function save() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

const { validate, views } = createEngine(load);
const clone = (v) => JSON.parse(JSON.stringify(v));
const delay = (v, ms = LATENCY) => new Promise((res) => setTimeout(() => res(clone(v)), ms));
const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ---------- session (demo only) ---------- */
function readSession() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const s = JSON.parse(store.getItem(SESSION_KEY) || 'null');
      if (s && s.expiresAt > Date.now()) return s;
      if (s) store.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
  return null;
}
function requireAuth() {
  if (!readSession()) fail(401, 'Your session has expired. Please sign in again.');
  load();
}
const attempts = { count: 0, until: 0 };

/** Answer a read from the shared views after the auth check. */
const read = (fn, ms) => async (...args) => {
  requireAuth();
  return delay(fn(...args), ms);
};

function once(key, fn) {
  if (key && db.idempotency[key]) return db.invoices.find((i) => i.id === db.idempotency[key]);
  const result = fn();
  if (key) db.idempotency[key] = result.id;
  return result;
}

/* ===================================================================== */
export const mockApi = {
  auth: {
    async login({ email, password, remember }) {
      await delay(null, 500);
      if (attempts.until > Date.now()) fail(429, 'Too many attempts. Please wait a minute and try again.');
      const ok = String(email).trim().toLowerCase() === DEMO_ADMIN.email && password === DEMO_ADMIN.password;
      if (!ok) {
        attempts.count += 1;
        if (attempts.count >= 5) {
          attempts.until = Date.now() + 60000;
          attempts.count = 0;
        }
        fail(401, 'Incorrect email or password.');
      }
      attempts.count = 0;
      const session = { name: DEMO_ADMIN.name, email: DEMO_ADMIN.email, expiresAt: Date.now() + (remember ? 7 * 864e5 : 8 * 36e5) };
      (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
      load();
      return { name: session.name, email: session.email };
    },
    async logout() {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      return delay(null, 80);
    },
    async me() {
      const s = readSession();
      return delay(s ? { name: s.name, email: s.email } : null, 60);
    },
    async resetPassword() {
      fail(400, 'Password reset is not available in demo mode.');
    },
  },

  search: read(views.search, 100),
  notifications: read(views.notifications, 60),
  dashboard: read(views.dashboard),

  /* ---------- customers ---------- */
  customers: {
    list: read(views.customers.list),
    get: read(views.customers.get),
    lookup: read(views.customers.lookup, 80),
    async create(input) {
      requireAuth();
      const c = { id: uid('cus'), ...validate.customer(input), createdAt: today() };
      db.customers.push(c);
      save();
      return delay(c);
    },
    async update(id, input) {
      requireAuth();
      const c = db.customers.find((x) => x.id === id);
      if (!c) fail(404, 'Customer not found.');
      Object.assign(c, validate.customer({ ...c, ...input }, id));
      save();
      return delay(c);
    },
  },

  /* ---------- services ---------- */
  services: {
    list: read(views.services.list, 80),
    async save(input) {
      requireAuth();
      const data = validate.service(input);
      let svc;
      if (input.id) {
        svc = db.services.find((s) => s.id === input.id);
        if (!svc) fail(404, 'Service not found.');
        // Changing a price only affects new bills; saved invoices keep the price they were billed at.
        Object.assign(svc, data);
      } else {
        svc = { id: uid('svc'), ...data };
        db.services.push(svc);
      }
      save();
      return delay(svc);
    },
    async importMenu(items) {
      requireAuth();
      const have = new Set(db.services.map((s) => s.name.toLowerCase()));
      const added = items.filter((it) => !have.has(it.name.toLowerCase())).map((it) => ({ id: uid('svc'), ...validate.service({ ...it, price: null, active: false, published: false }) }));
      db.services.push(...added);
      save();
      return delay({ added: added.length, skipped: items.length - added.length });
    },
  },

  /* ---------- appointments ---------- */
  appointments: {
    list: read(views.appointments.list, 100),
    async save(input) {
      requireAuth();
      const data = validate.appointment(input);
      let a;
      if (input.id) {
        a = db.appointments.find((x) => x.id === input.id);
        if (!a) fail(404, 'Appointment not found.');
        Object.assign(a, data);
      } else {
        a = { id: uid('apt'), ...data, invoiceId: null, createdAt: new Date().toISOString() };
        db.appointments.push(a);
      }
      save();
      return delay(views.appointments.view(a));
    },
    async setStatus(id, status) {
      requireAuth();
      return mockApi.appointments.save({ ...db.appointments.find((a) => a.id === id), id, status });
    },
  },

  /* ---------- invoices ---------- */
  invoices: {
    list: read(views.invoices.list),
    get: read(views.invoices.get),
    nextNumber: read(views.invoices.nextNumber, 60),
    /** Save without issuing. Drafts have no invoice number and no payments. */
    async saveDraft(payload) {
      requireAuth();
      const existing = payload.id ? db.invoices.find((i) => i.id === payload.id && i.status === 'draft') : null;
      if (payload.id && !existing) fail(409, 'This bill has already been generated and can no longer be edited as a draft.');
      const built = validate.invoice(payload, existing, { draft: true });
      const inv = existing || { id: uid('inv'), number: null, status: 'draft', payments: [], createdAt: new Date().toISOString() };
      Object.assign(inv, built, { draftPayment: payload.payment || null, internalNote: existing?.internalNote || '' });
      applyPayments(inv);
      if (!existing) db.invoices.push(inv);
      save();
      return delay(views.invoices.view(inv));
    },
    /** Generate the invoice: number, totals and first payment are created together or not at all. */
    async issue(payload, idempotencyKey) {
      requireAuth();
      const inv = once(idempotencyKey, () => {
        const existing = payload.id ? db.invoices.find((i) => i.id === payload.id) : null;
        if (existing && existing.status !== 'draft') fail(409, 'This invoice has already been generated.');
        const built = validate.invoice(payload, existing);
        const pay = validate.payment(payload.payment || {}, built.total);
        const next = existing || { id: uid('inv'), createdAt: new Date().toISOString(), internalNote: '' };
        Object.assign(next, built, {
          status: 'issued',
          number: views.invoices.nextNumber(built.date),
          issuedAt: new Date().toISOString(),
          payments: pay.amount > 0 ? [{ id: uid('pay'), ...pay, at: new Date().toISOString() }] : [],
        });
        delete next.draftPayment;
        applyPayments(next);
        if (!existing) db.invoices.push(next);
        if (next.appointmentId) {
          const a = db.appointments.find((x) => x.id === next.appointmentId);
          if (a) Object.assign(a, { invoiceId: next.id, status: 'completed' });
        }
        return next;
      });
      save();
      return delay(views.invoices.view(inv), 450);
    },
    async addPayment(id, payment, idempotencyKey) {
      requireAuth();
      const inv = db.invoices.find((i) => i.id === id && i.status === 'issued');
      if (!inv) fail(404, 'Invoice not found.');
      if (idempotencyKey && db.idempotency[idempotencyKey]) return delay(views.invoices.view(inv));
      if (inv.balance <= 0) fail(409, 'This invoice is already fully paid.');
      const pay = validate.payment(payment, inv.balance);
      if (pay.amount <= 0) fail(422, 'Enter the amount received.', { amount: 'Enter an amount.' });
      inv.payments.push({ id: uid('pay'), ...pay, at: new Date().toISOString() });
      applyPayments(inv);
      if (idempotencyKey) db.idempotency[idempotencyKey] = inv.id;
      save();
      return delay(views.invoices.view(inv));
    },
    async saveNote(id, internalNote) {
      requireAuth();
      const inv = db.invoices.find((i) => i.id === id);
      if (!inv) fail(404, 'Invoice not found.');
      inv.internalNote = String(internalNote || '').slice(0, 1000);
      save();
      return delay(views.invoices.view(inv));
    },
    async discardDraft(id) {
      requireAuth();
      const i = db.invoices.findIndex((x) => x.id === id && x.status === 'draft');
      if (i < 0) fail(404, 'Draft not found.');
      db.invoices.splice(i, 1);
      save();
      return delay(true);
    },
  },

  /* ---------- expenses ---------- */
  expenses: {
    list: read(views.expenses.list, 80),
    async save(input) {
      requireAuth();
      const data = validate.expense(input);
      let e;
      if (input.id) {
        e = db.expenses.find((x) => x.id === input.id);
        if (!e) fail(404, 'Expense not found.');
        Object.assign(e, data);
      } else {
        e = { id: uid('exp'), ...data };
        db.expenses.push(e);
      }
      save();
      return delay(e);
    },
    async remove(id) {
      requireAuth();
      db.expenses = db.expenses.filter((e) => e.id !== id);
      save();
      return delay(true);
    },
  },

  /* ---------- reports ---------- */
  report: read(views.report, 250),

  /* ---------- settings ---------- */
  settings: {
    async get() {
      requireAuth();
      return delay({ ...db.settings, demo: { seededOn: db.seededOn } });
    },
    async update(input) {
      requireAuth();
      Object.assign(db.settings, validate.settings(input));
      save();
      return delay(db.settings);
    },
    async resetDemoData() {
      requireAuth();
      db = createSeed();
      save();
      return delay(true, 300);
    },
  },
};
