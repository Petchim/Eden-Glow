import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AIcon, { type AIconName } from '../components/AIcon.tsx';
import AdminLogo, { Blossom } from '../components/AdminLogo.tsx';
import { Avatar, Badge, Card, ErrorNote, Field, Loading, Modal, PageHeader } from '../components/ui.tsx';
import { BUSINESS, hasEmail, hasInstagram, hasPhone, locationLine, siteUrl } from '../../config/business.ts';
import { api, newIdempotencyKey, type InvoiceDetail as Invoice, type InvoiceView } from '../api/index.ts';
import { useAction, useAdminTitle, useApi } from '../hooks.ts';
import { PAYMENT_METHODS, fmtDate, fmtDateTime, fmtTime, methodLabel, money, num } from '../lib/format.ts';
import { downloadInvoicePdf } from '../lib/invoicePdf.ts';

interface PaymentModalProps {
  inv: Pick<Invoice, 'id' | 'balance'>;
  open: boolean;
  onClose: () => void;
  onSaved: (invoice: InvoiceView) => void;
}

function PaymentModal({ inv, open, onClose, onSaved }: PaymentModalProps) {
  const [form, setForm] = useState({ amount: '', method: 'cash', reference: '' });
  const key = useRef(newIdempotencyKey());
  const { busy, error, run } = useAction();
  useEffect(() => {
    if (open) {
      setForm({ amount: String(inv.balance), method: 'cash', reference: '' });
      key.current = newIdempotencyKey();
    }
  }, [open, inv.balance]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => api.invoices.addPayment(inv.id, { ...form, amount: Number(form.amount) }, key.current));
    if (r) onSaved(r);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Payment"
      footer={
        <>
          <button type="button" className="ad-btn ad-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="ad-pay-form" className="ad-btn ad-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Record Payment'}
          </button>
        </>
      }
    >
      <form id="ad-pay-form" className="ad-form-grid" onSubmit={submit} noValidate>
        <p className="ad-span-2 ad-muted">Outstanding balance: {money(inv.balance)}. Record only money actually received.</p>
        {error && <p className="ad-alert ad-alert--error ad-span-2">{error.message}</p>}
        <Field label="Amount received (₹)" required error={error?.fields?.amount}>
          {(p) => <input {...p} className="ad-input" type="number" min="1" max={inv.balance} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />}
        </Field>
        <Field label="Method">
          {(p) => (
            <select {...p} className="ad-select" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Reference (optional)" className="ad-span-2">
          {(p) => <input {...p} className="ad-input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={60} />}
        </Field>
      </form>
    </Modal>
  );
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: inv, error, loading, reload, setData } = useApi(() => api.invoices.get(id ?? ''), [id]);
  const settings = useApi(() => api.settings.get(), []);
  useAdminTitle(inv?.number || 'Invoice');
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [paying, setPaying] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const noteAction = useAction();

  useEffect(() => {
    if (inv?.status === 'draft') nav(`/admin/invoices/new?draft=${inv.id}`, { replace: true });
    if (inv) setNote(inv.internalNote || '');
  }, [inv, nav]);

  if (loading && !inv) return <Loading rows={8} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!inv || inv.status === 'draft') return null;

  const footer = settings.data?.invoiceFooter || 'Thank you for choosing Eden Glow Studio. We look forward to serving you again.';
  const cust: { phone?: string; email?: string } = inv.customer || inv.walkIn || {};
  const lastPay = inv.payments[inv.payments.length - 1];
  type ContactLine = { icon: AIconName; text: string };
  const contactLines: (ContactLine | false | 0 | '')[] = [
    (BUSINESS.address.length || locationLine()) && { icon: 'pin', text: BUSINESS.address.length ? BUSINESS.address.join(', ') : locationLine() },
    hasPhone() && { icon: 'phone', text: BUSINESS.phoneDisplay || BUSINESS.phone },
    hasEmail() && { icon: 'mail', text: BUSINESS.email },
    siteUrl() && { icon: 'search', text: siteUrl().replace(/^https:\/\//, '') },
  ];
  const contact = contactLines.filter((c): c is ContactLine => !!c);
  const share = `Hello ${inv.customerName}, here is your Eden Glow Studio invoice ${inv.number} dated ${fmtDate(inv.date)}. Total ${money(inv.total)}, paid ${money(inv.paid)}${inv.balance ? `, balance ${money(inv.balance)}` : ''}. Thank you!`;
  const phoneDigits = (cust.phone || '').replace(/\D/g, '');
  const waTo = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;

  const pdf = async () => {
    setPdfBusy(true);
    try {
      await downloadInvoicePdf(inv, footer);
    } finally {
      setPdfBusy(false);
      setMenu(false);
    }
  };
  const saveNote = async () => {
    const r = await noteAction.run(() => api.invoices.saveNote(inv.id, note));
    if (r) {
      setData({ ...inv, internalNote: r.internalNote });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2500);
    }
  };

  return (
    <div className="ad-page">
      <PageHeader
        crumbs={[{ label: 'Billing', to: '/admin/invoices' }, { label: 'Invoices', to: '/admin/invoices' }, { label: inv.number ?? '' }]}
        title="Invoice Details"
        badge={<Badge status={inv.paymentStatus} />}
        sub={`Created on ${fmtDateTime(inv.issuedAt || inv.createdAt)}`}
        actions={
          <>
            {inv.balance > 0 && (
              <button type="button" className="ad-btn ad-btn--ghost" onClick={() => setPaying(true)}>
                <AIcon name="rupee" size={18} /> Record Payment
              </button>
            )}
            <div className="ad-menu">
              <button type="button" className="ad-btn ad-btn--primary" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
                <AIcon name="printer" size={18} /> Print / Download <AIcon name="chevron" size={16} />
              </button>
              {menu && (
                <div className="ad-pop ad-pop--right">
                  <button type="button" className="ad-pop-item" onClick={() => (setMenu(false), window.print())}>
                    <AIcon name="printer" size={18} />
                    <span>Print Invoice</span>
                  </button>
                  <button type="button" className="ad-pop-item" onClick={pdf} disabled={pdfBusy}>
                    <AIcon name="download" size={18} />
                    <span>{pdfBusy ? 'Preparing PDF…' : 'Download PDF'}</span>
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      <div className="ad-inv-layout">
        <article className="ad-paper" aria-label={`Invoice ${inv.number}`}>
          <Blossom className="ad-paper-blossom ad-paper-blossom--l" />
          <Blossom className="ad-paper-blossom ad-paper-blossom--r" />
          <header className="ad-paper-head">
            <AdminLogo tagline="BEAUTY · CARE · CONFIDENCE" className="ad-logo--paper" />
            {contact.length > 0 && (
              <ul className="ad-paper-contact">
                {contact.map((c) => (
                  <li key={c.icon}>
                    <AIcon name={c.icon} size={16} />
                    {c.text}
                  </li>
                ))}
              </ul>
            )}
          </header>

          <div className="ad-paper-meta">
            <div>
              <p className="ad-cap">Invoice To</p>
              <div className="ad-person">
                <Avatar name={inv.customerName} size={56} />
                <span className="ad-row-main">
                  <b className="ad-paper-name">{inv.customerName}</b>
                  {cust.phone && <small>{cust.phone}</small>}
                  {cust.email && <small>{cust.email}</small>}
                </span>
              </div>
            </div>
            <dl className="ad-paper-facts">
              <div>
                <dt>Invoice No.</dt>
                <dd className="ad-paper-no">{inv.number}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{fmtDate(inv.date)}</dd>
              </div>
              {inv.appointment && (
                <div>
                  <dt>Appointment</dt>
                  <dd>{fmtTime(inv.appointment.time)}</dd>
                </div>
              )}
              <div>
                <dt>Payment Status</dt>
                <dd>
                  <Badge status={inv.paymentStatus} />
                </dd>
              </div>
              <div>
                <dt>Payment Method</dt>
                <dd>{lastPay ? [...new Set(inv.payments.map((p) => methodLabel(p.method)))].join(', ') : '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="ad-table-wrap">
            <table className="ad-table ad-paper-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Service / Treatment</th>
                  <th>Duration</th>
                  <th className="num">Price (₹)</th>
                  <th className="ctr">Qty</th>
                  <th className="num">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((l, i) => (
                  <tr key={l.serviceId + i}>
                    <td>{i + 1}</td>
                    <td>
                      {l.name}
                      {l.discount > 0 && <small className="ad-muted ad-block">Discount {money(l.discount)}</small>}
                    </td>
                    <td className="ad-nowrap">{l.durationMin} mins</td>
                    <td className="num">{num(l.price)}</td>
                    <td className="ctr">{l.qty}</td>
                    <td className="num">{num(l.price * l.qty - (l.discount || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ad-paper-bottom">
            <div className="ad-paper-thanks">
              <AIcon name="heart" size={20} />
              <p className="ad-script">Thank You!</p>
              <p>{footer}</p>
              {inv.notes && <p className="ad-paper-note">Note: {inv.notes}</p>}
            </div>
            <dl className="ad-sum ad-paper-sum">
              <div>
                <dt>Subtotal</dt>
                <dd>{num(inv.subtotal)}</dd>
              </div>
              {inv.discount > 0 && (
                <div>
                  <dt>Discount{inv.discountReason ? ` (${inv.discountReason})` : ''}</dt>
                  <dd>-{num(inv.discount)}</dd>
                </div>
              )}
              {inv.tax > 0 && (
                <div>
                  <dt>
                    {inv.taxLabel} ({inv.taxRate}%)
                  </dt>
                  <dd>{num(inv.tax)}</dd>
                </div>
              )}
              <div className="ad-sum-total">
                <dt>Total Amount</dt>
                <dd>{money(inv.total)}</dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>{money(inv.paid)}</dd>
              </div>
              {inv.balance > 0 && (
                <div className="ad-sum-due">
                  <dt>Balance Due</dt>
                  <dd>{money(inv.balance)}</dd>
                </div>
              )}
            </dl>
          </div>

          <footer className="ad-paper-foot">
            {hasInstagram() && (
              <span>
                <AIcon name="heart" size={16} /> {BUSINESS.instagramHandle || BUSINESS.instagramUrl.replace(/^https:\/\/(www\.)?/, '')}
              </span>
            )}
            <span className="ad-paper-words">Beauty · Wellness · Self Love</span>
          </footer>
        </article>

        <aside className="ad-stack-lg ad-inv-side">
          <Card title="Payment Information" icon="wallet">
            <p className={`ad-pay-state ad-pay-state--${inv.paymentStatus}`}>
              <AIcon name={inv.paymentStatus === 'paid' ? 'check' : 'info'} size={16} />
              {inv.paymentStatus === 'paid' ? 'Payment Completed' : inv.paymentStatus === 'partial' ? `Balance ${money(inv.balance)} due` : 'Not paid yet'}
            </p>
            {!inv.payments.length && <p className="ad-muted">No payment recorded.</p>}
            {inv.payments.map((p) => (
              <dl key={p.id} className="ad-kv">
                <div>
                  <dt>Payment Method</dt>
                  <dd>{methodLabel(p.method)}</dd>
                </div>
                <div>
                  <dt>Amount Received</dt>
                  <dd>{money(p.amount)}</dd>
                </div>
                {p.reference && (
                  <div>
                    <dt>Reference</dt>
                    <dd>{p.reference}</dd>
                  </div>
                )}
                <div>
                  <dt>Payment Date</dt>
                  <dd>{fmtDateTime(p.at)}</dd>
                </div>
              </dl>
            ))}
          </Card>

          <Card title="Customer Information" icon="user">
            {inv.customer ? (
              <Link to={`/admin/customers?id=${inv.customer.id}`} className="ad-row ad-row--link">
                <Avatar name={inv.customerName} size={52} />
                <span className="ad-row-main">
                  <b>{inv.customerName}</b>
                  <small>{inv.customer.phone}</small>
                  {inv.customer.email && <small>{inv.customer.email}</small>}
                </span>
                <AIcon name="chevronRight" size={18} />
              </Link>
            ) : (
              <p className="ad-muted">
                Walk-in customer{inv.walkIn?.name && inv.walkIn.name !== 'Walk-in customer' ? ` · ${inv.walkIn.name}` : ''}
                {inv.walkIn?.phone ? ` · ${inv.walkIn.phone}` : ''}
              </p>
            )}
          </Card>

          <Card title="Actions" icon="settings">
            <div className="ad-stack">
              <button type="button" className="ad-qa" onClick={() => window.print()}>
                <AIcon name="printer" size={20} /> Print Invoice
              </button>
              <button type="button" className="ad-qa" onClick={pdf} disabled={pdfBusy}>
                <AIcon name="download" size={20} /> {pdfBusy ? 'Preparing PDF…' : 'Download PDF'}
              </button>
              {waTo.length >= 10 && (
                <a className="ad-qa" href={`https://wa.me/${waTo}?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer">
                  <AIcon name="phone" size={20} /> Send via WhatsApp
                </a>
              )}
              {cust.email && (
                <a className="ad-qa" href={`mailto:${cust.email}?subject=${encodeURIComponent(`Your invoice ${inv.number}`)}&body=${encodeURIComponent(share)}`}>
                  <AIcon name="mail" size={20} /> Send via Email
                </a>
              )}
              <Link to="/admin/invoices/new" className="ad-qa">
                <AIcon name="plus" size={20} /> Create New Invoice
              </Link>
              <Link to="/admin/invoices" className="ad-qa">
                <AIcon name="chevronLeft" size={20} /> Back to Invoices
              </Link>
            </div>
          </Card>

          <Card title="Notes (Internal)" icon="note">
            <label className="visually-hidden" htmlFor="ad-inv-note">
              Internal note
            </label>
            <textarea id="ad-inv-note" className="ad-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Only visible to you, never printed." maxLength={1000} />
            <div className="ad-row-actions">
              <button type="button" className="ad-btn ad-btn--soft ad-btn--sm" onClick={saveNote} disabled={noteAction.busy || note === (inv.internalNote || '')}>
                Save Note
              </button>
              {noteSaved && <span className="ad-ok">Saved</span>}
            </div>
          </Card>
        </aside>
      </div>

      <PaymentModal
        inv={inv}
        open={paying}
        onClose={() => setPaying(false)}
        onSaved={(r) => {
          setPaying(false);
          setData({ ...inv, ...r });
        }}
      />
    </div>
  );
}
