/* =====================================================================
   MOCK BACKEND — FOR FRONTEND DEVELOPMENT ONLY. NOT SECURE.
   ---------------------------------------------------------------------
   Used only when VITE_ADMIN_DEMO=true (see src/admin/api/index.ts).
   Implements the API contract against demo data kept in this browser's
   localStorage, with the same rules as the Firestore backend (both use
   src/admin/api/engine.ts), but:
     • the "login" is checked in the browser and protects nothing;
     • data lives only in this browser and can be edited by anyone.
   ===================================================================== */
import { createSeed, DEMO_ADMIN, type DemoInvoice, type MockDb } from './seed.ts';
import {
  ApiError,
  applyPayments,
  createEngine,
  fail,
  type AppointmentInput,
  type CustomerInput,
  type ExpenseInput,
  type InvoicePayload,
  type PaymentInput,
  type ServiceInput,
  type SettingsInput,
} from '../api/engine.ts';
import type { AdminApi, LoginInput } from '../api/contract.ts';
import { today } from '../lib/format.ts';
import type { MenuItem } from '../lib/websiteMenu.ts';
import type { AdminProfile, Appointment, AppointmentStatus, Customer, Expense, Service } from '../../types/models.ts';

export { ApiError };

const DB_KEY = 'edenglow.admin.mockdb.v1';
const SESSION_KEY = 'edenglow.admin.mocksession';
const LATENCY = 180;

interface Session extends AdminProfile {
  expiresAt: number;
}

/* ---------- storage ---------- */
let db: MockDb | null = null;
function load(): MockDb {
  if (db) return db;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) db = JSON.parse(raw) as MockDb;
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
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const delay = <T>(v: T, ms = LATENCY) => new Promise<T>((res) => setTimeout(() => res(clone(v)), ms));
const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ---------- session (demo only) ---------- */
function readSession(): Session | null {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const s = JSON.parse(store.getItem(SESSION_KEY) || 'null') as Session | null;
      if (s && s.expiresAt > Date.now()) return s;
      if (s) store.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
  return null;
}
/** Throws 401 without a demo session; otherwise returns the demo data. */
function requireAuth(): MockDb {
  if (!readSession()) fail(401, 'Your session has expired. Please sign in again.');
  return load();
}
const attempts = { count: 0, until: 0 };

/** Answer a read from the shared views after the auth check. */
const read = <A extends unknown[], R>(fn: (...args: A) => R, ms?: number) => async (...args: A): Promise<R> => {
  requireAuth();
  return delay(fn(...args), ms);
};

function once(db: MockDb, key: string | undefined, fn: () => DemoInvoice): DemoInvoice {
  if (key && db.idempotency[key]) {
    const done = db.invoices.find((i) => i.id === db.idempotency[key]);
    if (done) return done;
  }
  const result = fn();
  if (key) db.idempotency[key] = result.id;
  return result;
}

