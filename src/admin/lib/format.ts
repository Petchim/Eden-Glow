/* Formatting helpers shared by every admin screen. Amounts are stored in whole rupees. */
import type { AppointmentStatus, PaymentMethod, PaymentStatus } from '../../types/models.ts';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** ₹1,42,300 */
export const money = (n: number | string | null | undefined): string => `₹${inr.format(Math.round((Number(n) || 0) * 100) / 100)}`;
/** 1,42,300 (no symbol, for table columns headed "(₹)") */
export const num = (n: number | string | null | undefined): string => inr.format(Math.round((Number(n) || 0) * 100) / 100);
/** ₹1.4L / ₹32K for chart axes */
export const moneyShort = (n: number): string => {
  const v = Math.abs(n);
  if (v >= 100000) return `₹${+(n / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${+(n / 1000).toFixed(v >= 10000 ? 0 : 1)}K`;
  return `₹${Math.round(n)}`;
};
export const pct = (n: number): string => `${Math.round(n)}%`;

/* ---------- dates (local 'YYYY-MM-DD' strings, so no timezone drift) ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
export const toISODate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISODate(new Date());
export const parseDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number): string => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};
export const daysBetween = (a: string, b: string): number => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 28 Oct 2026 */
export const fmtDate = (s: string | null | undefined): string => {
  if (!s) return '—';
  const d = parseDate(s.slice(0, 10));
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
/** 28 Oct */
export const fmtDay = (s: string): string => {
  const d = parseDate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
export const fmtMonth = (s: string): string => {
  const d = parseDate(s);
  return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};
/** Tuesday, 28 Oct 2026 */
export const fmtLongDate = (d = new Date()): string =>
  `${d.toLocaleDateString('en-GB', { weekday: 'long' })}, ${fmtDate(toISODate(d))}`;
/** '14:30' → '02:30 PM' */
export const fmtTime = (t: string | null | undefined): string => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${pad(((h + 11) % 12) + 1)}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};
/** ISO timestamp → 28 Oct 2026, 10:45 AM */
export const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${fmtDate(toISODate(d))}, ${fmtTime(`${d.getHours()}:${d.getMinutes()}`)}`;
};

export const initials = (name = ''): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi', label: 'UPI' },
  { id: 'card', label: 'Card' },
  { id: 'other', label: 'Others' },
];
export const methodLabel = (id: string): string => PAYMENT_METHODS.find((m) => m.id === id)?.label || id;

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus | 'draft' | 'void', string> = { paid: 'Paid', partial: 'Partially Paid', unpaid: 'Unpaid', draft: 'Draft', void: 'Void' };
export const APPT_STATUS_LABEL: Record<AppointmentStatus, string> = { upcoming: 'Upcoming', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' };
