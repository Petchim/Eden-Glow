/* =====================================================================
   MOCK BACKEND — FOR FRONTEND DEVELOPMENT ONLY. NOT SECURE.
   ---------------------------------------------------------------------
   Implements the API contract in src/admin/api/index.js against demo
   data kept in this browser's localStorage. It behaves like a server
   would (it recomputes totals, numbers invoices, rejects bad input and
   repeated submissions) so the screens are built against realistic
   rules, but it is NOT a substitute for the real backend:
     • the "login" is checked in the browser and protects nothing;
     • data lives only in this browser and can be edited by anyone.
   Delete this folder once the backend is connected.
   ===================================================================== */
import { createSeed, DEMO_ADMIN } from './seed.js';
import { computeTotals, paymentStatus, sumPayments } from '../lib/billing.js';
import { addDays, daysBetween, fmtDay, fmtMonth, parseDate, toISODate, today } from '../lib/format.js';

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

export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
const fail = (status, message, fields) => {
  throw new ApiError(status, message, fields);
};
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

/* ---------- validation helpers ---------- */
const PHONE_RE = /^\+?[\d\s-]{8,16}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function cleanCustomer(input, existingId) {
  const errors = {};
  const name = String(input.name || '').trim();
  const phone = String(input.phone || '').trim();
  const email = String(input.email || '').trim();
  if (name.length < 2) errors.name = 'Enter the customer’s name.';
  if (!PHONE_RE.test(phone)) errors.phone = 'Enter a valid phone number.';
  if (email && !EMAIL_RE.test(email)) errors.email = 'Enter a valid email or leave it empty.';
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (!errors.phone && db.customers.some((c) => c.id !== existingId && c.phone.replace(/\D/g, '').slice(-10) === digits)) {
    errors.phone = 'A customer with this phone number already exists.';
  }
  if (Object.keys(errors).length) fail(422, 'Please check the highlighted fields.', errors);
  return {
    name,
    phone,
    email,
    area: String(input.area || '').trim().slice(0, 80),
    notes: String(input.notes || '').trim().slice(0, 1000),
    status: input.status === 'inactive' ? 'inactive' : 'active',
  };
}

/* ---------- derived data ---------- */
const issued = () => db.invoices.filter((i) => i.status === 'issued');
const custById = (id) => db.customers.find((c) => c.id === id);
const svcById = (id) => db.services.find((s) => s.id === id);
const invoiceName = (inv) => (inv.customerId ? custById(inv.customerId)?.name : inv.walkIn?.name) || 'Walk-in customer';

function customerStats(c) {
  const invs = issued().filter((i) => i.customerId === c.id);
  const visits = db.appointments.filter((a) => a.customerId === c.id && a.status === 'completed');
  const dates = [...invs.map((i) => i.date), ...visits.map((a) => a.date)].sort();
  const totalSpent = invs.reduce((s, i) => s + i.paid, 0);
  const totalVisits = Math.max(visits.length, invs.length);
  return {
    totalVisits,
    totalSpent,
    lastVisit: dates[dates.length - 1] || null,
    averageSpend: totalVisits ? Math.round(totalSpent / totalVisits) : 0,
  };
}

const withCustomer = (inv) => ({ ...inv, customerName: invoiceName(inv), customer: inv.customerId ? custById(inv.customerId) || null : null });
const apptView = (a) => {
  const c = custById(a.customerId);
  return {
    ...a,
    customerName: c?.name || 'Unknown',
    customerPhone: c?.phone || '',
    services: a.serviceIds.map(svcById).filter(Boolean).map((s) => ({ id: s.id, name: s.name, price: s.price, durationMin: s.durationMin })),
  };
};

function inRange(d, from, to) {
  return (!from || d >= from) && (!to || d <= to);
}
// payment timestamps are ISO (UTC); compare by the local calendar day
const localDay = (isoStr) => toISODate(new Date(isoStr));
function paymentsInLocal(from, to) {
  const out = [];
  for (const inv of issued()) for (const p of inv.payments) if (inRange(localDay(p.at), from, to)) out.push({ ...p, invoice: inv });
  return out;
}
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
const change = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null);

