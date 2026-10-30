/* =====================================================================
   ADMIN DATA RULES — shared by every backend behind src/admin/api.
   ---------------------------------------------------------------------
   Validation, invoice building and the derived views (dashboard,
   reports, customer stats…) computed from one snapshot of the data:

     { services, customers, appointments, invoices, expenses, settings }

   `invoices[].payments` holds that invoice's payments. Both the
   Firestore backend and the demo mock hand their data to createEngine,
   so the screens behave the same whichever one is answering.
   Functions here never write anything; each backend saves the result.
   ===================================================================== */
import type {
  Appointment,
  AppointmentStatus,
  Customer,
  CustomerStatus,
  DataSnapshot,
  Expense,
  Invoice,
  InvoiceItem,
  Payment,
  PaymentDraft,
  PaymentMethod,
  PaymentStatus,
  Service,
  StudioSettings,
  WalkIn,
} from '../../types/models.ts';
import { computeTotals, paymentStatus, sumPayments } from '../lib/billing.ts';
import { addDays, daysBetween, fmtDay, fmtMonth, parseDate, toISODate, today } from '../lib/format.ts';

/** Field name → message, for highlighting form fields. */
export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  /** HTTP-style status: 401 signed out, 403 not allowed, 404, 409 conflict, 422 invalid input… */
  status: number;
  fields?: FieldErrors;

  constructor(status: number, message: string, fields?: FieldErrors) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
export function fail(status: number, message: string, fields?: FieldErrors): never {
  throw new ApiError(status, message, fields);
}

/* ---------- what the screens send (form values, so numbers may arrive as strings) ---------- */
export interface CustomerInput {
  name?: string;
  phone?: string;
  email?: string;
  area?: string;
  notes?: string;
  status?: string;
}
export interface ServiceInput {
  id?: string;
  name?: string;
  category?: string;
  price?: number | string | null;
  durationMin?: number | string | null;
  image?: string;
  active?: boolean;
  published?: boolean;
}
export interface AppointmentInput {
  id?: string;
  customerId?: string;
  serviceIds?: string[];
  date?: string;
  time?: string;
  staff?: string;
  status?: string;
  notes?: string;
}
export interface ExpenseInput {
  id?: string;
  date?: string;
  category?: string;
  description?: string;
  amount?: number | string;
  method?: string;
}
export interface SettingsInput {
  taxEnabled?: boolean;
  taxRate?: number | string;
  taxLabel?: string;
  staff?: unknown;
  invoiceFooter?: string;
}
export interface PaymentInput {
  amount?: number | string;
  method?: string;
  reference?: string;
}
export interface InvoiceLineInput {
  serviceId: string;
  qty: number | string;
  discount?: number | string;
}
/** What the bill screen sends. Prices are looked up here, never taken from the page. */
export interface InvoicePayload {
  id?: string;
  date?: string;
  customerId?: string | null;
  walkIn?: Partial<WalkIn> | null;
  appointmentId?: string | null;
  staff?: string;
  items?: InvoiceLineInput[];
  billDiscount?: number | string;
  discountReason?: string;
  notes?: string;
  payment?: PaymentInput | null;
}

/* ---------- what validation hands back to the backends to save ---------- */
export type CustomerFields = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>;
export type ServiceFields = Omit<Service, 'id' | 'updatedAt'>;
export type AppointmentFields = Omit<Appointment, 'id' | 'invoiceId' | 'createdAt' | 'updatedAt'>;
export type ExpenseFields = Omit<Expense, 'id' | 'updatedAt'>;
export type SettingsFields = Pick<StudioSettings, 'taxEnabled' | 'taxRate' | 'taxLabel' | 'staff' | 'invoiceFooter'>;
export type InvoiceFields = Pick<
  Invoice,
  | 'date' | 'customerId' | 'walkIn' | 'appointmentId' | 'staff' | 'items' | 'billDiscount' | 'discountReason' | 'notes'
  | 'taxRate' | 'taxLabel' | 'subtotal' | 'discount' | 'tax' | 'total'
>;

