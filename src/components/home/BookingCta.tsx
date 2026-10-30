import { BOOK_PATH } from '../../data/content.ts';
import Button from '../ui/Button.tsx';
import Reveal from '../ui/Reveal.tsx';
import Floral from '../ui/Floral.tsx';

/* Full-width burgundy appointment band: florals draw themselves in, the heading rises from a mask.
   The button opens the existing booking form, which prepares the WhatsApp message. */
export default function BookingCta() {
  return (
    <Reveal as="section" variant="draw" className="bcta tone-burgundy" aria-labelledby="bcta-title">
      <Floral className="bcta-floral bcta-floral--l" />
      <Floral className="bcta-floral bcta-floral--r" flip />
      <span className="bcta-rule" aria-hidden="true" />
      <div className="wrap bcta-in">
        <p className="eyebrow bcta-eyebrow">Appointments</p>
        <h2 className="h2 bcta-title" id="bcta-title">
          <span className="line"><span className="line-in">Ready for Your <em>Glow?</em></span></span>
        </h2>
        <p className="lede bcta-text">
          Choose your service, date and time — we’ll prepare a WhatsApp message to the studio for you.
        </p>
        <div className="ctas bcta-actions">
          <Button to={BOOK_PATH} arrow>Book Appointment</Button>
        </div>
        <p className="fine bcta-fine">Your appointment is confirmed only once the studio replies to your enquiry.</p>
      </div>
    </Reveal>
  );
}
