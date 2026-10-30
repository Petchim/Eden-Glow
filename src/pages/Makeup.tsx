import { MAKEUP_PAGE as M, type MakeupFeatureContent } from '../data/services.ts';
import { bookLink } from '../data/content.ts';
import { galleryFor } from '../data/images.ts';
import { BUSINESS, hasWhatsApp, waLink } from '../config/business.ts';
import { usePageMeta } from '../hooks/usePageMeta.ts';
import PageHero from '../components/PageHero.tsx';
import GalleryGrid from '../components/GalleryGrid.tsx';
import Faq from '../components/Faq.tsx';
import CtaBand from '../components/CtaBand.tsx';
import Button from '../components/ui/Button.tsx';
import Img from '../components/ui/Img.tsx';
import Leaf from '../components/ui/Leaf.tsx';
import Reveal from '../components/ui/Reveal.tsx';
import SectionTitle from '../components/ui/SectionTitle.tsx';

interface FeatureProps {
  data: MakeupFeatureContent;
  id: string;
  /** Booking-form service this section enquires about. */
  service: string;
  flip?: boolean;
  alt?: boolean;
}

function Feature({ data, id, service, flip = false, alt = false }: FeatureProps) {
  return (
    <section className={`section mfeat ${alt ? 'section--alt' : ''}`} aria-labelledby={id}>
      <div className={`wrap mfeat-grid ${flip ? 'mfeat-grid--flip' : ''}`}>
        <div className="mfeat-art">
          <Reveal variant="curtain" className="mfeat-main"><Img {...data.image} sizes="(max-width: 900px) 90vw, 46vw" /></Reveal>
          <Reveal className="mfeat-detail" delay={300}><Img {...data.detail} sizes="260px" /></Reveal>
          <Leaf className="mfeat-leaf" stroke={0.8} />
        </div>
        <div className="mfeat-copy">
          <SectionTitle eyebrow={data.eyebrow} lines={data.title} id={id} />
          <Reveal delay={100}>
            {data.paragraphs.map((p) => <p className="lede mfeat-p" key={p.slice(0, 20)}>{p}</p>)}
          </Reveal>
          <ul className="makeup-list">
            {data.points.map((pt, i) => (
              <Reveal as="li" key={pt} delay={140 + i * 80}>
                <span className="ml-num">{String(i + 1).padStart(2, '0')}</span>
                <b>{pt}</b>
              </Reveal>
            ))}
          </ul>
          <Reveal className="ctas" delay={200}>
            <Button to={bookLink(service)} arrow>Enquire for {service === 'Bridal makeup' ? 'Bridal Makeup' : 'Makeup'}</Button>
          </Reveal>
          <p className="fine makeup-fine">Services listed are proposed and subject to confirmation by the studio.</p>
        </div>
      </div>
    </section>
  );
}

export default function Makeup() {
  usePageMeta(M.meta.title, M.meta.description);
  const book = bookLink(M.booking);
  const e = M.enquiry;
  const waText = `Hello ${BUSINESS.name}, I'd like to enquire about makeup.\n\nOccasion & date: \nGetting-ready location: \nNumber of people: \nLook I have in mind: `;

  return (
    <>
      <PageHero {...M.hero} crumb="Makeup">
        <Button to={book} arrow>{M.cta.label}</Button>
        <Button to={bookLink('Bridal makeup')} variant="line">Bridal Enquiry</Button>
      </PageHero>

      <Feature data={M.bridal} id="bridal-title" service="Bridal makeup" />
      <Feature data={M.occasion} id="occasion-title" service="Makeup" flip alt />

      <section className="section gsection" aria-labelledby="makeup-gallery">
        <div className="wrap">
          <div className="gsection-head">
            <SectionTitle eyebrow="Makeup gallery" lines={['Artistry,', '*up close.*']} id="makeup-gallery" />
          </div>
          <GalleryGrid items={[...galleryFor('Makeup')]} columns={[[1100, 3], [0, 2]]} />
        </div>
      </section>

      <section className="section section--alt menq" aria-labelledby="menq-title">
        <div className="wrap menq-grid">
          <Reveal variant="curtain" className="menq-photo"><Img {...e.image} sizes="(max-width: 900px) 90vw, 40vw" /></Reveal>
          <div>
            <SectionTitle eyebrow={e.eyebrow} lines={e.title} id="menq-title" />
            <Reveal delay={100}>
              <p className="lede menq-lede">{e.text}</p>
              <h3 className="mini-label menq-label">Helpful to include</h3>
              <ul className="o-list">{e.checklist.map((c) => <li key={c}>{c}</li>)}</ul>
              <div className="ctas menq-ctas">
                <Button to={book} arrow>Send Makeup Enquiry</Button>
                {hasWhatsApp() && <Button href={waLink(waText)} variant="line" icon="whatsapp">WhatsApp Us</Button>}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <Faq items={M.faqs} id="makeup-faq" />
      <CtaBand {...M.cta} to={book} secondary={{ to: '/gallery?category=Makeup', label: 'View Gallery' }} />
    </>
  );
}
