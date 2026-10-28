import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import AIcon from './AIcon.jsx';
import { APPT_STATUS_LABEL, PAYMENT_STATUS_LABEL, initials } from '../lib/format.js';

export function PageHeader({ crumbs = [], title, sub, actions, badge }) {
  return (
    <header className="ad-ph">
      <div className="ad-ph-main">
        {crumbs.length > 0 && (
          <nav className="ad-crumbs" aria-label="Breadcrumb">
            <Link to="/admin/dashboard" aria-label="Dashboard">
              <AIcon name="home" size={15} />
            </Link>
            {crumbs.map((c, i) => (
              <span key={c.label}>
                <span className="ad-crumb-sep" aria-hidden="true">{i === 0 ? '›' : '/'}</span>
                {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <div className="ad-ph-title">
          <h1>{title}</h1>
          {badge}
        </div>
        {sub && <p className="ad-ph-sub">{sub}</p>}
      </div>
      {actions && <div className="ad-ph-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, icon, actions, children, className = '', pad = true, as: Tag = 'section' }) {
  return (
    <Tag className={`ad-card ${pad ? '' : 'ad-card--flush'} ${className}`}>
      {(title || actions) && (
        <div className="ad-card-head">
          {title && (
            <h2 className="ad-card-title">
              {icon && (
                <span className="ad-card-ico">
                  <AIcon name={icon} size={18} />
                </span>
              )}
              {title}
            </h2>
          )}
          {actions && <div className="ad-card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

export function ViewAll({ to, children = 'View All' }) {
  return (
    <Link className="ad-viewall" to={to}>
      {children} <AIcon name="arrow" size={14} />
    </Link>
  );
}

export function Trend({ value, invert = false }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const up = value >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`ad-trend ${good ? 'is-good' : 'is-bad'}`}>
      <AIcon name={up ? 'arrowUp' : 'arrowDown'} size={12} stroke={2} />
      {up ? '+' : ''}
      {Math.round(value)}%
    </span>
  );
}

export function StatCard({ icon, label, value, foot, trend, to, tone = 'rose', side }) {
  const body = (
    <>
      <span className={`ad-stat-ico ad-tone-${tone}`}>
        <AIcon name={icon} size={24} />
      </span>
      <span className="ad-stat-body">
        <span className="ad-stat-label">{label}</span>
        <span className="ad-stat-value">{value}</span>
        {(foot || trend) && (
          <span className="ad-stat-foot">
            {foot && <span>{foot}</span>}
            {trend}
          </span>
        )}
      </span>
      {side}
      {to && (
        <span className="ad-stat-go" aria-hidden="true">
          <AIcon name="chevronRight" size={14} stroke={2} />
        </span>
      )}
    </>
  );
  return to ? (
    <Link className="ad-stat" to={to} aria-label={`${label}: ${value}`}>
      {body}
    </Link>
  ) : (
    <div className="ad-stat">{body}</div>
  );
}

const BADGE_TONE = {
  paid: 'green',
  completed: 'green',
  active: 'green',
  Payment: 'green',
  partial: 'amber',
  in_progress: 'blue',
  upcoming: 'rose',
  unpaid: 'red',
  inactive: 'red',
  cancelled: 'grey',
  no_show: 'grey',
  draft: 'grey',
  Expense: 'red',
};
export function Badge({ status, children }) {
  const label = children || PAYMENT_STATUS_LABEL[status] || APPT_STATUS_LABEL[status] || status;
  return <span className={`ad-badge ad-badge--${BADGE_TONE[status] || 'grey'}`}>{label}</span>;
}

export function Avatar({ name, size = 40 }) {
  // Initials instead of photos: the admin never shows invented portraits of customers.
  const hue = [...(name || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 5, 0);
  return (
    <span className={`ad-avatar ad-avatar--${hue}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Modal({ open, title, onClose, children, footer, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => ref.current?.querySelector('input, select, textarea, button')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="ad-modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`ad-modal ${wide ? 'ad-modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div className="ad-modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="ad-icon-btn" onClick={onClose} aria-label="Close">
            <AIcon name="close" size={18} />
          </button>
        </div>
        <div className="ad-modal-body">{children}</div>
        {footer && <div className="ad-modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({ open, title, text, confirmLabel = 'Confirm', danger, onConfirm, onClose, busy }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ad-btn ad-btn--ghost" onClick={onClose}>
            Keep it
          </button>
          <button type="button" className={`ad-btn ${danger ? 'ad-btn--danger' : 'ad-btn--primary'}`} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="ad-muted">{text}</p>
    </Modal>
  );
}

export function Field({ label, error, hint, children, required, className = '' }) {
  const id = useId();
  const child = typeof children === 'function' ? children({ id, 'aria-invalid': !!error, 'aria-describedby': error || hint ? `${id}-d` : undefined }) : children;
  return (
    <div className={`ad-field ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={id}>
          {label}
          {required && <span className="ad-req"> *</span>}
        </label>
      )}
      {child}
      {(error || hint) && (
        <span id={`${id}-d`} className={error ? 'ad-field-error' : 'ad-field-hint'}>
          {error || hint}
        </span>
      )}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, label = 'Search', className = '' }) {
  return (
    <label className={`ad-search ${className}`}>
      <AIcon name="search" size={18} />
      <span className="visually-hidden">{label}</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Pagination({ page, pageSize, total, onPage, noun = 'items' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);
  const list = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) list.push(p);
    else if (list[list.length - 1] !== '…') list.push('…');
  }
  return (
    <div className="ad-pager">
      <span className="ad-muted">
        Showing {from} to {to} of {total} {noun}
      </span>
      {pages > 1 && (
        <nav className="ad-pager-nav" aria-label="Pages">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <AIcon name="chevronLeft" size={16} />
          </button>
          {list.map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="ad-pager-gap">…</span>
            ) : (
              <button type="button" key={p} onClick={() => onPage(p)} className={p === page ? 'is-active' : ''} aria-current={p === page ? 'page' : undefined}>
                {p}
              </button>
            ),
          )}
          <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
            <AIcon name="chevronRight" size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}

export function Empty({ icon = 'spa', title, text, action }) {
  return (
    <div className="ad-empty">
      <AIcon name={icon} size={28} />
      <strong>{title}</strong>
      {text && <span>{text}</span>}
      {action}
    </div>
  );
}

export function Loading({ rows = 3 }) {
  return (
    <div className="ad-skel" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="ad-alert ad-alert--error" role="alert">
      <AIcon name="info" size={18} />
      <span>{error.message || 'Something went wrong.'}</span>
      {onRetry && (
        <button type="button" className="ad-link" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Segmented({ options, value, onChange, label, className = '' }) {
  return (
    <div className={`ad-seg ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button type="button" role="radio" aria-checked={value === o.value} key={o.value} className={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {o.icon && <AIcon name={o.icon} size={16} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}
