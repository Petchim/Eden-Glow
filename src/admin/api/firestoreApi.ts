/* =====================================================================
   FIRESTORE BACKEND — implements the admin API contract with Firebase.
   ---------------------------------------------------------------------
   Sign-in: Firebase Authentication (email + password). Only a user who
   also has a document at admins/{uid} is treated as the owner; the
   same check is enforced on the server by firestore.rules, so hiding
   screens in React is never the protection.

   Data: after the owner signs in, each admin collection is kept in sync
   in memory (onSnapshot) and the screens' views are computed from it by
   engine.ts. Writes go straight to Firestore. Invoice numbers, invoice
   + first payment, and later payments are saved in transactions, with
   the screen's idempotency key so a double submit can't save twice.

   Collections (see firestore.rules and src/admin/README.md):
     admins/{uid} · services · customers · appointments · invoices ·
     payments · expenses · settings/studio · counters · requestKeys
   ===================================================================== */
import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebase, firebaseConfigured, missingFirebaseConfig } from '../../lib/firebase.ts';
import type {
  AdminProfile,
  AdminRecord,
  Appointment,
  AppointmentStatus,
  Customer,
  DataSnapshot,
  Expense,
  Invoice,
  Payment,
  Service,
  StudioSettings,
} from '../../types/models.ts';
import { paymentStatus } from '../lib/billing.ts';
import { today } from '../lib/format.ts';
import type { MenuItem } from '../lib/websiteMenu.ts';
import type { AdminApi, LoginInput } from './contract.ts';
import {
  ApiError,
  applyPayments,
  createEngine,
  DEFAULT_SETTINGS,
  fail,
  formatInvoiceNumber,
  maxInvoiceSeq,
  type AppointmentInput,
  type CustomerInput,
  type ExpenseInput,
  type InvoicePayload,
  type PaymentInput,
  type ServiceFields,
  type ServiceInput,
  type SettingsInput,
} from './engine.ts';

export { ApiError };

/** Invoices as stored: their payments live in the `payments` collection. */
type StoredInvoice = Omit<Invoice, 'payments'>;
type StoredPayment = Payment & { invoiceId: string };
/** Document type of each synced collection. */
interface Docs {
  services: Service;
  customers: Customer;
  appointments: Appointment;
  invoices: StoredInvoice;
  payments: StoredPayment;
  expenses: Expense;
}
type ListName = keyof Docs;

const LISTS: ListName[] = ['services', 'customers', 'appointments', 'invoices', 'payments', 'expenses'];
const round2 = (n: number) => Math.round(n * 100) / 100;
const stamp = () => ({ updatedAt: serverTimestamp() });
const notConfigured = () => `The admin is not connected to Firebase yet. Add ${missingFirebaseConfig().join(', ')} to .env.local and restart.`;

/* ---------- errors ---------- */
function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const code = String((e as { code?: unknown } | null)?.code || '');
  const map: Record<string, [status: number, message: string]> = {
    'permission-denied': [403, 'You don’t have permission to do that. Sign in again with the owner account.'],
    unauthenticated: [401, 'Your session has expired. Please sign in again.'],
    unavailable: [503, 'Can’t reach the server. Check the internet connection and try again.'],
    'deadline-exceeded': [503, 'The server took too long to answer. Please try again.'],
    'not-found': [404, 'That record no longer exists.'],
    aborted: [409, 'This record was changed at the same moment. Please try again.'],
    'resource-exhausted': [429, 'Too many requests right now. Please wait a moment and try again.'],
    'auth/invalid-credential': [401, 'Incorrect email or password.'],
    'auth/invalid-login-credentials': [401, 'Incorrect email or password.'],
    'auth/wrong-password': [401, 'Incorrect email or password.'],
    'auth/user-not-found': [401, 'Incorrect email or password.'],
    'auth/invalid-email': [401, 'Incorrect email or password.'],
    'auth/too-many-requests': [429, 'Too many attempts. Please wait a few minutes and try again.'],
    'auth/user-disabled': [403, 'This account has been disabled.'],
    'auth/network-request-failed': [503, 'Can’t reach the server. Check the internet connection and try again.'],
    'auth/operation-not-allowed': [503, 'Email/password sign-in is not enabled for this Firebase project.'],
    'auth/invalid-api-key': [503, 'The Firebase API key is not valid. Check VITE_FIREBASE_API_KEY.'],
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': [503, 'The Firebase API key is not valid. Check VITE_FIREBASE_API_KEY.'],
  };
  const hit = map[code];
  if (hit) return new ApiError(hit[0], hit[1]);
  console.error('[admin] Firebase error', e);
  return new ApiError(500, 'Something went wrong. Please try again.');
}

