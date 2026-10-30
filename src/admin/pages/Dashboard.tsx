import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AIcon from '../components/AIcon.tsx';
import { Avatar, Badge, Card, Empty, ErrorNote, Loading, StatCard, Trend, ViewAll } from '../components/ui.tsx';
import { BarChart, Donut } from '../charts/Charts.tsx';
import { api, isOneOf, type AppointmentView, type DashboardRange } from '../api/index.ts';
import { useAdminTitle, useApi } from '../hooks.ts';
import { useAuth } from '../auth.tsx';
import { PAYMENT_METHODS, addDays, fmtDate, fmtLongDate, fmtTime, money, today } from '../lib/format.ts';

const RANGES: { value: DashboardRange; label: string }[] = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_7', label: 'Last 7 Days' },
];
const RANGE_VALUES = RANGES.map((r) => r.value);

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="ad-clock">
      <span className="ad-clock-ico">
        <AIcon name="calendar" size={22} />
      </span>
      <span>
        <b>{fmtLongDate(now)}</b>
        <small>{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
      </span>
    </div>
  );
}

function RangeSelect({ value, onChange, label }: { value: DashboardRange; onChange: (range: DashboardRange) => void; label: string }) {
  return (
    <select
      className="ad-select ad-select--sm"
      value={value}
      onChange={(e) => isOneOf(RANGE_VALUES, e.target.value) && onChange(e.target.value)}
      aria-label={label}
    >
      {RANGES.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

export default function Dashboard() {
  useAdminTitle('Dashboard');
  const { admin } = useAuth();
  const [range, setRange] = useState<DashboardRange>('this_month');
  const { data: d, error, loading, reload } = useApi(() => api.dashboard({ range }), [range]);

  const tomorrow = addDays(today(), 1);
  const upcomingGroups = d
    ? d.upcoming.reduce<Record<string, AppointmentView[]>>((g, a) => {
        (g[a.date] ||= []).push(a);
        return g;
      }, {})
    : {};
  const methodItems = d ? PAYMENT_METHODS.map((m) => ({ label: m.label, value: d.paymentMethods[m.id] || 0 })).filter((m) => m.value > 0) : [];
  const methodTotal = methodItems.reduce((s, m) => s + m.value, 0);

  return (
    <div className="ad-page">
      <header className="ad-ph ad-ph--welcome">
        <div className="ad-ph-main">
          <div className="ad-ph-title">
            <h1>Welcome Back, {admin?.name || 'Admin'}</h1>
            <AIcon name="sparkle" size={26} className="ad-sparkle" />
          </div>
          <p className="ad-ph-sub">Here’s what’s happening at Eden Glow Studio today.</p>
        </div>
        <Clock />
      </header>

      <ErrorNote error={error} onRetry={reload} />

      <div className="ad-stats">
        <StatCard
          icon="calendar"
          label="Today’s Appointments"
          value={d ? d.todayAppointments.count : '—'}
          foot={d ? `${d.todayAppointments.completed} Completed • ${d.todayAppointments.upcoming} Upcoming` : ''}
          to="/admin/appointments"
        />
        <StatCard
          icon="rupee"
          tone="gold"
          label="Today’s Revenue"
          value={d ? money(d.todayRevenue.amount) : '—'}
          foot={d ? `Collected · ${d.todayRevenue.invoices} invoice${d.todayRevenue.invoices === 1 ? '' : 's'}` : ''}
          trend={d && <Trend value={d.todayRevenue.change} />}
          to="/admin/invoices"
        />
        <StatCard icon="users" label="Total Customers" value={d ? d.customers.total : '—'} foot={d ? `+${d.customers.newThisMonth} this month` : ''} to="/admin/customers" />
        <StatCard
          icon="chart"
          label="Monthly Revenue"
          value={d ? money(d.monthRevenue.amount) : '—'}
          foot="Billed"
          trend={d && <Trend value={d.monthRevenue.change} />}
          to="/admin/reports"
        />
      </div>

      <div className="ad-grid ad-grid--dash">
        <Card title="Revenue Overview" actions={<RangeSelect value={range} onChange={setRange} label="Revenue period" />} className="ad-span-rev">
          {loading && !d ? <Loading rows={4} /> : d && <BarChart data={d.revenue.map((r) => ({ label: r.label, a: r.value }))} series={[{ key: 'a', label: 'Billed' }]} ariaLabel="Daily billed revenue" />}
        </Card>
        <Card title="Payment Methods" actions={<RangeSelect value={range} onChange={setRange} label="Payment methods period" />}>
          {d && <Donut items={methodItems} centerValue={money(methodTotal)} centerLabel="Collected" />}
        </Card>
        <Card title="Quick Actions" className="ad-card--blush">
          <div className="ad-quick">
            <Link to="/admin/invoices/new" className="ad-quick-btn is-primary">
              <AIcon name="plus" size={20} /> Create Bill
            </Link>
            <Link to="/admin/appointments?new=1" className="ad-quick-btn">
              <AIcon name="calendarPlus" size={20} /> New Appointment
            </Link>
            <Link to="/admin/customers?new=1" className="ad-quick-btn">
              <AIcon name="user" size={20} /> New Customer
            </Link>
            <Link to="/admin/services" className="ad-quick-btn">
              <AIcon name="scissors" size={20} /> Manage Services
            </Link>
          </div>
        </Card>
      </div>

      <div className="ad-grid ad-grid--3">
        <Card title="Today’s Appointments" actions={<ViewAll to="/admin/appointments" />}>
          {d && !d.todaysAppointments.length && <Empty icon="calendar" title="No appointments today" />}
          <ul className="ad-list">
            {d?.todaysAppointments.slice(0, 6).map((a) => (
              <li key={a.id} className="ad-row">
                <span className="ad-row-time">{fmtTime(a.time)}</span>
                <Avatar name={a.customerName} />
                <span className="ad-row-main">
                  <b>{a.customerName}</b>
                  <small>{a.services.map((s) => s.name).join(', ')}</small>
                </span>
                <Badge status={a.status} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Recent Invoices" actions={<ViewAll to="/admin/invoices" />}>
          <ul className="ad-list">
            {d?.recentInvoices.slice(0, 5).map((i) => (
              <li key={i.id}>
                <Link to={`/admin/invoices/${i.id}`} className="ad-row ad-row--link">
                  <span className="ad-row-main">
                    <b>#{i.number}</b>
                    <small>{i.customerName}</small>
                  </span>
                  <span className="ad-row-amt">{money(i.total)}</span>
                  <Badge status={i.paymentStatus} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Upcoming Appointments" actions={<ViewAll to="/admin/appointments" />}>
          {d && !d.upcoming.length && <Empty icon="calendar" title="Nothing booked yet" text="New bookings will appear here." />}
          {Object.entries(upcomingGroups).map(([date, list]) => (
            <div key={date} className="ad-upc">
              <p className="ad-upc-day">
                {date === today() ? 'Today' : date === tomorrow ? 'Tomorrow' : ''}
                {date === today() || date === tomorrow ? ', ' : ''}
                {fmtDate(date)}
              </p>
              <ul className="ad-list">
                {list.map((a) => (
                  <li key={a.id} className="ad-row">
                    <span className="ad-row-time">{fmtTime(a.time)}</span>
                    <Avatar name={a.customerName} />
                    <span className="ad-row-main">
                      <b>{a.customerName}</b>
                      <small>{a.services.map((s) => s.name).join(', ')}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
