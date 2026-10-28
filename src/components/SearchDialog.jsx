import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SERVICES } from '../data/content.js';
import { searchSite } from '../data/searchIndex.js';
import { useBodyLock } from '../hooks/useUi.js';
import Icon from './ui/Icon.jsx';

const SUGGESTED = SERVICES.map((s) => ({ title: s.title, to: s.to, type: 'Service', text: s.kicker }));

/* Site search: type to filter pages, services and treatments; arrow keys + Enter to open a result. */
export default function SearchDialog({ onClose }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const navigate = useNavigate();
  const listId = useId();
  useBodyLock(true);

  const results = useMemo(() => (query.trim() ? searchSite(query) : SUGGESTED), [query]);
  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    const opener = document.activeElement;
    inputRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
    else if (e.key === 'Enter' && e.target === inputRef.current && results[active]) { e.preventDefault(); navigate(results[active].to); onClose(); }
    else if (e.key === 'Tab') {
      // keep focus inside the dialog
      const f = dialogRef.current.querySelectorAll('input, button, a[href]');
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  return (
    <div className="srch" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="srch-panel" role="dialog" aria-modal="true" aria-label="Search the site" ref={dialogRef} onKeyDown={onKeyDown}>
        <div className="srch-bar">
          <Icon name="search" size={22} stroke={1.2} />
          <input
            ref={inputRef}
            type="search"
            className="srch-input"
            placeholder="Search services, treatments, pages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            aria-label="Search"
          />
          <button type="button" className="srch-close" aria-label="Close search" onClick={onClose}>
            <Icon name="close" size={18} stroke={1.3} />
          </button>
        </div>

        <p className="srch-label" aria-live="polite">
          {query.trim() ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Our services'}
        </p>
        {results.length > 0 ? (
          <ul className="srch-list" id={listId} role="listbox" aria-label="Search results">
            {results.map((r, i) => (
              <li key={`${r.to}-${r.title}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <Link
                  to={r.to}
                  className={`srch-item ${i === active ? 'is-active' : ''}`}
                  onClick={onClose}
                  onMouseEnter={() => setActive(i)}
                  tabIndex={-1}
                >
                  <span className="srch-type">{r.type}</span>
                  <span className="srch-title">{r.title}</span>
                  {r.text && <span className="srch-text">{r.text}</span>}
                  <Icon name="arrow" size={16} className="srch-go" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="srch-empty">Nothing matches “{query.trim()}”. Try a service such as hair, facial or nails.</p>
        )}
      </div>
    </div>
  );
}
