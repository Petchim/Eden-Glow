/* Builds a real A4 PDF from invoice data (text, not a screenshot). jsPDF loads only when needed. */
import { BUSINESS, hasEmail, hasPhone, locationLine } from '../../config/business.ts';
import { PAYMENT_STATUS_LABEL, fmtDate, fmtDateTime, fmtTime, methodLabel } from './format.ts';
import type { InvoiceDetail } from '../api/index.ts';

type RGB = [r: number, g: number, b: number];

// jsPDF's built-in fonts have no ₹ glyph, so amounts are written as "Rs." in the PDF.
const rs = (n: number) => `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`;
const WINE: RGB = [122, 24, 48];
const INK: RGB = [58, 31, 31];
const MUTED: RGB = [125, 100, 98];

export async function downloadInvoicePdf(inv: InvoiceDetail, footer: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 16;
  let y = 20;

  doc.setFont('times', 'bolditalic');
  doc.setFontSize(26);
  doc.setTextColor(...WINE);
  doc.text('Eden Glow', M, y);
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setCharSpace(2);
  doc.text('STUDIO', M + 1, y + 6);
  doc.setCharSpace(0);

  // Only details the studio has actually filled in (src/config/business.ts).
  const contact = [...BUSINESS.address, !BUSINESS.address.length && locationLine(), hasPhone() && BUSINESS.phoneDisplay, hasEmail() && BUSINESS.email, BUSINESS.siteUrl].filter(Boolean);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  contact.forEach((line, i) => doc.text(String(line), W - M, y - 4 + i * 4.5, { align: 'right' }));

  y += 16;
  doc.setDrawColor(232, 208, 205);
  doc.line(M, y, W - M, y);
  y += 9;

  doc.setFontSize(9);
  doc.setTextColor(...WINE);
  doc.text('INVOICE TO', M, y);
  doc.text('INVOICE NO.', 110, y);
  doc.text('DATE', 160, y);
  doc.setTextColor(...INK);
  doc.setFontSize(11);
  doc.text(inv.customerName, M, y + 6);
  doc.setFontSize(9.5);
  const cust: { phone?: string; email?: string } = inv.customer || inv.walkIn || {};
  [cust.phone, cust.email].filter((l): l is string => !!l).forEach((l, i) => doc.text(l, M, y + 11 + i * 4.5));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(inv.number ?? '', 110, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(fmtDate(inv.date), 160, y + 6);
  doc.setFontSize(9);
  doc.setTextColor(...WINE);
  doc.text('PAYMENT STATUS', 110, y + 14);
  if (inv.appointment) doc.text('APPOINTMENT', 160, y + 14);
  doc.setTextColor(...INK);
  doc.setFontSize(10);
  doc.text(PAYMENT_STATUS_LABEL[inv.paymentStatus], 110, y + 19);
  if (inv.appointment) doc.text(fmtTime(inv.appointment.time), 160, y + 19);
  y += 30;

  // items table
  const cols = [M + 2, M + 10, 112, 152, 160, W - M - 2];
  doc.setFillColor(251, 236, 234);
  doc.rect(M, y - 5, W - 2 * M, 8, 'F');
  doc.setFontSize(8.5);
  doc.setTextColor(...WINE);
  doc.text('#', cols[0], y);
  doc.text('SERVICE / TREATMENT', cols[1], y);
  doc.text('DURATION', cols[2], y);
  doc.text('PRICE', cols[3], y, { align: 'right' });
  doc.text('QTY', cols[4], y);
  doc.text('AMOUNT', cols[5], y, { align: 'right' });
  y += 8;
  doc.setTextColor(...INK);
  doc.setFontSize(10);
  inv.items.forEach((l, i) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.text(String(i + 1), cols[0], y);
    doc.text((doc.splitTextToSize(l.name, 80) as string[])[0], cols[1], y);
    doc.text(`${l.durationMin} mins`, cols[2], y);
    doc.text(rs(l.price), cols[3], y, { align: 'right' });
    doc.text(String(l.qty), cols[4] + 2, y);
    doc.text(rs(l.price * l.qty - (l.discount || 0)), cols[5], y, { align: 'right' });
    if (l.discount) {
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`incl. discount ${rs(l.discount)}`, cols[1], y + 4);
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      y += 4;
    }
    y += 3;
    doc.setDrawColor(240, 222, 219);
    doc.line(M, y, W - M, y);
    y += 6;
  });

  // totals
  y += 2;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, 128, y);
    doc.text(value, W - M - 2, y, { align: 'right' });
    y += 6;
  };
  row('Subtotal', rs(inv.subtotal));
  if (inv.discount) row(`Discount${inv.discountReason ? ` (${inv.discountReason})` : ''}`, `-${rs(inv.discount)}`);
  if (inv.tax) row(`${inv.taxLabel} (${inv.taxRate}%)`, rs(inv.tax));
  doc.setFillColor(251, 236, 234);
  doc.rect(124, y - 4.5, W - M - 124, 8, 'F');
  doc.setTextColor(...WINE);
  row('Total Amount', rs(inv.total), true);
  doc.setTextColor(...INK);
  row('Paid', rs(inv.paid));
  if (inv.balance > 0) row('Balance due', rs(inv.balance), true);

  doc.setFont('helvetica', 'normal');
  if (inv.payments.length) {
    y += 4;
    doc.setFontSize(9);
    doc.setTextColor(...WINE);
    doc.text('PAYMENTS', M, y);
    doc.setTextColor(...INK);
    y += 5;
    inv.payments.forEach((p) => {
      doc.text(`${fmtDateTime(p.at)}  ·  ${methodLabel(p.method)}${p.reference ? `  ·  Ref ${p.reference}` : ''}  ·  ${rs(p.amount)}`, M, y);
      y += 4.5;
    });
  }
  if (inv.notes) {
    y += 4;
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    (doc.splitTextToSize(`Note: ${inv.notes}`, W - 2 * M) as string[]).forEach((l) => {
      doc.text(l, M, y);
      y += 4.5;
    });
  }

  y = Math.max(y + 10, 250);
  doc.setFont('times', 'italic');
  doc.setFontSize(18);
  doc.setTextColor(...WINE);
  doc.text('Thank You!', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  (doc.splitTextToSize(footer, 110) as string[]).forEach((l, i) => doc.text(l, M, y + 6 + i * 4.5));

  doc.save(`${inv.number}.pdf`);
}
