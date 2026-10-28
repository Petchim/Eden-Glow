/* =====================================================================
   SITE CONTENT — edit wording here without touching components.
   Service descriptions are suggestions: confirm exact treatments,
   courses and categories before publishing. Placeholders in [square
   brackets] are shown on the site until you replace them.
   Service-page content lives in data/services.js.
   ===================================================================== */
import { CARD_IMAGES } from './images.js';

export const NAV = [
  { label: 'Home', to: '/' },
  { label: 'Hair', to: '/hair' },
  { label: 'Skin', to: '/skin' },
  { label: 'Nails', to: '/nails' },
  { label: 'Lashes', to: '/lashes' },
  { label: 'Makeup', to: '/makeup' },
  { label: 'Academy', to: '/academy' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Contact', to: '/contact' },
];

/* Desktop header: five top-level items, with the service pages grouped under "Services".
   The mobile menu still lists every page in NAV. */
const SERVICE_PATHS = ['/hair', '/skin', '/nails', '/lashes', '/makeup'];
export const MAIN_NAV = [
  { label: 'Home', to: '/' },
  { label: 'Services', children: NAV.filter((l) => SERVICE_PATHS.includes(l.to)) },
  { label: 'Academy', to: '/academy' },
  { label: 'Gallery', to: '/gallery' },
  { label: 'Contact', to: '/contact' },
];

export const BOOK_PATH = '/book-appointment';
/** Link to the booking page with a service (and optional treatment) pre-selected. */
export const bookLink = (service, treatment) => {
  const q = new URLSearchParams();
  if (service) q.set('service', service);
  if (treatment) q.set('treatment', treatment);
  const s = q.toString();
  return s ? `${BOOK_PATH}?${s}` : BOOK_PATH;
};

export const DISCIPLINES = ['Hair', 'Skin', 'Nails', 'Lashes', 'Makeup', 'Academy'];

/* Home page service cards — each opens its own page.
   `price` (optional): a real starting price as you want it shown, e.g. 'From ₹1,500'.
   While empty, no price is shown. */
export const SERVICES = [
  {
    id: 'hair', title: 'Hair', short: 'Hair Styling', kicker: 'Cut · Colour · Care', layout: 'feature', to: '/hair',
    desc: 'Hair styling, haircuts, colour and hair-care treatments — shaped around your texture, your routine and the way you like to wear it.',
    image: CARD_IMAGES.hair,
    price: '',
  },
  {
    id: 'skin', title: 'Skin', short: 'Skin Care', kicker: 'Facials · Skincare', layout: 'offset', to: '/skin',
    desc: 'Facials, skincare and beauty treatments that leave skin feeling cared for and looking quietly radiant.',
    image: CARD_IMAGES.skin,
    price: '',
  },
  {
    id: 'nails', title: 'Nails', short: 'Nails', kicker: 'Manicure · Pedicure · Art', layout: 'small', to: '/nails',
    desc: 'Nail care, manicure, pedicure and nail artistry with a clean, considered finish.',
    image: CARD_IMAGES.nails,
    price: '',
  },
  {
    id: 'lashes', title: 'Lashes', short: 'Lashes', kicker: 'Styling · Enhancement', layout: 'wide', to: '/lashes',
    desc: 'Lash styling and enhancement to frame your eyes — from barely-there to beautifully defined.',
    image: CARD_IMAGES.lashes,
    price: '',
  },
  {
    id: 'makeup', title: 'Makeup', short: 'Makeup', kicker: 'Occasion · Party · Bridal', layout: 'small', to: '/makeup',
    desc: 'Occasion, party and bridal makeup designed around your features, your outfit and your day.',
    image: CARD_IMAGES.makeup,
    price: '',
  },
  {
    id: 'academy', title: 'Academy', short: 'Academy', kicker: 'Training · Learning', layout: 'side', to: '/academy',
    desc: 'Beauty training and professional learning for those who want to make the craft their own.',
    image: CARD_IMAGES.academy,
    price: '',
  },
];

/* Options in the booking form. Each service page pre-selects its own. */
export const BOOKING_SERVICES = ['Hair', 'Skin', 'Nails', 'Lashes', 'Makeup', 'Bridal makeup', 'Academy enquiry', 'Not sure yet'];

/* About — replace with the studio's real story whenever you're ready.
   Do not add founder names, years or awards unless they are true. */
export const ABOUT = {
  eyebrow: 'About Eden Glow',
  title: ['Beauty, with a', 'Personal Touch.'],
  paragraphs: [
    'Eden Glow Studio is a beauty space made for the small, unhurried moments that leave you feeling more like yourself — a fresh cut, a calm facial, nails done just so, or makeup for a day you’ll want to remember.',
    'Every visit begins with a conversation. We take time to understand what you want, what suits you and how you live, so the result feels personal rather than prescribed.',
  ],
  note: '[Your studio story — add how Eden Glow began, in your own words.]',
};

/* Home hero — short reassurance points under the buttons (keep them factual). */
export const HERO_FEATURES = [
  { icon: 'user', label: 'Personalised care' },
  { icon: 'sparkle', label: 'Six beauty services' },
  { icon: 'leaf', label: 'Calm, elegant space' },
  { icon: 'calendar', label: 'Easy WhatsApp booking' },
];

/* Home "Elevate Your Everyday Beauty" section. Confirm these points describe the studio.
   Points marked `confirmed: false` are factual claims about the studio and stay hidden
   until the studio confirms them — then change them to `confirmed: true`. */
export const EXPERIENCE_FEATURES = [
  { icon: 'heart', title: 'Professional Care', text: 'Careful, attentive work from first consultation to final finish.' },
  { icon: 'shield', title: 'Hygienic Environment', text: 'Clean tools and a well-kept studio for every visit.', confirmed: false },
  { icon: 'tools', title: 'Modern Equipment', text: 'Up-to-date tools and products chosen for each treatment.', confirmed: false },
  { icon: 'sparkle', title: 'Personalised Experience', text: 'Every treatment shaped around you and your routine.' },
];

export const SIGNATURE = {
  points: [
    { title: 'Listen first', text: 'A conversation before any treatment begins.' },
    { title: 'Made for you', text: 'Choices shaped around your features and routine.' },
    { title: 'Leave glowing', text: 'Simple aftercare so the feeling lasts.' },
  ],
};

export const WHY = [
  { title: 'Personalised consultations', text: 'Every appointment starts with understanding what you want.' },
  { title: 'Attention to detail', text: 'Care in the finishing touches, from first step to last.' },
  { title: 'A welcoming experience', text: 'A calm, comfortable studio where you can simply relax.' },
  { title: 'Six beauty categories', text: 'Hair, skin, nails, lashes, makeup and academy in one place.' },
  { title: 'Thoughtful recommendations', text: 'Honest suggestions for what will genuinely suit you.' },
];

/* Testimonials — add ONLY genuine feedback, with the client's permission.
   Example: { quote: '…', name: 'First name', service: 'Hair', source: 'Google review', permission: true }
   `permission: true` records that the client agreed to be quoted; entries without it are not shown.
   `service` and `source` (where the review was left) are optional.
   While no entry qualifies, the home page has no reviews section at all. */
export const TESTIMONIALS = [];
export const VERIFIED_TESTIMONIALS = TESTIMONIALS.filter((t) => t.permission === true && t.quote?.trim() && t.name?.trim());

/* Instagram posts for the home page strip (optional). Save each image in /public/images/instagram/
   and link to the real post, e.g. { src: '/images/instagram/1.jpg', alt: '…', url: 'https://www.instagram.com/p/…' }.
   The strip appears once `instagramUrl` is set in config/business.js; posts are shown when added here. */
export const INSTAGRAM_POSTS = [];
