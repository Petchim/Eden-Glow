/* Formatting helpers shared by every admin screen. Amounts are stored in whole rupees. */

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** ₹1,42,300 */
export const money = (n) => `₹${inr.format(Math.round((Number(n) || 0) * 100) / 100)}`;
/** 1,42,300 (no symbol, for table columns headed "(₹)") */
export const num = (n) => inr.format(Math.round((Number(n) || 0) * 100) / 100);
/** ₹1.4L / ₹32K for chart axes */
export const moneyShort = (n) => {
  const v = Math.abs(n);
  if (v >= 100000) return `₹${+(n / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${+(n / 1000).toFixed(v >= 10000 ? 0 : 1)}K`;
  return `₹${Math.round(n)}`;
};
export const pct = (n) => `${Math.round(n)}%`;

/* ---------- dates (local 'YYYY-MM-DD' strings, so no timezone drift) ---------- */
const pad = (n) => String(n).padStart(2, '0');
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISODate(new Date());
export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s, n) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 28 Oct 2026 */
export const fmtDate = (s) => {
  if (!s) return '—';
  const d = parseDate(s.slice(0, 10));
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
/** 28 Oct */
export const fmtDay = (s) => {
  const d = parseDate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
export const fmtMonth = (s) => {
  const d = parseDate(s);
  return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};
/** Tuesday, 28 Oct 2026 */
export const fmtLongDate = (d = new Date()) =>
  `${d.toLocaleDateString('en-GB', { weekday: 'long' })}, ${fmtDate(toISODate(d))}`;
/** '14:30' → '02:30 PM' */
export const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${pad(((h + 11) % 12) + 1)}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};
/** ISO timestamp → 28 Oct 2026, 10:45 AM */
export const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${fmtDate(toISODate(d))}, ${fmtTime(`${d.getHours()}:${d.getMinutes()}`)}`;
};

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi', label: 'UPI' },
  { id: 'card', label: 'Card' },
  { id: 'other', label: 'Others' },
];
export const methodLabel = (id) => PAYMENT_METHODS.find((m) => m.id === id)?.label || id;

export const PAYMENT_STATUS_LABEL = { paid: 'Paid', partial: 'Partially Paid', unpaid: 'Unpaid', draft: 'Draft', void: 'Void' };
export const APPT_STATUS_LABEL = { upcoming: 'Upcoming', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };
