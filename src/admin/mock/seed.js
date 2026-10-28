/* =====================================================================
   DEMO DATA — NOT REAL BUSINESS RECORDS
   ---------------------------------------------------------------------
   Every customer, appointment, invoice, payment and expense below is
   generated sample data so the admin screens have something to show
   before the backend exists. Names are invented, phone numbers use a
   dummy 90000 range and emails use the reserved example.com domain.

   When the real backend is ready, delete the whole src/admin/mock/
   folder and point src/admin/api/index.js at the HTTP client.
   ===================================================================== */
import { CARD_IMAGES, HAIR_IMAGES, SKIN_IMAGES, NAILS_IMAGES, LASH_IMAGES, MAKEUP_IMAGES } from '../../data/images.js';
import { addDays, today } from '../lib/format.js';
import { computeTotals, paymentStatus } from '../lib/billing.js';

export const DEMO_ADMIN = {
  // Demo-only sign-in. The real backend will own the admin account and hashed password.
  email: 'admin@edenglow.demo',
  password: 'EdenGlow@demo',
  name: 'Admin',
};

const SERVICES = [
  ['Facial Treatment', 'Skin', 1500, 60, SKIN_IMAGES.facial],
  ['Clean-up Facial', 'Skin', 900, 45, SKIN_IMAGES.cleanse],
  ['Hair Cut & Styling', 'Hair', 800, 45, HAIR_IMAGES.cut],
  ['Hair Spa', 'Hair', 1200, 60, HAIR_IMAGES.treatment],
  ['Hair Colouring', 'Hair', 2500, 120, HAIR_IMAGES.colour],
  ['Blow-dry & Finish', 'Hair', 500, 30, HAIR_IMAGES.intro],
  ['Manicure', 'Nails', 600, 45, NAILS_IMAGES.manicure],
  ['Pedicure', 'Nails', 700, 60, NAILS_IMAGES.pedicure],
  ['Gel Polish', 'Nails', 900, 45, NAILS_IMAGES.gel],
  ['Lash Extensions', 'Lashes', 2200, 90, LASH_IMAGES.technician],
  ['Lash Lift', 'Lashes', 1400, 60, LASH_IMAGES.intro],
  ['Bridal Makeup', 'Makeup', 12000, 180, MAKEUP_IMAGES.bridal],
  ['Party Makeup', 'Makeup', 3500, 90, MAKEUP_IMAGES.occasion],
  ['Threading', 'Skin', 300, 15, CARD_IMAGES.skin],
  ['Waxing', 'Skin', 800, 30, SKIN_IMAGES.homecare],
];

const FIRST = ['Priya', 'Divya', 'Sneha', 'Anitha', 'Keerthana', 'Meena', 'Nandhini', 'Revathi', 'Kavya', 'Harini',
  'Lakshmi', 'Swathi', 'Deepa', 'Janani', 'Aishwarya', 'Gayathri', 'Pooja', 'Ramya', 'Shalini', 'Vidhya',
  'Yamini', 'Bhavya', 'Charu', 'Ishita', 'Madhu', 'Nisha', 'Oviya', 'Pavithra', 'Reshma', 'Sandhya',
  'Tanvi', 'Uma', 'Varsha', 'Abinaya', 'Brindha', 'Dharani', 'Fathima', 'Hema', 'Indhu', 'Jaya'];
const LAST = ['Sharma', 'Lakshmi', 'Raj', 'Kumar', 'R', 'S', 'Krishnan', 'Iyer', 'Menon', 'Nair', 'Prakash', 'Mohan', 'Suresh', ''];
const AREAS = ['Anna Nagar', 'T. Nagar', 'Adyar', 'Velachery', 'Mylapore', 'Besant Nagar', ''];
const STAFF = ['Anitha', 'Kavitha', 'Shruthi'];
const NOTES = ['Prefers weekend appointments.', 'Sensitive skin, patch test first.', 'Likes herbal products.', '', '', ''];

