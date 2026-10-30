import { useEffect, useRef, type TouchEvent } from 'react';
import type { GalleryImage } from '../types/content.ts';
import { useBodyLock } from '../hooks/useUi.ts';
import Img from './ui/Img.tsx';
import Icon from './ui/Icon.tsx';

interface LightboxProps {
  items: GalleryImage[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}

export default function Lightbox({ items, index, onChange, onClose }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const item = items[index];
  const go = (d: number) => onChange((index + d + items.length) % items.length);
  useBodyLock(true);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // Warm the cache for the neighbouring photos so prev/next feel instant.
  useEffect(() => {
    [1, -1].forEach((d) => {
      const n = items[(index + d + items.length) % items.length];
      if (n) new Image().src = n.full || n.src;
    });
  }, [index, items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Tab') {
        // keep focus inside the dialog
        const f = dialogRef.current?.querySelectorAll('button');
        if (!f?.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const onTouchStart = (e: TouchEvent) => { touch.current = e.touches[0].clientX; };
  const onTouchEnd = (e: TouchEvent) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) > 50 && items.length > 1) go(dx < 0 ? 1 : -1);
  };

  return (
    <div
      className="lb"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      ref={dialogRef}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button ref={closeRef} type="button" className="lb-btn lb-close" aria-label="Close image viewer" onClick={onClose}><Icon name="close" /></button>
      <figure className="lb-stage" key={index}>
        <div className="lb-img"><Img src={item.full || item.src} alt={`${item.cat}: ${item.caption}`} /></div>
        <figcaption className="lb-meta">
          <span><b>{item.cat}</b> — {item.caption}</span>
          <span aria-live="polite">{index + 1} / {items.length}</span>
        </figcaption>
      </figure>
      {items.length > 1 && (
        <>
          <button type="button" className="lb-btn lb-prev" aria-label="Previous image" onClick={() => go(-1)}><Icon name="arrowLeft" /></button>
          <button type="button" className="lb-btn lb-next" aria-label="Next image" onClick={() => go(1)}><Icon name="arrow" /></button>
        </>
      )}
    </div>
  );
}
