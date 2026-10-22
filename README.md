# Eden Glow Studio — website

React + Vite + React Router, plain CSS, no backend. Look Good. Feel Good. Be You.

## Run it

```bash
npm install
npm run dev      # local preview at http://localhost:5173
npm run build    # production build in /dist (upload this folder to your host)
npm run preview  # test the production build locally
```

## Pages

| Route | Page |
| --- | --- |
| `/` | Home |
| `/hair` `/skin` `/nails` `/lashes` | Service pages (one shared layout, content from `data/services.js`) |
| `/makeup` | Makeup artistry (bridal, occasion, enquiry) |
| `/academy` | Academy (course placeholders + training enquiry form) |
| `/gallery` | Full gallery — filters (`/gallery?category=Nails`) + lightbox |
| `/contact` | Contact details, map, enquiry form |
| `/book-appointment` | Appointment enquiry (`?service=Hair&treatment=Hair%20colouring` pre-fills it) |
| anything else | 404 page |

## Where to edit things

| What | File |
| --- | --- |
| WhatsApp, phone, email, address, hours, Google Maps, Instagram | `src/config/business.js` |
| All photos (temporary stock — replace with your own) | `src/data/images.js` |
| Hair / Skin / Nails / Lashes / Makeup page content, treatments, FAQs | `src/data/services.js` |
| Academy courses, fees, durations (placeholders) | `src/data/academy.js` |
| Navigation, home page wording, testimonials | `src/data/content.js` |
| Colours, fonts, buttons | `src/styles/base.css` (tokens at the top) |
| Layout styles | `src/styles/sections.css` (header, home), `src/styles/pages.css` (inner pages) |

### Using your own photos
Put images in `public/images/` and set e.g. `src: '/images/hair-hero.jpg'` in `src/data/images.js`
(for gallery items set both `src` and `full`). If an image fails to load, the site shows a branded
gold-leaf panel instead of a broken image.

### Enquiries (booking, contact, academy)
There is no backend or database. Forms are validated in the browser and then:
1. open WhatsApp with a ready-written message, if `whatsappNumber` is set; otherwise
2. open the visitor's email app, if `email` is set; otherwise
3. show the prepared message with a Copy button.

Nothing is ever presented as a confirmed or saved booking — the studio confirms by reply.

### Testimonials
Add only genuine feedback (with permission) to `TESTIMONIALS` in `src/data/content.js`.

## Hosting (direct links & refresh)
The site uses real URLs (`/hair`, `/contact` …), so the host must serve `index.html` for unknown paths.
This is already configured for the common hosts:

- **Netlify / Cloudflare Pages:** `public/_redirects` (copied into `dist/`)
- **Vercel:** `vercel.json`
- **Apache / cPanel / Hostinger:** `public/.htaccess` (copied into `dist/`)
- **Nginx:** add `try_files $uri /index.html;` to the site's `location /` block.

If the site lives in a sub-folder (e.g. `example.com/studio/`), set `base: '/studio/'` in
`vite.config.js` and `<BrowserRouter basename="/studio">` in `src/main.jsx`.
