import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { firestoreApi as api } from '../src/admin/api/firestoreApi.js';
import { websiteMenu } from '../src/admin/lib/websiteMenu.js';
import { today } from '../src/admin/lib/format.js';

/* The admin's Firebase backend, end to end, against the Auth + Firestore emulators
   (with firestore.rules enforced). Run with `npm test`. */
const PROJECT = 'demo-eden-glow';
const AUTH = 'http://127.0.0.1:9099';
const OWNER = { email: 'owner@example.com', password: 'owner-pass-123' };
const OTHER = { email: 'someone@example.com', password: 'other-pass-123' };
let env;

async function signUp({ email, password }) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return (await r.json()).localId;
}
const rejects = async (p, status) => {
  const e = await p.then(() => null, (err) => err);
  expect(e, `expected an error with status ${status}`).toBeTruthy();
  expect(e.status).toBe(status);
  return e;
};

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
  await env.clearFirestore();
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  const ownerUid = await signUp(OWNER);
  await signUp(OTHER);
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'admins', ownerUid), { name: 'Studio Owner', email: OWNER.email }));
});
afterAll(() => env?.cleanup());

describe('sign-in', () => {
  it('is signed out at first and refuses data calls', async () => {
    expect(await api.auth.me()).toBeNull();
    await rejects(api.customers.list(), 401);
  });
  it('rejects a wrong password', async () => {
    await rejects(api.auth.login({ ...OWNER, password: 'nope-nope' }), 401);
  });
  it('rejects a real account that is not the owner', async () => {
    await rejects(api.auth.login(OTHER), 403);
    expect(await api.auth.me()).toBeNull();
  });
  it('lets the owner in', async () => {
    expect(await api.auth.login(OWNER)).toEqual({ name: 'Studio Owner', email: OWNER.email });
    expect((await api.auth.me()).email).toBe(OWNER.email);
  });
});

describe('services', () => {
  it('starts empty with default settings and no invented staff or prices', async () => {
    expect(await api.services.list({ includeInactive: true })).toEqual([]);
    const s = await api.settings.get();
    expect(s.staff).toEqual([]);
    expect(s.serviceCategories).toContain('Hair');
  });
  it('imports the website treatments as hidden, unpriced services, and never twice', async () => {
    const menu = websiteMenu();
    const first = await api.services.importMenu(menu);
    expect(first.added).toBe(menu.length);
    const again = await api.services.importMenu(menu);
    expect(again).toEqual({ added: 0, skipped: menu.length });
    const all = await api.services.list({ includeInactive: true });
    expect(all).toHaveLength(menu.length);
    expect(all.every((s) => s.price === null && !s.active && !s.published)).toBe(true);
    expect(await api.services.list()).toEqual([]); // nothing billable yet
  });
  it('becomes billable once the owner sets a price and duration', async () => {
    const all = await api.services.list({ includeInactive: true });
    const cut = all.find((s) => s.name === 'Haircuts & styling');
    await rejects(api.services.save({ ...cut, active: true }), 422);
    const saved = await api.services.save({ ...cut, price: 800, durationMin: 45, active: true, published: true });
    expect(saved.price).toBe(800);
    const created = await api.services.save({ name: 'Test Facial', category: 'Skin', price: 1500, durationMin: 60, image: '', active: true });
    expect(created.id).toBeTruthy();
    expect((await api.services.list()).map((s) => s.name).sort()).toEqual(['Haircuts & styling', 'Test Facial']);
  });
});

let customer;
let services;
describe('customers and appointments', () => {
  it('creates and updates customers, refusing duplicate phones', async () => {
    customer = await api.customers.create({ name: 'Test Customer', phone: '+91 90000 11111', email: 'test@example.com' });
    await rejects(api.customers.create({ name: 'Other', phone: '90000 11111' }), 422);
    const upd = await api.customers.update(customer.id, { notes: 'Prefers mornings' });
    expect(upd.notes).toBe('Prefers mornings');
    expect((await api.customers.list({ q: 'test' })).total).toBe(1);
    expect((await api.customers.lookup('9000011111')).length + (await api.customers.lookup('Test')).length).toBeGreaterThan(0);
  });
  it('books and updates an appointment', async () => {
    services = await api.services.list();
    const a = await api.appointments.save({ customerId: customer.id, serviceIds: [services[0].id], date: today(), time: '11:00' });
    expect(a.customerName).toBe('Test Customer');
    const done = await api.appointments.setStatus(a.id, 'in_progress');
    expect(done.status).toBe('in_progress');
    await rejects(api.appointments.save({ customerId: 'nope', serviceIds: [], date: 'x', time: '' }), 422);
    expect((await api.appointments.list({ from: today(), to: today() })).length).toBe(1);
  });
});

