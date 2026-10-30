/* Bill arithmetic. The browser uses this for the live preview only; whatever answers the API
   (today the mock in src/admin/mock, later the real backend) must recompute totals itself and
   never trust numbers sent from the page. */
import type { PaymentStatus } from '../../types/models.ts';

/** The fields of a bill line that the arithmetic needs. */
export interface BillLineInput {
  price: number;
  qty: number;
  /** Rupees off this line. */
  discount?: number | string;
}

export type ComputedLine<T extends BillLineInput> = Omit<T, 'discount'> & { gross: number; discount: number; amount: number };

export interface BillTotals<T extends BillLineInput> {
  lines: ComputedLine<T>[];
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * @param items    [{ price, qty, discount }]  discount = rupees off that line
 * @param billDiscount rupees off the whole bill (after line discounts)
 * @param taxRate  percent, 0 when tax is not configured
 */
export function computeTotals<T extends BillLineInput>(items: T[], billDiscount: number | string = 0, taxRate = 0): BillTotals<T> {
  const lines = items.map((it) => {
    const gross = round2(it.price * it.qty);
    const discount = Math.min(Math.max(Number(it.discount) || 0, 0), gross);
    return { ...it, gross, discount, amount: round2(gross - discount) };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.gross, 0));
  const lineDiscounts = round2(lines.reduce((s, l) => s + l.discount, 0));
  const afterLines = round2(subtotal - lineDiscounts);
  const extra = Math.min(Math.max(Number(billDiscount) || 0, 0), afterLines);
  const discount = round2(lineDiscounts + extra);
  const taxable = round2(subtotal - discount);
  const tax = taxRate > 0 ? round2((taxable * taxRate) / 100) : 0;
  const total = round2(taxable + tax);
  return { lines, subtotal, discount, taxable, tax, total };
}

/** Never "paid" unless the full amount has actually been received. */
export function paymentStatus(total: number, paid: number): PaymentStatus {
  if (total <= 0) return 'paid';
  if (paid >= total - 0.001) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

export const sumPayments = (payments: { amount: number }[] = []): number => round2(payments.reduce((s, p) => s + p.amount, 0));
