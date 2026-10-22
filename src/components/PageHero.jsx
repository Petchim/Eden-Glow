import { Link } from 'react-router-dom';
import Img from './ui/Img.jsx';
import Leaf from './ui/Leaf.jsx';
import { Accent } from './ui/SectionTitle.jsx';

/**
 * Hero for inner pages. Variants keep each page distinct:
 *  'arch'   — copy left, tall arched photo right
 *  'split'  — photo left (full height), copy right
 *  'full'   — full-bleed photo with a dark veil, copy bottom-left
 *  'framed' — centred title, wide framed photo beneath
 */
export default function PageHero({ variant = 'arch', eyebrow, title, text, image, crumb, children }) {
  return (
    <section className={`phero phero--${variant}`} aria-labelledby="page-title">
      {variant === 'full' && (
        <div className="phero-bg">
          <Img {...image} priority sizes="100vw" />
        </div>
      )}
      <div className="wrap phero-grid">
        <div className="phero-copy">
          <nav className="crumbs" aria-label="Breadcrumb">
            <ol>
              <li><Link to="/">Home</Link></li>
              <li aria-current="page">{crumb}</li>
            </ol>
          </nav>
          {eyebrow && <p className="eyebrow phero-eyebrow">{eyebrow}</p>}
          <h1 className="phero-title" id="page-title">
            {title.map((l, i) => (
              <span className="ln" key={i}><span><Accent text={l} /></span></span>
            ))}
          </h1>
          {text && <p className="phero-text">{text}</p>}
          {children && <div className="ctas phero-ctas">{children}</div>}
        </div>
        {variant !== 'full' && (
          <div className="phero-art">
            <div className="phero-img">
              <Img {...image} priority sizes={variant === 'framed' ? '100vw' : '(max-width: 900px) 92vw, 50vw'} />
            </div>
            {variant === 'arch' && <span className="phero-outline" aria-hidden="true" />}
            {variant !== 'split' && <Leaf className="phero-leaf" stroke={0.8} />}
          </div>
        )}
      </div>
    </section>
  );
}
