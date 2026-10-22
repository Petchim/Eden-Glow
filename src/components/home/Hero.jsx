import { HOME_IMAGES } from '../../data/images.js';
import { BOOK_PATH } from '../../data/content.js';
import { BUSINESS } from '../../config/business.js';
import Img from '../ui/Img.jsx';
import Leaf from '../ui/Leaf.jsx';
import Button from '../ui/Button.jsx';

export default function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">{BUSINESS.tagline}</p>
          <h1 className="h1" id="hero-title">
            <span className="ln"><span>Your Beauty.</span></span>
            <span className="ln"><span>Your Ritual.</span></span>
            <span className="ln"><span><em>Your Glow.</em></span></span>
          </h1>
          <p className="hero-text">
            Discover a more personal beauty experience at Eden Glow Studio, where artistry, care, and confidence come together.
          </p>
          <div className="ctas hero-ctas">
            <Button to={BOOK_PATH} arrow>Book Appointment</Button>
            <Button href="#services" variant="line">Explore Services</Button>
          </div>
        </div>

        <div className="hero-art">
          <span className="hero-outline" aria-hidden="true" />
          <div className="hero-main">
            <Img {...HOME_IMAGES.heroMain} priority sizes="(max-width: 1024px) 80vw, 46vw" />
          </div>
          <div className="hero-second">
            <div className="hero-second-in">
              <Img {...HOME_IMAGES.heroSecond} sizes="240px" />
            </div>
          </div>
          <Leaf className="hero-leaf" stroke={0.7} />
          <Leaf className="hero-leaf hero-leaf--sm" stroke={0.9} flip />
        </div>
      </div>
      <a className="scroll-cue" href="#about" aria-label="Scroll to About">
        <span>Scroll</span>
        <i aria-hidden="true" />
      </a>
    </section>
  );
}
