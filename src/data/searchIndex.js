/* =====================================================================
   SITE SEARCH — built only from content that already exists on the site
   (pages, services, treatment lists). Loaded with the search dialog.
   ===================================================================== */
import { NAV, SERVICES, BOOK_PATH } from './content.js';
import { SERVICE_PAGES, MAKEUP_PAGE } from './services.js';

const plain = (s = '') => s.replace(/\*/g, '');
const servicePaths = new Set(SERVICES.map((s) => s.to));

export const SEARCH_INDEX = [
  ...SERVICES.map((s) => ({ title: s.title, to: s.to, type: 'Service', text: `${s.kicker} — ${s.desc}` })),
  ...NAV.filter((l) => !servicePaths.has(l.to)).map((l) => ({ title: l.label, to: l.to, type: 'Page', text: '' })),
  { title: 'Book Appointment', to: BOOK_PATH, type: 'Booking', text: 'Choose a service, date and time and send an enquiry to the studio.' },
  ...Object.values(SERVICE_PAGES).flatMap((p) =>
    (p.offerings?.items || []).map((i) => ({ title: i.title, to: `/${p.slug}`, type: p.name, text: i.text })),
  ),
  { title: MAKEUP_PAGE.bridal.eyebrow, to: '/makeup', type: 'Makeup', text: MAKEUP_PAGE.bridal.points.join(' · ') },
  { title: MAKEUP_PAGE.occasion.eyebrow, to: '/makeup', type: 'Makeup', text: plain(MAKEUP_PAGE.occasion.paragraphs?.[0]) },
];

/** Every word of the query must appear in the title, type or description. Title matches rank first. */
export function searchSite(query, limit = 8) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return SEARCH_INDEX
    .map((item) => {
      const title = item.title.toLowerCase();
      const hay = `${title} ${item.type.toLowerCase()} ${item.text.toLowerCase()}`;
      if (!words.every((w) => hay.includes(w))) return null;
      const score = words.reduce((n, w) => n + (title.startsWith(w) ? 3 : title.includes(w) ? 2 : 0), 0);
      return { item, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.item);
}