/* ---------- in-memory copy of the admin collections ---------- */
const cache: { [N in ListName]: Map<string, Docs[N]> } = {
  services: new Map(),
  customers: new Map(),
  appointments: new Map(),
  invoices: new Map(),
  payments: new Map(),
  expenses: new Map(),
};
let settingsDoc: Partial<StudioSettings> | null = null;
let version = 0;
let built: { version: number; db: DataSnapshot } | null = null;

/** Firestore Timestamps become ISO strings, like every other date the screens use. */
const plain = (data: DocumentData = {}): DocumentData =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v instanceof Timestamp ? v.toDate().toISOString() : v]));
/** A document as a typed record. Its shape is enforced on every write by firestore.rules. */
const fromDoc = <T>(d: DocumentSnapshot): T => ({ ...plain(d.data()), id: d.id }) as T;
/** Merge `data` into the cached copy (the full record for a new one). */
const put = <N extends ListName>(name: N, id: string, data: Partial<Docs[N]>) => {
  const map = cache[name] as Map<string, Docs[N]>;
  map.set(id, { ...map.get(id), ...data, id } as Docs[N]);
  version += 1;
};

function getDb(): DataSnapshot {
  if (built && built.version === version) return built.db;
  const byInvoice = new Map<string, Payment[]>();
  for (const p of cache.payments.values()) {
    const list = byInvoice.get(p.invoiceId) ?? [];
    list.push(p);
    byInvoice.set(p.invoiceId, list);
  }
  const createdOrder = (a: { createdAt?: string }, b: { createdAt?: string }) => (a.createdAt || '').localeCompare(b.createdAt || '');
  const invoices = [...cache.invoices.values()]
    .map((inv): Invoice => applyPayments({ ...inv, payments: (byInvoice.get(inv.id) || []).sort((a, b) => a.at.localeCompare(b.at)) }))
    .sort(createdOrder);
  built = {
    version,
    db: {
      services: [...cache.services.values()],
      customers: [...cache.customers.values()].sort(createdOrder),
      appointments: [...cache.appointments.values()],
      invoices,
      expenses: [...cache.expenses.values()],
      settings: { ...DEFAULT_SETTINGS, ...(settingsDoc || {}) },
    },
  };
  return built.db;
}

const { validate, views } = createEngine(getDb);

/* ---------- live sync ---------- */
let sync: { unsubs: Unsubscribe[]; ready: Promise<void> } | null = null;

function stopSync() {
  if (sync) sync.unsubs.forEach((u) => u());
  sync = null;
  for (const n of LISTS) cache[n].clear();
  settingsDoc = null;
  version += 1;
}

function startSync(): Promise<void> {
  if (sync) return sync.ready;
  const { db } = firebase();
  const current = { unsubs: [] as Unsubscribe[], ready: Promise.resolve() };
  sync = current;
  current.ready = new Promise<void>((resolve, reject) => {
    let pending = LISTS.length + 1;
    const loaded = () => --pending === 0 && resolve();
    const failed = (e: unknown) => {
      if (sync === current) stopSync();
      reject(toApiError(e));
    };
    for (const name of LISTS) {
      const map: Map<string, Docs[ListName]> = cache[name];
      let first = true;
      current.unsubs.push(
        onSnapshot(
          collection(db, name),
          (snap) => {
            for (const ch of snap.docChanges()) {
              if (ch.type === 'removed') map.delete(ch.doc.id);
              else map.set(ch.doc.id, fromDoc<Docs[ListName]>(ch.doc));
            }
            version += 1;
            if (first) (first = false), loaded();
          },
          failed,
        ),
      );
    }
    let first = true;
    current.unsubs.push(
      onSnapshot(
        doc(db, 'settings', 'studio'),
        (snap) => {
          settingsDoc = snap.exists() ? (plain(snap.data()) as Partial<StudioSettings>) : null;
          version += 1;
          if (first) (first = false), loaded();
        },
        failed,
      ),
    );
  });
  return current.ready;
}

