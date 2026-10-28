import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HOME_GALLERY } from '../../data/images.js';
import Img from '../ui/Img.jsx';
import Reveal from '../ui/Reveal.jsx';
import SectionTitle from '../ui/SectionTitle.jsx';
import Icon from '../ui/Icon.jsx';
import Lightbox from '../Lightbox.jsx';

/* Campaign gallery: seven frames interlocking in one edge-to-edge composition; opens the shared lightbox. */
export default function Gallery() {
  const [active, setActive] = useState(-1);

  return (
    <section className="section hgal" aria-labelledby="gallery-title">
      <div className="wrap">
        <div className="hgal-head">
          <SectionTitle eyebrow="Beauty gallery" lines={['Moments of *Beauty.*']} id="gallery-title" />
          <Reveal className="hgal-aside" delay={150}>
            <p className="fine">Images shown are temporary stock photography, used for illustration — not Eden Glow Studio clients or results.</p>
            <Link className="tlink" to="/gallery"><span>View Gallery</span><Icon name="arrow" /></Link>
          </Reveal>
        </div>

        <ul className="hgal-grid">
          {HOME_GALLERY.map((g, i) => (
            <Reveal as="li" key={g.src} variant="curtain" className={`hgal-cell hgal-cell--${i + 1}`} delay={(i % 4) * 110 + Math.floor(i / 4) * 60}>
              <button
                type="button"
                className="hgal-tile"
                onClick={() => setActive(i)}
                aria-label={`Open image ${i + 1}: ${g.cat} — ${g.caption}`}
              >
                <Img src={g.src} alt={`${g.cat}: ${g.caption}`} position={g.position} sizes="(max-width: 700px) 50vw, 30vw" />
                <span className="hgal-cap" aria-hidden="true"><b>{g.cat}</b>{g.caption}</span>
              </button>
            </Reveal>
          ))}
        </ul>
      </div>
      {active >= 0 && <Lightbox items={HOME_GALLERY} index={active} onChange={setActive} onClose={() => setActive(-1)} />}
    </section>
  );
}
