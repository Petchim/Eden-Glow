import Reveal from './ui/Reveal.jsx';
import SectionTitle from './ui/SectionTitle.jsx';
import Icon from './ui/Icon.jsx';

/* Accessible FAQ accordion built on native <details>. */
export default function Faq({ items, id = 'faq', eyebrow = 'Questions', title = ['Good to', '*know.*'] }) {
  if (!items?.length) return null;
  return (
    <section className="section faq" aria-labelledby={`${id}-title`}>
      <div className="wrap faq-grid">
        <SectionTitle eyebrow={eyebrow} lines={title} id={`${id}-title`} className="faq-head" />
        <Reveal className="faq-list" delay={100}>
          {items.map((f, i) => (
            <details key={f.q} open={i === 0}>
              <summary>
                <span>{f.q}</span>
                <Icon name="chevron" size={18} />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