let invoice;
describe('billing', () => {
  it('issues an invoice with server-side prices, a number and the first payment', async () => {
    const cut = services.find((s) => s.name === 'Haircuts & styling');
    const year = today().slice(0, 4);
    expect(await api.invoices.nextNumber(today())).toBe(`INV-${year}-0001`);
    const [appt] = await api.appointments.list({ from: today(), to: today() });
    const payload = { customerId: customer.id, appointmentId: appt.id, date: today(), items: [{ serviceId: cut.id, qty: 2, price: 1 }], payment: { amount: 600, method: 'upi' } };
    invoice = await api.invoices.issue(payload, 'key-issue-1');
    expect(invoice.number).toBe(`INV-${year}-0001`);
    expect(invoice.total).toBe(1600);
    expect(invoice.paid).toBe(600);
    expect(invoice.paymentStatus).toBe('partial');
    // the same submission again does not create a second invoice
    const replay = await api.invoices.issue(payload, 'key-issue-1');
    expect(replay.id).toBe(invoice.id);
    expect((await api.invoices.list({})).total).toBe(1);
    // the appointment is marked completed and linked
    const [linked] = await api.appointments.list({ from: today(), to: today() });
    expect(linked.status).toBe('completed');
    expect(linked.invoiceId).toBe(invoice.id);
  });
  it('takes further payments once, capped at the balance', async () => {
    const p1 = await api.invoices.addPayment(invoice.id, { amount: 400, method: 'cash' }, 'key-pay-1');
    expect(p1.paid).toBe(1000);
    const again = await api.invoices.addPayment(invoice.id, { amount: 400, method: 'cash' }, 'key-pay-1');
    expect(again.paid).toBe(1000);
    const p2 = await api.invoices.addPayment(invoice.id, { amount: 5000, method: 'card' }, 'key-pay-2');
    expect(p2.paid).toBe(1600);
    expect(p2.paymentStatus).toBe('paid');
    expect(p2.payments).toHaveLength(3);
    await rejects(api.invoices.addPayment(invoice.id, { amount: 1, method: 'cash' }, 'key-pay-3'), 409);
  });
  it('saves a note, numbers the next invoice, and handles drafts', async () => {
    expect((await api.invoices.saveNote(invoice.id, 'Thanks')).internalNote).toBe('Thanks');
    const svc = services.find((s) => s.name === 'Test Facial');
    const draft = await api.invoices.saveDraft({ walkIn: { name: 'Walk-in' }, items: [{ serviceId: svc.id, qty: 1 }], payment: { amount: 0, method: 'cash' } });
    expect(draft.status).toBe('draft');
    expect(draft.number).toBeNull();
    const second = await api.invoices.issue({ id: draft.id, walkIn: { name: 'Walk-in' }, items: [{ serviceId: svc.id, qty: 1 }], payment: { amount: 1500, method: 'cash' } }, 'key-issue-2');
    expect(second.id).toBe(draft.id);
    expect(second.number.endsWith('0002')).toBe(true);
    await rejects(api.invoices.saveDraft({ id: second.id, items: [] }), 409);
    const d2 = await api.invoices.saveDraft({ items: [] });
    expect(await api.invoices.discardDraft(d2.id)).toBe(true);
    await rejects(api.invoices.discardDraft(second.id), 404);
  });
  it('keeps billed prices when the service price changes later', async () => {
    const cut = services.find((s) => s.name === 'Haircuts & styling');
    await api.services.save({ ...cut, price: 900 });
    const inv = await api.invoices.get(invoice.id);
    expect(inv.items[0].price).toBe(800);
  });
});

describe('expenses, reports and settings', () => {
  it('saves and removes an expense', async () => {
    const e = await api.expenses.save({ date: today(), category: 'Products', description: 'Shampoo', amount: 500, method: 'upi' });
    expect((await api.expenses.list({})).length).toBe(1);
    await api.expenses.save({ ...e, amount: 650 });
    expect((await api.expenses.list({}))[0].amount).toBe(650);
    await api.expenses.remove(e.id);
    expect(await api.expenses.list({})).toEqual([]);
  });
  it('builds the dashboard, reports, search and notifications', async () => {
    const d = await api.dashboard({ range: 'this_month' });
    expect(d.monthRevenue.amount).toBe(3100);
    expect(d.todayRevenue.amount).toBe(3100);
    const r = await api.report({ from: today(), to: today(), group: 'daily', compare: 'previous' });
    expect(r.summary.billed.value).toBe(3100);
    expect(r.summary.collected.value).toBe(3100);
    expect((await api.search('test')).customers).toHaveLength(1);
    expect(Array.isArray(await api.notifications())).toBe(true);
    const c = await api.customers.get(customer.id);
    expect(c.totalSpent).toBe(1600);
  });
  it('validates and saves settings', async () => {
    await rejects(api.settings.update({ taxEnabled: true, taxRate: 99 }), 422);
    const s = await api.settings.update({ taxEnabled: true, taxRate: 18, taxLabel: 'GST', staff: ['Anu', ' '], invoiceFooter: 'Thanks!' });
    expect(s.staff).toEqual(['Anu']);
    expect((await api.settings.get()).taxRate).toBe(18);
    await rejects(api.settings.resetDemoData(), 400);
  });
});

describe('sign-out', () => {
  it('ends access to data', async () => {
    await api.auth.logout();
    expect(await api.auth.me()).toBeNull();
    await rejects(api.invoices.list({}), 401);
  });
});