const EXPENSES = [
  // category, description, [min, max], times per month
  ['Rent & Utilities', 'Studio rent', [18000, 18000], 1],
  ['Rent & Utilities', 'Electricity bill', [2200, 3600], 1],
  ['Staff', 'Staff incentive', [1500, 4000], 2],
  ['Products', 'Beauty products purchase', [2500, 6500], 3],
  ['Marketing', 'Marketing – social media', [1500, 3000], 2],
  ['Maintenance', 'Equipment maintenance', [800, 2500], 1],
  ['Others', 'Pantry & sundries', [300, 900], 2],
];

/* Small seeded random generator, so the demo looks the same every time it is reset. */
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeed() {
  const r = rng(20261028);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const between = (a, b) => Math.round(a + r() * (b - a));
  const weighted = (pairs) => {
    let x = r() * pairs.reduce((s, p) => s + p[1], 0);
    for (const [v, w] of pairs) if ((x -= w) < 0) return v;
    return pairs[0][0];
  };
  const now = new Date();
  const T = today();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const iso = (date, time) => new Date(`${date}T${time}:00`).toISOString();

  const services = SERVICES.map(([name, category, price, durationMin, img], i) => ({
    id: `svc_${i + 1}`,
    name,
    category,
    price,
    durationMin,
    image: img?.src || '',
    active: true,
  }));

  const customers = [];
  for (let i = 0; i < 64; i++) {
    const first = FIRST[i % FIRST.length];
    const last = i < FIRST.length ? LAST[i % LAST.length] : pick(LAST);
    const name = `${first} ${last}`.trim();
    customers.push({
      id: `cus_${i + 1}`,
      name,
      phone: `+91 90000 ${String(10001 + i * 137).slice(-5)}`,
      email: r() < 0.8 ? `${first.toLowerCase()}${last ? `.${last.toLowerCase()}` : ''}${i}@example.com` : '',
      area: pick(AREAS),
      notes: pick(NOTES),
      status: r() < 0.93 ? 'active' : 'inactive',
      createdAt: addDays(T, -between(i < 10 ? 2 : 20, 160)),
    });
  }

  const appointments = [];
  const invoices = [];
  let apptN = 0;
  let invN = 0;
  const year = T.slice(0, 4);
  const pickService = () =>
    weighted(services.map((s) => [s, s.category === 'Makeup' ? (s.name.startsWith('Bridal') ? 0.25 : 0.6) : s.price > 2000 ? 1 : 3]));

  const makeInvoice = ({ date, time, customer, walkIn, appt, items }) => {
    const disc = r() < 0.2 ? Math.round((items[0].price * pick([5, 10])) / 100) : 0;
    const lines = items.map((s, i) => ({
      serviceId: s.id,
      name: s.name,
      category: s.category,
      durationMin: s.durationMin,
      price: s.price,
      qty: 1,
      discount: i === 0 ? disc : 0,
    }));
    const totals = computeTotals(lines, 0, 0);
    const mode = date === T ? weighted([['paid', 0.85], ['partial', 0.15]]) : weighted([['paid', 0.88], ['partial', 0.08], ['unpaid', 0.04]]);
    const method = weighted([['upi', 46], ['cash', 28], ['card', 20], ['other', 6]]);
    const amount = mode === 'paid' ? totals.total : mode === 'partial' ? Math.round(totals.total * 0.5) : 0;
    const payments = [];
    if (amount > 0) payments.push({ id: `pay_${invN + 1}_1`, amount, method, reference: '', at: iso(date, time) });
    // older partial bills were usually settled a few days later
    if (mode === 'partial' && date < addDays(T, -10)) {
      payments.push({ id: `pay_${invN + 1}_2`, amount: totals.total - amount, method: 'cash', reference: '', at: iso(addDays(date, 4), '12:00') });
    }
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    invN += 1;
    invoices.push({
      id: `inv_${invN}`,
      number: `INV-${year}-${String(invN).padStart(4, '0')}`,
      status: 'issued',
      date,
      customerId: customer?.id || null,
      walkIn: walkIn || null,
      appointmentId: appt?.id || null,
      staff: appt?.staff || '',
      items: totals.lines.map(({ gross, amount: a, ...l }) => l),
      billDiscount: 0,
      discountReason: disc ? 'Special offer' : '',
      notes: '',
      internalNote: '',
      taxRate: 0,
      taxLabel: '',
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: 0,
      total: totals.total,
      payments,
      paid,
      balance: Math.max(totals.total - paid, 0),
      paymentStatus: paymentStatus(totals.total, paid),
      createdAt: iso(date, time),
      issuedAt: iso(date, time),
      demo: true,
    });
    if (appt) appt.invoiceId = `inv_${invN}`;
  };

  // 150 days of history, today, and two weeks ahead
  const slots = ['10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '14:00', '15:00', '15:30', '16:30', '17:00', '18:00', '19:00'];
  for (let d = -150; d <= 14; d++) {
    const date = addDays(T, d);
    const weekend = [0, 6].includes(new Date(`${date}T12:00:00`).getDay());
    const growth = 1 + (d + 150) / 300;
    const count = d === 0 ? 8 : d > 0 ? between(1, d < 3 ? 4 : 2) : Math.round(between(2, weekend ? 7 : 5) * growth);
    const times = [...slots].sort(() => r() - 0.5).slice(0, count).sort();
    for (const time of times) {
      const customer = pick(customers.slice(0, d > -30 ? 64 : 54));
      const svcs = [pickService()];
      if (r() < 0.25) svcs.push(pickService());
      const uniq = [...new Map(svcs.map((s) => [s.id, s])).values()];
      const [h, m] = time.split(':').map(Number);
      const start = h * 60 + m;
      let status = 'upcoming';
      if (d < 0) status = weighted([['completed', 0.92], ['cancelled', 0.05], ['no_show', 0.03]]);
      if (d === 0) status = start + 60 <= nowMin ? 'completed' : start <= nowMin ? 'in_progress' : 'upcoming';
      apptN += 1;
      const appt = {
        id: `apt_${apptN}`,
        customerId: customer.id,
        serviceIds: uniq.map((s) => s.id),
        date,
        time,
        staff: pick(STAFF),
        status,
        notes: '',
        invoiceId: null,
        createdAt: iso(addDays(date, -between(1, 6)), '10:00'),
      };
      appointments.push(appt);
      if (status === 'completed') makeInvoice({ date, time, customer, appt, items: uniq });
    }
    // walk-ins
    if (d <= 0 && r() < (d === 0 ? 1 : 0.5)) {
      const time = d === 0 ? '09:30' : pick(slots);
      if (d < 0 || nowMin > 600) makeInvoice({ date, time, walkIn: { name: 'Walk-in customer', phone: '' }, items: [pickService()] });
    }
  }
  invoices.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  invoices.forEach((inv, i) => {
    inv.number = `INV-${inv.date.slice(0, 4)}-${String(i + 1).padStart(4, '0')}`;
  });

  const expenses = [];
  let expN = 0;
  for (let mBack = 5; mBack >= 0; mBack--) {
    const base = new Date(now.getFullYear(), now.getMonth() - mBack, 1);
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    for (const [category, description, [lo, hi], times] of EXPENSES) {
      for (let k = 0; k < times; k++) {
        const day = category === 'Rent & Utilities' && description === 'Studio rent' ? 1 : between(1, daysInMonth);
        const date = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (date > T) continue;
        expN += 1;
        expenses.push({
          id: `exp_${expN}`,
          date,
          category,
          description,
          amount: Math.round(between(lo, hi) / 50) * 50,
          method: weighted([['upi', 3], ['cash', 2], ['card', 1]]),
          demo: true,
        });
      }
    }
  }

  return {
    version: 1,
    seededOn: T,
    services,
    customers,
    appointments,
    invoices,
    expenses,
    settings: {
      taxEnabled: false,
      taxLabel: 'GST',
      taxRate: 0,
      staff: STAFF,
      expenseCategories: ['Products', 'Rent & Utilities', 'Staff', 'Marketing', 'Maintenance', 'Others'],
      serviceCategories: ['Hair', 'Skin', 'Nails', 'Lashes', 'Makeup'],
      invoiceFooter: 'Thank you for choosing Eden Glow Studio. We look forward to serving you again.',
    },
    idempotency: {},
  };
}
