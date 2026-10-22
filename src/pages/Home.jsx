import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { BOOK_PATH } from '../data/content.js';
import { FEATURED_GALLERY } from '../data/images.js';
import Hero from '../components/home/Hero.jsx';
import Ribbon from '../components/home/Ribbon.jsx';
import About from '../components/home/About.jsx';
import Services from '../components/home/Services.jsx';
import Signature from '../components/home/Signature.jsx';
import AcademyTeaser from '../components/home/AcademyTeaser.jsx';
import Why from '../components/home/Why.jsx';
import Testimonials from '../components/home/Testimonials.jsx';
import GalleryGrid from '../components/GalleryGrid.jsx';
import ContactDetails, { ContactActions } from '../components/ContactDetails.jsx';
import CtaBand from '../components/CtaBand.jsx';
import SectionTitle from '../components/ui/SectionTitle.jsx';
import Icon from '../components/ui/Icon.jsx';

export default function Home() {
  usePageMeta(
    null,
    'Eden Glow Studio — hair, skin, nails, lashes, makeup and beauty academy. Look Good. Feel Good. Be You. Send an appointment enquiry on WhatsApp.',
  );

  return (
    <>
      <Hero />
      <Ribbon />
      <About />
      <Services />
      <Signature />

      <section className="section gallery" aria-labelledby="gallery-title">
        <div className="wrap">
          <div className="gsection-head">
            <SectionTitle eyebrow="Beauty gallery" lines={['A glimpse of', '*the glow.*']} id="gallery-title" />
            <Link className="tlink" to="/gallery"><span>View full gallery</span><Icon name="arrow" /></Link>
          </div>
          <GalleryGrid items={FEATURED_GALLERY} />
        </div>
      </section>

      <AcademyTeaser />
      <Why />
      <Testimonials />
      <CtaBand
        title={['Reserve your', '*moment.*']}
        text="Choose your service, date and time — we’ll prepare a WhatsApp message to the studio for you."
        to={BOOK_PATH}
        secondary={{ to: '/contact', label: 'Contact Us' }}
      />

      <section className="section contact" aria-labelledby="contact-title">
        <div className="wrap">
          <div className="contact-head">
            <SectionTitle eyebrow="Visit us" lines={['Find your way', 'to *Eden.*']} id="contact-title" />
            <div className="ctas">
              <ContactActions />
              <Link className="tlink" to="/contact"><span>All contact details</span><Icon name="arrow" /></Link>
            </div>
          </div>
          <ContactDetails />
        </div>
      </section>
    </>
  );
}
