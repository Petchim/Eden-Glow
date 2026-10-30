import { useEffect } from 'react';
import { BUSINESS } from '../config/business.ts';
import { absoluteUrl } from '../config/seo.ts';

const setMeta = (selector: string, attr: string, value: string): void => {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
};

/** Find or create a <meta>/<link> in <head>. */
const headTag = (tag: 'meta' | 'link', key: string, value: string): Element => {
  let el = document.head.querySelector(`${tag}[${key}="${value}"]`);
  if (!el) {
    el = document.createElement(tag);
    el.setAttribute(key, value);
    document.head.appendChild(el);
  }
  return el;
};

/**
 * Page-specific <title>, meta description and share titles. Once BUSINESS.siteUrl is set, the
 * canonical URL and og:url follow the current page (without query strings such as ?service=).
 * `noindex` asks search engines not to list the page (used by the 404 page).
 */
export function usePageMeta(title: string | null | undefined, description?: string, { noindex = false }: { noindex?: boolean } = {}): void {
  useEffect(() => {
    const full = title ? `${title} | ${BUSINESS.name}` : `${BUSINESS.name} — ${BUSINESS.tagline}`;
    document.title = full;
    if (description) {
      setMeta('meta[name="description"]', 'content', description);
      setMeta('meta[property="og:description"]', 'content', description);
      setMeta('meta[name="twitter:description"]', 'content', description);
    }
    setMeta('meta[property="og:title"]', 'content', full);
    setMeta('meta[name="twitter:title"]', 'content', full);

    const url = absoluteUrl(window.location.pathname);
    if (url) {
      headTag('link', 'rel', 'canonical').setAttribute('href', url);
      setMeta('meta[property="og:url"]', 'content', url);
    }
  }, [title, description]);

  useEffect(() => {
    if (!noindex) return undefined;
    const robots = headTag('meta', 'name', 'robots');
    robots.setAttribute('content', 'noindex');
    return () => robots.remove();
  }, [noindex]);
}
