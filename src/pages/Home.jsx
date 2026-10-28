import { usePageMeta } from '../hooks/usePageMeta.js';
import Hero from '../components/home/Hero.jsx';
import Services from '../components/home/Services.jsx';
import Signature from '../components/home/Signature.jsx';
import Gallery from '../components/home/Gallery.jsx';
import BookingCta from '../components/home/BookingCta.jsx';

export default function Home() {
  usePageMeta(
    null,
    'Eden Glow Studio — hair, skin, nails, lashes, makeup and beauty academy. Look Good. Feel Good. Be You. Send an appointment enquiry on WhatsApp.',
  );

  return (
    <>
      <Hero />
      <Services />
      <Signature />
      <Gallery />
      <BookingCta />
    </>
  );
}
