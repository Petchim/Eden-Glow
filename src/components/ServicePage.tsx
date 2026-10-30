import { Fragment, type ReactNode } from 'react';
import type { ServicePageContent, ServiceSectionKey } from '../types/content.ts';
import { bookLink } from '../data/content.ts';
import { usePageMeta } from '../hooks/usePageMeta.ts';
import PageHero from './PageHero.tsx';
import Button from './ui/Button.tsx';
import Faq from './Faq.tsx';
import CtaBand from './CtaBand.tsx';
import { GallerySection, Info, Intro, Offerings } from './ServiceSections.tsx';

/* Reusable layout for Hair, Skin, Nails and Lashes — driven by data/services.ts. */
export default function ServicePage({ service: s }: { service: ServicePageContent }) {
  usePageMeta(s.meta.title, s.meta.description);
  const book = bookLink(s.booking);

  // `order` only lists sections the page has content for.
  const sections: Record<ServiceSectionKey, () => ReactNode> = {
    intro: () => s.intro && <Intro data={s.intro} id={s.slug} flip={s.hero.variant === 'split'} />,
    offerings: () => <Offerings data={s.offerings} id={s.slug} booking={s.booking} confirmed={s.confirmed} />,
    info: () => s.info && <Info data={s.info} id={s.slug} />,
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
