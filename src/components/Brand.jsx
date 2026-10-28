import { Link } from 'react-router-dom';

/* Text logo: serif wordmark + fine service subtitle. */
export default function Brand({ compact = false, onClick }) {
  return (
    <Link className={`brand ${compact ? 'brand--compact' : ''}`} to="/" onClick={onClick} aria-label="Eden Glow Studio — home">
      <span className="brand-name">EDEN GLOW <span className="brand-accent">STUDIO</span></span>
      {!compact && <span className="brand-sub" aria-hidden="true">Hair · Skin · Nails · Lashes · Makeup</span>}
    </Link>
  );
}
