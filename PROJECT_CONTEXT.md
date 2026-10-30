# Eden Glow Studio — Project Context

> Context file for a Claude Project. It describes the codebase, its conventions and its
> content rules so Claude can help build and edit the site without re-reading every file.
> Last updated: 2026-10-28.

## 1. What this is

A marketing website for **Eden Glow Studio**, a beauty studio offering **Hair, Skin, Nails,
Lashes, Makeup** and a training **Academy**. Tagline: **"Look Good. Feel Good. Be You."**

- **Frontend only.** There is no backend, database, API or CMS.
- **Enquiries, not bookings.** Booking, contact and academy forms build a message and hand it
  to WhatsApp (or email, or a copy-to-clipboard fallback). The site never claims a booking is
  confirmed; the studio confirms by reply.
- **Content is data-driven.** Nearly all wording, images and treatment lists live in
  `src/data/*.ts` and `src/config/business.ts`; components just render them.
- **Tone:** premium, calm, editorial, feminine. Rose / burgundy / champagne-gold palette,
  serif headlines, script accents, fine line-art florals.

## 2. Tech stack

| Area | Choice |
| --- | --- |
| Framework | React 18.3 (function components + hooks, plain `.jsx`, no TypeScript) |
| Build | Vite 5 (`@vitejs/plugin-react`), `base: '/'` |
| Routing | React Router 6 (`BrowserRouter`, nested routes under one `Layout`) |
| Styling | Plain CSS, three global files, CSS custom properties as design tokens. No Tailwind, no CSS-in-JS, no CSS modules |
| Fonts | Google Fonts: Cormorant Garamond (serif), Jost (sans), Pinyon Script (script) |
| Dependencies | Only `react`, `react-dom`, `react-router-dom`. No UI library, no animation library, no form library |
| Tests / lint | None configured |
| Hosting | Static. SPA fallbacks for Netlify/Cloudflare (`public/_redirects`), Vercel (`vercel.json`), Apache (`public/.htaccess`) |

Commands: `npm run dev` (localhost:5173), `npm run build` (→ `dist/`), `npm run preview`.

## 3. Folder structure

```
index.html                 Fonts, default <title>/meta, #root
vite.config.ts
public/
  images/home/             Local home-page photos (jpg) — hero, service cards, gallery, signature, CTA
  favicon.svg  _redirects  .htaccess
src/
  main.tsx                 BrowserRouter + imports base.css, sections.css, pages.css
  App.tsx                  Routes; every page except Home is React.lazy + Suspense
  config/business.ts       BUSINESS details (WhatsApp, phone, email, address, hours, maps, IG) + link helpers
  data/
    content.ts             NAV, MAIN_NAV, bookLink(), SERVICES (home cards), BOOKING_SERVICES,
                           ABOUT, HERO_FEATURES, EXPERIENCE_FEATURES, SIGNATURE, WHY, TESTIMONIALS
    services.ts            SERVICE_PAGES {hair, skin, nails, lashes} + MAKEUP_PAGE
    academy.ts             ACADEMY (all course details are placeholders)
    images.ts              Every image (src, alt, position) grouped by page; GALLERY_IMAGES, galleryFor()
    searchIndex.ts         SEARCH_INDEX built from existing content + searchSite(query)
  hooks/
    usePageMeta.ts         Sets document.title + meta description/og tags per page
    useReveal.ts           IntersectionObserver → adds is-in once (scroll reveal)
    useColumns.ts          Responsive column count for masonry gallery
    useUi.ts               useScrolled, useBodyLock, useParallax
  utils/enquiry.ts         Validation (checkName/Phone/Email), date/time formatting, sendEnquiry()
  components/
    layout/Layout.tsx      Skip link, Header, <main> with focus management, Outlet, Footer
    Header.tsx             Sticky header; desktop "Services" dropdown; mobile menu; lazy SearchDialog
    Footer.tsx  Brand.tsx
    SearchDialog.tsx       Site search modal (lazy-loaded)
    PageHero.tsx           Inner-page hero with variants (arch / split / framed / full …)
    ServicePage.tsx        Shared template for Hair/Skin/Nails/Lashes, ordered by `order` array
    ServiceSections.tsx    Intro, Offerings, Info, GallerySection building blocks
    BookingForm.tsx        Appointment enquiry form (service → treatment, date, time)
    EnquiryForm.tsx        Contact / academy enquiry form
    forms/Field.tsx  forms/EnquiryResult.tsx
    GalleryGrid.tsx  Lightbox.tsx  Faq.tsx  CtaBand.tsx  ContactDetails.tsx
    home/                  Hero, Services, Signature, Gallery, BookingCta (used on Home)
                           About, AcademyTeaser, Testimonials, Why, Ribbon (exist but NOT currently used)
    ui/
      Button.tsx           One button for `to` (Link), `href` (a), or <button>; variant 'gold' | 'line'; `arrow`, `icon`
      Img.tsx              Fade-in image, lazy by default, `priority` for hero, `position`, branded fallback on error
      Icon.tsx             Inline SVG icon set (see §7)
      SectionTitle.tsx     Eyebrow + h2 with per-line reveal; exports Accent
      Reveal.tsx           Scroll reveal wrapper; variant 'rise' | 'fade' | 'curtain'; `delay` ms
      Floral.tsx  Leaf.tsx Decorative line-art SVGs (currentColor)
  pages/
    Home.tsx               Hero → Services → Signature → Gallery → BookingCta
    Hair/Skin/Nails/Lashes.tsx   6-line wrappers: <ServicePage service={SERVICE_PAGES.x} />
    Makeup.tsx  Academy.tsx  Gallery.tsx  Contact.tsx  BookAppointment.tsx  NotFound.tsx
  styles/
    base.css               Tokens (:root), dark-surface remap, typography, buttons, shared components
    sections.css           Header, footer, home page sections
    pages.css              Inner pages (service pages, gallery, contact, academy, forms)
```

