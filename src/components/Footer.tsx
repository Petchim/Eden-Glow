import { Link } from 'react-router-dom';
import { BUSINESS, hasPhone, hasWhatsApp, telLink, waLink } from '../config/business.ts';
import { BOOK_PATH, SERVICES } from '../data/content.ts';
import Brand from './Brand.tsx';
import Button from './ui/Button.tsx';
import Icon from './ui/Icon.tsx';

const SERVICE_LINKS = SERVICES.filter((s) => s.id !== 'academy');

export default function Footer() {
  const wa = hasWhatsApp();
  const phone = hasPhone();
  const insta = Boolean(BUSINESS.instagramUrl);
  const maps = Boolean(BUSINESS.googleMapsUrl);

  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-brand">
            <Brand />
            <p className="footer-tag">{BUSINESS.tagline}</p>
            <Button to={BOOK_PATH} size="sm" arrow className="footer-book">Book Appointment</Button>
            {(insta || wa || maps) && (
              <ul className="social" aria-label="Social links">
                {insta && <li><a href={BUSINESS.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Icon name="instagram" /></a></li>}
                {wa && <li><a href={waLink()} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><Icon name="whatsapp" /></a></li>}
                {maps && <li><a href={BUSINESS.googleMapsUrl} target="_blank" rel="noopener noreferrer" aria-label="Google Maps"><Icon name="pin" /></a></li>}
              </ul>
            )}
          </div>
          <nav aria-labelledby="footer-services">
            <h2 className="footer-h" id="footer-services">Services</h2>
            <ul>{SERVICE_LINKS.map((s) => <li key={s.id}><Link to={s.to}>{s.title}</Link></li>)}</ul>
          </nav>
          <nav aria-labelledby="footer-studio">
            <h2 className="footer-h" id="footer-studio">Studio</h2>
            <ul>
              <li><Link to="/academy">Academy</Link></li>
              <li><Link to="/gallery">Gallery</Link></li>
              <li><Link to={BOOK_PATH}>Book Appointment</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </nav>
          <div>
            <h2 className="footer-h">Visit</h2>
            {BUSINESS.address.length ? (
              <p className="footer-p">{BUSINESS.address.map((l) => <span key={l}>{l}</span>)}</p>
            ) : (
              <p className="footer-p placeholder">[Studio address — to be added]</p>
            )}
            {phone && <p className="footer-p"><a href={telLink()}>{BUSINESS.phoneDisplay || BUSINESS.phone}</a></p>}
            {insta && <p className="footer-p"><a href={BUSINESS.instagramUrl} target="_blank" rel="noopener noreferrer">{BUSINESS.instagramHandle || 'Instagram'}</a></p>}
            {!insta && !wa && <p className="footer-p placeholder">[Social links — to be added]</p>}
          </div>
        </div>

        <div className="footer-base">
          <span>© {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.</span>
          <span>Photography shown is temporary stock imagery.</span>
          <a href="#main" className="tlink" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><span>Back to top</span></a>
        </div>
      </div>
    </footer>
  );
}
