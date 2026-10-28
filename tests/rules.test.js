import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

/* firestore.rules against the Firestore emulator. */
let env;
const OWNER = 'owner-uid';

const service = (over = {}) => ({ name: 'Cut', category: 'Hair', price: 800, durationMin: 45, image: '', active: true, published: false, ...over });
const issued = (over = {}) => ({
  date: '2026-10-28', customerId: 'c1', walkIn: null, appointmentId: null, staff: '', items: [{ serviceId: 's1', name: 'Cut', price: 800, qty: 1, discount: 0 }],
  billDiscount: 0, discountReason: '', notes: '', taxRate: 0, taxLabel: '', subtotal: 800, discount: 0, tax: 0, total: 800,
  status: 'issued', number: 'INV-2026-0001', issuedAt: '2026-10-28T10:00:00Z', createdAt: '2026-10-28T10:00:00Z', internalNote: '',
  paid: 0, balance: 800, paymentStatus: 'unpaid', ...over,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-eden-glow', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
});
afterAll(() => env?.cleanup());
beforeEach(async () => {
  // The emulator can cancel the first clear while an earlier test file's connections close.
  await env.clearFirestore().catch(() => env.clearFirestore());
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', OWNER), { name: 'Owner', email: 'owner@example.com' });
    await setDoc(doc(db, 'services', 'pub'), service({ published: true }));
    await setDoc(doc(db, 'services', 'priv'), service({ name: 'Secret', published: false }));
    await setDoc(doc(db, 'customers', 'c1'), { name: 'Customer', phone: '+91 90000 00001', email: '', area: '', notes: '', status: 'active', createdAt: '2026-10-01' });
    await setDoc(doc(db, 'invoices', 'i1'), issued());
    await setDoc(doc(db, 'payments', 'p0'), { invoiceId: 'i1', amount: 1, method: 'cash', reference: '', at: 'x', createdAt: new Date() });
    await setDoc(doc(db, 'counters', 'invoices-2026'), { last: 1 });
  });
});

const visitor = () => env.unauthenticatedContext().firestore();
const stranger = () => env.authenticatedContext('someone-else').firestore();
const owner = () => env.authenticatedContext(OWNER).firestore();

describe('public visitors', () => {
  it('can read published services only', async () => {
    await assertSucceeds(getDoc(doc(visitor(), 'services', 'pub')));
    await assertSucceeds(getDocs(query(collection(visitor(), 'services'), where('published', '==', true))));
    await assertFails(getDoc(doc(visitor(), 'services', 'priv')));
    await assertFails(getDocs(collection(visitor(), 'services')));
  });
  it('cannot read or write private records', async () => {
    for (const name of ['customers', 'appointments', 'invoices', 'payments', 'expenses', 'settings', 'counters', 'requestKeys', 'admins']) {
      await assertFails(getDocs(collection(visitor(), name)));
    }
    await assertFails(getDoc(doc(visitor(), 'customers', 'c1')));
    await assertFails(getDoc(doc(visitor(), 'invoices', 'i1')));
    await assertFails(setDoc(doc(visitor(), 'services', 'x'), service({ name: 'Hack' })));
    await assertFails(addDoc(collection(visitor(), 'customers'), { name: 'X' }));
  });
});

describe('signed-in users who are not the owner', () => {
  it('get nothing private and cannot make themselves admin', async () => {
    await assertFails(getDoc(doc(stranger(), 'customers', 'c1')));
    await assertFails(getDocs(collection(stranger(), 'payments')));
    await assertFails(setDoc(doc(stranger(), 'admins', 'someone-else'), { name: 'me' }));
    await assertFails(updateDoc(doc(stranger(), 'services', 'pub'), { price: 1 }));
  });
});

describe('the owner', () => {
  it('reads and edits business records', async () => {
    await assertSucceeds(getDocs(collection(owner(), 'customers')));
    await assertSucceeds(getDocs(collection(owner(), 'services')));
    await assertSucceeds(updateDoc(doc(owner(), 'services', 'pub'), { price: 900, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(owner(), 'customers', 'c1'), { notes: 'Prefers mornings' }));
  });
  it('cannot store invalid or unknown fields', async () => {
    await assertFails(updateDoc(doc(owner(), 'services', 'pub'), { price: -5 }));
    await assertFails(updateDoc(doc(owner(), 'services', 'pub'), { price: null })); // active needs a price
    await assertFails(updateDoc(doc(owner(), 'customers', 'c1'), { isAdmin: true }));
    await assertFails(updateDoc(doc(owner(), 'services', 'pub'), { updatedAt: new Date(0) }));
  });
  it('cannot delete services, customers or the owner record', async () => {
    await assertFails(deleteDoc(doc(owner(), 'services', 'priv')));
    await assertFails(deleteDoc(doc(owner(), 'customers', 'c1')));
    await assertFails(deleteDoc(doc(owner(), 'admins', OWNER)));
  });
  it('cannot rewrite or delete an issued invoice', async () => {
    await assertFails(updateDoc(doc(owner(), 'invoices', 'i1'), { total: 1 }));
    await assertFails(updateDoc(doc(owner(), 'invoices', 'i1'), { number: 'INV-2026-0009' }));
    await assertFails(deleteDoc(doc(owner(), 'invoices', 'i1')));
    await assertSucceeds(updateDoc(doc(owner(), 'invoices', 'i1'), { internalNote: 'called' }));
  });
  it('records payments only together with the invoice total, and never edits them', async () => {
    const db = owner();
    // payment without moving the invoice's paid total
    await assertFails(setDoc(doc(db, 'payments', 'p1'), { invoiceId: 'i1', amount: 300, method: 'upi', reference: '', at: 'now', createdAt: serverTimestamp() }));
    const b = writeBatch(db);
    b.set(doc(db, 'payments', 'p1'), { invoiceId: 'i1', amount: 300, method: 'upi', reference: '', at: 'now', createdAt: serverTimestamp() });
    b.update(doc(db, 'invoices', 'i1'), { paid: 300, balance: 500, paymentStatus: 'partial' });
    await assertSucceeds(b.commit());
    await assertFails(updateDoc(doc(db, 'payments', 'p1'), { amount: 3 }));
    await assertFails(deleteDoc(doc(db, 'payments', 'p0')));
    // paid can't go down
    await assertFails(updateDoc(doc(db, 'invoices', 'i1'), { paid: 0, balance: 800, paymentStatus: 'unpaid' }));
  });
  it('can only move the invoice counter forward', async () => {
    await assertFails(setDoc(doc(owner(), 'counters', 'invoices-2026'), { last: 1 }));
    await assertSucceeds(setDoc(doc(owner(), 'counters', 'invoices-2026'), { last: 2 }));
  });
  it('can delete drafts and expenses', async () => {
    const draft = issued({ status: 'draft', number: null, draftPayment: null });
    await assertSucceeds(setDoc(doc(owner(), 'invoices', 'd1'), draft));
    await assertSucceeds(deleteDoc(doc(owner(), 'invoices', 'd1')));
    await assertSucceeds(setDoc(doc(owner(), 'expenses', 'e1'), { date: '2026-10-01', category: 'Products', description: 'Shampoo', amount: 500, method: 'cash' }));
    await assertSucceeds(deleteDoc(doc(owner(), 'expenses', 'e1')));
  });
});
