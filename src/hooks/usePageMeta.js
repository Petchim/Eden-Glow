import { useEffect } from 'react';
import { BUSINESS } from '../config/business.js';
import { absoluteUrl } from '../config/seo.js';

const setMeta = (selector, attr, value) => {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
};

/** Find or create a <meta>/<link> in <head>. */
const headTag = (tag, key, value) => {
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
export function usePageMeta(title, description, { noindex = false } = {}) {
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
