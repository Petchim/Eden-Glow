import { useRef } from 'react';
import { HOME_IMAGES } from '../../data/images.js';
import { BOOK_PATH, HERO_FEATURES } from '../../data/content.js';
import { BUSINESS } from '../../config/business.js';
import { useParallax } from '../../hooks/useUi.js';
import Img from '../ui/Img.jsx';
import Button from '../ui/Button.jsx';
import Icon from '../ui/Icon.jsx';
import Floral from '../ui/Floral.jsx';

/* Editorial hero: copy on ivory to the left, a full-height portrait bleeding off the right edge. */
export default function Hero() {
  const media = useRef(null);
  useParallax(media, 0.06);
  const { artInImage, ...image } = HOME_IMAGES.hero;

  return (
    <section className={`hero ${artInImage ? 'hero--art-in-image' : ''}`} aria-labelledby="hero-title">
      <div className="hero-stage">
        <div className="hero-media">
          <div className="hero-media-in" ref={media}>
            <Img {...image} priority sizes="(max-width: 900px) 100vw, 62vw" />
          </div>
          <span className="hero-frame" aria-hidden="true" />
          {!artInImage && (
            <>
              <Floral className="hero-floral" />
              <p className="hero-script" aria-hidden="true">
                <span>Beauty</span>
                <span>is a feeling.</span>
              </p>
            </>
          )}
        </div>

        <div className="wrap hero-inner">
          <div className="hero-copy">
            <p className="hero-eyebrow">{BUSINESS.tagline}</p>
            <h1 className="h1" id="hero-title">
              <span className="ln"><span>Your Beauty.</span></span>
              <span className="ln"><span>Your Ritual.</span></span>
              <span className="ln"><span><em>Your Glow.</em></span></span>
            </h1>
            <p className="hero-text">
              A premium beauty studio for hair, skin, nails, lashes and makeup. Experience personalised care in a calm and elegant space.
            </p>
            <div className="ctas hero-ctas">
              <Button to={BOOK_PATH} arrow>Book Appointment</Button>
              <Button href="#services" variant="line">Explore Services</Button>
            </div>
            <ul className="hero-features">
              {HERO_FEATURES.map((f) => (
                <li key={f.label}>
                  <Icon name={f.icon} size={22} stroke={1.1} />
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
