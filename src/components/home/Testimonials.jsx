import { TESTIMONIALS } from '../../data/content.js';
import { hasWhatsApp, waLink } from '../../config/business.js';
import Reveal from '../ui/Reveal.jsx';
import Leaf from '../ui/Leaf.jsx';
import SectionTitle from '../ui/SectionTitle.jsx';

/* Shows genuine testimonials from data/content.js. Until any are added,
   it shows an invitation to share feedback — nothing is invented. */
export default function Testimonials() {
  const hasReviews = TESTIMONIALS.length > 0;

  return (
    <section className="section testimonials" id="stories" aria-labelledby="stories-title">
      <div className="wrap">
        {hasReviews ? (
          <>
            <SectionTitle eyebrow="Client stories" lines={['In their', '*own words.*']} id="stories-title" />
            <div className="tq-grid">
              {TESTIMONIALS.map((t, i) => (
                <Reveal as="figure" className="tq" key={i} delay={i * 100}>
                  <blockquote>“{t.quote}”</blockquote>
                  <figcaption><b>{t.name}</b>{t.service && <span> · {t.service}</span>}</figcaption>
                </Reveal>
              ))}
            </div>
          </>
        ) : (
          <div className="tq-invite">
            <Leaf className="tq-leaf" stroke={0.8} />
            <SectionTitle eyebrow="Client stories" lines={['Your words will', '*bloom here.*']} id="stories-title" align="center" />
            <Reveal delay={120}>
              <p className="lede tq-lede">Visited Eden Glow Studio? We’d love to hear how it felt. With your permission, your feedback may be featured here.</p>
              {hasWhatsApp() ? (
                <a className="btn btn--line tq-btn" href={waLink('Hello Eden Glow Studio, I’d like to share feedback about my visit:')} target="_blank" rel="noopener noreferrer">
                  Share Your Feedback
                </a>
              ) : (
                <p className="fine tq-fine">Share your thoughts with us on your next visit.</p>
              )}
            </Reveal>
          </div>
        )}
      </div>
    </section>
  );
}