## 4. Routes

| Path | Page | Notes |
| --- | --- | --- |
| `/` | Home | Eager-loaded |
| `/hair` `/skin` `/nails` `/lashes` | ServicePage | Content from `SERVICE_PAGES` |
| `/makeup` | Makeup | Bridal + occasion, from `MAKEUP_PAGE` |
| `/academy` | Academy | Placeholder courses + training enquiry |
| `/gallery` | Gallery | `?category=Nails` filter, lightbox |
| `/contact` | Contact | Details, map embed, enquiry form |
| `/book-appointment` | BookAppointment | `?service=Hair&treatment=Hair%20colouring` pre-fills; build links with `bookLink(service, treatment)` |
| `*` | NotFound | |

`Layout` scrolls to top (or `#hash`) on navigation and moves focus to `<main>` for screen readers.

## 5. Key data shapes

**Image object** (used everywhere): `{ src, alt, position? }` — `position` is CSS
`object-position` (e.g. `'50% 35%'`). Gallery items add `cat`, `caption`, `full`.

**Title lines:** arrays of strings; wrap a word in `*asterisks*` to render it as gold italic
via `<Accent>`. Example: `title: ['Hair that feels', 'like *you.*']`.

**Service page** (`SERVICE_PAGES.hair` etc.):
```js
{
  slug, name, booking,            // booking = value in BOOKING_SERVICES
  confirmed: false,               // while false, shows "treatments subject to confirmation"
  meta: { title, description },
  order: ['intro', 'offerings', 'gallery', 'faqs', 'cta'],   // sections & their order
  hero: { variant, eyebrow, title: [...], text, image },
  intro: { eyebrow, title, paragraphs: [...], image },
  offerings: { variant, eyebrow, title, items: [{ title, text, includes: [...], image }] },
  info?, gallery?, faqs: [{ q, a }], cta: { label, ... }
}
```
Offering item titles double as the treatment options in `BookingForm` (`TREATMENTS`) and as
search entries in `searchIndex.ts` — renaming one updates all three.

**Business config** (`BUSINESS`): `whatsappNumber` (digits only, intl format), `phone`,
`phoneDisplay`, `email`, `address[]`, `hours[{days,time}]`, `googleMapsUrl`,
`googleMapsEmbedUrl`, `studioVideoUrl`, `instagramUrl`, `instagramHandle`.
Helpers: `hasWhatsApp()`, `hasPhone()`, `hasEmail()`, `waLink(text)`, `telLink()`, `mailLink()`.
**All are currently empty (TODO).** Empty values show labelled placeholders and hide the
related button.

## 6. Enquiry flow

1. Form validates in the browser (`utils/enquiry.ts`): name ≥ 2 chars, phone 8–15 digits,
   date not in the past, time not already passed today.
2. A plain-text message is built (`buildMessage`).
3. `sendEnquiry(message, subject)` picks a channel via `enquiryChannel()`:
   `whatsapp` → opens `wa.me` in a new tab; else `email` → `mailto:`; else `copy` → shows the
   message with a Copy button (`EnquiryResult`).
4. Wording always says "enquiry / request", never "booked" or "confirmed".

## 7. Design system

**Tokens (in `src/styles/base.css` `:root`):**

