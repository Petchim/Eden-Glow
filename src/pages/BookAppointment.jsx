import { Link, useSearchParams } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta.js';
import BookingForm from '../components/BookingForm.jsx';
import Reveal from '../components/ui/Reveal.jsx';
import SectionTitle from '../components/ui/SectionTitle.jsx';

export default function BookAppointment() {
  usePageMeta('Book an Appointment', 'Request an appointment at Eden Glow Studio. Choose your service, preferred date and time, and send your enquiry on WhatsApp — the studio will confirm.');
  const [params] = useSearchParams();
  const service = params.get('service') || '';
  const treatment = params.get('treatment') || '';

  return (
    <section className="section booking bpage" aria-labelledby="page-title">
      <div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <ol>
            <li><Link to="/">Home</Link></li>
            <li aria-current="page">Book Appointment</li>
          </ol>
        </nav>
        <div className="bpage-head">
          <SectionTitle as="h1" eyebrow="Appointment enquiry" lines={['Reserve your', '*moment.*']} id="page-title" />
          <Reveal delay={100}>
            <ol className="booking-steps">
              <li><i>i.</i>Choose your service, date and time.</li>
              <li><i>ii.</i>Send the prepared message on WhatsApp.</li>
              <li><i>iii.</i>The studio replies to confirm availability.</li>
            </ol>
          </Reveal>
        </div>
        <p className="notice" role="note">
          <b>Please note:</b> sending this form does not book or save an appointment. Your preferred slot is confirmed only when the studio replies.
        </p>
        {/* key: re-initialise if the user follows a different "Book" link while on this page */}
        <BookingForm key={`${service}|${treatment}`} initialService={service} initialTreatment={treatment} />
      </div>
    </section>
  );
}
