import { Link } from 'react-router-dom';
import { SERVICES, bookLink } from '../../data/content.js';
import Img from '../ui/Img.jsx';
import Reveal from '../ui/Reveal.jsx';
import SectionTitle from '../ui/SectionTitle.jsx';
import Icon from '../ui/Icon.jsx';

function ServiceCard({ s, index }) {
  const isAcademy = s.id === 'academy';
  return (
    <Reveal as="article" className={`svc svc--${s.layout}`} id={`svc-${s.id}`} delay={(index % 2) * 120} aria-labelledby={`svc-${s.id}-title`}>
      <Link className="svc-media zoom-on-hover" to={s.to} tabIndex={-1} aria-hidden="true">
        <Img {...s.image} sizes="(max-width: 760px) 92vw, 50vw" />
      </Link>
      <div className="svc-body">
        <p className="svc-meta"><span className="svc-num">{String(index + 1).padStart(2, '0')}</span>{s.kicker}</p>
        <h3 className="svc-title" id={`svc-${s.id}-title`}><Link to={s.to}>{s.title}</Link></h3>
        <p className="svc-desc">{s.desc}</p>
        <div className="svc-actions">
          <Link className="tlink" to={s.to}><span>Explore {s.title.toLowerCase()}</span><Icon name="arrow" /></Link>
          <Link className="btn btn--line btn--sm" to={bookLink(isAcademy ? 'Academy enquiry' : s.title)}>
            {isAcademy ? 'Enquire' : 'Book'}<span className="visually-hidden"> {s.title}</span>
          </Link>
        </div>
      </div>
    </Reveal>
  );
}

export default function Services() {
  return (
    <section className="section section--alt services" id="services" aria-labelledby="services-title">
      <div className="wrap">
        <div className="services-head">
          <SectionTitle eyebrow="Our services" lines={['Six rituals,', 'one *studio.*']} id="services-title" />
          <Reveal delay={100} className="services-intro">
            <p className="lede">Everything on our banner, under one roof. Choose a service to explore it — or start an enquiry and we’ll help you find what suits you.</p>
            <p className="fine">Treatments shown are a guide; please enquire to confirm availability.</p>
          </Reveal>
        </div>
        <div className="svc-grid">
          {SERVICES.map((s, i) => (
            <ServiceCard s={s} index={i} key={s.id} />
          ))}
        </div>
      </div>
    </section>
  );
}
