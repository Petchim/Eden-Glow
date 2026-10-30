/* =====================================================================
   EDEN GLOW STUDIO — BUSINESS DETAILS
   ---------------------------------------------------------------------
   Fill these in with the studio's real details. Anything left empty
   is shown on the website as a clearly labelled placeholder, and the
   related button (Call / WhatsApp / Email / Directions / Instagram) is
   hidden until a real value is added. Nothing here is invented.
   ===================================================================== */

export interface OpeningHours {
  days: string;
  time: string;
}

export interface BusinessDetails {
  name: string;
  tagline: string;
  whatsappNumber: string;
  phone: string;
  phoneDisplay: string;
  email: string;
  address: string[];
  hours: OpeningHours[];
  googleMapsUrl: string;
  googleMapsEmbedUrl: string;
  studioVideoUrl: string;
  instagramUrl: string;
  instagramHandle: string;
  location: { area: string; city: string; region: string; postalCode: string; country: string };
  siteUrl: string;
  openingHoursSchema: string[];
  priceRange: string;
}

export const BUSINESS: BusinessDetails = {
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

  // Link to a studio video (e.g. YouTube or Instagram Reel). While empty, the home page
  // shows "Tour Our Studio" (salon photos in the gallery) instead of "Watch Our Studio".
  studioVideoUrl: '', // TODO: optional

  instagramUrl: '', // TODO: e.g. 'https://instagram.com/yourhandle'
  instagramHandle: '', // TODO: e.g. '@edenglowstudio'

  // Area and city of the studio. Once `city` is set, a location line appears in the home hero,
  // and the city is added to the home page title. `country` is a two-letter code, e.g. 'IN'.
  // The first line of `address` above is used as the street address for search engines.
  location: {
    area: '', // TODO: optional, e.g. the neighbourhood
    city: '', // TODO
    region: '', // TODO: optional, state or region
    postalCode: '', // TODO: optional
    country: '', // TODO: optional, e.g. 'IN'
  },

  // ---------- search engines & link previews ----------
  // The live website address, e.g. 'https://www.yourdomain.com' (https, no trailing slash).
  // It is needed for the canonical URL, sitemap.xml, and the image shown when a link is shared.
  // While it is empty those are simply left out, rather than pointing at a made-up address.
  siteUrl: '', // TODO

  // Optional: opening hours in schema.org format for search engines, e.g. ['Tu-Su 10:00-20:00'].
  // (The `hours` list above is what visitors see; keep the two in step.)
  openingHoursSchema: [],
  // Optional: price band for search engines, e.g. '₹₹'. Leave empty if unsure.
  priceRange: '',
};

/* ---------- helpers (no need to edit) ---------- */
export const hasWhatsApp = () => /^\d{8,15}$/.test(BUSINESS.whatsappNumber);
export const hasPhone = () => BUSINESS.phone.replace(/[^\d]/g, '').length >= 8;
export const hasEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(BUSINESS.email);
export const waLink = (text?: string) =>
  `https://wa.me/${BUSINESS.whatsappNumber}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const telLink = () => `tel:${BUSINESS.phone.replace(/[^\d+]/g, '')}`;
export const mailLink = (subject: string, body: string) =>
  `mailto:${BUSINESS.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
export const hasInstagram = () => /^https:\/\/(www\.)?instagram\.com\/[^\s]+$/.test(BUSINESS.instagramUrl);
/** "Area, City" for display, or '' until a city is set. */
export const locationLine = () =>
  BUSINESS.location.city ? [BUSINESS.location.area, BUSINESS.location.city].filter(Boolean).join(', ') : '';
/** The live site address, or '' if it is unset or still a placeholder. */
export const siteUrl = () => {
  const url = BUSINESS.siteUrl.trim().replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(url)) return '';
  return /(^|\.)(example\.(com|org|net)|yourdomain\.[a-z]+|localhost)$/i.test(new URL(url).hostname) ? '' : url;
};
