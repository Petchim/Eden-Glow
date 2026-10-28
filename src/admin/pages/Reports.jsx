import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AIcon from '../components/AIcon.jsx';
import { Badge, Card, Empty, ErrorNote, Loading, PageHeader, StatCard, Trend, ViewAll } from '../components/ui.jsx';
import { BarChart, Donut, SERIES, topN } from '../charts/Charts.jsx';
import { api } from '../api/index.js';
import { useAdminTitle, useApi } from '../hooks.js';
import { PAYMENT_METHODS, addDays, fmtDate, money, num, parseDate, toISODate, today } from '../lib/format.js';

const PRESETS = {
  this_month: () => [`${today().slice(0, 8)}01`, today()],
  last_month: () => {
    const d = parseDate(today());
    return [toISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1)), toISODate(new Date(d.getFullYear(), d.getMonth(), 0))];
  },
  last_30: () => [addDays(today(), -29), today()],
  last_90: () => [addDays(today(), -89), today()],
};

function csv(rows) {
  return rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}
function download(name, text) {
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Reports() {
  useAdminTitle('Reports');
  const [preset, setPreset] = useState('this_month');
  const [[from, to], setRange] = useState(PRESETS.this_month());
  const [group, setGroup] = useState('daily');
  const [compare, setCompare] = useState('previous');
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const { data: r, error, loading, reload } = useApi(() => api.report({ from, to, group, compare }), [from, to, group, compare]);

  useEffect(() => {
    const h = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pickPreset = (p) => {
    setPreset(p);
    if (PRESETS[p]) setRange(PRESETS[p]());
  };
  const setFrom = (v) => v && (setPreset('custom'), setRange([v, v > to ? v : to]));
  const setTo = (v) => v && (setPreset('custom'), setRange([v < from ? v : from, v]));

  const exportSummary = () => {
    const rows = [['Eden Glow Studio report', `${from} to ${to}`], [], ['Metric', 'Amount (INR)', 'Previous period', 'Change %']];
    const labels = { billed: 'Total billed revenue', collected: 'Collected amount', pending: 'Pending amount', discounts: 'Total discounts', expenses: 'Total expenses' };
    for (const [k, v] of Object.entries(r.summary)) rows.push([labels[k], v.value, v.previous ?? '', v.change === null ? '' : Math.round(v.change)]);
    rows.push([], ['Period', 'Billed', 'Collected'], ...r.trend.map((t) => [t.key, t.billed, t.collected]));
    rows.push([], ['Service', 'Bookings', 'Revenue'], ...r.services.map((s) => [s.name, s.bookings, s.revenue]));
    rows.push([], ['Payment method', 'Collected'], ...Object.entries(r.paymentMethods).map(([m, v]) => [m, v]));
    rows.push([], ['Expense category', 'Amount'], ...Object.entries(r.expensesByCategory).map(([c, v]) => [c, v]));
    download(`eden-glow-report-${from}-to-${to}.csv`, csv(rows));
    setMenu(false);
  };
  const exportInvoices = () => {
    const rows = [['Invoice', 'Date', 'Customer', 'Subtotal', 'Discount', 'Tax', 'Total', 'Paid', 'Balance', 'Status']];
    for (const i of r.invoices) rows.push([i.number, i.date, i.customerName, i.subtotal, i.discount, i.tax, i.total, i.paid, i.balance, i.paymentStatus]);
    download(`eden-glow-invoices-${from}-to-${to}.csv`, csv(rows));
    setMenu(false);
  };
  const exportTransactions = () => {
    const rows = [['Date', 'Type', 'Description', 'Amount (INR)'], ...r.transactions.map((t) => [t.date, t.type, t.description, t.amount])];
    download(`eden-glow-transactions-${from}-to-${to}.csv`, csv(rows));
    setMenu(false);
  };

  const s = r?.summary;
  const vs = compare === 'none' ? '' : 'vs. previous period';
  const svcItems = r ? topN(r.services.map((x) => ({ label: x.name, value: x.revenue })), 5) : [];
  const methodItems = r ? PAYMENT_METHODS.map((m) => ({ label: m.label, value: r.paymentMethods[m.id] || 0 })).filter((m) => m.value) : [];
  const expItems = r ? Object.entries(r.expensesByCategory).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value) : [];
  const svcTotal = r ? r.services.reduce((t, x) => t + x.revenue, 0) : 0;

  return (
    <div className="ad-page">
      <PageHeader
        crumbs={[{ label: 'Reports' }]}
        title="Reports & Revenue"
        sub="View your business performance, revenue, payments and expenses."
        actions={
          <div className="ad-report-filters">
            <label className="ad-field">
              <span className="ad-label">Period</span>
              <select className="ad-select" value={preset} onChange={(e) => pickPreset(e.target.value)}>
                <option value="this_month">This month</option>
                <option value="last_month">Last month</option>
                <option value="last_30">Last 30 days</option>
                <option value="last_90">Last 90 days</option>
                <option value="custom">Custom range</option>
              </select>
            </label>
            <div className="ad-field">
              <span className="ad-label">Date Range</span>
              <span className="ad-daterange">
                <input className="ad-input" type="date" value={from} max={today()} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
                <span aria-hidden="true">–</span>
                <input className="ad-input" type="date" value={to} max={today()} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
              </span>
            </div>
            <label className="ad-field">
              <span className="ad-label">Compare With</span>
              <select className="ad-select" value={compare} onChange={(e) => setCompare(e.target.value)}>
                <option value="previous">Previous Period</option>
                <option value="none">No comparison</option>
              </select>
            </label>
            <div className="ad-menu" ref={menuRef}>
              <button type="button" className="ad-btn ad-btn--primary ad-btn--lg" onClick={() => setMenu((m) => !m)} disabled={!r} aria-expanded={menu}>
                <AIcon name="download" size={18} /> Export Report <AIcon name="chevron" size={16} />
              </button>
              {menu && r && (
                <div className="ad-pop ad-pop--right">
                  <button type="button" className="ad-pop-item" onClick={exportSummary}>
                    <AIcon name="chart" size={18} />
                    <span>Summary (CSV)</span>
                  </button>
                  <button type="button" className="ad-pop-item" onClick={exportInvoices}>
                    <AIcon name="bill" size={18} />
                    <span>Invoices (CSV)</span>
                  </button>
                  <button type="button" className="ad-pop-item" onClick={exportTransactions}>
                    <AIcon name="wallet" size={18} />
                    <span>Transactions (CSV)</span>
                  </button>
                  <button type="button" className="ad-pop-item" onClick={() => (setMenu(false), window.print())}>
                    <AIcon name="printer" size={18} />
                    <span>Print this page</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      <ErrorNote error={error} onRetry={reload} />

      <div className="ad-stats ad-stats--5">
        <StatCard icon="chart" label="Total Revenue (Billed)" value={s ? money(s.billed.value) : '—'} trend={s && <Trend value={s.billed.change} />} foot={vs} />
        <StatCard icon="wallet" label="Collected Amount" value={s ? money(s.collected.value) : '—'} trend={s && <Trend value={s.collected.change} />} foot={vs} />
        <StatCard icon="hourglass" tone="gold" label="Pending Amount" value={s ? money(s.pending.value) : '—'} trend={s && <Trend value={s.pending.change} invert />} foot={vs} />
        <StatCard icon="percent" label="Total Discounts" value={s ? money(s.discounts.value) : '—'} trend={s && <Trend value={s.discounts.change} invert />} foot={vs} />
        <StatCard icon="card" label="Total Expenses" value={s ? money(s.expenses.value) : '—'} trend={s && <Trend value={s.expenses.change} invert />} foot={vs} />
      </div>

      <div className="ad-grid ad-grid--dash">
        <Card
          title="Revenue Trend"
          className="ad-span-rev"
          actions={
            <>
              <span className="ad-chart-legend">
                <span>
                  <i style={{ background: SERIES[2] }} />
                  Billed Revenue
                </span>
                <span>
                  <i style={{ background: SERIES[0] }} />
                  Collected Amount
                </span>
              </span>
              <select className="ad-select ad-select--sm" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group by">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </>
          }
        >
          {loading && !r ? (
            <Loading rows={5} />
          ) : (
            r && (
              <BarChart
                data={r.trend}
                series={[
                  { key: 'billed', label: 'Billed', color: SERIES[2] },
                  { key: 'collected', label: 'Collected', color: SERIES[0] },
                ]}
                line
                ariaLabel="Billed and collected revenue over time"
              />
            )
          )}
        </Card>
        <Card title="Revenue by Service">{r && <Donut items={svcItems} centerValue={money(svcTotal)} centerLabel="Total" size={160} thickness={28} />}</Card>
        <Card title="Payment Methods">
          {r && <Donut items={methodItems} centerValue={money(s.collected.value)} centerLabel="Collected" size={160} thickness={28} />}
        </Card>
      </div>

      <div className="ad-grid ad-grid--3">
        <Card title="Top Services (by Revenue)" actions={<ViewAll to="/admin/services" />}>
          {r && !r.services.length ? (
            <Empty title="No billed services in this period" />
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table ad-table--tight">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Service</th>
                    <th className="num">Bookings</th>
                    <th className="num">Revenue (₹)</th>
                    <th className="num">%</th>
                  </tr>
                </thead>
                <tbody>
                  {r?.services.slice(0, 6).map((x, i) => (
                    <tr key={x.name}>
                      <td>{i + 1}</td>
                      <td>{x.name}</td>
                      <td className="num">{x.bookings}</td>
                      <td className="num">{num(x.revenue)}</td>
                      <td className="num">{svcTotal ? Math.round((x.revenue / svcTotal) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card
          title="Monthly Comparison"
          actions={
            <span className="ad-chart-legend">
              <span>
                <i style={{ background: SERIES[2] }} />
                Billed
              </span>
              <span>
                <i style={{ background: SERIES[0] }} />
                Collected
              </span>
            </span>
          }
        >
          {r && (
            <BarChart
              data={r.months}
              series={[
                { key: 'billed', label: 'Billed', color: SERIES[2] },
                { key: 'collected', label: 'Collected', color: SERIES[0] },
              ]}
              height={210}
              ariaLabel="Billed and collected revenue for the last three months"
            />
          )}
        </Card>
        <Card title="Expenses by Category" actions={<ViewAll to="/admin/expenses" />}>
          {r && <Donut items={expItems} centerValue={money(s.expenses.value)} centerLabel="Total" size={160} thickness={28} />}
        </Card>
      </div>

      <div className="ad-grid ad-grid--2">
        <Card title="Recent Invoices" actions={<ViewAll to="/admin/invoices" />}>
          <div className="ad-table-wrap">
            <table className="ad-table ad-table--tight">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th className="num">Amount (₹)</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {r?.recentInvoices.slice(0, 6).map((i) => (
                  <tr key={i.id}>
                    <td className="ad-nowrap">
                      <Link to={`/admin/invoices/${i.id}`} className="ad-strong-link">
                        {i.number}
                      </Link>
                    </td>
                    <td>{i.customerName}</td>
                    <td className="ad-nowrap">{fmtDate(i.date)}</td>
                    <td className="num">{num(i.total)}</td>
                    <td>
                      <Badge status={i.paymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Transactions Summary">
          <div className="ad-table-wrap">
            <table className="ad-table ad-table--tight">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th className="num">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {r?.transactions.slice(0, 6).map((t, i) => (
                  <tr key={i}>
                    <td className="ad-nowrap">{fmtDate(t.date)}</td>
                    <td>
                      <Badge status={t.type}>{t.type}</Badge>
                    </td>
                    <td>{t.description}</td>
                    <td className={`num ${t.amount < 0 ? 'ad-amt-neg' : 'ad-amt-pos'}`}>
                      {t.amount < 0 ? '-' : '+'}
                      {num(Math.abs(t.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
