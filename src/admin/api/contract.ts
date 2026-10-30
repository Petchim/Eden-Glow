/* =====================================================================
   ADMIN API CONTRACT — what every backend behind src/admin/api provides.
   ---------------------------------------------------------------------
   Implemented by the Firebase backend (./firestoreApi.ts) and the demo
   mock (../mock/mockApi.ts). Response types come from the shared views
   in ./engine.ts, so both backends answer with the same shapes.
   ===================================================================== */
import type { AdminProfile, AppointmentStatus, Customer, Expense, Service, StudioSettings } from '../../types/models.ts';
import type { MenuItem } from '../lib/websiteMenu.ts';
import type {
  AdminNotification,
  AppointmentInput,
  AppointmentListQuery,
  CustomerInput,
  CustomerListQuery,
  DashboardRange,
  ExpenseInput,
  ExpenseListQuery,
  InvoiceListQuery,
  InvoicePayload,
  PaymentInput,
  ReportQuery,
  ServiceInput,
  ServiceListQuery,
  SettingsInput,
  Views,
} from './engine.ts';

export type {
  AdminNotification,
  AppointmentInput,
  AppointmentListQuery,
  CustomerInput,
  CustomerListQuery,
  DashboardRange,
  ExpenseInput,
  ExpenseListQuery,
  FieldErrors,
  InvoiceLineInput,
  InvoiceListQuery,
  InvoicePayload,
  PaymentInput,
  ReportQuery,
  ServiceInput,
  ServiceListQuery,
  SettingsInput,
} from './engine.ts';

/* ---------- responses ---------- */
export type SearchResults = ReturnType<Views['search']>;
export type DashboardData = ReturnType<Views['dashboard']>;
export type CustomerList = ReturnType<Views['customers']['list']>;
export type CustomerRow = CustomerList['items'][number];
export type CustomerDetail = ReturnType<Views['customers']['get']>;
export type ServiceRow = ReturnType<Views['services']['list']>[number];
export type AppointmentView = ReturnType<Views['appointments']['view']>;
export type InvoiceList = ReturnType<Views['invoices']['list']>;
export type InvoiceView = ReturnType<Views['invoices']['view']>;
export type InvoiceDetail = ReturnType<Views['invoices']['get']>;
export type ReportData = ReturnType<Views['report']>;

export interface LoginInput {
  email: string;
  password: string;
  /** Keep the session after the browser closes. */
  remember?: boolean;
}

export interface AdminApi {
  auth: {
    login(creds: LoginInput): Promise<AdminProfile>;
    logout(): Promise<void>;
    /** The signed-in owner, or null. */
    me(): Promise<AdminProfile | null>;
    resetPassword(email: string): Promise<void>;
  };
  search(q: string): Promise<SearchResults>;
  notifications(): Promise<AdminNotification[]>;
  dashboard(opts?: { range?: DashboardRange }): Promise<DashboardData>;
  customers: {
    list(query?: CustomerListQuery): Promise<CustomerList>;
    get(id: string): Promise<CustomerDetail>;
    lookup(q: string): Promise<Customer[]>;
    create(input: CustomerInput): Promise<Customer>;
    update(id: string, input: CustomerInput): Promise<Customer>;
  };
  services: {
    list(query?: ServiceListQuery): Promise<ServiceRow[]>;
    save(input: ServiceInput): Promise<Service>;
    /** Adds the website's treatments that are not in the list yet. */
    importMenu(items: MenuItem[]): Promise<{ added: number; skipped: number }>;
  };
  appointments: {
    list(query?: AppointmentListQuery): Promise<AppointmentView[]>;
    save(input: AppointmentInput): Promise<AppointmentView>;
    setStatus(id: string, status: AppointmentStatus): Promise<AppointmentView>;
  };
  invoices: {
    list(query?: InvoiceListQuery): Promise<InvoiceList>;
    get(id: string): Promise<InvoiceDetail>;
    nextNumber(date?: string): Promise<string>;
    saveDraft(payload: InvoicePayload): Promise<InvoiceView>;
    issue(payload: InvoicePayload, idempotencyKey?: string): Promise<InvoiceView>;
    addPayment(id: string, payment: PaymentInput, idempotencyKey?: string): Promise<InvoiceView>;
    saveNote(id: string, note: string): Promise<InvoiceView>;
    discardDraft(id: string): Promise<boolean>;
  };
  expenses: {
    list(query?: ExpenseListQuery): Promise<Expense[]>;
    save(input: ExpenseInput): Promise<Expense>;
    remove(id: string): Promise<boolean>;
  };
  report(query: ReportQuery): Promise<ReportData>;
  settings: {
    get(): Promise<StudioSettings>;
    update(input: SettingsInput): Promise<StudioSettings>;
    /** Demo mode only. */
    resetDemoData(): Promise<boolean>;
  };
}
