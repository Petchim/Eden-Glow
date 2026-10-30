import { Link } from 'react-router-dom';
import { SERVICES, type ServiceCard } from '../../data/content.ts';
import Img from '../ui/Img.tsx';
import Reveal from '../ui/Reveal.tsx';
import SectionTitle from '../ui/SectionTitle.tsx';
import Icon from '../ui/Icon.tsx';

const SIZES: Partial<Record<ServiceCard['id'], string>> = {
  hair: '(max-width: 700px) 100vw, (max-width: 1000px) 60vw, 42vw',
  academy: '(max-width: 700px) 100vw, 100vw',
};

/* Editorial service mosaic: one feature image, four supporting frames and a wide academy band.
   Each tile is a single link to the service page. */
export default function Services() {
  return (
    <section className="section svcx" id="services" aria-labelledby="services-title">
      <div className="wrap">
        <div className="svcx-head">
          <SectionTitle eyebrow="Our services" lines={['Beauty Care for', 'Every *You.*']} id="services-title" />
          <Reveal className="svcx-intro" delay={150}>
            <p className="lede">Hair, skin, nails, lashes and makeup under one roof — plus an academy for those learning the craft.</p>
          </Reveal>
        </div>

        <ul className="svcx-grid">
          {SERVICES.map((s, i) => (
            <Reveal as="li" key={s.id} variant="curtain" className={`svcx-cell svcx-cell--${s.id}`} delay={i * 90}>
              <Link className="svcx-card" to={s.to}>
                <span className="svcx-img">
                  <Img {...s.image} sizes={SIZES[s.id] || '(max-width: 700px) 50vw, (max-width: 1000px) 40vw, 26vw'} />
                </span>
                <span className="svcx-info">
                  <span className="svcx-no" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <span className="svcx-name">{s.title}</span>
                  <span className="svcx-kick">{s.kicker}</span>
                  {s.price && <span className="svcx-price">{s.price}</span>}
                </span>
                <span className="svcx-go" aria-hidden="true"><Icon name="arrow" size={16} /></span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
