import { BUSINESS } from '../config/business.js';
import { BOOK_PATH } from '../data/content.js';
import { PAGE_IMAGES } from '../data/images.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import PageHero from '../components/PageHero.jsx';
import ContactDetails, { ContactActions } from '../components/ContactDetails.jsx';
import EnquiryForm from '../components/EnquiryForm.jsx';
import Button from '../components/ui/Button.jsx';
import Leaf from '../components/ui/Leaf.jsx';
import Reveal from '../components/ui/Reveal.jsx';
import SectionTitle from '../components/ui/SectionTitle.jsx';

const TOPICS = ['General enquiry', 'Hair', 'Skin', 'Nails', 'Lashes', 'Makeup', 'Academy', 'Feedback'];

export default function Contact() {
  usePageMeta('Contact & Directions', 'Contact Eden Glow Studio — address, phone, WhatsApp, opening hours, Instagram and directions. Send us an enquiry.');

  return (
    <>
      <PageHero
        variant="split"
        eyebrow="Contact"
        title={['We’d love to', '*hear from you.*']}
        text="Questions about a treatment, the academy or your next appointment — get in touch and the studio will reply as soon as they can."
        image={PAGE_IMAGES.contact}
        crumb="Contact"
      >
        <Button to={BOOK_PATH} arrow>Book Appointment</Button>
        <ContactActions />
      </PageHero>

      <section className="section contact" aria-labelledby="details-title">
        <div className="wrap">
          <div className="contact-head">
            <SectionTitle eyebrow="Visit us" lines={['Find your way', 'to *Eden.*']} id="details-title" />
          </div>
          <ContactDetails />

          <Reveal className="map" delay={100}>
            {BUSINESS.googleMapsEmbedUrl ? (
              <iframe
                title={`Map showing ${BUSINESS.name}`}
                src={BUSINESS.googleMapsEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            ) : (
              <div className="map-empty">
                <Leaf className="map-leaf" stroke={0.8} />
                <p className="placeholder">[Google Map — will appear here once the studio address and map link are added]</p>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      <section className="section section--alt" aria-label="Contact form">
        <div className="wrap enq-grid">
          <div>
            <SectionTitle eyebrow="Send a message" lines={['How can we', '*help?*']} id="contact-form-side" />
            <Reveal delay={100}>
              <p className="lede enq-lede">Fill in the form and we’ll open a ready-written message in WhatsApp for you to send.</p>
              <p className="fine enq-note">This website has no inbox of its own: your message is sent from your own WhatsApp (or email) app, so you’ll get the studio’s reply there. To request an appointment, use the booking page instead.</p>
              <Button to={BOOK_PATH} variant="line" size="sm" arrow className="enq-book">Book an Appointment</Button>
            </Reveal>
          </div>
          <Reveal delay={120}>
            <EnquiryForm
              id="ct"
              title="Your enquiry"
              topics={TOPICS}
              messagePlaceholder="How can we help?"
            />
          </Reveal>
        </div>
      </section>
    </>
  );
}
