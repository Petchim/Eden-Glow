import { usePageMeta } from '../hooks/usePageMeta.ts';
import Hero from '../components/home/Hero.tsx';
import Services from '../components/home/Services.tsx';
import Signature from '../components/home/Signature.tsx';
import Gallery from '../components/home/Gallery.tsx';
import BookingCta from '../components/home/BookingCta.tsx';
import Testimonials from '../components/home/Testimonials.tsx';
import Instagram from '../components/home/Instagram.tsx';
import { VERIFIED_TESTIMONIALS } from '../data/content.ts';
import { BUSINESS, hasInstagram, locationLine } from '../config/business.ts';

export default function Home() {
  const place = locationLine();
  usePageMeta(
    place ? `Beauty Studio in ${place}` : null,
    `${BUSINESS.name}${place ? ` in ${place}` : ''} — hair, skin, nails, lashes, makeup and beauty academy. Look Good. Feel Good. Be You. Send an appointment enquiry on WhatsApp.`,
  );

  return (
    <>
      <Hero />
      <Services />
      <Signature />
      <Gallery />
      {/* Shown only once there is real data for them (see data/content.ts and config/business.ts). */}
      {VERIFIED_TESTIMONIALS.length > 0 && <Testimonials />}
      {hasInstagram() && <Instagram />}
      <BookingCta />
    </>
  );
}
