import { Link, useLocation } from 'react-router-dom';
import { BOOK_PATH } from '../data/content.ts';
import { hasWhatsApp, waLink } from '../config/business.ts';
import { useScrolled } from '../hooks/useUi.ts';
import Icon from './ui/Icon.tsx';

/* Phones and tablets: a slim bar that keeps "Book appointment" one tap away once the visitor
   has scrolled past the hero. Not shown on the booking page itself. The WhatsApp button only
   opens a chat with the studio; it appears once a WhatsApp number is set in business.ts. */
export default function MobileBookBar() {
  const { pathname } = useLocation();
  const shown = useScrolled(360);
  if (pathname === BOOK_PATH) return null;

  return (
    <>
      <div className="bookbar-space tone-burgundy" aria-hidden="true" />
      <div className={`bookbar ${shown ? 'is-shown' : ''}`} {...(!shown ? { inert: '', 'aria-hidden': true } : {})}>
        <Link className="btn btn--gold bookbar-btn" to={BOOK_PATH}>
          Book Appointment
          <Icon name="arrow" />
        </Link>
        {hasWhatsApp() && (
          <a
            className="bookbar-wa"
            href={waLink()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with the studio on WhatsApp (opens in a new tab)"
          >
            <Icon name="whatsapp" size={22} />
          </a>
        )}
      </div>
    </>
  );
}
