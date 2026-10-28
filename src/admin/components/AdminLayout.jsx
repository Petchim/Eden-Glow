import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import AIcon from './AIcon.jsx';
import AdminLogo, { Blossom } from './AdminLogo.jsx';
import { Avatar } from './ui.jsx';
import { useAuth } from '../auth.jsx';
import { api, USING_MOCK } from '../api/index.js';
import { useDebounced } from '../hooks.js';
import { fmtDate, fmtTime, money } from '../lib/format.js';

const NAV = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/admin/invoices', label: 'Billing / Invoices', icon: 'bill' },
  { to: '/admin/customers', label: 'Customers', icon: 'users' },
  { to: '/admin/appointments', label: 'Appointments', icon: 'calendar' },
  { to: '/admin/services', label: 'Services', icon: 'spa' },
  { to: '/admin/expenses', label: 'Expenses', icon: 'wallet' },
  { to: '/admin/reports', label: 'Reports', icon: 'chart' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
];

function useOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOut();
    const k = (e) => e.key === 'Escape' && onOut();
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [ref, onOut]);
}

function Sidebar({ open, onClose, onLogout }) {
  return (
    <>
      <div className={`ad-scrim ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`ad-side ${open ? 'is-open' : ''}`} aria-label="Admin navigation">
        <Link to="/admin/dashboard" className="ad-side-brand" aria-label="Eden Glow Studio admin home">
          <AdminLogo />
        </Link>
        <button type="button" className="ad-side-close ad-icon-btn" onClick={onClose} aria-label="Close menu">
          <AIcon name="close" size={20} />
        </button>
        <nav className="ad-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `ad-nav-link ${isActive ? 'is-active' : ''}`} onClick={onClose}>
              <AIcon name={n.icon} size={22} stroke={1.5} />
              <span>{n.label}</span>
            </NavLink>
          ))}
          <button type="button" className="ad-nav-link" onClick={onLogout}>
            <AIcon name="logout" size={22} stroke={1.5} />
            <span>Logout</span>
          </button>
        </nav>
        <div className="ad-side-foot" aria-hidden="true">
          <Blossom className="ad-side-blossom" />
          <span className="ad-side-words">
            Beauty
            <br />
            Care
            <br />
            Confidence
          </span>
        </div>
      </aside>
    </>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState(null);
  const dq = useDebounced(q, 220);
  const ref = useRef(null);
  const nav = useNavigate();
  useOutside(ref, () => setOpen(false));

  useEffect(() => {
    let live = true;
    if (dq.trim().length < 2) {
      setRes(null);
      return undefined;
    }
    api.search(dq).then((r) => live && setRes(r), () => live && setRes(null));
    return () => {
      live = false;
    };
  }, [dq]);

  const go = (to) => {
    setOpen(false);
    setQ('');
    nav(to);
  };
  const count = res ? res.customers.length + res.invoices.length + res.appointments.length : 0;

  return (
    <div className="ad-gsearch" ref={ref}>
      <label className="ad-search ad-search--top">
        <AIcon name="search" size={18} />
        <span className="visually-hidden">Search customers, appointments and invoices</span>
        <input
          type="search"
          value={q}
          placeholder="Search customers, appointments, invoices…"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </label>
      {open && res && (
        <div className="ad-pop ad-gsearch-pop" role="listbox" aria-label="Search results">
          {!count && <p className="ad-pop-empty">No matches for “{dq}”.</p>}
          {res.customers.length > 0 && <p className="ad-pop-h">Customers</p>}
          {res.customers.map((c) => (
            <button type="button" key={c.id} className="ad-pop-item" onClick={() => go(`/admin/customers?id=${c.id}`)}>
              <Avatar name={c.name} size={30} />
              <span>
                <b>{c.name}</b>
                <small>{c.phone}</small>
              </span>
            </button>
          ))}
          {res.invoices.length > 0 && <p className="ad-pop-h">Invoices</p>}
          {res.invoices.map((i) => (
            <button type="button" key={i.id} className="ad-pop-item" onClick={() => go(i.status === 'draft' ? `/admin/invoices/new?draft=${i.id}` : `/admin/invoices/${i.id}`)}>
              <AIcon name="bill" size={18} />
              <span>
                <b>{i.number || 'Draft bill'}</b>
                <small>
                  {i.customerName} · {money(i.total)}
                </small>
              </span>
            </button>
          ))}
          {res.appointments.length > 0 && <p className="ad-pop-h">Upcoming appointments</p>}
          {res.appointments.map((a) => (
            <button type="button" key={a.id} className="ad-pop-item" onClick={() => go(`/admin/appointments?date=${a.date}`)}>
              <AIcon name="calendar" size={18} />
              <span>
                <b>{a.customerName}</b>
                <small>
                  {fmtDate(a.date)}, {fmtTime(a.time)}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const ref = useRef(null);
  const loc = useLocation();
  useOutside(ref, () => setOpen(false));
  useEffect(() => {
    api.notifications().then(setItems, () => setItems([]));
  }, [loc.pathname]);
  return (
    <div className="ad-menu" ref={ref}>
      <button type="button" className="ad-round-btn" aria-label={`Notifications${items.length ? ` (${items.length})` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <AIcon name="bell" size={20} />
        {items.length > 0 && <span className="ad-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="ad-pop ad-pop--right">
          <p className="ad-pop-h">Notifications</p>
          {!items.length && <p className="ad-pop-empty">You’re all caught up.</p>}
          {items.map((n) => (
            <Link key={n.id} to={n.to} className="ad-pop-item" onClick={() => setOpen(false)}>
              <AIcon name={n.kind === 'appointments' ? 'calendar' : 'bill'} size={18} />
              <span>{n.text}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Profile({ onLogout }) {
  const { admin } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  return (
    <div className="ad-menu" ref={ref}>
      <button type="button" className="ad-profile" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Avatar name={admin?.name || 'Admin'} size={42} />
        <span className="ad-profile-text">
          <b>{admin?.name || 'Admin'}</b>
          <small>
            <i className="ad-online" /> Owner
          </small>
        </span>
        <AIcon name="chevron" size={16} />
      </button>
      {open && (
        <div className="ad-pop ad-pop--right">
          <p className="ad-pop-h">{admin?.email}</p>
          <Link to="/admin/settings" className="ad-pop-item" onClick={() => setOpen(false)}>
            <AIcon name="settings" size={18} />
            <span>Settings</span>
          </Link>
          <button type="button" className="ad-pop-item" onClick={onLogout}>
            <AIcon name="logout" size={18} />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminLayout() {
  const [drawer, setDrawer] = useState(false);
  const { logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const main = useRef(null);

  useEffect(() => {
    setDrawer(false);
    main.current?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  const onLogout = async () => {
    await logout();
    nav('/admin/login', { replace: true });
  };

  return (
    <div className={`ad-shell ${drawer ? 'drawer-open' : ''}`}>
      <a className="skip-link" href="#ad-main">
        Skip to content
      </a>
      <Sidebar open={drawer} onClose={() => setDrawer(false)} onLogout={onLogout} />
      <div className="ad-body">
        <header className="ad-top">
          <button type="button" className="ad-round-btn ad-burger" aria-label="Open menu" onClick={() => setDrawer(true)}>
            <AIcon name="menu" size={20} />
          </button>
          <GlobalSearch />
          <div className="ad-top-right">
            {USING_MOCK && (
              <span className="ad-demo" title="The admin is running on sample data in this browser. Nothing is saved to a server yet.">
                Demo data
              </span>
            )}
            <Notifications />
            <Profile onLogout={onLogout} />
          </div>
        </header>
        <main id="ad-main" className="ad-main" ref={main} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