/* ---------- list filters ---------- */
export type DashboardRange = 'this_month' | 'last_month' | 'last_7';
export interface CustomerListQuery {
  q?: string;
  segment?: 'all' | 'new' | 'repeat' | 'never';
  status?: 'all' | CustomerStatus;
  sort?: 'recent' | 'name' | 'spent' | 'visits';
  page?: number;
  pageSize?: number;
}
export interface ServiceListQuery {
  q?: string;
  category?: string;
  includeInactive?: boolean;
}
export interface AppointmentListQuery {
  from?: string;
  to?: string;
  status?: 'all' | AppointmentStatus;
  q?: string;
}
export interface InvoiceListQuery {
  q?: string;
  /** 'pending' = issued with a balance left. */
  status?: 'all' | 'draft' | 'pending' | PaymentStatus;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
export interface ExpenseListQuery {
  from?: string;
  to?: string;
  category?: string;
}
export interface ReportQuery {
  from: string;
  to: string;
  group?: 'daily' | 'weekly' | 'monthly';
  compare?: 'previous' | 'none';
}
export interface AdminNotification {
  id: string;
  kind: 'appointments' | 'invoices' | 'drafts';
  text: string;
  to: string;
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_RE = /^\+?[\d\s-]{8,16}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['upcoming', 'in_progress', 'completed', 'cancelled', 'no_show'];
export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'card', 'other'];
/** True when `v` is one of `list` (narrows `v` to that union). */
export const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);
/** `v` when it is one of `list`, otherwise `fallback`. */
export const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (isOneOf(list, v) ? v : fallback);

/** Settings used until the owner saves their own. No staff names or prices are made up. */
export const DEFAULT_SETTINGS: StudioSettings = {
  taxEnabled: false,
  taxLabel: 'GST',
  taxRate: 0,
  staff: [],
  expenseCategories: ['Products', 'Rent & Utilities', 'Staff', 'Marketing', 'Maintenance', 'Others'],
  serviceCategories: ['Hair', 'Skin', 'Nails', 'Lashes', 'Makeup'],
  invoiceFooter: 'Thank you for choosing Eden Glow Studio. We look forward to serving you again.',
};

const sum = <T>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0);
const change = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : null);
const inRange = (d: string, from?: string, to?: string) => (!from || d >= from) && (!to || d <= to);
// payment timestamps are ISO (UTC); compare by the local calendar day
const localDay = (isoStr: string) => toISODate(new Date(isoStr));
const lower = (v: unknown) => String(v || '').toLowerCase();

/** Recompute paid / balance / status from the payments list. Mutates and returns `inv`. */
export function applyPayments<T extends Pick<Invoice, 'payments' | 'total' | 'paid' | 'balance' | 'paymentStatus'>>(inv: T): T {
  inv.paid = sumPayments(inv.payments);
  inv.balance = Math.max(Math.round((inv.total - inv.paid) * 100) / 100, 0);
  inv.paymentStatus = paymentStatus(inv.total, inv.paid);
  return inv;
}

/** Highest invoice sequence already used in `year` ("INV-2026-0042" → 42). */
export const maxInvoiceSeq = (invoices: Pick<Invoice, 'number'>[], year: string): number =>
  invoices.filter((i) => i.number?.startsWith(`INV-${year}-`)).reduce((m, i) => Math.max(m, Number((i.number ?? '').split('-')[2]) || 0), 0);
export const formatInvoiceNumber = (year: string, n: number): string => `INV-${year}-${String(n).padStart(4, '0')}`;

