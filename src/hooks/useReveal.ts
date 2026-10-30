import { useEffect, useRef, useState, type RefObject } from 'react';

/** Adds `is-in` once an element scrolls into view (once only). */
export function useReveal<T extends Element = HTMLElement>(
  options: IntersectionObserverInit = { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    }, options);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, inView];
}
