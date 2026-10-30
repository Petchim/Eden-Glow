/* =====================================================================
   ADMIN DATA MODEL — the records the admin keeps in Cloud Firestore.
   ---------------------------------------------------------------------
   Field lists match firestore.rules (which enforces them on the server)
   and src/admin/README.md. Dates are local 'YYYY-MM-DD' strings,
   timestamps are ISO strings and amounts are rupees.
   `updatedAt` is a server timestamp, read back as an ISO string.
   ===================================================================== */

/** Local calendar day, 'YYYY-MM-DD'. */
export type ISODate = string;
/** ISO 8601 timestamp, e.g. new Date().toISOString(). */
export type ISODateTime = string;

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'other';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';
export type InvoiceStatus = 'draft' | 'issued';
export type AppointmentStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type CustomerStatus = 'active' | 'inactive';

/** admins/{uid}: created by hand in the Firebase Console; marks the owner's Auth account. */
export interface AdminRecord {
  name: string;
  email: string;
}

/** The signed-in owner, as the screens see them. */
export interface AdminProfile {
  name: string;
  email: string | null;
}

/** services/{id}. Public visitors may read it only when `published` is true. */
export interface Service {
  id: string;
  name: string;
  category: string;
  /** null until the owner sets a price (e.g. after importing the website menu). */
  price: number | null;
  durationMin: number | null;
  image: string;
  /** Offered when billing. Needs a price and a duration. */
  active: boolean;
  /** Shown on the public website. Needs a price. */
  published: boolean;
  updatedAt?: ISODateTime;
}

/** customers/{id}. Never deleted; marked inactive instead. */
export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  area: string;
  notes: string;
  status: CustomerStatus;
  createdAt: ISODate;
  updatedAt?: ISODateTime;
}

/** appointments/{id}. Never deleted; cancelled instead. */
export interface Appointment {
  id: string;
  customerId: string;
  serviceIds: string[];
  date: ISODate;
  /** 'HH:MM', 24-hour. */
  time: string;
  staff: string;
  status: AppointmentStatus;
  notes: string;
  invoiceId: string | null;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime;
}

/** One bill line, keeping the price it was billed at. */
export interface InvoiceItem {
  serviceId: string;
  name: string;
  category: string;
  durationMin: number | null;
  price: number;
  qty: number;
  /** Rupees off this line. */
  discount: number;
}

export interface WalkIn {
  name: string;
  phone: string;
}

/** What the owner entered as received, before the payment is recorded. */
export interface PaymentDraft {
  amount: number;
  method: PaymentMethod;
  reference: string;
}

/** payments/{id}: append-only. In a data snapshot, also listed under its invoice. */
export interface Payment extends PaymentDraft {
  id: string;
  invoiceId?: string;
  at: ISODateTime;
}

/** invoices/{id}. A draft has no number; an issued invoice only takes payments and notes. */
export interface Invoice {
  id: string;
  date: ISODate;
  customerId: string | null;
  walkIn: WalkIn | null;
  appointmentId: string | null;
  staff: string;
  items: InvoiceItem[];
  billDiscount: number;
  discountReason: string;
  notes: string;
  taxRate: number;
  taxLabel: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  /** 'INV-YYYY-NNNN' once issued, null for a draft. */
  number: string | null;
  issuedAt?: ISODateTime;
  createdAt: ISODateTime;
  internalNote: string;
  paid: number;
  balance: number;
  paymentStatus: PaymentStatus;
  draftPayment?: PaymentDraft | null;
  /** This invoice's payments (joined in by each backend; not a Firestore field). */
  payments: Payment[];
  updatedAt?: ISODateTime;
}

/** expenses/{id}. */
export interface Expense {
  id: string;
  date: ISODate;
  category: string;
  description: string;
  amount: number;
  method: PaymentMethod;
  updatedAt?: ISODateTime;
}

/** settings/studio. */
export interface StudioSettings {
  taxEnabled: boolean;
  taxLabel: string;
  /** Percent, 0–28. */
  taxRate: number;
  staff: string[];
  expenseCategories: string[];
  serviceCategories: string[];
  invoiceFooter: string;
  /** Demo mode only: when the sample data was generated. */
  demo?: { seededOn: ISODate };
}

/** Everything the engine computes its views from (see src/admin/api/engine.ts). */
export interface DataSnapshot {
  services: Service[];
  customers: Customer[];
  appointments: Appointment[];
  invoices: Invoice[];
  expenses: Expense[];
  settings: StudioSettings;
}
