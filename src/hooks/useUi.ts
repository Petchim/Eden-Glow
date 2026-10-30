import { useEffect, useState, type RefObject } from 'react';

/** true once the page is scrolled past `offset` px. */
export function useScrolled(offset = 24): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset]);
  return scrolled;
}

/* How many dialogs/menus are open; while any are, <body> carries `has-overlay`
   (the mobile booking bar uses it to step out of the way and out of the tab order). */
let overlays = 0;

/** Prevents background scrolling while a dialog/menu is open. */
export function useBodyLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    overlays += 1;
    document.body.classList.add('has-overlay');
    return () => {
      document.body.style.overflow = prev;
      overlays -= 1;
      if (!overlays) document.body.classList.remove('has-overlay');
    };
  }, [locked]);
}

/** Subtle vertical parallax for one element; desktop only, disabled for reduced motion. */
export function useParallax(ref: RefObject<HTMLElement>, strength = 0.08): void {
  useEffect(() => {
    const el = ref.current;
    const still = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 900px), (pointer: coarse)');
    const parentEl = el?.parentElement;
    if (!el || !parentEl || still.matches) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const parent = parentEl.getBoundingClientRect();
      const max = parent.height * 0.05; // never move further than the bleed allows
      const raw = (parent.top + parent.height / 2 - window.innerHeight / 2) * -strength;
      const offset = Math.max(-max, Math.min(max, raw));
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0) scale(1.12)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ref, strength]);
}
