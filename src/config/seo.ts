/* =====================================================================
   SEARCH ENGINES & LINK PREVIEWS — built from config/business.ts.
   ---------------------------------------------------------------------
   Used at build time (vite.config.ts writes the tags into index.html,
   and creates robots.txt and sitemap.xml) and in the browser
   (hooks/usePageMeta.ts keeps the canonical URL in step per page).
   Nothing here needs editing: fill in business.ts and rebuild.
   ===================================================================== */
import { BUSINESS, hasEmail, hasInstagram, hasPhone, locationLine, siteUrl } from './business.ts';
import { NAV, BOOK_PATH } from '../data/content.ts';

/* 1200x630 crop of the hero photo, made by scripts/optimize-images.py */
export const SHARE_IMAGE = {
  path: '/images/share/og-image.jpg',
  width: 1200,
  height: 630,
  alt: 'Eden Glow Studio — woman with long brunette hair framed by pink blossom branches',
};

/** Every public page, for sitemap.xml. */
export const SITE_PATHS = [...NAV.map((l) => l.to), BOOK_PATH];

/** Absolute URL for a site path, or '' while the live address is not set. */
export const absoluteUrl = (path = '/') => (siteUrl() ? `${siteUrl()}${path}` : '');

/**
 * schema.org BeautySalon (a kind of LocalBusiness) describing the studio — or null until there is
 * enough real information for search engines to use (a street address or a city). Only filled-in
 * fields are included; reviews are not added here, as self-published reviews are not eligible.
 */
export function localBusinessSchema() {
  const loc = BUSINESS.location;
  const street = BUSINESS.address[0] || '';
  if (!street && !loc.city) return null;

  const address = {
    '@type': 'PostalAddress',
    streetAddress: street,
    addressLocality: loc.city,
    addressRegion: loc.region,
    postalCode: loc.postalCode,
    addressCountry: loc.country,
  };
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BeautySalon',
    name: BUSINESS.name,
    slogan: BUSINESS.tagline,
    url: absoluteUrl('/'),
    image: absoluteUrl(SHARE_IMAGE.path),
    telephone: hasPhone() ? BUSINESS.phone : '',
    email: hasEmail() ? BUSINESS.email : '',
    address: prune(address),
    openingHours: BUSINESS.openingHoursSchema.length ? BUSINESS.openingHoursSchema : '',
    priceRange: BUSINESS.priceRange,
    hasMap: BUSINESS.googleMapsUrl,
    sameAs: hasInstagram() ? [BUSINESS.instagramUrl] : '',
  };
  return prune(schema);
}

/** Home page <title>, with the area and city once they are known. */
export const homeTitle = () => {
  const place = locationLine();
  return place
    ? `${BUSINESS.name} — Beauty Studio in ${place}`
    : `${BUSINESS.name} — Hair, Skin, Nails, Lashes, Makeup & Academy`;
};

// drop empty strings so the markup only states what is actually known
const prune = (obj: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v != null));
