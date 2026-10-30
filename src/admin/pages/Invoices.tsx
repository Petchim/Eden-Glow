import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AIcon from '../components/AIcon.tsx';
import { Badge, Card, Empty, ErrorNote, Loading, PageHeader, Pagination, SearchInput, Segmented, StatCard } from '../components/ui.tsx';
import { api, isOneOf, type InvoiceListQuery, type InvoiceView } from '../api/index.ts';
import { useAdminTitle, useApi, useDebounced } from '../hooks.ts';
import { fmtDate, money, num } from '../lib/format.ts';

type StatusTab = NonNullable<InvoiceListQuery['status']>;

const TABS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partially Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'pending', label: 'Balance Due' },
  { value: 'draft', label: 'Drafts' },
];

export default function Invoices() {
  useAdminTitle('Invoices');
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const requested = params.get('status');
  const status: StatusTab = isOneOf(TABS.map((t) => t.value), requested) ? requested : 'all';
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const { data, error, loading, reload } = useApi(() => api.invoices.list({ q: dq, status, from: from || undefined, to: to || undefined, page }), [dq, status, from, to, page]);

  const open = (i: Pick<InvoiceView, 'id' | 'status'>) => nav(i.status === 'draft' ? `/admin/invoices/new?draft=${i.id}` : `/admin/invoices/${i.id}`);

  return (
    <div className="ad-page">
      <PageHeader
        crumbs={[{ label: 'Billing' }]}
        title="Billing & Invoices"
        sub="Every bill, its payments and what is still due."
        actions={
          <Link to="/admin/invoices/new" className="ad-btn ad-btn--primary">
            <AIcon name="plus" size={18} /> Create Bill
          </Link>
        }
      />

      <div className="ad-stats ad-stats--3">
        <StatCard icon="bill" label="Billed (filtered)" value={data ? money(data.totals.billed) : '—'} foot={data ? `${data.total} bills` : ''} />
        <StatCard icon="wallet" tone="gold" label="Collected" value={data ? money(data.totals.collected) : '—'} />
        <StatCard icon="hourglass" label="Balance Due" value={data ? money(data.totals.pending) : '—'} />
      </div>

      <Card>
        <div className="ad-toolbar">
          <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Search invoice number or customer…" />
          <label className="ad-inline-field">
            <span>From</span>
            <input className="ad-input" type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} />
          </label>
          <label className="ad-inline-field">
            <span>To</span>
            <input className="ad-input" type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} />
          </label>
        </div>
        <Segmented
          label="Invoice status"
          options={TABS}
          value={status}
          onChange={(v) => {
            setParams(v === 'all' ? {} : { status: v });
            setPage(1);
          }}
        />
        <ErrorNote error={error} onRetry={reload} />
        {loading && !data ? (
          <Loading rows={6} />
        ) : data && !data.items.length ? (
          <Empty icon="bill" title="No invoices found" text="Try another filter, or create a new bill." />
        ) : (
          <div className="ad-table-wrap ad-mt">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th className="num">Amount (₹)</th>
                  <th className="num">Paid (₹)</th>
                  <th className="num">Balance (₹)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((i) => (
                  <tr key={i.id} className="is-clickable" onClick={() => open(i)}>
                    <td className="ad-nowrap">
                      <Link to={i.status === 'draft' ? `/admin/invoices/new?draft=${i.id}` : `/admin/invoices/${i.id}`} onClick={(e) => e.stopPropagation()} className="ad-strong-link">
                        {i.number || 'Draft'}
                      </Link>
                    </td>
                    <td>{i.customerName}</td>
                    <td className="ad-nowrap">{fmtDate(i.date)}</td>
                    <td className="num">{num(i.total)}</td>
                    <td className="num">{num(i.paid)}</td>
                    <td className="num">{i.balance ? num(i.balance) : '—'}</td>
                    <td>
                      <Badge status={i.status === 'draft' ? 'draft' : i.paymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > 0 && <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun="invoices" />}
      </Card>
    </div>
  );
}
