import { BUSINESS, hasEmail, hasPhone, hasWhatsApp, telLink, waLink } from '../config/business.ts';
import Reveal from './ui/Reveal.tsx';
import Icon from './ui/Icon.tsx';

/* Every detail comes from config/business.ts. Missing details show a labelled
   placeholder and their action buttons stay hidden until configured. */
export function ContactActions({ className = '' }) {
  const wa = hasWhatsApp();
  const phone = hasPhone();
  const maps = Boolean(BUSINESS.googleMapsUrl);
  if (!wa && !phone && !maps) return null;
  return (
    <div className={`ctas ${className}`}>
      {phone && <a className="btn btn--line" href={telLink()}><Icon name="phone" />Call</a>}
      {wa && <a className="btn btn--gold" href={waLink(`Hello ${BUSINESS.name}, I have an enquiry.`)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" />WhatsApp</a>}
      {maps && <a className="btn btn--line" href={BUSINESS.googleMapsUrl} target="_blank" rel="noopener noreferrer"><Icon name="pin" />Directions</a>}
    </div>
  );
}

export default function ContactDetails() {
  const wa = hasWhatsApp();
  const phone = hasPhone();
  const maps = Boolean(BUSINESS.googleMapsUrl);
  const insta = Boolean(BUSINESS.instagramUrl);

  return (
    <Reveal as="address" className="contact-grid" delay={120}>
      <div className="ci">
        <h3><Icon name="pin" size={16} />Studio address</h3>
        {BUSINESS.address.length ? (
          <p>{BUSINESS.address.map((l) => <span key={l}>{l}</span>)}</p>
        ) : (
          <p className="placeholder">[Studio address — to be added]</p>
        )}
        {maps && <a className="tlink" href={BUSINESS.googleMapsUrl} target="_blank" rel="noopener noreferrer"><span>Get directions</span><Icon name="arrow" /></a>}
      </div>
      <div className="ci">
        <h3><Icon name="phone" size={16} />Phone</h3>
        {phone ? <p><a href={telLink()}>{BUSINESS.phoneDisplay || BUSINESS.phone}</a></p> : <p className="placeholder">[Phone number — to be added]</p>}
        {hasEmail() && <a className="tlink" href={`mailto:${BUSINESS.email}`}><span>{BUSINESS.email}</span></a>}
      </div>
      <div className="ci">
        <h3><Icon name="whatsapp" size={16} />WhatsApp &amp; Instagram</h3>
        {wa ? (
          <p><a href={waLink()} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a></p>
        ) : (
          <p className="placeholder">[WhatsApp number — to be added]</p>
        )}
        {insta ? (
          <a className="tlink" href={BUSINESS.instagramUrl} target="_blank" rel="noopener noreferrer"><span>{BUSINESS.instagramHandle || 'Instagram'}</span><Icon name="arrow" /></a>
        ) : (
          <p className="fine placeholder">[Instagram — to be added]</p>
        )}
      </div>
      <div className="ci">
        <h3><Icon name="clock" size={16} />Opening hours</h3>
        {BUSINESS.hours.length ? (
          <dl className="hours">
            {BUSINESS.hours.map((h) => (
              <div key={h.days}><dt>{h.days}</dt><dd>{h.time}</dd></div>
            ))}
          </dl>
        ) : (
          <p className="placeholder">[Opening days &amp; hours — to be added]</p>
        )}
      </div>
    </Reveal>
  );
}
