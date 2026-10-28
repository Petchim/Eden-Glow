import { describe, expect, it } from 'vitest';
import { createEngine, DEFAULT_SETTINGS } from '../src/admin/api/engine.js';

const db = {
  services: [
    { id: 's1', name: 'Cut', category: 'Hair', price: 800, durationMin: 45, active: true },
    { id: 's2', name: 'Imported', category: 'Hair', price: null, durationMin: null, active: false },
  ],
  customers: [{ id: 'c1', name: 'Test Customer', phone: '+91 90000 00001', email: '', status: 'active', createdAt: '2026-01-01' }],
  appointments: [],
  invoices: [],
  expenses: [],
  settings: { ...DEFAULT_SETTINGS },
};
const { validate } = createEngine(() => db);

describe('invoice rules', () => {
  it('takes prices from the service list, not from the page', () => {
    const inv = validate.invoice({ customerId: 'c1', items: [{ serviceId: 's1', qty: 2, price: 1 }] });
    expect(inv.items[0].price).toBe(800);
    expect(inv.total).toBe(1600);
  });
  it('refuses to bill a service that has no price yet', () => {
    expect(() => validate.invoice({ items: [{ serviceId: 's2', qty: 1 }] })).toThrow(/no price yet/);
  });
  it('needs a reason for a discount and caps it at the bill', () => {
    expect(() => validate.invoice({ items: [{ serviceId: 's1', qty: 1 }], billDiscount: 100 })).toThrow(/reason/);
    expect(() => validate.invoice({ items: [{ serviceId: 's1', qty: 1 }], billDiscount: 5000, discountReason: 'x' })).toThrow();
  });
  it('treats money above the balance as change', () => {
    expect(validate.payment({ amount: 1000, method: 'cash' }, 800).amount).toBe(800);
    expect(() => validate.payment({ amount: 10, method: 'cheque' }, 800)).toThrow();
  });
});

describe('service rules', () => {
  it('keeps a service without a price hidden', () => {
    expect(() => validate.service({ name: 'New', category: 'Hair', price: null, durationMin: 30, active: true })).toThrow();
    expect(validate.service({ name: 'New', category: 'Hair', price: null, durationMin: null, active: false }).price).toBeNull();
    expect(() => validate.service({ name: 'New', category: 'Hair', price: null, durationMin: 30, active: false, published: true })).toThrow();
  });
  it('rejects duplicate names and unknown categories', () => {
    expect(() => validate.service({ name: 'cut', category: 'Hair', price: 100, durationMin: 30 })).toThrow();
    expect(() => validate.service({ name: 'Other', category: 'Spa', price: 100, durationMin: 30 })).toThrow();
  });
});

describe('customer rules', () => {
  it('rejects a duplicate phone number', () => {
    let err;
    try {
      validate.customer({ name: 'Someone', phone: '90000 00001' });
    } catch (e) {
      err = e;
    }
    expect(err.status).toBe(422);
    expect(err.fields.phone).toMatch(/already exists/);
  });
});
