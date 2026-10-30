import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AIcon from '../components/AIcon.tsx';
import { Avatar, Card, Empty, ErrorNote, Field, Loading, Modal, PageHeader, SearchInput, Segmented } from '../components/ui.tsx';
import { api, isOneOf, oneOf, type AppointmentInput, type AppointmentView, type FieldErrors } from '../api/index.ts';
import type { AppointmentStatus, Customer } from '../../types/models.ts';
import { useAction, useAdminTitle, useApi, useDebounced } from '../hooks.ts';
import { APPT_STATUS_LABEL, addDays, fmtDate, fmtLongDate, fmtTime, money, parseDate, today } from '../lib/format.ts';

// The label map lists every status, in display order.
const STATUSES = Object.keys(APPT_STATUS_LABEL) as AppointmentStatus[];

interface ApptFormProps {
  open: boolean;
  /** The appointment to edit, or null to book one. */
  appt: Partial<AppointmentView> | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: (appt: AppointmentView) => void;
}

function ApptForm({ open, appt, defaultDate, onClose, onSaved }: ApptFormProps) {
  const services = useApi(() => api.services.list(), []);
  const settings = useApi(() => api.settings.get(), []);
  const [form, setForm] = useState<AppointmentInput>({});
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 200);
  const [matches, setMatches] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Pick<Customer, 'id' | 'name' | 'phone'> | null>(null);
  const { busy, error, setError, run } = useAction();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setQ('');
    setForm(appt ? { ...appt } : { date: defaultDate || today(), time: '10:00', serviceIds: [], staff: '', notes: '', status: 'upcoming' });
    setCustomer(appt ? { id: appt.customerId ?? '', name: appt.customerName ?? '', phone: appt.customerPhone ?? '' } : null);
  }, [open, appt, defaultDate, setError]);
  useEffect(() => {
    if (!open || customer) return undefined;
    let live = true;
    api.customers.lookup(dq).then((r) => live && setMatches(r));
    return () => {
      live = false;
    };
  }, [dq, open, customer]);

  const toggle = (id: string) =>
    setForm((f) => {
      const ids = f.serviceIds ?? [];
      return { ...f, serviceIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] };
    });
  const fe: FieldErrors = error?.fields || {};
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => api.appointments.save({ ...form, customerId: customer?.id }));
    if (r) onSaved(r);
  };
  const chosen = (services.data || []).filter((s) => form.serviceIds?.includes(s.id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={appt ? 'Edit Appointment' : 'New Appointment'}
      footer={
        <>
          <button type="button" className="ad-btn ad-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="ad-appt-form" className="ad-btn ad-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : appt ? 'Save Changes' : 'Book Appointment'}
          </button>
        </>
      }
    >
      <form id="ad-appt-form" className="ad-form-grid" onSubmit={submit} noValidate>
        {error && !error.fields && <p className="ad-alert ad-alert--error ad-span-2">{error.message}</p>}
        <Field label="Customer" required error={fe.customerId} className="ad-span-2">
          {(p) =>
            customer ? (
              <div className="ad-picked">
                <Avatar name={customer.name} size={40} />
                <span className="ad-row-main">
                  <b>{customer.name}</b>
                  <small>{customer.phone}</small>
                </span>
                <button type="button" className="ad-icon-btn" onClick={() => setCustomer(null)} aria-label="Change customer">
                  <AIcon name="close" size={18} />
                </button>
              </div>
            ) : (
              <div>
                <input {...p} className="ad-input" type="search" placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
                <div className="ad-chips ad-mt-s">
                  {matches.slice(0, 6).map((c) => (
                    <button type="button" key={c.id} className="ad-chip" onClick={() => setCustomer(c)}>
                      {c.name} · {c.phone}
                    </button>
                  ))}
                  {!matches.length && <span className="ad-muted">No match. Add the customer on the Customers page first.</span>}
                </div>
              </div>
            )
          }
        </Field>
        <Field label="Date" required error={fe.date}>
          {(p) => <input {...p} className="ad-input" type="date" value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} />}
        </Field>
        <Field label="Time" required error={fe.time}>
          {(p) => <input {...p} className="ad-input" type="time" step="900" value={form.time || ''} onChange={(e) => setForm({ ...form, time: e.target.value })} />}
        </Field>
        <Field label="Services" required error={fe.serviceIds} className="ad-span-2" hint={chosen.length ? `${chosen.reduce((t, s) => t + (s.durationMin ?? 0), 0)} mins · ${money(chosen.reduce((t, s) => t + (s.price ?? 0), 0))}` : ''}>
          {() => (
            <div className="ad-chips" role="group" aria-label="Services">
              {(services.data || []).map((s) => (
                <button type="button" key={s.id} className={`ad-chip ${form.serviceIds?.includes(s.id) ? 'is-on' : ''}`} aria-pressed={!!form.serviceIds?.includes(s.id)} onClick={() => toggle(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Staff (optional)">
          {(p) => (
            <select {...p} className="ad-select" value={form.staff || ''} onChange={(e) => setForm({ ...form, staff: e.target.value })}>
              <option value="">Not assigned</option>
              {(settings.data?.staff || []).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Status">
          {(p) => (
            <select {...p} className="ad-select" value={form.status || 'upcoming'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {APPT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Notes (optional)" className="ad-span-2">
          {(p) => <textarea {...p} className="ad-textarea" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} />}
        </Field>
      </form>
    </Modal>
  );
}

export default function Appointments() {
  useAdminTitle('Appointments');
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<'day' | 'upcoming'>('day');
  const date = params.get('date') || today();
  const [status, setStatus] = useState<'all' | AppointmentStatus>('all');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [edit, setEdit] = useState<Partial<AppointmentView> | null>(params.get('new') ? {} : null);
  const range = view === 'day' ? { from: date, to: date } : { from: today(), to: addDays(today(), 13) };
  const { data, error, loading, reload, setData } = useApi(() => api.appointments.list({ ...range, status, q: dq }), [range.from, range.to, status, dq]);
  const statusAction = useAction();

  const setDate = (d: string) => setParams({ date: d });
  const changeStatus = async (a: AppointmentView, s: AppointmentStatus) => {
    const r = await statusAction.run(() => api.appointments.setStatus(a.id, s));
    if (r && data) setData(data.map((x) => (x.id === a.id ? r : x)));
  };

  const groups = (data || []).reduce<Record<string, AppointmentView[]>>((g, a) => {
    (g[a.date] ||= []).push(a);
    return g;
  }, {});
  const counts = (data || []).reduce<Partial<Record<AppointmentStatus, number>>>((c, a) => ({ ...c, [a.status]: (c[a.status] || 0) + 1 }), {});

  return (
    <div className="ad-page">
      <PageHeader
        crumbs={[{ label: 'Appointments' }]}
        title="Appointments"
        sub="Plan the day, update progress and bill finished appointments."
        actions={
          <button type="button" className="ad-btn ad-btn--primary ad-btn--lg" onClick={() => setEdit({})}>
            <AIcon name="calendarPlus" size={20} /> New Appointment
          </button>
        }
      />

      <Card>
        <div className="ad-toolbar">
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'day', label: 'Day' },
              { value: 'upcoming', label: 'Next 14 days' },
            ]}
          />
          {view === 'day' && (
            <div className="ad-daynav">
              <button type="button" className="ad-icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
                <AIcon name="chevronLeft" size={18} />
              </button>
              <input className="ad-input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
              <button type="button" className="ad-icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
                <AIcon name="chevronRight" size={18} />
              </button>
              {date !== today() && (
                <button type="button" className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => setDate(today())}>
                  Today
                </button>
              )}
            </div>
          )}
          <SearchInput value={q} onChange={setQ} placeholder="Search customer…" />
          <select className="ad-select ad-select--auto" value={status} onChange={(e) => setStatus(oneOf<'all' | AppointmentStatus>(['all', ...STATUSES], e.target.value, 'all'))} aria-label="Status">
            <option value="all">All Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {APPT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        {view === 'day' && (
          <p className="ad-day-title">
            {fmtLongDate(parseDate(date))}
            <span className="ad-muted">
              {' '}
              · {data?.length || 0} appointment{data?.length === 1 ? '' : 's'}
              {counts.completed ? ` · ${counts.completed} completed` : ''}
              {counts.upcoming ? ` · ${counts.upcoming} upcoming` : ''}
            </span>
          </p>
        )}
        <ErrorNote error={error || statusAction.error} onRetry={reload} />
        {loading && !data ? (
          <Loading rows={6} />
        ) : !data?.length ? (
          <Empty icon="calendar" title="No appointments" text="Book one with “New Appointment”." />
        ) : (
          Object.entries(groups).map(([d, list]) => (
            <div key={d} className="ad-appt-group">
              {view !== 'day' && <p className="ad-upc-day">{fmtDate(d)}</p>}
              <ul className="ad-appts">
                {list.map((a) => (
                  <li key={a.id} className="ad-appt">
                    <span className="ad-appt-time">{fmtTime(a.time)}</span>
                    <span className="ad-person ad-appt-who">
                      <Avatar name={a.customerName} size={40} />
                      <span className="ad-row-main">
                        <b>{a.customerName}</b>
                        <small>{a.customerPhone}</small>
                      </span>
                    </span>
                    <span className="ad-appt-svc">
                      {a.services.map((s) => s.name).join(', ')}
                      <small className="ad-muted ad-block">
                        {a.services.reduce((t, s) => t + (s.durationMin ?? 0), 0)} mins{a.staff ? ` · ${a.staff}` : ''}
                      </small>
                    </span>
                    <span className="ad-appt-status">
                      <select className={`ad-select ad-select--sm ad-sel-${a.status}`} value={a.status} onChange={(e) => isOneOf(STATUSES, e.target.value) && changeStatus(a, e.target.value)} aria-label={`Status for ${a.customerName}`}>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {APPT_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span className="ad-appt-actions">
                      {a.invoiceId ? (
                        <Link to={`/admin/invoices/${a.invoiceId}`} className="ad-btn ad-btn--ghost ad-btn--sm">
                          View Bill
                        </Link>
                      ) : (
                        a.status !== 'cancelled' &&
                        a.status !== 'no_show' && (
                          <Link to={`/admin/invoices/new?appointment=${a.id}`} className="ad-btn ad-btn--soft ad-btn--sm">
                            Create Bill
                          </Link>
                        )
                      )}
                      <button type="button" className="ad-icon-btn" onClick={() => setEdit(a)} aria-label={`Edit appointment for ${a.customerName}`}>
                        <AIcon name="edit" size={17} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Card>

      <ApptForm
        open={!!edit}
        appt={edit?.id ? edit : null}
        defaultDate={view === 'day' && date >= today() ? date : today()}
        onClose={() => setEdit(null)}
        onSaved={(a) => {
          setEdit(null);
          if (view === 'day' && a.date !== date) setDate(a.date);
          else reload();
        }}
      />
    </div>
  );
}
