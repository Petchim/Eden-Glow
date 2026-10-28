import { MAKEUP_PAGE, SERVICE_PAGES } from '../../data/services.js';

/* The treatments listed on the public service pages, as starting entries for the admin
   service list. Names and categories only: prices and durations are left for the owner to
   enter, so nothing is made up. Imported services stay hidden until they have a price. */
export function websiteMenu() {
  const items = [];
  for (const page of Object.values(SERVICE_PAGES)) {
    for (const it of page.offerings.items) items.push({ name: it.title, category: page.name, image: it.image?.src || '' });
  }
  items.push({ name: MAKEUP_PAGE.bridal.eyebrow, category: 'Makeup', image: MAKEUP_PAGE.bridal.image?.src || '' });
  items.push({ name: MAKEUP_PAGE.occasion.eyebrow, category: 'Makeup', image: MAKEUP_PAGE.occasion.image?.src || '' });
  return items.map((it) => ({ ...it, durationMin: null }));
}