/* ---------- auth ---------- */
let authReady: Promise<void> | null = null;
let verifiedUid: string | null = null;

/** The signed-in Firebase user once Firebase has restored any saved session, or null. */
function currentUser(): Promise<User | null> {
  const { auth } = firebase();
  if (!authReady) {
    authReady = new Promise<void>((resolve) => {
      let first = true;
      onAuthStateChanged(auth, (user) => {
        if (!user || user.uid !== verifiedUid) {
          verifiedUid = null;
          stopSync();
        }
        if (first) (first = false), resolve();
      });
    });
  }
  return authReady.then(() => auth.currentUser);
}

/** The owner's profile if this user is listed in admins/{uid}, otherwise null. */
async function adminProfile(user: User): Promise<AdminProfile | null> {
  const snap = await getDoc(doc(firebase().db, 'admins', user.uid));
  if (!snap.exists()) return null;
  const record = snap.data() as Partial<AdminRecord>;
  return { name: record.name || user.displayName || 'Owner', email: user.email };
}

async function requireAdmin() {
  if (!firebaseConfigured()) fail(503, notConfigured());
  const user = await currentUser();
  if (!user) fail(401, 'Your session has expired. Please sign in again.');
  if (verifiedUid !== user.uid) {
    if (!(await adminProfile(user))) fail(403, 'This account is not authorised to use the Eden Glow admin.');
    verifiedUid = user.uid;
  }
  await startSync();
}

/** Every call: check the owner is signed in, run, and hand the screen its own copy. */
const call = <A extends unknown[], R>(fn: (...args: A) => R) => async (...args: A): Promise<Awaited<R>> => {
  try {
    await requireAdmin();
    return structuredClone(await fn(...args));
  } catch (e) {
    throw toApiError(e);
  }
};
const ref = (name: string, id?: string): DocumentReference =>
  id ? doc(firebase().db, name, id) : doc(collection(firebase().db, name));
const cached = <N extends ListName>(name: N, id: string, message: string): Docs[N] =>
  (cache[name] as Map<string, Docs[N]>).get(id) || fail(404, message);
const invoiceView = (id: string) => {
  const inv = getDb().invoices.find((i) => i.id === id);
  if (!inv) fail(404, 'Invoice not found.');
  return views.invoices.view(inv);
};

