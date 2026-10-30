import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AIcon, { type AIconName } from '../components/AIcon.tsx';
import CustomerForm from '../components/CustomerForm.tsx';
import { Avatar, Card, Confirm, ErrorNote, Field, PageHeader, Segmented } from '../components/ui.tsx';
import Img from '../../components/ui/Img.tsx';
import { api, ApiError, newIdempotencyKey, type AppointmentView, type InvoicePayload, type InvoiceView, type ServiceRow } from '../api/index.ts';
import type { Customer, PaymentMethod, WalkIn } from '../../types/models.ts';
import { asApiError, useAction, useAdminTitle, useApi, useDebounced } from '../hooks.ts';
import { computeTotals, paymentStatus } from '../lib/billing.ts';
import { PAYMENT_METHODS, PAYMENT_STATUS_LABEL, fmtLongDate, fmtTime, money, num, today } from '../lib/format.ts';

const METHOD_ICON: Record<PaymentMethod, AIconName> = { cash: 'cash', upi: 'upi', card: 'card', other: 'more' };

/** One line on the bill being built. Prices shown here are a preview; the API prices the bill itself. */
interface BillLine {
  serviceId: string;
  name: string;
  price: number;
  durationMin: number | null;
  qty: number;
  /** Rupees off the line; '' while the field is empty. */
  discount: number | '';
}

interface PaymentForm {
  method: PaymentMethod;
  /** As typed: a string from the input, or a number from a saved draft. */
  amount: number | string;
  reference: string;
}

interface CustomerPickerProps {
  value: Customer | null;
  onPick: (customer: Customer | null) => void;
  onNew: () => void;
}

