import { useRef } from 'react';
import { SIGNATURE } from '../../data/content.js';
import { HOME_IMAGES as IMAGES } from '../../data/images.js';
import { useParallax } from '../../hooks/useUi.js';
import Img from '../ui/Img.jsx';
import Reveal from '../ui/Reveal.jsx';
import SectionTitle from '../ui/SectionTitle.jsx';

export default function Signature() {
  const bg = useRef(null);
  useParallax(bg, 0.07);

  return (
    <section className="signature" aria-labelledby="sig-title">
      <div className="signature-bg" ref={bg}>
        <Img {...IMAGES.signature} sizes="100vw" />
      </div>
      <div className="signature-veil" aria-hidden="true" />
      <div className="wrap signature-in">
        <SectionTitle eyebrow="The Eden Glow experience" lines={['Your Moment.', '*Your Glow.*']} id="sig-title" className="signature-title" />
        <Reveal delay={120}>
          <p className="lede signature-story">
            Beauty, for us, is less about changing who you are and more about making room to enjoy it. An hour that is
            entirely yours — to be listened to, cared for, and to leave feeling quietly confident in your own skin.
          </p>
        </Reveal>
        <ol className="signature-points">
          {SIGNATURE.points.map((p, i) => (
            <Reveal as="li" key={p.title} delay={200 + i * 110}>
              <span className="sp-num">{['i', 'ii', 'iii'][i]}.</span>
              <b>{p.title}</b>
              <span>{p.text}</span>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