/* ===================================================================== */
export const mockApi: AdminApi = {
  auth: {
    async login({ email, password, remember }: LoginInput) {
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
      const session: Session = { name: DEMO_ADMIN.name, email: DEMO_ADMIN.email, expiresAt: Date.now() + (remember ? 7 * 864e5 : 8 * 36e5) };
      (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
      load();
      return { name: session.name, email: session.email };
    },
    async logout() {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      await delay(null, 80);
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
    async create(input: CustomerInput) {
      const db = requireAuth();
      const c: Customer = { id: uid('cus'), ...validate.customer(input), createdAt: today() };
      db.customers.push(c);
      save();
      return delay(c);
    },
    async update(id: string, input: CustomerInput) {
      const db = requireAuth();
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
    async save(input: ServiceInput) {
      const db = requireAuth();
      const data = validate.service(input);
      let svc: Service | undefined;
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
    async importMenu(items: MenuItem[]) {
      const db = requireAuth();
      const have = new Set(db.services.map((s) => s.name.toLowerCase()));
      const added: Service[] = items
        .filter((it) => !have.has(it.name.toLowerCase()))
        .map((it) => ({ id: uid('svc'), ...validate.service({ ...it, price: null, active: false, published: false }) }));
      db.services.push(...added);
      save();
      return delay({ added: added.length, skipped: items.length - added.length });
    },
  },

  /* ---------- appointments ---------- */
  appointments: {
    list: read(views.appointments.list, 100),
    async save(input: AppointmentInput) {
      const db = requireAuth();
      const data = validate.appointment(input);
      let a: Appointment | undefined;
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
    async setStatus(id: string, status: AppointmentStatus) {
      const db = requireAuth();
      return mockApi.appointments.save({ ...db.appointments.find((a) => a.id === id), id, status });
    },
  },

  /* ---------- invoices ---------- */
  invoices: {
    list: read(views.invoices.list),
    get: read(views.invoices.get),
    nextNumber: read(views.invoices.nextNumber, 60),
    /** Save without issuing. Drafts have no invoice number and no payments. */
    async saveDraft(payload: InvoicePayload) {
      const db = requireAuth();
      const existing = payload.id ? db.invoices.find((i) => i.id === payload.id && i.status === 'draft') : null;
      if (payload.id && !existing) fail(409, 'This bill has already been generated and can no longer be edited as a draft.');
      const built = validate.invoice(payload, existing, { draft: true });
      const extra = { draftPayment: validate.draftPayment(payload.payment), internalNote: existing?.internalNote || '' };
      const inv: DemoInvoice = existing
        ? Object.assign(existing, built, extra)
        : { id: uid('inv'), number: null, status: 'draft', payments: [], createdAt: new Date().toISOString(), ...built, ...extra, paid: 0, balance: 0, paymentStatus: 'unpaid' };
      applyPayments(inv);
      if (!existing) db.invoices.push(inv);
      save();
      return delay(views.invoices.view(inv));
    },
    /** Generate the invoice: number, totals and first payment are created together or not at all. */
    async issue(payload: InvoicePayload, idempotencyKey?: string) {
      const db = requireAuth();
      const inv = once(db, idempotencyKey, () => {
        const existing = payload.id ? db.invoices.find((i) => i.id === payload.id) : null;
        if (existing && existing.status !== 'draft') fail(409, 'This invoice has already been generated.');
        const built = validate.invoice(payload, existing);
        const pay = validate.payment(payload.payment || {}, built.total);
        const fields = {
          ...built,
          status: 'issued' as const,
          number: views.invoices.nextNumber(built.date),
          issuedAt: new Date().toISOString(),
          payments: pay.amount > 0 ? [{ id: uid('pay'), ...pay, at: new Date().toISOString() }] : [],
        };
        const next: DemoInvoice = existing
          ? Object.assign(existing, fields)
          : { id: uid('inv'), createdAt: new Date().toISOString(), internalNote: '', ...fields, paid: 0, balance: 0, paymentStatus: 'unpaid' };
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
    async addPayment(id: string, payment: PaymentInput, idempotencyKey?: string) {
      const db = requireAuth();
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
    async saveNote(id: string, internalNote: string) {
      const db = requireAuth();
      const inv = db.invoices.find((i) => i.id === id);
      if (!inv) fail(404, 'Invoice not found.');
      inv.internalNote = String(internalNote || '').slice(0, 1000);
      save();
      return delay(views.invoices.view(inv));
    },
    async discardDraft(id: string) {
      const db = requireAuth();
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
    async save(input: ExpenseInput) {
      const db = requireAuth();
      const data = validate.expense(input);
      let e: Expense | undefined;
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
    async remove(id: string) {
      const db = requireAuth();
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
      const db = requireAuth();
      return delay({ ...db.settings, demo: { seededOn: db.seededOn } });
    },
    async update(input: SettingsInput) {
      const db = requireAuth();
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
