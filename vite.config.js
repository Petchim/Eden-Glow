import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { siteUrl, locationLine } from './src/config/business.js';
import { SHARE_IMAGE, SITE_PATHS, absoluteUrl, homeTitle, localBusinessSchema } from './src/config/seo.js';
import { HOME_IMAGES } from './src/data/images.js';

/* Search-engine and link-preview tags, written into index.html from src/config/business.js.
   Tags that need the live address (canonical, og:url, og:image, sitemap) are only added once
   BUSINESS.siteUrl is set, so a build never points at a made-up domain. */
function siteHead() {
  return {
    name: 'eden-glow-site-head',
    transformIndexHtml(html) {
      const tags = [];
      const meta = (attrs) => tags.push({ tag: 'meta', attrs, injectTo: 'head' });
      const hero = HOME_IMAGES.hero;
      // On the home page, start fetching the hero photo before the app script has run (it is the
      // largest paint). Added by a tiny script so other pages don't download a photo they never show.
      if (hero.srcSet) {
        const set = (k, v) => `l.setAttribute('${k}',${JSON.stringify(v)});`;
        tags.push({
          tag: 'script',
          children: `if(location.pathname==='/'){var l=document.createElement('link');${set('rel', 'preload')}${set('as', 'image')}${set('type', 'image/webp')}${set('imagesrcset', hero.srcSet)}${set('imagesizes', '(max-width: 900px) 100vw, 62vw')}${set('fetchpriority', 'high')}document.head.appendChild(l)}`,
          injectTo: 'head',
        });
      }
      if (siteUrl()) {
        tags.push({ tag: 'link', attrs: { rel: 'canonical', href: absoluteUrl('/') }, injectTo: 'head' });
        meta({ property: 'og:url', content: absoluteUrl('/') });
        meta({ property: 'og:image', content: absoluteUrl(SHARE_IMAGE.path) });
        meta({ property: 'og:image:width', content: String(SHARE_IMAGE.width) });
        meta({ property: 'og:image:height', content: String(SHARE_IMAGE.height) });
        meta({ property: 'og:image:alt', content: SHARE_IMAGE.alt });
        meta({ name: 'twitter:image', content: absoluteUrl(SHARE_IMAGE.path) });
        meta({ name: 'twitter:image:alt', content: SHARE_IMAGE.alt });
      }
      const schema = localBusinessSchema();
      if (schema) {
        tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(schema).replace(/</g, '\\u003c'), injectTo: 'head' });
      }
      const out = locationLine() ? html.replace(/<title>[^<]*<\/title>/, `<title>${homeTitle()}</title>`) : html;
      return { html: out, tags };
    },
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /', 'Disallow: /admin'];
      if (siteUrl()) {
        robots.push('', `Sitemap: ${absoluteUrl('/sitemap.xml')}`);
        const urls = SITE_PATHS.map((p) => `  <url><loc>${absoluteUrl(p)}</loc></url>`).join('\n');
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        });
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${robots.join('\n')}\n` });
    },
  };
}

// `base: '/'` so assets resolve from nested routes such as /hair or /book-appointment.
// If the site is deployed in a sub-folder (e.g. example.com/studio/), set base to '/studio/'
// and pass the same value to <BrowserRouter basename="/studio">.
export default defineConfig({
  plugins: [react(), siteHead()],
  base: '/',
});