/** @param getDb () => current data snapshot (see the comment at the top). */
export function createEngine(getDb: () => DataSnapshot) {
  /* ---------- lookups ---------- */
  const issued = () => getDb().invoices.filter((i) => i.status === 'issued');
  const custById = (id: string | null | undefined) => getDb().customers.find((c) => c.id === id);
  const svcById = (id: string) => getDb().services.find((s) => s.id === id);
  const invoiceName = (inv: Pick<Invoice, 'customerId' | 'walkIn'>) => (inv.customerId ? custById(inv.customerId)?.name : inv.walkIn?.name) || 'Walk-in customer';

  function customerStats(c: Customer) {
    const invs = issued().filter((i) => i.customerId === c.id);
    const visits = getDb().appointments.filter((a) => a.customerId === c.id && a.status === 'completed');
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

  const withCustomer = (inv: Invoice) => ({ ...inv, customerName: invoiceName(inv), customer: inv.customerId ? custById(inv.customerId) || null : null });
  const apptView = (a: Appointment) => {
    const c = custById(a.customerId);
    return {
      ...a,
      customerName: c?.name || 'Unknown',
      customerPhone: c?.phone || '',
      services: a.serviceIds.map(svcById).filter((s): s is Service => !!s).map((s) => ({ id: s.id, name: s.name, price: s.price, durationMin: s.durationMin })),
    };
  };

  function paymentsInLocal(from?: string, to?: string) {
    const out: (Payment & { invoice: Invoice })[] = [];
    for (const inv of issued()) for (const p of inv.payments) if (inRange(localDay(p.at), from, to)) out.push({ ...p, invoice: inv });
    return out;
  }

  /* ---------- validation: each returns clean data or throws ApiError 422 ---------- */
  const validate = {
    customer(input: CustomerInput, existingId?: string): CustomerFields {
      const errors: FieldErrors = {};
      const name = String(input.name || '').trim();
      const phone = String(input.phone || '').trim();
      const email = String(input.email || '').trim();
      if (name.length < 2) errors.name = 'Enter the customer’s name.';
      if (name.length > 80) errors.name = 'Keep the name under 80 characters.';
      if (!PHONE_RE.test(phone)) errors.phone = 'Enter a valid phone number.';
      if (email && !EMAIL_RE.test(email)) errors.email = 'Enter a valid email or leave it empty.';
      const digits = phone.replace(/\D/g, '').slice(-10);
      if (!errors.phone && getDb().customers.some((c) => c.id !== existingId && c.phone.replace(/\D/g, '').slice(-10) === digits)) {
        errors.phone = 'A customer with this phone number already exists.';
      }
      if (Object.keys(errors).length) fail(422, 'Please check the highlighted fields.', errors);
      return {
        name,
        phone,
        email: email.slice(0, 120),
        area: String(input.area || '').trim().slice(0, 80),
        notes: String(input.notes || '').trim().slice(0, 1000),
        status: input.status === 'inactive' ? 'inactive' : 'active',
      };
    },

    service(input: ServiceInput): ServiceFields {
      const errors: FieldErrors = {};
      const name = String(input.name || '').trim();
      // A service imported from the website menu has no price until the owner sets one.
      const noPrice = input.price === null || input.price === undefined || input.price === '';
      const price = noPrice ? null : Number(input.price);
      const noDuration = input.durationMin === null || input.durationMin === undefined || input.durationMin === '';
      const durationMin = noDuration ? null : Math.floor(Number(input.durationMin));
      const active = input.active !== false;
      if (name.length < 2 || name.length > 80) errors.name = 'Enter a service name.';
      if (price !== null && !(price > 0 && price <= 500000)) errors.price = 'Enter a price above ₹0.';
      if (price === null && active) errors.price = 'Set a price before showing this service when billing.';
      if (durationMin !== null && !(durationMin >= 5 && durationMin <= 600)) errors.durationMin = 'Duration must be 5–600 minutes.';
      if (durationMin === null && active) errors.durationMin = 'Set a duration before showing this service when billing.';
      const category = input.category ?? '';
      if (!getDb().settings.serviceCategories.includes(category)) errors.category = 'Choose a category.';
      if (getDb().services.some((s) => s.id !== input.id && s.name.toLowerCase() === name.toLowerCase())) errors.name = 'A service with this name already exists.';
      if (input.published && price === null) errors.price = 'Set a price before showing this service on the website.';
      if (Object.keys(errors).length) fail(422, 'Please check the highlighted fields.', errors);
      return {
        name,
        price: price === null ? null : Math.round(price * 100) / 100,
        durationMin,
        category,
        image: String(input.image || '').trim().slice(0, 500),
        active,
        published: !!input.published,
      };
    },

    appointment(input: AppointmentInput): AppointmentFields {
      const errors: FieldErrors = {};
      const { customerId = '', date = '', time = '' } = input;
      if (!custById(customerId)) errors.customerId = 'Choose a customer.';
      if (!DATE_RE.test(input.date || '')) errors.date = 'Choose a date.';
      if (!/^\d{2}:\d{2}$/.test(input.time || '')) errors.time = 'Choose a time.';
      const serviceIds = (input.serviceIds || []).filter((id) => svcById(id));
      if (!serviceIds.length) errors.serviceIds = 'Choose at least one service.';
      if (input.status && !isOneOf(APPOINTMENT_STATUSES, input.status)) errors.status = 'Unknown status.';
      if (Object.keys(errors).length) fail(422, 'Please check the highlighted fields.', errors);
      return {
        customerId,
        serviceIds,
        date,
        time,
        staff: String(input.staff || '').slice(0, 60),
        status: isOneOf(APPOINTMENT_STATUSES, input.status) ? input.status : 'upcoming',
        notes: String(input.notes || '').trim().slice(0, 500),
      };
    },

    expense(input: ExpenseInput): ExpenseFields {
      const errors: FieldErrors = {};
      const { date = '', category = '' } = input;
      const amount = Math.round(Number(input.amount) * 100) / 100;
      if (!DATE_RE.test(date) || date > today()) errors.date = 'Choose a date that is not in the future.';
      if (!getDb().settings.expenseCategories.includes(category)) errors.category = 'Choose a category.';
      if (String(input.description || '').trim().length < 2) errors.description = 'Describe the expense.';
      if (!(amount > 0 && amount <= 10000000)) errors.amount = 'Enter an amount above ₹0.';
      if (Object.keys(errors).length) fail(422, 'Please check the highlighted fields.', errors);
      return {
        date,
        category,
        description: String(input.description).trim().slice(0, 120),
        amount,
        method: isOneOf(PAYMENT_METHODS, input.method) ? input.method : 'cash',
      };
    },

    settings(input: SettingsInput): SettingsFields {
      const current = getDb().settings;
      const rate = Number(input.taxRate);
      if (input.taxEnabled && !(rate > 0 && rate <= 28)) fail(422, 'Enter a tax rate between 0 and 28%.', { taxRate: 'Enter a rate between 0 and 28%.' });
      const list = (v: unknown, fallback: string[]) => (Array.isArray(v) ? v.map((x) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 50) : fallback);
      return {
        taxEnabled: !!input.taxEnabled,
        taxRate: input.taxEnabled ? rate : 0,
        taxLabel: String(input.taxLabel || 'GST').slice(0, 20),
        staff: list(input.staff, current.staff),
        invoiceFooter: String(input.invoiceFooter ?? current.invoiceFooter).slice(0, 300),
      };
    },

    /** What a draft remembers as received (nothing is recorded until the bill is generated). */
    draftPayment(p: PaymentInput | null | undefined): PaymentDraft | null {
      if (!p) return null;
      return {
        amount: Math.max(0, Math.round((Number(p.amount) || 0) * 100) / 100),
        method: isOneOf(PAYMENT_METHODS, p.method) ? p.method : 'cash',
        reference: String(p.reference || '').slice(0, 60),
      };
    },

    /** Amount above the balance is change handed back, not money kept. */
    payment(p: PaymentInput, balance: number): PaymentDraft {
      const amount = Math.round((Number(p.amount) || 0) * 100) / 100;
      if (amount < 0) fail(422, 'Amount received cannot be negative.', { amount: 'Cannot be negative.' });
      if (!isOneOf(PAYMENT_METHODS, p.method)) fail(422, 'Choose a payment method.', { method: 'Choose a method.' });
      return { amount: Math.min(amount, balance), method: p.method, reference: String(p.reference || '').trim().slice(0, 60) };
    },

    /** Invoice fields from what the bill screen sent. Prices come from the service list, never from the page. */
    invoice(payload: InvoicePayload, existing?: Pick<Invoice, 'items'> | null, { draft = false }: { draft?: boolean } = {}): InvoiceFields {
      const errors: FieldErrors = {};
      const date = payload.date && DATE_RE.test(payload.date) ? payload.date : today();
      let customerId: string | null = null;
      let walkIn: WalkIn | null = null;
      if (payload.customerId) {
        if (!custById(payload.customerId)) errors.customer = 'Customer not found.';
        customerId = payload.customerId;
      } else {
        walkIn = { name: String(payload.walkIn?.name || '').trim().slice(0, 80) || 'Walk-in customer', phone: String(payload.walkIn?.phone || '').trim().slice(0, 20) };
      }
      if (!draft && (!Array.isArray(payload.items) || !payload.items.length)) errors.items = 'Add at least one service.';
      if ((payload.items || []).length > 50) errors.items = 'A bill can have at most 50 lines.';
      const items = (payload.items || []).map((it): InvoiceItem | null => {
        const svc = svcById(it.serviceId);
        const prev = existing?.items?.find((x) => x.serviceId === it.serviceId);
        if (!svc && !prev) errors.items = 'One of the services no longer exists.';
        const qty = Math.floor(Number(it.qty));
        if (!(qty >= 1 && qty <= 20)) errors.items = 'Quantities must be between 1 and 20.';
        // The price already saved on this bill, or the service list's current price.
        const src = prev || svc;
        if (!src) return null;
        const price = src.price;
        if (price === null || !(price > 0)) {
          errors.items = `${src.name} has no price yet. Set it under Services first.`;
          return null;
        }
        return {
          serviceId: it.serviceId,
          name: src.name,
          category: src.category,
          durationMin: src.durationMin,
          price,
          qty,
          discount: Math.max(0, Number(it.discount) || 0),
        };
      }).filter((l): l is InvoiceItem => l !== null);
      if (items.some((l) => l.discount > l.price * l.qty)) errors.items = 'A line discount cannot exceed its amount.';
      const billDiscount = Math.max(0, Number(payload.billDiscount) || 0);
      const s = getDb().settings;
      const taxRate = s.taxEnabled ? s.taxRate : 0;
      const totals = computeTotals(items, billDiscount, taxRate);
      if (billDiscount > totals.subtotal) errors.discount = 'Discount cannot exceed the bill.';
      if (!draft && totals.discount > 0 && !String(payload.discountReason || '').trim()) errors.discountReason = 'Give a reason for the discount.';
      if (payload.appointmentId && !getDb().appointments.some((a) => a.id === payload.appointmentId)) errors.appointment = 'Appointment not found.';
      if (Object.keys(errors).length) fail(422, Object.values(errors)[0], errors);
      return {
        date,
        customerId,
        walkIn,
        appointmentId: payload.appointmentId || null,
        staff: String(payload.staff || '').slice(0, 60),
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
    },
  };

  /* ---------- read views (synchronous; each backend wraps them) ---------- */
  const views = {
    search(q: string) {
      const db = getDb();
      const t = lower(q).trim();
      if (t.length < 2) return { customers: [], invoices: [], appointments: [] };
      const customers = db.customers.filter((c) => [c.name, c.phone, c.email].some((v) => lower(v).includes(t))).slice(0, 5);
      const invoices = db.invoices
        .filter((i) => lower(i.number).includes(t) || lower(invoiceName(i)).includes(t))
        .slice(-5)
        .reverse()
        .map(withCustomer);
      const appointments = db.appointments
        .filter((a) => a.date >= today() && lower(custById(a.customerId)?.name).includes(t))
        .slice(0, 5)
        .map(apptView);
      return { customers, invoices, appointments };
    },

    notifications(): AdminNotification[] {
      const db = getDb();
      const T = today();
      const items: AdminNotification[] = [];
      const upcoming = db.appointments.filter((a) => a.date === T && a.status === 'upcoming');
      if (upcoming.length) items.push({ id: 'n1', kind: 'appointments', text: `${upcoming.length} appointment${upcoming.length > 1 ? 's' : ''} still to come today`, to: '/admin/appointments' });
      const unpaid = issued().filter((i) => i.balance > 0);
      if (unpaid.length) items.push({ id: 'n2', kind: 'invoices', text: `${unpaid.length} invoice${unpaid.length > 1 ? 's have' : ' has'} an outstanding balance`, to: '/admin/invoices?status=pending' });
      const drafts = db.invoices.filter((i) => i.status === 'draft');
      if (drafts.length) items.push({ id: 'n3', kind: 'drafts', text: `${drafts.length} draft bill${drafts.length > 1 ? 's' : ''} not yet generated`, to: '/admin/invoices?status=draft' });
      return items;
    },

    dashboard({ range = 'this_month' }: { range?: DashboardRange } = {}) {
      const db = getDb();
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
      const methods: Partial<Record<PaymentMethod, number>> = {};
      for (const p of paymentsInLocal(from, to)) methods[p.method] = (methods[p.method] || 0) + p.amount;

      const upcoming = db.appointments
        .filter((a) => a.status === 'upcoming' && a.date >= T)
        .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
        .slice(0, 6)
        .map(apptView);

      return {
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
        recentInvoices: issued().sort(byCreated).slice(-6).reverse().map(withCustomer),
        upcoming,
      };
    },

    customers: {
      list({ q = '', segment = 'all', status = 'all', sort = 'recent', page = 1, pageSize = 10 }: CustomerListQuery = {}) {
        const db = getDb();
        const T = today();
        const monthStart = `${T.slice(0, 8)}01`;
        const t = q.trim().toLowerCase();
        let rows = db.customers.map((c) => ({ ...c, ...customerStats(c) }));
        const summary = {
          total: rows.length,
          newThisMonth: rows.filter((c) => c.createdAt >= monthStart).length,
          repeat: rows.filter((c) => c.totalVisits > 1).length,
          walkIns: issued().filter((i) => !i.customerId).length,
        };
        if (t) rows = rows.filter((c) => [c.name, c.phone, c.email].some((v) => lower(v).includes(t)));
        if (segment === 'new') rows = rows.filter((c) => c.createdAt >= monthStart);
        if (segment === 'repeat') rows = rows.filter((c) => c.totalVisits > 1);
        if (segment === 'never') rows = rows.filter((c) => c.totalVisits === 0);
        if (status !== 'all') rows = rows.filter((c) => c.status === status);
        type Row = (typeof rows)[number];
        const by: Record<NonNullable<CustomerListQuery['sort']>, (a: Row, b: Row) => number> = {
          recent: (a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''),
          name: (a, b) => a.name.localeCompare(b.name),
          spent: (a, b) => b.totalSpent - a.totalSpent,
          visits: (a, b) => b.totalVisits - a.totalVisits,
        };
        rows.sort(by[sort] || by.recent);
        return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize, summary };
      },
      get(id: string) {
        const db = getDb();
        const c = custById(id);
        if (!c) fail(404, 'Customer not found.');
        return {
          ...c,
          ...customerStats(c),
          appointments: db.appointments
            .filter((a) => a.customerId === id)
            .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
            .map(apptView),
          invoices: db.invoices.filter((i) => i.customerId === id).sort(byCreated).reverse().map(withCustomer),
        };
      },
      lookup(q: string) {
        const t = lower(q).trim();
        return getDb()
          .customers.filter((c) => c.status === 'active' && (!t || [c.name, c.phone, c.email].some((v) => lower(v).includes(t))))
          .slice(0, 8);
      },
    },

    services: {
      list({ q = '', category = 'all', includeInactive = false }: ServiceListQuery = {}) {
        const t = q.trim().toLowerCase();
        const usage: Record<string, number> = {};
        for (const inv of issued()) for (const l of inv.items) usage[l.serviceId] = (usage[l.serviceId] || 0) + l.qty;
        return getDb()
          .services.filter((s) => (includeInactive || s.active) && (category === 'all' || s.category === category) && (!t || s.name.toLowerCase().includes(t)))
          .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
          .map((s) => ({ ...s, bookings: usage[s.id] || 0 }));
      },
    },

    appointments: {
      list({ from, to, status = 'all', q = '' }: AppointmentListQuery = {}) {
        const t = q.trim().toLowerCase();
        return getDb()
          .appointments.filter((a) => inRange(a.date, from, to) && (status === 'all' || a.status === status))
          .map(apptView)
          .filter((a) => !t || a.customerName.toLowerCase().includes(t) || a.customerPhone.includes(t))
          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      },
      view: (a: Appointment) => apptView(a),
    },

    invoices: {
      list({ q = '', status = 'all', from, to, page = 1, pageSize = 12 }: InvoiceListQuery = {}) {
        const t = q.trim().toLowerCase();
        let rows = getDb()
          .invoices.filter((i) => inRange(i.date, from, to))
          .map(withCustomer)
          .filter((i) => !t || lower(i.number).includes(t) || i.customerName.toLowerCase().includes(t));
        if (status === 'draft') rows = rows.filter((i) => i.status === 'draft');
        else if (status === 'pending') rows = rows.filter((i) => i.status === 'issued' && i.balance > 0);
        else if (status !== 'all') rows = rows.filter((i) => i.status === 'issued' && i.paymentStatus === status);
        rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const done = rows.filter((i) => i.status === 'issued');
        const totals = { billed: sum(done, (i) => i.total), collected: sum(done, (i) => i.paid), pending: sum(done, (i) => i.balance) };
        return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize, totals };
      },
      get(id: string) {
        const db = getDb();
        const inv = db.invoices.find((i) => i.id === id);
        if (!inv) fail(404, 'Invoice not found.');
        const appt = inv.appointmentId ? db.appointments.find((a) => a.id === inv.appointmentId) : null;
        return { ...withCustomer(inv), appointment: appt ? apptView(appt) : null };
      },
      nextNumber(date = today()) {
        const year = date.slice(0, 4);
        return formatInvoiceNumber(year, maxInvoiceSeq(getDb().invoices, year) + 1);
      },
      view: (inv: Invoice) => withCustomer(inv),
    },

    expenses: {
      list({ from, to, category = 'all' }: ExpenseListQuery = {}) {
        return getDb()
          .expenses.filter((e) => inRange(e.date, from, to) && (category === 'all' || e.category === category))
          .sort((a, b) => b.date.localeCompare(a.date));
      },
    },

    report({ from, to, group = 'daily', compare = 'previous' }: ReportQuery) {
      const db = getDb();
      const len = daysBetween(from, to) + 1;
      const pFrom = addDays(from, -len);
      const pTo = addDays(from, -1);
      const period = (a: string, b: string) => {
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
      const keys = ['billed', 'collected', 'pending', 'discounts', 'expenses'] as const;
      type Figure = { value: number; previous: number | null; change: number | null };
      const summary = Object.fromEntries(
        keys.map((k) => [k, { value: cur[k], previous: prev ? prev[k] : null, change: prev ? change(cur[k], prev[k]) : null }]),
      ) as Record<(typeof keys)[number], Figure>;

      // trend buckets
      const bucketOf = (d: string) => {
        if (group === 'monthly') return `${d.slice(0, 7)}-01`;
        if (group === 'weekly') return addDays(from, Math.floor(daysBetween(from, d) / 7) * 7);
        return d;
      };
      const buckets = new Map<string, { key: string; label: string; billed: number; collected: number }>();
      for (let k = 0; k < len; k++) {
        const b = bucketOf(addDays(from, k));
        if (!buckets.has(b)) buckets.set(b, { key: b, label: group === 'monthly' ? fmtMonth(b) : fmtDay(b), billed: 0, collected: 0 });
      }
      for (const i of cur.invs) {
        const b = buckets.get(bucketOf(i.date));
        if (b) b.billed += i.total;
      }
      for (const p of cur.pays) {
        const b = buckets.get(bucketOf(localDay(p.at)));
        if (b) b.collected += p.amount;
      }

      // by service
      const svc: Record<string, { name: string; bookings: number; revenue: number }> = {};
      for (const i of cur.invs) {
        const share = i.subtotal ? i.total / i.subtotal : 0;
        for (const l of i.items) {
          svc[l.name] ||= { name: l.name, bookings: 0, revenue: 0 };
          svc[l.name].bookings += l.qty;
          svc[l.name].revenue += l.price * l.qty * share;
        }
      }
      const services = Object.values(svc).sort((a, b) => b.revenue - a.revenue).map((s) => ({ ...s, revenue: Math.round(s.revenue) }));

      const methods: Partial<Record<PaymentMethod, number>> = {};
      for (const p of cur.pays) methods[p.method] = (methods[p.method] || 0) + p.amount;
      const expenseCats: Record<string, number> = {};
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

      const invs = [...cur.invs].sort(byCreated);
      return {
        from,
        to,
        previous: prev ? { from: pFrom, to: pTo } : null,
        summary,
        trend: [...buckets.values()],
        services,
        paymentMethods: methods,
        months,
        expensesByCategory: expenseCats,
        recentInvoices: invs.slice(-8).reverse().map(withCustomer),
        transactions,
        invoices: invs.map(withCustomer),
      };
    },
  };

  return { validate, views };
}

export type Engine = ReturnType<typeof createEngine>;
export type Views = Engine['views'];

const byCreated = (a: { createdAt?: string }, b: { createdAt?: string }) => (a.createdAt || '').localeCompare(b.createdAt || '');
