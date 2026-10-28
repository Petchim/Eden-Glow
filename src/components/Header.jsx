import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { NAV, MAIN_NAV, BOOK_PATH } from '../data/content.js';
import { BUSINESS } from '../config/business.js';
import { useBodyLock, useScrolled } from '../hooks/useUi.js';
import Brand from './Brand.jsx';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';
import Floral from './ui/Floral.jsx';

// Loaded on first use, so the search index stays out of the initial bundle.
const SearchDialog = lazy(() => import('./SearchDialog.jsx'));

const SERVICES = MAIN_NAV.find((l) => l.children);

/** "Services" with a dropdown of the service pages; opens on hover, click or keyboard. */
function ServicesMenu({ pathname, onIndicate }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const active = SERVICES.children.some((l) => pathname.startsWith(l.to));

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <li
      ref={wrapRef}
      className={`nav-drop ${open ? 'is-open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(e) => {
        if (!wrapRef.current.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={btnRef}
        type="button"
        className={`nav-link ${active ? 'is-active' : ''}`}
        aria-expanded={open}
        aria-controls="nav-services"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={(e) => onIndicate(e.currentTarget)}
        onFocus={(e) => onIndicate(e.currentTarget)}
      >
        {SERVICES.label}
        <Icon name="chevron" size={12} stroke={1.4} className="nav-chev" />
      </button>
      <ul className="nav-menu" id="nav-services">
        {SERVICES.children.map((l) => (
          <li key={l.to}>
            <NavLink to={l.to} className={({ isActive }) => (isActive ? 'is-active' : undefined)} tabIndex={open ? 0 : -1}>
              <span>{l.label}</span>
              <Icon name="arrow" size={14} />
            </NavLink>
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function Header() {
  const scrolled = useScrolled(24);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [indicator, setIndicator] = useState(null);
  const toggleRef = useRef(null);
  const closeRef = useRef(null);
  const listRef = useRef(null);
  useBodyLock(open);

  // The fine underline glides to whichever item is hovered, and settles back on the active page.
  const indicate = useCallback((el) => {
    const list = listRef.current;
    if (!el || !list) {
      setIndicator(null);
      return;
    }
    const a = el.getBoundingClientRect();
    const b = list.getBoundingClientRect();
    setIndicator({ x: a.left - b.left, w: a.width });
  }, []);
  const settle = useCallback(() => {
    indicate(listRef.current?.querySelector(':scope > li > .nav-link.is-active'));
  }, [indicate]);

  useLayoutEffect(() => {
    settle();
    window.addEventListener('resize', settle);
    document.fonts?.ready.then(settle);
    return () => window.removeEventListener('resize', settle);
  }, [pathname, settle]);

  // Close the menu and search whenever the route changes.
  useEffect(() => {
    setOpen(false);
    setSearching(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = (returnFocus = false) => {
    setOpen(false);
    if (returnFocus) toggleRef.current?.focus();
  };

  const linkClass = ({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`;

  return (
    <>
      <header className={`site-header ${scrolled || open ? 'is-solid' : ''}`}>
        <div className="header-deco" aria-hidden="true">
          <Floral className="header-floral header-floral--l" />
          <Floral className="header-floral header-floral--r" flip />
        </div>
        <div className="wrap header-row">
          <Brand />
          <nav className="header-nav" aria-label="Main">
            <ul ref={listRef} onMouseLeave={settle}>
              {MAIN_NAV.map((l) =>
                l.children ? (
                  <ServicesMenu key={l.label} pathname={pathname} onIndicate={indicate} />
                ) : (
                  <li key={l.to}>
                    <NavLink
                      to={l.to}
                      end={l.to === '/'}
                      className={linkClass}
                      onMouseEnter={(e) => indicate(e.currentTarget)}
                      onFocus={(e) => indicate(e.currentTarget)}
                      onBlur={settle}
                    >
                      {l.label}
                    </NavLink>
                  </li>
                ),
              )}
              <li
                className="nav-ind"
                aria-hidden="true"
                style={indicator ? { '--x': `${indicator.x}px`, '--w': `${indicator.w}px` } : { opacity: 0 }}
              />
            </ul>
          </nav>
          <span className="header-divider" aria-hidden="true" />
          <div className="header-actions">
            <Button to={BOOK_PATH} arrow className="header-cta">Book Appointment</Button>
            <button type="button" className="icon-btn" aria-label="Search the site" aria-haspopup="dialog" onClick={() => setSearching(true)}>
              <Icon name="search" size={21} stroke={1.4} />
            </button>
            <button
              ref={toggleRef}
              type="button"
              className="burger"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen(true)}
            >
              <Icon name="menu3" size={26} stroke={1.2} />
            </button>
          </div>
        </div>
      </header>

      {searching && (
        <Suspense fallback={null}>
          <SearchDialog onClose={() => setSearching(false)} />
        </Suspense>
      )}

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
          <Brand onClick={() => close()} />
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