/* ===================================================================== */
export const firestoreApi: AdminApi = {
  auth: {
    async login({ email, password, remember }: LoginInput) {
      if (!firebaseConfigured()) fail(503, notConfigured());
      const { auth } = firebase();
      try {
        await currentUser();
        await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence).catch(() => {});
        const { user } = await signInWithEmailAndPassword(auth, String(email).trim(), password);
        const profile = await adminProfile(user);
        if (!profile) {
          await signOut(auth);
          fail(403, 'This account is not authorised to use the Eden Glow admin.');
        }
        verifiedUid = user.uid;
        return profile;
      } catch (e) {
        throw toApiError(e);
      }
    },
    async logout() {
      verifiedUid = null;
      stopSync();
      if (firebaseConfigured()) await signOut(firebase().auth);
    },
    async me() {
      if (!firebaseConfigured()) return null;
      try {
        const user = await currentUser();
        if (!user) return null;
        const profile = await adminProfile(user);
        if (!profile) {
          await signOut(firebase().auth);
          return null;
        }
        verifiedUid = user.uid;
        return profile;
      } catch (e) {
        throw toApiError(e);
      }
    },
    async resetPassword(email: string) {
      if (!firebaseConfigured()) fail(503, notConfigured());
      try {
        await sendPasswordResetEmail(firebase().auth, String(email).trim());
      } catch (e) {
        // Don't reveal whether an account exists for this address.
        if (!['auth/user-not-found', 'auth/invalid-email'].includes(String((e as { code?: unknown } | null)?.code))) throw toApiError(e);
      }
    },
  },

  search: call(views.search),
  notifications: call(views.notifications),
  dashboard: call(views.dashboard),

  /* ---------- customers ---------- */
  customers: {
    list: call(views.customers.list),
    get: call(views.customers.get),
    lookup: call(views.customers.lookup),
    create: call(async (input: CustomerInput) => {
      const r = ref('customers');
      const data = { ...validate.customer(input), createdAt: today() };
      await setDoc(r, { ...data, ...stamp() });
      put('customers', r.id, data);
      return { id: r.id, ...data };
    }),
    update: call(async (id: string, input: CustomerInput) => {
      const c = cached('customers', id, 'Customer not found.');
      const data = validate.customer({ ...c, ...input }, id);
      await updateDoc(ref('customers', id), { ...data, ...stamp() });
      put('customers', id, data);
      return cached('customers', id, 'Customer not found.');
    }),
  },

  /* ---------- services ---------- */
  services: {
    list: call(views.services.list),
    save: call(async (input: ServiceInput) => {
      const data = validate.service(input);
      if (input.id) cached('services', input.id, 'Service not found.');
      const r = ref('services', input.id);
      // Changing a price only affects new bills; saved invoices keep the price they were billed at.
      if (input.id) await updateDoc(r, { ...data, ...stamp() });
      else await setDoc(r, { ...data, ...stamp() });
      put('services', r.id, data);
      return cached('services', r.id, 'Service not found.');
    }),
    /** Add the website's treatments that are not in the list yet. Existing services are never changed. */
    importMenu: call(async (items: MenuItem[]) => {
      const have = new Set([...cache.services.values()].map((s) => s.name.toLowerCase()));
      const fresh = items.filter((it) => !have.has(it.name.toLowerCase()));
      const rows = fresh.map((it): [DocumentReference, ServiceFields] => [ref('services'), validate.service({ ...it, price: null, active: false, published: false })]);
      if (rows.length) {
        const batch = writeBatch(firebase().db);
        for (const [r, data] of rows) batch.set(r, { ...data, ...stamp() });
        await batch.commit();
        for (const [r, data] of rows) put('services', r.id, data);
      }
      return { added: rows.length, skipped: items.length - rows.length };
    }),
  },

  /* ---------- appointments ---------- */
  appointments: {
    list: call(views.appointments.list),
    save: call(async (input: AppointmentInput) => {
      const data = validate.appointment(input);
      if (input.id) {
        cached('appointments', input.id, 'Appointment not found.');
        await updateDoc(ref('appointments', input.id), { ...data, ...stamp() });
        put('appointments', input.id, data);
        return views.appointments.view(cached('appointments', input.id, 'Appointment not found.'));
      }
      const r = ref('appointments');
      const full = { ...data, invoiceId: null, createdAt: new Date().toISOString() };
      await setDoc(r, { ...full, ...stamp() });
      put('appointments', r.id, full);
      return views.appointments.view(cached('appointments', r.id, 'Appointment not found.'));
    }),
    setStatus: call(async (id: string, status: AppointmentStatus) => firestoreApi.appointments.save({ ...cached('appointments', id, 'Appointment not found.'), status })),
  },

  /* ---------- invoices ---------- */
  invoices: {
    list: call(views.invoices.list),
    get: call(views.invoices.get),
    nextNumber: call(views.invoices.nextNumber),

    /** Save without issuing. Drafts have no invoice number and no payments. */
    saveDraft: call(async (payload: InvoicePayload) => {
      const existing = payload.id ? cache.invoices.get(payload.id) : null;
      if (payload.id && existing?.status !== 'draft') fail(409, 'This bill has already been generated and can no longer be edited as a draft.');
      const fields = validate.invoice(payload, existing, { draft: true });
      const draftPayment = validate.draftPayment(payload.payment);
      const r = ref('invoices', payload.id);
      const data: Omit<StoredInvoice, 'id'> = {
        ...fields,
        status: 'draft',
        number: null,
        draftPayment,
        internalNote: existing?.internalNote || '',
        createdAt: existing?.createdAt || new Date().toISOString(),
        paid: 0,
        balance: fields.total,
        paymentStatus: paymentStatus(fields.total, 0),
      };
      await setDoc(r, { ...data, ...stamp() });
      put('invoices', r.id, data);
      return invoiceView(r.id);
    }),

    /** Generate the invoice: number, totals and first payment are saved together or not at all. */
    issue: call(async (payload: InvoicePayload, idempotencyKey?: string) => {
      const { db } = firebase();
      const keyRef = idempotencyKey ? doc(db, 'requestKeys', String(idempotencyKey)) : null;
      type Issued =
        | { replayOf: string }
        | { replayOf?: undefined; id: string; inv: Omit<StoredInvoice, 'id'>; payment: StoredPayment | null; apptId: string | null };
      const out = await runTransaction(db, async (tx): Promise<Issued> => {
        // Firestore transactions: every read first, then the writes.
        if (keyRef) {
          const k = await tx.get(keyRef);
          if (k.exists()) return { replayOf: String(k.get('invoiceId')) };
        }
        const invRef = ref('invoices', payload.id);
        let existing: StoredInvoice | null = null;
        if (payload.id) {
          const s = await tx.get(invRef);
          if (!s.exists()) fail(404, 'Invoice not found.');
          existing = fromDoc<StoredInvoice>(s);
          if (existing.status !== 'draft') fail(409, 'This invoice has already been generated.');
        }
        const fields = validate.invoice(payload, existing);
        const year = fields.date.slice(0, 4);
        const counterRef = doc(db, 'counters', `invoices-${year}`);
        const counter = await tx.get(counterRef);
        const apptRef = fields.appointmentId ? doc(db, 'appointments', fields.appointmentId) : null;
        const appt = apptRef ? await tx.get(apptRef) : null;
        if (apptRef && !appt?.exists()) fail(422, 'Appointment not found.', { appointment: 'Appointment not found.' });

        const seq = Math.max(counter.exists() ? Number(counter.get('last')) : 0, maxInvoiceSeq(getDb().invoices, year)) + 1;
        const pay = validate.payment(payload.payment || {}, fields.total);
        const now = new Date().toISOString();
        const paid = round2(pay.amount);
        const inv: Omit<StoredInvoice, 'id'> = {
          ...fields,
          status: 'issued',
          number: formatInvoiceNumber(year, seq),
          issuedAt: now,
          createdAt: existing?.createdAt || now,
          internalNote: existing?.internalNote || '',
          paid,
          balance: Math.max(round2(fields.total - paid), 0),
          paymentStatus: paymentStatus(fields.total, paid),
        };
        tx.set(invRef, { ...inv, ...stamp() });
        let payment: StoredPayment | null = null;
        if (paid > 0) {
          const payRef = ref('payments');
          payment = { id: payRef.id, invoiceId: invRef.id, ...pay, at: now };
          tx.set(payRef, { invoiceId: invRef.id, ...pay, at: now, createdAt: serverTimestamp() });
        }
        tx.set(counterRef, { last: seq, ...stamp() });
        if (keyRef) tx.set(keyRef, { invoiceId: invRef.id, createdAt: serverTimestamp() });
        if (apptRef) tx.update(apptRef, { invoiceId: invRef.id, status: 'completed', ...stamp() });
        return { id: invRef.id, inv, payment, apptId: fields.appointmentId };
      });
      if (out.replayOf !== undefined) {
        if (!cache.invoices.has(out.replayOf)) fail(409, 'This invoice was already generated. Open Invoices to see it.');
        return invoiceView(out.replayOf);
      }
      put('invoices', out.id, out.inv);
      if (out.payment) put('payments', out.payment.id, out.payment);
      if (out.apptId) put('appointments', out.apptId, { invoiceId: out.id, status: 'completed' });
      return invoiceView(out.id);
    }),

    addPayment: call(async (id: string, payment: PaymentInput, idempotencyKey?: string) => {
      const { db } = firebase();
      const invRef = ref('invoices', id);
      const payRef = ref('payments', idempotencyKey ? String(idempotencyKey) : undefined);
      type Added =
        | { replay: true }
        | { replay?: undefined; payment: Omit<StoredPayment, 'id'>; totals: Pick<StoredInvoice, 'paid' | 'balance' | 'paymentStatus'> };
      const out = await runTransaction(db, async (tx): Promise<Added> => {
        if (idempotencyKey && (await tx.get(payRef)).exists()) return { replay: true };
        const s = await tx.get(invRef);
        if (!s.exists() || s.get('status') !== 'issued') fail(404, 'Invoice not found.');
        const inv = fromDoc<StoredInvoice>(s);
        const balance = Math.max(round2(inv.total - (inv.paid || 0)), 0);
        if (balance <= 0) fail(409, 'This invoice is already fully paid.');
        const pay = validate.payment(payment, balance);
        if (pay.amount <= 0) fail(422, 'Enter the amount received.', { amount: 'Enter an amount.' });
        const paid = round2((inv.paid || 0) + pay.amount);
        const totals = { paid, balance: Math.max(round2(inv.total - paid), 0), paymentStatus: paymentStatus(inv.total, paid) };
        const at = new Date().toISOString();
        tx.set(payRef, { invoiceId: id, ...pay, at, createdAt: serverTimestamp() });
        tx.update(invRef, { ...totals, ...stamp() });
        return { payment: { invoiceId: id, ...pay, at }, totals };
      });
      if (!out.replay) {
        put('payments', payRef.id, out.payment);
        put('invoices', id, out.totals);
      }
      return invoiceView(id);
    }),

    saveNote: call(async (id: string, note: string) => {
      cached('invoices', id, 'Invoice not found.');
      const internalNote = String(note || '').slice(0, 1000);
      await updateDoc(ref('invoices', id), { internalNote, ...stamp() });
      put('invoices', id, { internalNote });
      return invoiceView(id);
    }),

    discardDraft: call(async (id: string) => {
      if (cache.invoices.get(id)?.status !== 'draft') fail(404, 'Draft not found.');
      await deleteDoc(ref('invoices', id));
      cache.invoices.delete(id);
      version += 1;
      return true;
    }),
  },

  /* ---------- expenses ---------- */
  expenses: {
    list: call(views.expenses.list),
    save: call(async (input: ExpenseInput) => {
      const data = validate.expense(input);
      if (input.id) cached('expenses', input.id, 'Expense not found.');
      const r = ref('expenses', input.id);
      if (input.id) await updateDoc(r, { ...data, ...stamp() });
      else await setDoc(r, { ...data, ...stamp() });
      put('expenses', r.id, data);
      return cached('expenses', r.id, 'Expense not found.');
    }),
    remove: call(async (id: string) => {
      cached('expenses', id, 'Expense not found.');
      await deleteDoc(ref('expenses', id));
      cache.expenses.delete(id);
      version += 1;
      return true;
    }),
  },

  /* ---------- reports ---------- */
  report: call(views.report),

  /* ---------- settings ---------- */
  settings: {
    get: call(() => getDb().settings),
    update: call(async (input: SettingsInput) => {
      const data = validate.settings(input);
      await setDoc(doc(firebase().db, 'settings', 'studio'), { ...data, ...stamp() }, { merge: true });
      settingsDoc = { ...settingsDoc, ...data };
      version += 1;
      return getDb().settings;
    }),
    resetDemoData: call(() => fail(400, 'There is no demo data to reset: the admin is connected to Firebase.')),
  },
};