function CustomerPicker({ value, onPick, onNew }: CustomerPickerProps) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Customer[]>([]);
  const dq = useDebounced(q, 200);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    api.customers.lookup(dq).then((r) => live && setRows(r), () => {});
    return () => {
      live = false;
    };
  }, [dq, open]);
  useEffect(() => {
    const h = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (value) {
    return (
      <div className="ad-picked">
        <Avatar name={value.name} size={48} />
        <span className="ad-row-main">
          <b>{value.name}</b>
          <small>
            {value.phone}
            {value.email ? ` | ${value.email}` : ''}
          </small>
        </span>
        <button type="button" className="ad-icon-btn" onClick={() => onPick(null)} aria-label="Remove selected customer">
          <AIcon name="close" size={18} />
        </button>
      </div>
    );
  }
  return (
    <div className="ad-gsearch ad-picker" ref={box}>
      <label className="ad-search">
        <AIcon name="search" size={18} />
        <span className="visually-hidden">Search customers</span>
        <input type="search" value={q} placeholder="Search by name or phone number…" onFocus={() => setOpen(true)} onChange={(e) => (setQ(e.target.value), setOpen(true))} />
      </label>
      {open && (
        <div className="ad-pop ad-gsearch-pop" role="listbox" aria-label="Customers">
          {!rows.length && <p className="ad-pop-empty">No customer found.</p>}
          {rows.map((c) => (
            <button type="button" key={c.id} className="ad-pop-item" onClick={() => (onPick(c), setOpen(false), setQ(''))}>
              <Avatar name={c.name} size={30} />
              <span>
                <b>{c.name}</b>
                <small>{c.phone}</small>
              </span>
            </button>
          ))}
          <button type="button" className="ad-pop-item" onClick={() => (setOpen(false), onNew())}>
            <AIcon name="userPlus" size={18} />
            <span>
              <b>Add a new customer</b>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function CreateBill() {
  useAdminTitle('Create Bill');
  const nav = useNavigate();
  const [params] = useSearchParams();
  const draftId = params.get('draft');
  const apptParam = params.get('appointment');
  const customerParam = params.get('customer');

  const settings = useApi(() => api.settings.get(), []);
  const [cat, setCat] = useState('all');
  const [svcQ, setSvcQ] = useState('');
  const dSvcQ = useDebounced(svcQ, 150);
  const services = useApi(() => api.services.list({ q: dSvcQ, category: cat }), [dSvcQ, cat]);

  const [mode, setMode] = useState<'existing' | 'walkin'>('existing');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [walkIn, setWalkIn] = useState<WalkIn>({ name: '', phone: '' });
  const [date, setDate] = useState(today());
  const [appointmentId, setAppointmentId] = useState('');
  const [staff, setStaff] = useState('');
  const [items, setItems] = useState<BillLine[]>([]);
  const [billDiscount, setBillDiscount] = useState<number | string>('');
  const [discountReason, setDiscountReason] = useState('');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [payment, setPayment] = useState<PaymentForm>({ method: 'cash', amount: '', reference: '' });
  const [draft, setDraft] = useState<InvoiceView | null>(null);
  const [newCustomer, setNewCustomer] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saved, setSaved] = useState('');
  const amountTouched = useRef(false);
  const key = useRef(newIdempotencyKey());
  const { busy, error, setError, run } = useAction();

  const nextNo = useApi(() => api.invoices.nextNumber(date), [date]);
  const appts = useApi(
    () => (customer ? api.appointments.list({ from: date, to: date }).then((r) => r.filter((a) => a.customerId === customer.id && !a.invoiceId && a.status !== 'cancelled')) : Promise.resolve<AppointmentView[]>([])),
    [customer?.id, date],
  );

  // Pick up a saved draft, or start from an appointment.
  useEffect(() => {
    let live = true;
    if (draftId) {
      api.invoices.get(draftId).then((inv) => {
        if (!live) return;
        if (inv.status !== 'draft') return nav(`/admin/invoices/${inv.id}`, { replace: true });
        setDraft(inv);
        setMode(inv.customerId ? 'existing' : 'walkin');
        setCustomer(inv.customer);
        setWalkIn(inv.walkIn || { name: '', phone: '' });
        setDate(inv.date);
        setAppointmentId(inv.appointmentId || '');
        setStaff(inv.staff || '');
        setItems(inv.items.map((l) => ({ serviceId: l.serviceId, name: l.name, price: l.price, durationMin: l.durationMin, qty: l.qty, discount: l.discount || 0 })));
        setBillDiscount(inv.billDiscount || '');
        setDiscountReason(inv.discountReason || '');
        setNotes(inv.notes || '');
        setShowNotes(!!inv.notes);
        if (inv.draftPayment) {
          setPayment({ method: inv.draftPayment.method || 'cash', amount: inv.draftPayment.amount ?? '', reference: inv.draftPayment.reference || '' });
          amountTouched.current = true;
        }
      }, (e) => live && setError(asApiError(e)));
    } else if (apptParam) {
      api.appointments.list({}).then((all) => {
        const a = all.find((x) => x.id === apptParam);
        if (!a || !live) return;
        api.customers.get(a.customerId).then((c) => live && setCustomer(c));
        setDate(a.date);
        setAppointmentId(a.id);
        setStaff(a.staff || '');
        setItems(a.services.map((s) => ({ serviceId: s.id, name: s.name, price: s.price ?? 0, durationMin: s.durationMin, qty: 1, discount: 0 })));
      });
    } else if (customerParam) {
      api.customers.get(customerParam).then((c) => live && setCustomer(c), () => {});
    }
    return () => {
      live = false;
    };
  }, [draftId, apptParam, customerParam, nav, setError]);

  const taxRate = settings.data?.taxEnabled ? settings.data.taxRate : 0;
  const totals = useMemo(() => computeTotals(items, Number(billDiscount) || 0, taxRate), [items, billDiscount, taxRate]);
  const received = Math.max(Number(payment.amount) || 0, 0);
  const status = paymentStatus(totals.total, Math.min(received, totals.total));
  const balance = Math.max(totals.total - received, 0);
  const changeDue = Math.max(received - totals.total, 0);

  // Default "amount received" to the bill total until the admin types something else.
  useEffect(() => {
    if (!amountTouched.current) setPayment((p) => ({ ...p, amount: totals.total ? String(totals.total) : '' }));
  }, [totals.total]);

  const addService = (s: ServiceRow) => {
    setSaved('');
    setItems((list) => {
      const i = list.findIndex((l) => l.serviceId === s.id);
      if (i >= 0) return list.map((l, k) => (k === i ? { ...l, qty: Math.min(l.qty + 1, 20) } : l));
      return [...list, { serviceId: s.id, name: s.name, price: s.price ?? 0, durationMin: s.durationMin, qty: 1, discount: 0 }];
    });
  };
  const patchItem = (i: number, patch: Partial<BillLine>) => setItems((list) => list.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const removeItem = (i: number) => setItems((list) => list.filter((_, k) => k !== i));

  const payload = (): InvoicePayload => ({
    id: draft?.id,
    date,
    customerId: mode === 'existing' ? customer?.id : null,
    walkIn: mode === 'walkin' ? walkIn : null,
    appointmentId: appointmentId || null,
    staff,
    items: items.map(({ serviceId, qty, discount }) => ({ serviceId, qty, discount: Number(discount) || 0 })),
    billDiscount: Number(billDiscount) || 0,
    discountReason,
    notes,
    payment: { method: payment.method, amount: received, reference: payment.reference },
  });

  const validate = () => {
    if (mode === 'existing' && !customer) return 'Choose a customer, or switch to Walk-in Customer.';
    if (!items.length) return 'Add at least one service to the bill.';
    if (totals.discount > 0 && !discountReason.trim()) return 'Give a reason for the discount.';
    if (payment.method !== 'cash' && payment.method !== 'other' && received > totals.total) return 'Amount received by UPI or card cannot be more than the bill.';
    return '';
  };

  const saveDraft = async () => {
    if (mode === 'existing' && !customer && !items.length) return setError(new ApiError(400, 'Add a customer or a service before saving a draft.'));
    const inv = await run(() => api.invoices.saveDraft(payload()));
    if (inv) {
      setDraft(inv);
      setSaved(`Draft saved at ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`);
      if (!draftId) nav(`/admin/invoices/new?draft=${inv.id}`, { replace: true });
    }
  };

  const generate = async () => {
    const msg = validate();
    if (msg) return setError(new ApiError(400, msg));
    const inv = await run(() => api.invoices.issue(payload(), key.current));
    if (inv) nav(`/admin/invoices/${inv.id}`, { replace: true });
  };

  const clearAll = async () => {
    if (draft?.id) await api.invoices.discardDraft(draft.id).catch(() => {});
    setConfirmClear(false);
    nav('/admin/invoices/new', { replace: true });
    setDraft(null);
    setItems([]);
    setCustomer(null);
    setWalkIn({ name: '', phone: '' });
    setAppointmentId('');
    setBillDiscount('');
    setDiscountReason('');
    setNotes('');
    setPayment({ method: 'cash', amount: '', reference: '' });
    amountTouched.current = false;
    key.current = newIdempotencyKey();
  };

  const categories = settings.data?.serviceCategories || [];

  return (
    <div className="ad-page">
      <PageHeader
        crumbs={[{ label: 'Billing', to: '/admin/invoices' }, { label: draft ? 'Edit Draft' : 'Create Bill' }]}
        title={draft ? 'Edit Draft Bill' : 'Create Bill'}
        sub="Add customer, select services and generate invoice"
        actions={
          <div className="ad-clock">
            <span className="ad-clock-ico">
              <AIcon name="calendar" size={22} />
            </span>
            <span>
              <b>{fmtLongDate()}</b>
              <small>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
            </span>
          </div>
        }
      />

      <div className="ad-bill-top">
        <Card
          title="Customer Details"
          icon="user"
          actions={
            <button type="button" className="ad-btn ad-btn--sm ad-btn--ghost" onClick={() => setNewCustomer(true)}>
              <AIcon name="plus" size={16} /> New Customer
            </button>
          }
        >
          <Segmented
            className="ad-seg--full"
            label="Customer type"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'existing', label: 'Existing Customer' },
              { value: 'walkin', label: 'Walk-in Customer' },
            ]}
          />
          <div className="ad-mt">
            {mode === 'existing' ? (
              <CustomerPicker value={customer} onPick={setCustomer} onNew={() => setNewCustomer(true)} />
            ) : (
              <div className="ad-form-grid">
                <Field label="Name (optional)">{(p) => <input {...p} className="ad-input" value={walkIn.name} onChange={(e) => setWalkIn({ ...walkIn, name: e.target.value })} placeholder="Walk-in customer" maxLength={80} />}</Field>
                <Field label="Phone (optional)">{(p) => <input {...p} className="ad-input" type="tel" value={walkIn.phone} onChange={(e) => setWalkIn({ ...walkIn, phone: e.target.value })} maxLength={16} />}</Field>
              </div>
            )}
          </div>
        </Card>

        <Card title="Invoice Information" icon="bill">
          <div className="ad-form-grid">
            <Field label="Invoice Date">{(p) => <input {...p} className="ad-input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} />}</Field>
            <Field label="Invoice Number" hint={draft?.number ? '' : 'Confirmed when the invoice is generated'}>
              {(p) => <input {...p} className="ad-input" readOnly value={nextNo.data || '…'} />}
            </Field>
            <Field label="Appointment (Optional)" className="ad-span-2">
              {(p) => (
                <select {...p} className="ad-select" value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} disabled={mode !== 'existing' || !customer}>
                  <option value="">{customer ? 'No appointment' : 'Choose a customer first'}</option>
                  {(appts.data || []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {fmtTime(a.time)} - {a.services.map((s) => s.name).join(', ')} ({a.customerName})
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Staff (Optional)" className="ad-span-2">
              {(p) => (
                <select {...p} className="ad-select" value={staff} onChange={(e) => setStaff(e.target.value)}>
                  <option value="">Not recorded</option>
                  {(settings.data?.staff || []).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </Card>

        <Card title="Quick Actions" icon="sparkle" className="ad-card--blush ad-bill-quick">
          <div className="ad-stack">
            <Link to="/admin/services?new=1" className="ad-qa">
              <AIcon name="settings" size={20} /> Add New Service
            </Link>
            <button type="button" className="ad-qa" onClick={() => setNewCustomer(true)}>
              <AIcon name="userPlus" size={20} /> Add New Customer
            </button>
            <Link to="/admin/appointments?new=1" className="ad-qa">
              <AIcon name="calendarPlus" size={20} /> Book Appointment
            </Link>
          </div>
        </Card>
      </div>

      <div className="ad-bill-main">
        <div className="ad-stack-lg">
          <Card
            title="Select Services"
            icon="spa"
            actions={
              <div className="ad-svc-filters">
                <label className="ad-search">
                  <AIcon name="search" size={18} />
                  <span className="visually-hidden">Search services</span>
                  <input type="search" value={svcQ} onChange={(e) => setSvcQ(e.target.value)} placeholder="Search services…" />
                </label>
                <select className="ad-select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            }
          >
            <div className="ad-svc-grid">
              {(services.data || []).map((s) => (
                <button type="button" key={s.id} className="ad-svc" onClick={() => addService(s)} aria-label={`Add ${s.name}, ${money(s.price)}`}>
                  <Img src={s.image} alt="" className="ad-svc-img" />
                  <span className="ad-svc-text">
                    <b>{s.name}</b>
                    <span className="ad-svc-price">{money(s.price)}</span>
                    <small>{s.durationMin} mins</small>
                  </span>
                  <span className="ad-svc-add" aria-hidden="true">
                    <AIcon name="plus" size={16} stroke={2.2} />
                  </span>
                </button>
              ))}
              {services.data && !services.data.length && <p className="ad-muted">No services match.</p>}
            </div>
          </Card>

          <Card
            title="Bill Items"
            icon="note"
            actions={
              items.length > 0 && (
                <button type="button" className="ad-btn ad-btn--sm ad-btn--ghost" onClick={() => setConfirmClear(true)}>
                  <AIcon name="trash" size={16} /> Clear All
                </button>
              )
            }
          >
            {!items.length ? (
              <p className="ad-muted ad-bill-empty">Tap a service above to add it to the bill.</p>
            ) : (
              <div className="ad-table-wrap">
                <table className="ad-table ad-bill-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Service</th>
                      <th className="num">Price (₹)</th>
                      <th className="ctr">Qty</th>
                      <th className="ctr">Discount (₹)</th>
                      <th className="num">Amount (₹)</th>
                      <th className="ctr">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.lines.map((l, i) => (
                      <tr key={l.serviceId}>
                        <td>{i + 1}</td>
                        <td>{l.name}</td>
                        <td className="num">{num(l.price)}</td>
                        <td className="ctr">
                          <span className="ad-qty">
                            <button type="button" onClick={() => patchItem(i, { qty: Math.max(1, l.qty - 1) })} aria-label={`Decrease ${l.name} quantity`}>
                              <AIcon name="minus" size={14} />
                            </button>
                            <span aria-live="polite">{l.qty}</span>
                            <button type="button" onClick={() => patchItem(i, { qty: Math.min(20, l.qty + 1) })} aria-label={`Increase ${l.name} quantity`}>
                              <AIcon name="plus" size={14} />
                            </button>
                          </span>
                        </td>
                        <td className="ctr">
                          <input
                            className="ad-input ad-input--sm"
                            type="number"
                            min="0"
                            max={l.gross}
                            inputMode="decimal"
                            value={items[i].discount}
                            onChange={(e) => patchItem(i, { discount: e.target.value === '' ? '' : Math.min(Math.max(Number(e.target.value), 0), l.gross) })}
                            aria-label={`Discount on ${l.name}`}
                          />
                        </td>
                        <td className="num">{num(l.amount)}</td>
                        <td className="ctr">
                          <button type="button" className="ad-icon-btn ad-icon-btn--danger" onClick={() => removeItem(i)} aria-label={`Remove ${l.name}`}>
                            <AIcon name="trash" size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {items.length > 0 && (
              <div className="ad-form-grid ad-mt">
                <Field label="Extra discount on the bill (₹)">
                  {(p) => <input {...p} className="ad-input" type="number" min="0" inputMode="decimal" value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)} />}
                </Field>
                {totals.discount > 0 && (
                  <Field label="Reason for discount" required>
                    {(p) => <input {...p} className="ad-input" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="e.g. Special offer, loyalty" maxLength={200} />}
                  </Field>
                )}
              </div>
            )}

            {showNotes ? (
              <Field label="Notes for the customer (printed on the invoice)" className="ad-mt">
                {(p) => <textarea {...p} className="ad-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />}
              </Field>
            ) : (
              <button type="button" className="ad-notes-btn ad-mt" onClick={() => setShowNotes(true)}>
                <AIcon name="note" size={22} /> Add Notes (Optional)
              </button>
            )}
          </Card>
        </div>

        <div className="ad-stack-lg ad-bill-side">
          <Card title="Bill Summary" icon="note">
            <dl className="ad-sum">
              <div>
                <dt>Subtotal</dt>
                <dd>{money(totals.subtotal)}</dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>{totals.discount ? `−${money(totals.discount)}` : money(0)}</dd>
              </div>
              {taxRate > 0 && (
                <div>
                  <dt>
                    {settings.data?.taxLabel} ({taxRate}%)
                  </dt>
                  <dd>{money(totals.tax)}</dd>
                </div>
              )}
              <div className="ad-sum-total">
                <dt>Total Amount</dt>
                <dd>{money(totals.total)}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Payment Details" icon="wallet">
            <p className="ad-label">Payment Method</p>
            <div className="ad-methods" role="radiogroup" aria-label="Payment method">
              {PAYMENT_METHODS.map((m) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={payment.method === m.id}
                  key={m.id}
                  className={`ad-method ${payment.method === m.id ? 'is-active' : ''}`}
                  onClick={() => setPayment({ ...payment, method: m.id })}
                >
                  <AIcon name={payment.method === m.id ? 'check' : METHOD_ICON[m.id]} size={16} /> {m.label}
                </button>
              ))}
            </div>
            <div className="ad-form-grid ad-mt">
              <Field label="Amount Received" required>
                {(p) => (
                  <span className="ad-money-input">
                    <span>₹</span>
                    <input
                      {...p}
                      className="ad-input"
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={payment.amount}
                      onChange={(e) => {
                        amountTouched.current = true;
                        setPayment({ ...payment, amount: e.target.value });
                      }}
                    />
                  </span>
                )}
              </Field>
              <Field label="Payment Status" hint="Set from the amount received">
                {(p) => <input {...p} className={`ad-input ad-status-${status}`} readOnly value={PAYMENT_STATUS_LABEL[status]} />}
              </Field>
              <Field label="Reference No. (Optional)" className="ad-span-2">
                {(p) => <input {...p} className="ad-input" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} placeholder="e.g. UPI Transaction ID / last 4 card digits" maxLength={60} />}
              </Field>
            </div>
            {balance > 0 && items.length > 0 && <p className="ad-alert ad-alert--info ad-mt">Balance to collect later: {money(balance)}</p>}
            {changeDue > 0 && <p className="ad-alert ad-alert--ok ad-mt">Change to return: {money(changeDue)}</p>}
          </Card>

          <ErrorNote error={error} />
          {saved && (
            <p className="ad-alert ad-alert--ok" role="status">
              {saved}
            </p>
          )}
          <div className="ad-bill-actions">
            <button type="button" className="ad-btn ad-btn--soft ad-btn--lg" onClick={saveDraft} disabled={busy}>
              <AIcon name="note" size={20} /> Save as Draft
            </button>
            <button type="button" className="ad-btn ad-btn--primary ad-btn--lg" onClick={generate} disabled={busy || !items.length}>
              <AIcon name="printer" size={20} /> {busy ? 'Working…' : 'Generate Invoice'}
            </button>
          </div>
        </div>
      </div>

      <CustomerForm
        open={newCustomer}
        onClose={() => setNewCustomer(false)}
        onSaved={(c) => {
          setNewCustomer(false);
          setMode('existing');
          setCustomer(c);
        }}
      />
      <Confirm
        open={confirmClear}
        title="Clear this bill?"
        text={draft ? 'This removes all items and deletes the saved draft. This cannot be undone.' : 'This removes all items and details from the bill.'}
        confirmLabel="Clear bill"
        danger
        onConfirm={clearAll}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}
