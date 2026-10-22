import { WHY } from '../../data/content.js';
import Reveal from '../ui/Reveal.jsx';
import SectionTitle from '../ui/SectionTitle.jsx';

const NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi'];

export default function Why() {
  return (
    <section className="section section--alt why" aria-labelledby="why-title">
      <div className="wrap why-grid">
        <div className="why-head">
          <SectionTitle eyebrow="Why Eden Glow" lines={['Care in', '*every detail.*']} id="why-title" />
          <Reveal delay={100}>
            <p className="lede">The way we intend every visit to feel — simple principles we hold ourselves to.</p>
          </Reveal>
        </div>
        <ol className="why-list">
          {WHY.map((w, i) => (
            <Reveal as="li" key={w.title} delay={i * 80}>
              <span className="why-num">{NUMERALS[i]}.</span>
              <h3>{w.title}</h3>
              <p>{w.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
