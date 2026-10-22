import { Link } from 'react-router-dom';
import Leaf from './ui/Leaf.jsx';

/* Text logo matching the shop banner: gold wordmark + service subtitle. */
export default function Brand({ compact = false, onClick }) {
  return (
    <Link className={`brand ${compact ? 'brand--compact' : ''}`} to="/" onClick={onClick} aria-label="Eden Glow Studio — home">
      <Leaf className="brand-leaf" stroke={1.4} />
      <span className="brand-text">
        <span className="brand-name">EDEN GLOW STUDIO</span>
        {!compact && <span className="brand-sub">Hair | Skin | Nails | Lashes | Makeup | Academy</span>}
      </span>
    </Link>
  );
}
