import { Fragment } from 'react';
import { bookLink } from '../data/content.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import PageHero from './PageHero.jsx';
import Button from './ui/Button.jsx';
import Faq from './Faq.jsx';
import CtaBand from './CtaBand.jsx';
import { GallerySection, Info, Intro, Offerings } from './ServiceSections.jsx';

/* Reusable layout for Hair, Skin, Nails and Lashes — driven by data/services.js. */
export default function ServicePage({ service: s }) {
  usePageMeta(s.meta.title, s.meta.description);
  const book = bookLink(s.booking);

  const sections = {
    intro: () => <Intro data={s.intro} id={s.slug} flip={s.hero.variant === 'split'} />,
    offerings: () => <Offerings data={s.offerings} id={s.slug} booking={s.booking} confirmed={s.confirmed} />,
    info: () => <Info data={s.info} id={s.slug} />,
    gallery: () => <GallerySection data={s.gallery} id={s.slug} />,
    faqs: () => <Faq items={s.faqs} id={`${s.slug}-faq`} />,
    cta: () => <CtaBand {...s.cta} to={book} secondary={{ to: '/gallery', label: 'View Gallery' }} />,
  };

  return (
    <>
      <PageHero {...s.hero} crumb={s.name}>
        <Button to={book} arrow>{s.cta.label}</Button>
        <Button href="#services" variant="line" onClick={(e) => { e.preventDefault(); document.getElementById(`${s.slug}-offer`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
          View Services
        </Button>
      </PageHero>
      {s.order.map((key) => <Fragment key={key}>{sections[key]()}</Fragment>)}
    </>
  );
}
