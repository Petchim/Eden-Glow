import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NAV, BOOK_PATH } from '../data/content.js';
import { BUSINESS } from '../config/business.js';
import { useBodyLock, useScrolled } from '../hooks/useUi.js';
import Brand from './Brand.jsx';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';

const DESKTOP = 1180; // matches the breakpoint in sections.css

export default function Header() {
  const scrolled = useScrolled(24);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef(null);
  const closeRef = useRef(null);
  useBodyLock(open);

  // Close the menu whenever the route changes.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth >= DESKTOP) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const close = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  };

  return (
    <>
      <header className={`site-header ${scrolled || open ? 'is-solid' : ''}`}>
        <div className="wrap header-top">
          <p className="header-tag">{BUSINESS.tagline}</p>
          <Brand />
          <div className="header-actions">
            <Button to={BOOK_PATH} size="sm" className="header-cta">
              Book<span className="header-cta-long">&nbsp;Appointment</span>
            </Button>
            <button
              ref={toggleRef}
              type="button"
              className="burger"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" size={22} stroke={1.2} />
            </button>
          </div>
        </div>
        <nav className="header-nav" aria-label="Main">
          <ul className="wrap">
            {NAV.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.to === '/'} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div
        id="mobile-menu"
        className={`mmenu ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        aria-hidden={!open}
        {...(!open ? { inert: '' } : {})}
      >
        <div className="wrap mmenu-top">
          <Brand compact onClick={() => close()} />
          <button ref={closeRef} type="button" className="burger burger--close" aria-label="Close menu" onClick={() => close(true)}>
            <Icon name="close" size={20} stroke={1.2} />
          </button>
        </div>
        <nav className="wrap mmenu-nav" aria-label="Mobile">
          <ul>
            {NAV.map((l, i) => (
              <li key={l.to} style={{ '--i': i }}>
                <NavLink to={l.to} end={l.to === '/'} onClick={() => close()} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
                  <span>{l.label}</span>
                  <i>{String(i + 1).padStart(2, '0')}</i>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="wrap mmenu-foot">
          <Button to={BOOK_PATH} arrow onClick={() => close()}>Book Appointment</Button>
          <p className="fine">{BUSINESS.tagline}</p>
        </div>
      </div>
    </>
  );
}
