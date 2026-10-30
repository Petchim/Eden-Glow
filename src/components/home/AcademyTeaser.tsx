import { Link } from 'react-router-dom';
import { HOME_IMAGES } from '../../data/images.ts';
import { ACADEMY } from '../../data/academy.ts';
import Img from '../ui/Img.tsx';
import Reveal from '../ui/Reveal.tsx';
import SectionTitle from '../ui/SectionTitle.tsx';
import Button from '../ui/Button.tsx';

/* Home-page introduction to the academy; full details live on /academy. */
export default function AcademyTeaser() {
  return (
    <section className="section academy" aria-labelledby="academy-title">
      <div className="wrap academy-grid">
        <div className="academy-copy">
          <SectionTitle eyebrow="Eden Glow Academy" lines={['Learn the', 'Art of *Beauty.*']} id="academy-title" />
          <Reveal delay={100}>
            <p className="lede academy-lede">Hands-on beauty education for aspiring professionals and enthusiasts, taught in a real studio setting. Course details are being finalised — enquire to hear about upcoming programmes.</p>
          </Reveal>
          <Reveal className="academy-cats" delay={160}>
            <h3 className="mini-label">Training areas</h3>
            <ul>
              {ACADEMY.categories.map((c) => (
                <li key={c.title}><Link to="/academy">{c.title}</Link></li>
              ))}
            </ul>
          </Reveal>
          <Reveal className="ctas academy-cta" delay={220}>
            <Button to="/academy" arrow>Discover the Academy</Button>
          </Reveal>
        </div>
        <div className="academy-art">
          <Reveal variant="curtain" className="academy-photo">
            <Img {...HOME_IMAGES.academy} sizes="(max-width: 900px) 90vw, 40vw" />
          </Reveal>
          <span className="academy-rule" aria-hidden="true">Eden Glow Academy</span>
        </div>
      </div>
    </section>
  );
}
