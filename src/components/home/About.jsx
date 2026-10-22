import { ABOUT } from '../../data/content.js';
import { HOME_IMAGES as IMAGES } from '../../data/images.js';
import Img from '../ui/Img.jsx';
import Leaf from '../ui/Leaf.jsx';
import Reveal from '../ui/Reveal.jsx';
import SectionTitle from '../ui/SectionTitle.jsx';
import Icon from '../ui/Icon.jsx';

export default function About() {
  return (
    <section className="section about" id="about" aria-labelledby="about-title">
      <div className="wrap about-grid">
        <div className="about-art">
          <Reveal variant="curtain" className="about-photo">
            <Img {...IMAGES.about} sizes="(max-width: 900px) 90vw, 44vw" />
          </Reveal>
          <span className="about-frame" aria-hidden="true" />
          <Leaf className="about-leaf" stroke={0.8} />
        </div>
        <div className="about-copy">
          <SectionTitle eyebrow={ABOUT.eyebrow} lines={[ABOUT.title[0], `*${ABOUT.title[1]}*`]} id="about-title" />
          <Reveal delay={120}>
            {ABOUT.paragraphs.map((p) => (
              <p className="lede about-p" key={p.slice(0, 20)}>{p}</p>
            ))}
            <p className="about-note placeholder">{ABOUT.note}</p>
            <a className="tlink about-link" href="#services"><span>Explore our services</span><Icon name="arrow" /></a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
