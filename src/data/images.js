/* =====================================================================
   IMAGES — all photography in one place, organised by page.
   ---------------------------------------------------------------------
   These are TEMPORARY royalty-free stock photographs (Unsplash and
   Pexels) used only until the studio's own photos are ready. They are
   not Eden Glow Studio clients, students or results, and the site says
   so wherever they appear in a gallery.

   To use your own photos: put files in /public/images/ and change a
   `src` to e.g. '/images/hair-hero.jpg' (and `full` for gallery items).
   If any image fails to load, the site shows a branded panel instead.
   ===================================================================== */

// Unsplash: u('1560066984-138dadb4c035', 1200)   Pexels: p(3985324, 1200)
const u = (id, w = 1200) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=78`;
const p = (id, w = 1200) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

/* ---------- Home ----------
   Stored locally in /public/images/home/ (downloaded from Unsplash and
   Pexels under their free licences) so the home page never depends on
   a third-party image host. */
const home = (file) => `/images/home/${file}`;

export const HOME_IMAGES = {
  // Optimised JPEG copy of 'Beauty in Bloom.png' (same image, ~270 KB instead of 2.4 MB).
  // `artInImage`: the photo already carries the "Beauty is a feeling" script and blossoms,
  // so the hero skips its own overlay phrase and line-art florals.
  hero: {
    src: home('hero-beauty-in-bloom.jpg'),
    alt: 'Woman with long, tousled brunette hair and a burgundy satin wrap, eyes closed, framed by pink blossom branches',
    position: '100% 30%',
    artInImage: true,
  },
  signature: { src: home('signature-portrait.jpg'), alt: 'Smiling woman with long dark hair and a white flower tucked behind her ear', position: '50% 35%' },
  booking: { src: home('cta-salon.jpg'), alt: 'Stylist shaping soft curls with a curling tong', position: '50% 35%' },
  // used by the About / AcademyTeaser sections (not currently on the home page)
  about: { src: u('1633681926035-ec1ac984418a', 1100), alt: 'Elegant salon interior with round mirrors and styling chairs' },
  academy: { src: u('1596704017254-9b121068fb31', 1100), alt: 'Hand holding an eyeshadow palette and a fine makeup brush', position: '50% 40%' },
};

/* ---------- Service cards (home page + footer) ---------- */
export const CARD_IMAGES = {
  hair: { src: home('service-hair.jpg'), alt: 'Long, glossy curls styled into a half-up look in the salon', position: '50% 40%' },
  skin: { src: home('service-skin.jpg'), alt: 'Face serum being applied with a dropper to glowing, natural skin', position: '50% 35%' },
  nails: { src: home('service-nails.jpg'), alt: 'Manicured hands finished with classic red polish', position: '50% 45%' },
  lashes: { src: home('service-lashes.jpg'), alt: 'Lash stylist placing individual lash extensions with fine tweezers', position: '50% 55%' },
  makeup: { src: home('service-makeup.jpg'), alt: 'Lipstick being applied to finish a soft, glamorous makeup look', position: '35% 40%' },
  academy: { src: home('service-academy.jpg'), alt: 'Stylist working on a client’s curly hair in a bright salon', position: '58% 40%' },
};

/* ---------- Home gallery (editorial grid, opens in the lightbox) ---------- */
const hg = (file, cat, caption, position) => ({ cat, caption, src: home(file), full: home(file), position });
export const HOME_GALLERY = [
  hg('gallery-red-lip.jpg', 'Makeup', 'Evening red', '50% 35%'),
  hg('gallery-curling.jpg', 'Hair', 'Curls, set by hand', '50% 40%'),
  hg('gallery-nails.jpg', 'Nails', 'Glossy tortoiseshell', '50% 50%'),
  hg('gallery-glam.jpg', 'Makeup', 'Soft, smoky glam', '50% 35%'),
  hg('gallery-skin-ritual.jpg', 'Skin', 'A calm skincare ritual', '50% 30%'),
  hg('gallery-lashes.jpg', 'Lashes', 'Placed one by one', '50% 40%'),
  hg('gallery-curls.jpg', 'Hair', 'Soft, defined curls', '50% 30%'),
];

/* ---------- Hair ---------- */
export const HAIR_IMAGES = {
  hero: { src: p(3992872, 1600), alt: 'Stylist preparing a client for a haircut in a warmly lit salon', position: '60% 40%' },
  intro: { src: u('1580618672591-eb180b1a973f', 1000), alt: 'Hair being blow-dried smooth with a round brush' },
  cut: { src: p(7755216, 1000), alt: 'Stylist combing and cutting a client’s dark curly hair' },
  colour: { src: u('1492106087820-71f1a00d2b11', 1000), alt: 'Long wavy hair in a soft lavender colour', position: '50% 25%' },
  treatment: { src: u('1634449571010-02389ed0f9b0', 1000), alt: 'Hair being rinsed at the backwash during a hair treatment' },
  occasion: { src: u('1582095133179-bfd08e2fc6b3', 1000), alt: 'Stylist pinning a client’s hair into an occasion updo' },
};

/* ---------- Skin ---------- */
export const SKIN_IMAGES = {
  hero: { src: p(3985324, 1800), alt: 'Skin therapist giving a client a facial in a calm treatment room', position: '50% 45%' },
  intro: { src: u('1608571423902-eed4a5ad8108', 1000), alt: 'Amber serum bottle on a wooden stand with soft leaf shadows' },
  facial: { src: p(3985333, 900), alt: 'Fan brush applying a treatment mask during a facial' },
  cleanse: { src: p(3985326, 900), alt: 'Therapist cleansing a client’s skin with cotton pads' },
  mask: { src: p(3985330, 900), alt: 'Cream mask being applied with a spatula' },
  homecare: { src: p(3762871, 900), alt: 'Facial serum being applied with a dropper', position: '40% 50%' },
};

/* ---------- Nails ---------- */
export const NAILS_IMAGES = {
  hero: { src: p(3997378, 1800), alt: 'Nail technician applying red polish at a manicure station', position: '50% 55%' },
  manicure: { src: p(3997385, 900), alt: 'Gloved nail technician painting a client’s nails red' },
  pedicure: { src: u('1519415510236-718bdfcd89c8', 900), alt: 'Feet resting in a warm foot bath with flowers' },
  gel: { src: p(3997387, 900), alt: 'Hand placed under a nail lamp during a gel manicure' },
  art: { src: u('1519014816548-bf5fe059798b', 900), alt: 'Red nail art with hand-painted lettering' },
};

/* ---------- Lashes ---------- */
export const LASH_IMAGES = {
  hero: { src: p(5128235, 1800), alt: 'Close-up of lash extensions being applied with tweezers over an under-eye pad', position: '50% 40%' },
  intro: { src: p(5128236, 1000), alt: 'Client resting comfortably during a lash appointment' },
  technician: { src: p(5128268, 1000), alt: 'Lash stylist concentrating on precise lash placement' },
};

/* ---------- Makeup ---------- */
export const MAKEUP_IMAGES = {
  hero: { src: u('1487412947147-5cebf100ffc2', 1800), alt: 'Lipstick being applied to complete a soft, glamorous makeup look', position: '50% 35%' },
  bridal: { src: u('1610016302534-6f67f1c968d8', 1100), alt: 'Bride in a red and gold silk saree with traditional jewellery', position: '50% 25%' },
  bridalDetail: { src: u('1525258946800-98cfd641d0de', 700), alt: 'Bridal bouquet of peach and white roses' },
  occasion: { src: u('1613966802194-d46a163af70d', 1100), alt: 'Makeup artist blending pink eyeshadow for an occasion look' },
  occasionDetail: { src: u('1616683693504-3ea7e9ad6fec', 700), alt: 'Classic red-lip evening makeup', position: '50% 40%' },
  enquiry: { src: p(4620843, 1000), alt: 'Makeup palettes and brushes laid out on a dark table' },
};

/* ---------- Academy ---------- */
export const ACADEMY_IMAGES = {
  hero: { src: p(4620845, 1800), alt: 'Makeup brush resting on a palette in a softly lit studio', position: '50% 50%' },
  intro: { src: p(7755223, 1000), alt: 'Stylist working on a client’s curly hair in a bright salon' },
  categories: {
    makeup: { src: p(4620840, 800), alt: 'Roll of professional makeup brushes' },
    hair: { src: p(7755225, 800), alt: 'Close-up of scissors cutting hair' },
    nails: { src: p(3997374, 800), alt: 'Nail technician filing a client’s nails' },
    lashes: { src: p(5128264, 800), alt: 'Lash and brow tools laid out on a table' },
    skin: { src: p(3985322, 800), alt: 'Facial mask application with a spatula' },
  },
};

/* ---------- Contact / booking ---------- */
export const PAGE_IMAGES = {
  contact: { src: u('1633681138600-295fcd688876', 1400), alt: 'Bright salon with ornate white mirrors and styling chairs' },
  booking: { src: u('1560066984-138dadb4c035', 1400), alt: 'Light-filled salon with styling chairs and tall windows' },
  notFound: { src: u('1560750588-73207b1ef5b8', 1400), alt: 'Calm lounge with rattan chairs and green plants' },
};

/* =====================================================================
   GALLERY — one list, filtered by category everywhere on the site.
   `ratio`: 'p' portrait 4:5 · 't' tall 2:3 · 's' square · 'l' landscape 4:3
   ===================================================================== */
const g = (cat, caption, ratio, src, full) => ({ cat, caption, ratio, src, full });
const ug = (id, cat, caption, ratio = 'p') => g(cat, caption, ratio, u(id, 800), u(id, 1800));
const pg = (id, cat, caption, ratio = 'p') => g(cat, caption, ratio, p(id, 800), p(id, 1800));

export const GALLERY_CATEGORIES = ['All', 'Hair', 'Skin', 'Nails', 'Lashes', 'Makeup', 'Salon Interior'];

export const GALLERY_IMAGES = [
  pg(3065207, 'Hair', 'Soft, defined curls', 't'),
  ug('1600948836101-f9ffda59d250', 'Salon Interior', 'Round mirrors, dark walls', 'l'),
  pg(3985333, 'Skin', 'Mask, brushed on', 'p'),
  ug('1604654894610-df63bc536371', 'Nails', 'Glossy tortoiseshell', 'p'),
  pg(5128267, 'Lashes', 'Lashes, combed through', 'l'),
  ug('1487412947147-5cebf100ffc2', 'Makeup', 'Lip, finished by hand', 's'),
  ug('1582095133179-bfd08e2fc6b3', 'Hair', 'Pinned for an occasion', 'p'),
  ug('1617897903246-719242758050', 'Skin', 'Serum and eucalyptus', 's'),
  ug('1607779097040-26e80aa78e66', 'Nails', 'Lilac, white and shimmer', 'p'),
  ug('1633681926035-ec1ac984418a', 'Salon Interior', 'Styling floor', 'l'),
  pg(4620843, 'Makeup', 'Palettes, ready', 'p'),
  pg(5128236, 'Lashes', 'Rest, while we work', 'l'),
  ug('1522337360788-8b13dee7a37e', 'Hair', 'Long, loose waves', 't'),
  pg(3985330, 'Skin', 'Treatment mask', 'p'),
  pg(3997381, 'Nails', 'Classic red', 's'),
  ug('1610016302534-6f67f1c968d8', 'Makeup', 'Bridal, in red and gold', 't'),
  ug('1560750588-73207b1ef5b8', 'Salon Interior', 'A quiet place to pause', 'p'),
  pg(3065208, 'Hair', 'Half-up, curled', 'p'),
  ug('1600428853876-fb5a850b444f', 'Skin', 'Facial roller and serum', 'l'),
  ug('1599206676335-193c82b13c9e', 'Nails', 'Manicure on marble', 'p'),
  pg(5128271, 'Lashes', 'Brushed and set', 'p'),
  ug('1613966802194-d46a163af70d', 'Makeup', 'Colour on the lid', 'p'),
  ug('1519699047748-de8e457a634e', 'Hair', 'Natural texture', 'p'),
  ug('1570172619644-dfd03ed5d881', 'Skin', 'A calm facial ritual', 's'),
  ug('1519014816548-bf5fe059798b', 'Nails', 'Hand-painted detail', 'p'),
  ug('1633681138600-295fcd688876', 'Salon Interior', 'Mirrors in white and gold', 'p'),
  ug('1512496015851-a90fb38ba796', 'Makeup', 'Tools of the craft', 'l'),
  pg(5128273, 'Lashes', 'All smiles after', 'p'),
  ug('1580618672591-eb180b1a973f', 'Hair', 'Blow-dry, round brush', 'l'),
  ug('1590439471364-192aa70c0b53', 'Skin', 'Natural rituals', 'p'),
  ug('1632345031435-8727f6897d53', 'Nails', 'Precision at the station', 'p'),
  ug('1571875257727-256c39da42af', 'Makeup', 'Florals and finishing touches', 's'),
  ug('1560066984-138dadb4c035', 'Salon Interior', 'Light and space', 'l'),
  pg(7755215, 'Hair', 'Curls, cared for', 'p'),
  ug('1612817288484-6f916006741a', 'Skin', 'Botanical skincare', 'p'),
  ug('1610992015732-2449b76344bc', 'Nails', 'Natural nude', 'l'),
  pg(5128263, 'Lashes', 'Consultation first', 'p'),
  ug('1616683693504-3ea7e9ad6fec', 'Makeup', 'Evening red', 'p'),
  ug('1546193430-c2d207739ed7', 'Makeup', 'Bridal hair and veil', 't'),
  ug('1521590832167-7bcbfaa6381f', 'Salon Interior', 'Styling station', 'p'),
];

/** Gallery items for one category (used on each service page). */
export const galleryFor = (cat, limit) => {
  const list = GALLERY_IMAGES.filter((i) => i.cat === cat);
  return limit ? list.slice(0, limit) : list;
};

/** A varied selection for the home page. */
export const FEATURED_GALLERY = [0, 3, 5, 2, 4, 15, 9, 6].map((i) => GALLERY_IMAGES[i]);
