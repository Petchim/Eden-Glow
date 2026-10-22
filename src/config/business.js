/* =====================================================================
   EDEN GLOW STUDIO — BUSINESS DETAILS
   ---------------------------------------------------------------------
   Fill these in with the studio's real details. Anything left empty
   is shown on the website as a clearly labelled placeholder, and the
   related button (Call / WhatsApp / Email / Directions / Instagram) is
   hidden until a real value is added. Nothing here is invented.
   ===================================================================== */

export const BUSINESS = {
  name: 'Eden Glow Studio',
  tagline: 'Look Good. Feel Good. Be You.',

  // WhatsApp number in international format, DIGITS ONLY.
  // Example format: country code + number, e.g. '91XXXXXXXXXX'
  // Booking, contact and academy enquiries are sent to this number.
  whatsappNumber: '', // TODO: add the studio's WhatsApp number

  // Phone number for the "Call" button (digits, may start with +)
  phone: '', // TODO: e.g. '+91XXXXXXXXXX'
  // How the phone number should be displayed on the page
  phoneDisplay: '', // TODO: e.g. '+91 XXXXX XXXXX'

  // Used as the enquiry fallback when no WhatsApp number is set
  email: '', // TODO: optional, e.g. 'hello@yourdomain.com'

  // Studio address — one line per array item
  address: [], // TODO: e.g. ['Shop No. X, Street', 'Area, City – PIN']

  // Opening hours — one entry per row
  hours: [], // TODO: e.g. [{ days: 'Tue – Sun', time: '10:00 am – 8:00 pm' }, { days: 'Monday', time: 'Closed' }]

  googleMapsUrl: '', // TODO: paste the Google Maps share link (for the Directions button)
  // Google Maps → Share → "Embed a map" → copy only the src="…" URL
  googleMapsEmbedUrl: '', // TODO: e.g. 'https://www.google.com/maps/embed?pb=…'

  instagramUrl: '', // TODO: e.g. 'https://instagram.com/yourhandle'
  instagramHandle: '', // TODO: e.g. '@edenglowstudio'
};

/* ---------- helpers (no need to edit) ---------- */
export const hasWhatsApp = () => /^\d{8,15}$/.test(BUSINESS.whatsappNumber);
export const hasPhone = () => BUSINESS.phone.replace(/[^\d]/g, '').length >= 8;
export const hasEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(BUSINESS.email);
export const waLink = (text) =>
  `https://wa.me/${BUSINESS.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const telLink = () => `tel:${BUSINESS.phone.replace(/[^\d+]/g, '')}`;
export const mailLink = (subject, body) =>
  `mailto:${BUSINESS.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