/* ---------- invoice core (what the backend must do in one transaction) ---------- */
function buildInvoice(payload, existing, { draft = false } = {}) {
  const errors = {};
  const date = DATE_RE.test(payload.date || '') ? payload.date : today();
  let customerId = null;
  let walkIn = null;
  if (payload.customerId) {
    if (!custById(payload.customerId)) errors.customer = 'Customer not found.';
    customerId = payload.customerId;
  } else {
    walkIn = { name: String(payload.walkIn?.name || '').trim() || 'Walk-in customer', phone: String(payload.walkIn?.phone || '').trim() };
  }
  if (!draft && (!Array.isArray(payload.items) || !payload.items.length)) errors.items = 'Add at least one service.';
  const items = (payload.items || []).map((it) => {
    const svc = svcById(it.serviceId);
    const prev = existing?.items.find((x) => x.serviceId === it.serviceId);
    if (!svc && !prev) errors.items = 'One of the services no longer exists.';
    const qty = Math.floor(Number(it.qty));
    if (!(qty >= 1 && qty <= 20)) errors.items = 'Quantities must be between 1 and 20.';
    // Price always comes from the service list (or the price already saved on this bill), never from the page.
    const src = prev || svc;
    if (!src) return null;
    return {
      serviceId: it.serviceId,
      name: src.name,
      category: src.category,
      durationMin: src.durationMin,
      price: src.price,
      qty,
      discount: Math.max(0, Number(it.discount) || 0),
    };
  }).filter(Boolean);
  if (items.some((l) => l.discount > l.price * l.qty)) errors.items = 'A line discount cannot exceed its amount.';
  const billDiscount = Math.max(0, Number(payload.billDiscount) || 0);
  const s = db.settings;
  const taxRate = s.taxEnabled ? s.taxRate : 0;
  const totals = computeTotals(items, billDiscount, taxRate);
  if (billDiscount > totals.subtotal) errors.discount = 'Discount cannot exceed the bill.';
  if (!draft && totals.discount > 0 && !String(payload.discountReason || '').trim()) errors.discountReason = 'Give a reason for the discount.';
  if (payload.appointmentId && !db.appointments.some((a) => a.id === payload.appointmentId)) errors.appointment = 'Appointment not found.';
  if (Object.keys(errors).length) fail(422, Object.values(errors)[0], errors);
  return {
    date,
    customerId,
    walkIn,
    appointmentId: payload.appointmentId || null,
    staff: String(payload.staff || ''),
    items: totals.lines.map(({ gross, amount, ...l }) => l),
    billDiscount,
    discountReason: String(payload.discountReason || '').trim().slice(0, 200),
    notes: String(payload.notes || '').trim().slice(0, 500),
    taxRate,
    taxLabel: taxRate ? s.taxLabel : '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
  };
}
function nextNumber(date) {
  const year = date.slice(0, 4);
  const max = db.invoices
    .filter((i) => i.number?.startsWith(`INV-${year}-`))
    .reduce((m, i) => Math.max(m, Number(i.number.split('-')[2])), 0);
  return `INV-${year}-${String(max + 1).padStart(4, '0')}`;
}
function cleanPayment(p, balance) {
  const amount = Math.round((Number(p.amount) || 0) * 100) / 100;
  if (amount < 0) fail(422, 'Amount received cannot be negative.', { amount: 'Cannot be negative.' });
  if (!['cash', 'upi', 'card', 'other'].includes(p.method)) fail(422, 'Choose a payment method.', { method: 'Choose a method.' });
  // Anything above the balance is change handed back, not money kept.
  return { amount: Math.min(amount, balance), method: p.method, reference: String(p.reference || '').trim().slice(0, 60) };
}
function applyPayments(inv) {
  inv.paid = sumPayments(inv.payments);
  inv.balance = Math.max(Math.round((inv.total - inv.paid) * 100) / 100, 0);
  inv.paymentStatus = paymentStatus(inv.total, inv.paid);
}
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
  },

  async search(q) {
    requireAuth();
    const t = String(q || '').trim().toLowerCase();
    if (t.length < 2) return delay({ customers: [], invoices: [], appointments: [] }, 60);
    const customers = db.customers.filter((c) => [c.name, c.phone, c.email].some((v) => v.toLowerCase().includes(t))).slice(0, 5);
    const invoices = db.invoices
      .filter((i) => (i.number || '').toLowerCase().includes(t) || invoiceName(i).toLowerCase().includes(t))
      .slice(-5)
      .reverse()
      .map(withCustomer);
    const appointments = db.appointments
      .filter((a) => a.date >= today() && (custById(a.customerId)?.name || '').toLowerCase().includes(t))
      .slice(0, 5)
      .map(apptView);
    return delay({ customers, invoices, appointments }, 100);
  },

  async notifications() {
    requireAuth();
    const T = today();
    const items = [];
    const upcoming = db.appointments.filter((a) => a.date === T && a.status === 'upcoming');
    if (upcoming.length) items.push({ id: 'n1', kind: 'appointments', text: `${upcoming.length} appointment${upcoming.length > 1 ? 's' : ''} still to come today`, to: '/admin/appointments' });
    const unpaid = issued().filter((i) => i.balance > 0);
    if (unpaid.length) items.push({ id: 'n2', kind: 'invoices', text: `${unpaid.length} invoice${unpaid.length > 1 ? 's have' : ' has'} an outstanding balance`, to: '/admin/invoices?status=pending' });
    const drafts = db.invoices.filter((i) => i.status === 'draft');
    if (drafts.length) items.push({ id: 'n3', kind: 'drafts', text: `${drafts.length} draft bill${drafts.length > 1 ? 's' : ''} not yet generated`, to: '/admin/invoices?status=draft' });
    return delay(items, 60);
  },

  /* ---------- dashboard ---------- */
  async dashboard({ range = 'this_month' } = {}) {
    requireAuth();
    const T = today();
    const monthStart = `${T.slice(0, 8)}01`;
    const todays = db.appointments.filter((a) => a.date === T && a.status !== 'cancelled');
    const todayPays = paymentsInLocal(T, T);
    const ydayPays = paymentsInLocal(addDays(T, -1), addDays(T, -1));
    const monthInv = issued().filter((i) => i.date >= monthStart && i.date <= T);
    const prevStart = toISODate(new Date(parseDate(monthStart).getFullYear(), parseDate(monthStart).getMonth() - 1, 1));
    const prevSameDay = addDays(prevStart, daysBetween(monthStart, T));
    const prevInv = issued().filter((i) => i.date >= prevStart && i.date <= prevSameDay && i.date < monthStart);

    let from = monthStart;
    let to = T;
    if (range === 'last_month') {
      from = prevStart;
      to = addDays(monthStart, -1);
    } else if (range === 'last_7') {
      from = addDays(T, -6);
    }
    const chartInv = issued().filter((i) => inRange(i.date, from, to));
    const days = daysBetween(from, to) + 1;
    const revenue = Array.from({ length: days }, (_, k) => {
      const d = addDays(from, k);
      return { date: d, label: fmtDay(d), value: sum(chartInv.filter((i) => i.date === d), (i) => i.total) };
    });
    const methods = {};
    for (const p of paymentsInLocal(from, to)) methods[p.method] = (methods[p.method] || 0) + p.amount;

    const upcoming = db.appointments
      .filter((a) => a.status === 'upcoming' && a.date >= T)
      .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
      .slice(0, 6)
      .map(apptView);

    return delay({
      todayAppointments: {
        count: todays.length,
        completed: todays.filter((a) => a.status === 'completed').length,
        upcoming: todays.filter((a) => a.status === 'upcoming').length,
      },
      todayRevenue: {
        amount: sum(todayPays, (p) => p.amount),
        invoices: issued().filter((i) => i.date === T).length,
        change: change(sum(todayPays, (p) => p.amount), sum(ydayPays, (p) => p.amount)),
      },
      customers: { total: db.customers.length, newThisMonth: db.customers.filter((c) => c.createdAt >= monthStart).length },
      monthRevenue: { amount: sum(monthInv, (i) => i.total), change: change(sum(monthInv, (i) => i.total), sum(prevInv, (i) => i.total)) },
      revenue,
      paymentMethods: methods,
      todaysAppointments: todays.sort((a, b) => (a.time < b.time ? -1 : 1)).map(apptView),
      recentInvoices: issued().slice(-6).reverse().map(withCustomer),
      upcoming,
    });
  },

  /* ---------- customers ---------- */
  customers: {
    async list({ q = '', segment = 'all', status = 'all', sort = 'recent', page = 1, pageSize = 10 } = {}) {
      requireAuth();
      const T = today();
      const monthStart = `${T.slice(0, 8)}01`;
      const t = q.trim().toLowerCase();
      let rows = db.customers.map((c) => ({ ...c, ...customerStats(c) }));
      const walkInInvoices = issued().filter((i) => !i.customerId).length;
      const summary = {
        total: rows.length,
        newThisMonth: rows.filter((c) => c.createdAt >= monthStart).length,
        repeat: rows.filter((c) => c.totalVisits > 1).length,
        walkIns: walkInInvoices,
      };
      if (t) rows = rows.filter((c) => [c.name, c.phone, c.email].some((v) => v.toLowerCase().includes(t)));
      if (segment === 'new') rows = rows.filter((c) => c.createdAt >= monthStart);
      if (segment === 'repeat') rows = rows.filter((c) => c.totalVisits > 1);
      if (segment === 'never') rows = rows.filter((c) => c.totalVisits === 0);
      if (status !== 'all') rows = rows.filter((c) => c.status === status);
      const by = {
        recent: (a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''),
        name: (a, b) => a.name.localeCompare(b.name),
        spent: (a, b) => b.totalSpent - a.totalSpent,
        visits: (a, b) => b.totalVisits - a.totalVisits,
      };
      rows.sort(by[sort] || by.recent);
      const total = rows.length;
      return delay({ items: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, summary });
    },
    async get(id) {
      requireAuth();
      const c = custById(id);
      if (!c) fail(404, 'Customer not found.');
      return delay({
        ...c,
        ...customerStats(c),
        appointments: db.appointments
          .filter((a) => a.customerId === id)
          .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
          .map(apptView),
        invoices: db.invoices.filter((i) => i.customerId === id).reverse().map(withCustomer),
      });
    },
    async create(input) {
      requireAuth();
      const data = cleanCustomer(input);
      const c = { id: uid('cus'), ...data, createdAt: today() };
      db.customers.push(c);
      save();
      return delay(c);
    },
    async update(id, input) {
      requireAuth();
      const c = custById(id);
      if (!c) fail(404, 'Customer not found.');
      Object.assign(c, cleanCustomer({ ...c, ...input }, id));
      save();
      return delay(c);
    },
    async lookup(q) {
      requireAuth();
      const t = String(q || '').trim().toLowerCase();
      const rows = db.customers.filter((c) => c.status === 'active' && (!t || [c.name, c.phone, c.email].some((v) => v.toLowerCase().includes(t))));
      return delay(rows.slice(0, 8), 80);
    },
  },

  /* ---------- services ---------- */
  services: {
    async list({ q = '', category = 'all', includeInactive = false } = {}) {
      requireAuth();
      const t = q.trim().toLowerCase();
      const usage = {};
      for (const inv of issued()) for (const l of inv.items) usage[l.serviceId] = (usage[l.serviceId] || 0) + l.qty;
      const rows = db.services
        .filter((s) => (includeInactive || s.active) && (category === 'all' || s.category === category) && (!t || s.name.toLowerCase().includes(t)))
        .map((s) => ({ ...s, bookings: usage[s.id] || 0 }));
      return delay(rows, 80);
    },
    async save(input) {
      requireAuth();
      const errors = {};
      const name = String(input.name || '').trim();
      const price = Number(input.price);
      const durationMin = Math.floor(Number(input.durationMin));
      if (name.length < 2) errors.name = 'Enter a service name.';
      if (!(price > 0 && price <= 500000)) errors.price = 'Enter a price above ₹0.';
      if (!(durationMin >= 5 && durationMin <= 600)) errors.durationMin = 'Duration must be 5–600 minutes.';
      if (!db.settings.serviceCategories.includes(input.category)) errors.category = 'Choose a category.';
      if (db.services.some((s) => s.id !== input.id && s.name.toLowerCase() === name.toLowerCase())) errors.name = 'A service with this name already exists.';
      if (Object.keys(errors).length) fail(422, 'Please check the highlighted fields.', errors);
      const data = { name, price: Math.round(price * 100) / 100, durationMin, category: input.category, image: String(input.image || ''), active: input.active !== false };
      let svc;
      if (input.id) {
        svc = svcById(input.id);
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
  },

  /* ---------- appointments ---------- */
  appointments: {
    async list({ from, to, status = 'all', q = '' } = {}) {
      requireAuth();
      const t = q.trim().toLowerCase();
      const rows = db.appointments
        .filter((a) => inRange(a.date, from, to) && (status === 'all' || a.status === status))
        .map(apptView)
        .filter((a) => !t || a.customerName.toLowerCase().includes(t) || a.customerPhone.includes(t))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      return delay(rows, 100);
    },
    async save(input) {
      requireAuth();
      const errors = {};
      if (!custById(input.customerId)) errors.customerId = 'Choose a customer.';
      if (!DATE_RE.test(input.date || '')) errors.date = 'Choose a date.';
      if (!/^\d{2}:\d{2}$/.test(input.time || '')) errors.time = 'Choose a time.';
      const serviceIds = (input.serviceIds || []).filter((id) => svcById(id));
      if (!serviceIds.length) errors.serviceIds = 'Choose at least one service.';
      const statuses = ['upcoming', 'in_progress', 'completed', 'cancelled', 'no_show'];
      if (input.status && !statuses.includes(input.status)) errors.status = 'Unknown status.';
      if (Object.keys(errors).length) fail(422, 'Please check the highlighted fields.', errors);
      const data = {
        customerId: input.customerId,
        serviceIds,
        date: input.date,
        time: input.time,
        staff: String(input.staff || ''),
        status: input.status || 'upcoming',
        notes: String(input.notes || '').trim().slice(0, 500),
      };
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
      return delay(apptView(a));
    },
    async setStatus(id, status) {
      return mockApi.appointments.save({ ...db.appointments.find((a) => a.id === id), id, status });
    },
  },

  /* ---------- invoices ---------- */
  invoices: {
    async list({ q = '', status = 'all', from, to, page = 1, pageSize = 12 } = {}) {
      requireAuth();
      const t = q.trim().toLowerCase();
      let rows = db.invoices
        .filter((i) => inRange(i.date, from, to))
        .map(withCustomer)
        .filter((i) => !t || (i.number || '').toLowerCase().includes(t) || i.customerName.toLowerCase().includes(t));
      if (status === 'draft') rows = rows.filter((i) => i.status === 'draft');
      else if (status === 'pending') rows = rows.filter((i) => i.status === 'issued' && i.balance > 0);
      else if (status !== 'all') rows = rows.filter((i) => i.status === 'issued' && i.paymentStatus === status);
      rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const totals = {
        billed: sum(rows.filter((i) => i.status === 'issued'), (i) => i.total),
        collected: sum(rows.filter((i) => i.status === 'issued'), (i) => i.paid),
        pending: sum(rows.filter((i) => i.status === 'issued'), (i) => i.balance),
      };
      return delay({ items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize, totals });
    },
    async get(id) {
      requireAuth();
      const inv = db.invoices.find((i) => i.id === id);
      if (!inv) fail(404, 'Invoice not found.');
      const appt = inv.appointmentId ? db.appointments.find((a) => a.id === inv.appointmentId) : null;
      return delay({ ...withCustomer(inv), appointment: appt ? apptView(appt) : null });
    },
    async nextNumber(date = today()) {
      requireAuth();
      return delay(nextNumber(date), 60);
    },
    /** Save without issuing. Drafts have no invoice number and no payments. */
    async saveDraft(payload) {
      requireAuth();
      const existing = payload.id ? db.invoices.find((i) => i.id === payload.id && i.status === 'draft') : null;
      if (payload.id && !existing) fail(409, 'This bill has already been generated and can no longer be edited as a draft.');
      const built = buildInvoice(payload, existing, { draft: true });
      const inv = existing || { id: uid('inv'), number: null, status: 'draft', payments: [], createdAt: new Date().toISOString() };
      Object.assign(inv, built, { draftPayment: payload.payment || null, internalNote: existing?.internalNote || '' });
      applyPayments(inv);
      if (!existing) db.invoices.push(inv);
      save();
      return delay(withCustomer(inv));
    },
    /** Generate the invoice: number, totals and first payment are created together or not at all. */
    async issue(payload, idempotencyKey) {
      requireAuth();
      const inv = once(idempotencyKey, () => {
        const existing = payload.id ? db.invoices.find((i) => i.id === payload.id) : null;
        if (existing && existing.status !== 'draft') fail(409, 'This invoice has already been generated.');
        const built = buildInvoice(payload, existing);
        const pay = cleanPayment(payload.payment || {}, built.total);
        const next = existing || { id: uid('inv'), createdAt: new Date().toISOString(), internalNote: '' };
        Object.assign(next, built, {
          status: 'issued',
          number: nextNumber(built.date),
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
      return delay(withCustomer(inv), 450);
    },
    async addPayment(id, payment, idempotencyKey) {
      requireAuth();
      const inv = db.invoices.find((i) => i.id === id && i.status === 'issued');
      if (!inv) fail(404, 'Invoice not found.');
      if (idempotencyKey && db.idempotency[idempotencyKey]) return delay(withCustomer(inv));
      if (inv.balance <= 0) fail(409, 'This invoice is already fully paid.');
      const pay = cleanPayment(payment, inv.balance);
      if (pay.amount <= 0) fail(422, 'Enter the amount received.', { amount: 'Enter an amount.' });
      inv.payments.push({ id: uid('pay'), ...pay, at: new Date().toISOString() });
      applyPayments(inv);
      if (idempotencyKey) db.idempotency[idempotencyKey] = inv.id;
      save();
      return delay(withCustomer(inv));
    },
    async saveNote(id, internalNote) {
      requireAuth();
      const inv = db.invoices.find((i) => i.id === id);
      if (!inv) fail(404, 'Invoice not found.');
      inv.internalNote = String(internalNote || '').slice(0, 1000);
      save();
      return delay(withCustomer(inv));
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
    async list({ from, to, category = 'all' } = {}) {
      requireAuth();
      const rows = db.expenses.filter((e) => inRange(e.date, from, to) && (category === 'all' || e.category === category)).sort((a, b) => b.date.localeCompare(a.date));
      return delay(rows, 80);
    },
    async save(input) {
      requireAuth();
      const errors = {};
      const amount = Math.round(Number(input.amount) * 100) / 100;
      if (!DATE_RE.test(input.date || '') || input.date > today()) errors.date = 'Choose a date that is not in the future.';
      if (!db.settings.expenseCategories.includes(input.category)) errors.category = 'Choose a category.';
      if (String(input.description || '').trim().length < 2) errors.description = 'Describe the expense.';
      if (!(amount > 0)) errors.amount = 'Enter an amount above ₹0.';
      if (Object.keys(errors).length) fail(422, 'Please check the highlighted fields.', errors);
      const data = { date: input.date, category: input.category, description: String(input.description).trim().slice(0, 120), amount, method: input.method || 'cash' };
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
  async report({ from, to, group = 'daily', compare = 'previous' }) {
    requireAuth();
    const len = daysBetween(from, to) + 1;
    const pFrom = addDays(from, -len);
    const pTo = addDays(from, -1);
    const period = (a, b) => {
      const invs = issued().filter((i) => inRange(i.date, a, b));
      const pays = paymentsInLocal(a, b);
      const exps = db.expenses.filter((e) => inRange(e.date, a, b));
      return {
        invs,
        pays,
        exps,
        billed: sum(invs, (i) => i.total),
        collected: sum(pays, (p) => p.amount),
        pending: sum(invs, (i) => i.balance),
        discounts: sum(invs, (i) => i.discount),
        expenses: sum(exps, (e) => e.amount),
      };
    };
    const cur = period(from, to);
    const prev = compare === 'none' ? null : period(pFrom, pTo);
    const keys = ['billed', 'collected', 'pending', 'discounts', 'expenses'];
    const summary = Object.fromEntries(keys.map((k) => [k, { value: cur[k], previous: prev ? prev[k] : null, change: prev ? change(cur[k], prev[k]) : null }]));

    // trend buckets
    const bucketOf = (d) => {
      if (group === 'monthly') return `${d.slice(0, 7)}-01`;
      if (group === 'weekly') return addDays(from, Math.floor(daysBetween(from, d) / 7) * 7);
      return d;
    };
    const buckets = new Map();
    for (let k = 0; k < len; k++) {
      const b = bucketOf(addDays(from, k));
      if (!buckets.has(b)) buckets.set(b, { key: b, label: group === 'monthly' ? fmtMonth(b) : fmtDay(b), billed: 0, collected: 0 });
    }
    for (const i of cur.invs) buckets.get(bucketOf(i.date)).billed += i.total;
    for (const p of cur.pays) {
      const b = buckets.get(bucketOf(localDay(p.at)));
      if (b) b.collected += p.amount;
    }

    // by service
    const svc = {};
    for (const i of cur.invs) {
      const share = i.subtotal ? i.total / i.subtotal : 0;
      for (const l of i.items) {
        svc[l.name] ||= { name: l.name, bookings: 0, revenue: 0 };
        svc[l.name].bookings += l.qty;
        svc[l.name].revenue += l.price * l.qty * share;
      }
    }
    const services = Object.values(svc).sort((a, b) => b.revenue - a.revenue).map((s) => ({ ...s, revenue: Math.round(s.revenue) }));

    const methods = {};
    for (const p of cur.pays) methods[p.method] = (methods[p.method] || 0) + p.amount;
    const expenseCats = {};
    for (const e of cur.exps) expenseCats[e.category] = (expenseCats[e.category] || 0) + e.amount;

    // last three calendar months up to `to`
    const end = parseDate(to);
    const months = [2, 1, 0].map((back) => {
      const s = toISODate(new Date(end.getFullYear(), end.getMonth() - back, 1));
      const e = toISODate(new Date(end.getFullYear(), end.getMonth() - back + 1, 0));
      const p = period(s, e);
      return { label: fmtMonth(s), billed: p.billed, collected: p.collected };
    });

    const transactions = [
      ...cur.pays.map((p) => ({ date: localDay(p.at), at: p.at, type: 'Payment', description: `${p.method === 'other' ? 'Other' : p.method.toUpperCase()} collection · ${p.invoice.number}`, amount: p.amount })),
      ...cur.exps.map((e) => ({ date: e.date, at: `${e.date}T23:59`, type: 'Expense', description: e.description, amount: -e.amount })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    return delay({
      from,
      to,
      previous: prev ? { from: pFrom, to: pTo } : null,
      summary,
      trend: [...buckets.values()],
      services,
      paymentMethods: methods,
      months,
      expensesByCategory: expenseCats,
      recentInvoices: cur.invs.slice(-8).reverse().map(withCustomer),
      transactions,
      invoices: cur.invs.map(withCustomer),
    }, 250);
  },

  /* ---------- settings ---------- */
  settings: {
    async get() {
      requireAuth();
      return delay({ ...db.settings, demo: { seededOn: db.seededOn } });
    },
    async update(input) {
      requireAuth();
      const rate = Number(input.taxRate);
      if (input.taxEnabled && !(rate > 0 && rate <= 28)) fail(422, 'Enter a tax rate between 0 and 28%.', { taxRate: 'Enter a rate between 0 and 28%.' });
      const list = (v, fallback) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : fallback);
      Object.assign(db.settings, {
        taxEnabled: !!input.taxEnabled,
        taxRate: input.taxEnabled ? rate : 0,
        taxLabel: String(input.taxLabel || 'GST').slice(0, 20),
        staff: list(input.staff, db.settings.staff),
        invoiceFooter: String(input.invoiceFooter ?? db.settings.invoiceFooter).slice(0, 300),
      });
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
