import { useEffect } from 'react';
import { BUSINESS } from '../config/business.js';

const setMeta = (selector, attr, value) => {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
};

/** Page-specific <title> and meta description. */
export function usePageMeta(title, description) {
  useEffect(() => {
    const full = title ? `${title} | ${BUSINESS.name}` : `${BUSINESS.name} — ${BUSINESS.tagline}`;
    document.title = full;
    if (description) {
      setMeta('meta[name="description"]', 'content', description);
      setMeta('meta[property="og:description"]', 'content', description);
    }
    setMeta('meta[property="og:title"]', 'content', full);
  }, [title, description]);
}
