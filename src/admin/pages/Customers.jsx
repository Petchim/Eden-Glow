import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AIcon from '../components/AIcon.jsx';
import CustomerForm from '../components/CustomerForm.jsx';
import { Avatar, Badge, Card, Empty, ErrorNote, Loading, PageHeader, Pagination, SearchInput, StatCard } from '../components/ui.jsx';
import { api } from '../api/index.js';
import { useAction, useAdminTitle, useApi, useDebounced } from '../hooks.js';
import { fmtDate, fmtTime, money, num } from '../lib/format.js';

const TABS = ['Overview', 'Appointments', 'Invoices', 'Notes'];

function Detail({ id, version }) {
  const { data: c, error, loading, setData } = useApi(() => api.customers.get(id), [id, version]);
  const [tab, setTab] = useState('Overview');
  const [notes, setNotes] = useState('');
  const [editNotes, setEditNotes] = useState(false);
  const save = useAction();
  useEffect(() => {
    setTab('Overview');
    setEditNotes(false);
  }, [id]);
  useEffect(() => setNotes(c?.notes || ''), [c]);

  if (loading && !c) return <Loading rows={6} />;
  if (error) return <ErrorNote error={error} />;
  if (!c) return null;

  const saveNotes = async () => {
    const r = await save.run(() => api.customers.update(c.id, { notes }));
    if (r) {
      setData({ ...c, notes: r.notes });
      setEditNotes(false);
    }
  };

  const stats = [
    { icon: 'calendar', label: 'Total Visits', value: c.totalVisits },
    { icon: 'rupee', label: 'Total Spent', value: money(c.totalSpent) },
    { icon: 'calendar', label: 'Last Visit', value: c.lastVisit ? fmtDate(c.lastVisit) : '—' },
    { icon: 'chart', label: 'Average Spend', value: money(c.averageSpend) },
  ];

  return (
    <div className="ad-cust">
      <div className="ad-cust-head">
        <Avatar name={c.name} size={84} />
        <div className="ad-cust-id">
          <div className="ad-cust-name">
            <h3>{c.name}</h3>
            <Badge status={c.status}>{c.status === 'active' ? 'Active' : 'Inactive'}</Badge>
          </div>
          <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>
            <AIcon name="phone" size={15} /> {c.phone}
          </a>
          {c.email && (
            <a href={`mailto:${c.email}`}>
              <AIcon name="mail" size={15} /> {c.email}
            </a>
          )}
          {c.area && (
            <span>
              <AIcon name="pin" size={15} /> {c.area}
            </span>
          )}
        </div>
      </div>
      <div className="ad-seg ad-seg--full ad-mt" role="tablist" aria-label="Customer details">
        {TABS.map((t) => (
          <button type="button" key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <>
          <div className="ad-mini-stats">
            {stats.map((s) => (
              <div key={s.label} className="ad-mini">
                <AIcon name={s.icon} size={20} />
                <span>
                  <small>{s.label}</small>
                  <b>{s.value}</b>
                </span>
              </div>
            ))}
          </div>
          <div className="ad-sub-head">
            <h4>Recent Appointments</h4>
            <button type="button" className="ad-viewall" onClick={() => setTab('Appointments')}>
              View All <AIcon name="arrow" size={14} />
            </button>
          </div>
          <ApptList list={c.appointments.slice(0, 3)} />
          <div className="ad-sub-head">
            <h4>Customer Notes</h4>
            <button type="button" className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => (setTab('Notes'), setEditNotes(true))}>
              <AIcon name="edit" size={14} /> Edit
            </button>
          </div>
          <p className="ad-note-box">
            <AIcon name="note" size={18} />
            {c.notes || <span className="ad-muted">No notes yet.</span>}
          </p>
          <Link to={`/admin/invoices/new?customer=${c.id}`} className="ad-btn ad-btn--primary ad-btn--block ad-mt">
            <AIcon name="plus" size={18} /> Create Bill for {c.name.split(' ')[0]}
          </Link>
        </>
      )}
      {tab === 'Appointments' && <ApptList list={c.appointments} />}
      {tab === 'Invoices' &&
        (c.invoices.length ? (
          <ul className="ad-list">
            {c.invoices.map((i) => (
              <li key={i.id}>
                <Link to={i.status === 'draft' ? `/admin/invoices/new?draft=${i.id}` : `/admin/invoices/${i.id}`} className="ad-row ad-row--link">
                  <span className="ad-row-main">
                    <b>{i.number || 'Draft'}</b>
                    <small>{fmtDate(i.date)}</small>
                  </span>
                  <span className="ad-row-amt">{money(i.total)}</span>
                  <Badge status={i.status === 'draft' ? 'draft' : i.paymentStatus} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon="bill" title="No invoices yet" />
        ))}
      {tab === 'Notes' &&
        (editNotes ? (
          <div className="ad-mt">
            <label className="visually-hidden" htmlFor="ad-cnotes">
              Customer notes
            </label>
            <textarea id="ad-cnotes" className="ad-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            <div className="ad-row-actions">
              <button type="button" className="ad-btn ad-btn--primary ad-btn--sm" onClick={saveNotes} disabled={save.busy}>
                Save Notes
              </button>
              <button type="button" className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => (setNotes(c.notes || ''), setEditNotes(false))}>
                Cancel
              </button>
            </div>
            <ErrorNote error={save.error} />
          </div>
        ) : (
          <>
            <p className="ad-note-box ad-mt">
              <AIcon name="note" size={18} />
              {c.notes || <span className="ad-muted">No notes yet.</span>}
            </p>
            <button type="button" className="ad-btn ad-btn--ghost ad-btn--sm ad-mt" onClick={() => setEditNotes(true)}>
              <AIcon name="edit" size={14} /> Edit Notes
            </button>
          </>
        ))}
    </div>
  );
}

function ApptList({ list }) {
  if (!list.length) return <Empty icon="calendar" title="No appointments yet" />;
  return (
    <ul className="ad-list">
      {list.map((a) => (
        <li key={a.id} className="ad-row ad-row--compact">
          <span className="ad-row-date">
            {fmtDate(a.date)}
            <small>{fmtTime(a.time)}</small>
          </span>
          <span className="ad-row-main">
            <small className="ad-ink">{a.services.map((s) => s.name).join(', ')}</small>
          </span>
          <Badge status={a.status} />
        </li>
      ))}
    </ul>
  );
}

export default function Customers() {
  useAdminTitle('Customers');
  const [params, setParams] = useSearchParams();
  const selected = params.get('id');
  const [q, setQ] = useState('');
  const [segment, setSegment] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(params.get('new') ? {} : null);
  const [version, setVersion] = useState(0);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi(() => api.customers.list({ q: dq, segment, status, sort, page }), [dq, segment, status, sort, page, version]);

  // Open the first customer when nothing is selected (desktop panel), like the design.
  const current = selected || (typeof window !== 'undefined' && window.innerWidth > 1100 ? data?.items[0]?.id : null);
  const select = (id) => setParams({ id });
  const s = data?.summary;
  const pctOf = (n) => (s?.total ? `${Math.round((n / s.total) * 100)}%` : '');

  return (
    <div className="ad-page">
      <PageHeader
        crumbs={[{ label: 'Customers' }]}
        title="Customer Management"
        sub="Manage your customers, view history and create new customers."
        actions={
          <button type="button" className="ad-btn ad-btn--primary ad-btn--lg" onClick={() => setForm({})}>
            <AIcon name="plus" size={20} /> Add New Customer
          </button>
        }
      />

      <div className="ad-stats">
        <StatCard icon="users" label="Total Customers" value={s ? s.total : '—'} foot={s ? `+${s.newThisMonth} this month` : ''} />
        <StatCard icon="userPlus" label="New Customers (This Month)" value={s ? s.newThisMonth : '—'} />
        <StatCard icon="repeat" label="Repeat Customers" value={s ? s.repeat : '—'} side={s && <span className="ad-badge ad-badge--green ad-stat-side">{pctOf(s.repeat)}</span>} />
        <StatCard icon="users" tone="gold" label="Walk-in Bills" value={s ? s.walkIns : '—'} foot="Bills without a customer record" />
      </div>

      <div className="ad-cust-layout">
        <Card title="Customer List" icon="users" className="ad-cust-list">
          <div className="ad-toolbar">
            <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Search by name, phone number, or email…" />
            <select className="ad-select" value={segment} onChange={(e) => (setSegment(e.target.value), setPage(1))} aria-label="Customer group">
              <option value="all">All Customers</option>
              <option value="new">New this month</option>
              <option value="repeat">Repeat customers</option>
              <option value="never">No visits yet</option>
            </select>
            <select className="ad-select" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} aria-label="Status">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select className="ad-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="recent">Recent First</option>
              <option value="name">Name A–Z</option>
              <option value="spent">Top Spend</option>
              <option value="visits">Most Visits</option>
            </select>
          </div>
          <ErrorNote error={error} onRetry={reload} />
          {loading && !data ? (
            <Loading rows={8} />
          ) : data && !data.items.length ? (
            <Empty icon="users" title="No customers found" />
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Phone Number</th>
                    <th className="ad-hide-md">Email</th>
                    <th className="ctr">Total Visits</th>
                    <th className="num">Total Spent</th>
                    <th>Last Visit</th>
                    <th>Status</th>
                    <th className="ctr">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((c, i) => (
                    <tr key={c.id} className={`is-clickable ${current === c.id ? 'is-selected' : ''}`} onClick={() => select(c.id)}>
                      <td>{(page - 1) * data.pageSize + i + 1}</td>
                      <td>
                        <span className="ad-person">
                          <Avatar name={c.name} size={34} />
                          <b>{c.name}</b>
                        </span>
                      </td>
                      <td className="ad-nowrap">{c.phone}</td>
                      <td className="ad-hide-md ad-ellipsis">{c.email || '—'}</td>
                      <td className="ctr">{c.totalVisits}</td>
                      <td className="num">₹{num(c.totalSpent)}</td>
                      <td className="ad-nowrap">{c.lastVisit ? fmtDate(c.lastVisit) : '—'}</td>
                      <td>
                        <Badge status={c.status}>{c.status === 'active' ? 'Active' : 'Inactive'}</Badge>
                      </td>
                      <td className="ctr ad-nowrap">
                        <button type="button" className="ad-icon-btn" aria-label={`View ${c.name}`} onClick={(e) => (e.stopPropagation(), select(c.id))}>
                          <AIcon name="eye" size={17} />
                        </button>
                        <button type="button" className="ad-icon-btn" aria-label={`Edit ${c.name}`} onClick={(e) => (e.stopPropagation(), setForm(c))}>
                          <AIcon name="edit" size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun="customers" />}
        </Card>

        {current && (
          <Card
            title="Customer Details"
            icon="user"
            className="ad-cust-panel"
            actions={
              <>
                <button type="button" className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => api.customers.get(current).then(setForm)}>
                  <AIcon name="edit" size={14} /> Edit
                </button>
                {selected && (
                  <button type="button" className="ad-icon-btn ad-panel-close" onClick={() => setParams({})} aria-label="Close details">
                    <AIcon name="close" size={18} />
                  </button>
                )}
              </>
            }
          >
            <Detail id={current} version={version} />
          </Card>
        )}
      </div>

      <CustomerForm
        open={!!form}
        customer={form?.id ? form : null}
        onClose={() => setForm(null)}
        onSaved={(c) => {
          setForm(null);
          setVersion((v) => v + 1);
          select(c.id);
        }}
      />
    </div>
  );
}
