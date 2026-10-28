import { usePageMeta } from '../hooks/usePageMeta.js';
import Hero from '../components/home/Hero.jsx';
import Services from '../components/home/Services.jsx';
import Signature from '../components/home/Signature.jsx';
import Gallery from '../components/home/Gallery.jsx';
import BookingCta from '../components/home/BookingCta.jsx';
import Testimonials from '../components/home/Testimonials.jsx';
import Instagram from '../components/home/Instagram.jsx';
import { VERIFIED_TESTIMONIALS } from '../data/content.js';
import { BUSINESS, hasInstagram, locationLine } from '../config/business.js';

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
      {/* Shown only once there is real data for them (see data/content.js and config/business.js). */}
      {VERIFIED_TESTIMONIALS.length > 0 && <Testimonials />}
      {hasInstagram() && <Instagram />}
      <BookingCta />
    </>
  );
}