| Token | Value | Use |
| --- | --- | --- |
| `--blush` | `#fbe9e3` | Page background (`--paper`) |
| `--ivory` | `#fff7f2` | Alternate section (`--paper-2`) |
| `--burgundy` / `--wine` | `#7a1830` / `#8f203a` | Accent / hover |
| `--rose` | `#d995a1` | Soft accent |
| `--champagne` | `#d6a35d` | Gold; accent on dark surfaces |
| `--charcoal` | `#351c1b` | Primary text |
| `--decor` | `#b87932` | Gold icons/borders (not small text) |
| `--body` / `--muted` | `#543b39` / `#684b48` | Paragraphs / secondary text |

Use the **role** tokens (`--paper`, `--text`, `--accent`, `--body`, `--muted`, `--line`,
`--decor`…) in CSS, not raw colours. Dark surfaces (`.tone-dark`, `.phero--full`, `.lb`)
remap those roles, so components placed inside adapt automatically.

Fonts: `--serif` (Cormorant Garamond — headlines), `--sans` (Jost — body/UI),
`--script` (Pinyon Script — decorative accents).
Layout: `--wrap: 1320px`, `--gutter: clamp(20px, 5vw, 56px)`, `--section: clamp(68px, 7.5vw, 112px)`,
header height `--header-top: 96px` (76px when scrolled).
Easing: `--ease`, `--ease-io`.

Main breakpoints (max-width): **900px** (tablet/mobile switch), **600px**, plus 1000/760/700/560/520.
Motion is wrapped in `prefers-reduced-motion: no-preference`; parallax is disabled on touch,
≤ 900px and reduced motion.

**Icons** (`<Icon name=… />`): arrow, close, menu, search, chevron, whatsapp, phone, pin,
clock, instagram, copy, check, heart, sparkle, leaf, calendar, shield, tools, user, play.

## 8. Coding conventions

- Function components, default export per file; small helpers as named exports.
- File headers / comments are short `/* … */` or `/** … */` explaining *why*, matching existing density.
- Class names: lowercase, hyphenated, BEM-ish modifiers with `--` (`btn btn--gold`, `intro-grid--flip`,
  `stitle--left`). State classes: `is-in`, `is-loaded`, `is-open`.
- Section markup pattern: `<section className="section x" aria-labelledby="…">` → `<div className="wrap …">`
  → `<SectionTitle eyebrow lines id />` + content wrapped in `<Reveal>`.
- Always use `<Img>` for photos (never raw `<img>`), `<Button>` for CTAs, `usePageMeta(title, description)`
  at the top of every page.
- Keep content in `src/data/`; components should not hard-code copy.
- New pages: add a lazy import + route in `App.tsx`, a `NAV` entry in `content.ts`, and they
  appear in search automatically if they're in `NAV`.
- Accessibility is a priority: skip link, focus management, `aria-*` on menus/dialogs,
  Escape closes overlays, `useBodyLock` while modals are open, meaningful `alt` text,
  contrast ratios noted in token comments.
- Performance: non-home pages and SearchDialog are lazy-loaded; images lazy-load except
  `priority` hero; home images are stored locally and optimised (~270 KB hero).

## 9. Content rules (important — do not break)

- **Never invent facts:** no fake addresses, phone numbers, prices, founder names, years,
  awards, certifications, course fees/durations, or testimonials.
- Unknown values stay as visible `[square-bracket placeholders]` or empty config fields.
- `TESTIMONIALS` stays empty until there is genuine client feedback with permission.
- Treatment lists are a **proposed** menu (`confirmed: false`) until the studio confirms.
- Academy courses are placeholders ("Details coming soon").
- Most non-home photos are **temporary stock** (Unsplash / Pexels URLs via `u()` / `p()` helpers
  in `images.ts`) and are labelled as such in galleries. To use real photos: put files in
  `public/images/` and set `src: '/images/…'`.

## 10. Current state (as of 2026-10-28)

- Uncommitted work in progress on `main`: home page redesign (Hero, Services, Signature,
  new Gallery and BookingCta sections, Floral line-art), new SearchDialog + searchIndex,
  local home images in `public/images/home/`, large CSS updates.
- Home page uses: Hero → Services → Signature → Gallery → BookingCta. About, AcademyTeaser,
  Testimonials, Why and Ribbon components still exist but are not rendered.
- Hero image already contains its own "Beauty is a feeling" script and blossoms
  (`artInImage: true`), so the hero skips its overlay text and florals.
- Business details (WhatsApp, phone, address, hours, maps, Instagram) are all still TODO.
- No tests, linter or TypeScript.

## 11. How to ask Claude for help on this project

When requesting changes, it helps to paste the relevant file(s) — e.g. the component, its
data file and the CSS section — since Claude in a Project only sees what's uploaded.
Expected output: code that matches the conventions above (plain JSX, plain CSS with tokens,
content in `src/data/`), accessible, responsive at 900px / 600px, and honest about placeholders.
