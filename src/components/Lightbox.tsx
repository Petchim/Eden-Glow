import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import { reelPath } from './ReelCard.tsx';
import type { GalleryImage, GallerySlide } from '../types/content.ts';
import { useBodyLock } from '../hooks/useUi.ts';
import Img from './ui/Img.tsx';
import Icon from './ui/Icon.tsx';

interface LightboxProps {
  items: GalleryImage[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
}

const altOf = (item: GalleryImage) => item.alt || `${item.cat}: ${item.caption}`;

/** What the viewer shows right now: the photo/video itself, or one slide of a carousel post. */
function currentSlide(item: GalleryImage, slide: number): GallerySlide {
  if (item.kind === 'carousel' && item.slides?.length) return item.slides[Math.min(slide, item.slides.length - 1)];
  return item.kind === 'video' ? { kind: 'video', src: item.src, video: item.video } : { kind: 'image', src: item.full || item.src };
}

/**
 * Full-screen viewer for photos, videos/Reels and Instagram carousels.
 * Arrows / swipe move through a carousel's slides first, then on to the next post.
 * Videos only start downloading here (never in the grid), with native controls and full-screen.
 */
export default function Lightbox({ items, index, onChange, onClose }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const item = items[index];
  const [slide, setSlide] = useState(0);
  const [failed, setFailed] = useState(false);
  const slides = item.kind === 'carousel' && item.slides && item.slides.length > 1 ? item.slides : null;
  const current = currentSlide(item, slide);
  const go = (d: number) => onChange((index + d + items.length) % items.length);
  /** Next/previous slide inside a carousel, else next/previous post. */
  const step = (d: number) => {
    if (slides && slide + d >= 0 && slide + d < slides.length) setSlide(slide + d);
    else if (items.length > 1) go(d);
  };
  useBodyLock(true);

  useEffect(() => {
    setSlide(0);
  }, [index]);
  useEffect(() => {
    setFailed(false);
  }, [index, slide]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // Warm the cache for the neighbouring photos so prev/next feel instant (covers only, never videos).
  useEffect(() => {
    [1, -1].forEach((d) => {
      const n = items[(index + d + items.length) % items.length];
      if (n && (n.full || n.src)) new Image().src = n.full || n.src;
    });
  }, [index, items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && !(e.target instanceof HTMLVideoElement)) step(1);
      else if (e.key === 'ArrowLeft' && !(e.target instanceof HTMLVideoElement)) step(-1);
      else if (e.key === 'Tab') {
        // keep focus inside the dialog
        const f = dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href], video[controls]');
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

  const onTouchStart = (e: TouchEvent) => {
    // swiping on a video's controls scrubs the video, not the gallery
    touch.current = (e.target as HTMLElement).closest('video') ? null : e.touches[0].clientX;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  };

  const isVideo = current.kind === 'video';
  const playable = isVideo && !!current.video && !failed;
  const showFallback = item.permalink && (failed || (isVideo && !current.video));
  const many = items.length > 1 || !!slides;

  return (
    <div
      className="lb"
      role="dialog"
      aria-modal="true"
      aria-label={item.source === 'instagram' ? 'Instagram post viewer' : 'Image viewer'}
      ref={dialogRef}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button ref={closeRef} type="button" className="lb-btn lb-close" aria-label="Close viewer" onClick={onClose}><Icon name="close" /></button>
      <figure className="lb-stage" key={`${index}-${slide}`}>
        <div className={`lb-img ${isVideo ? 'lb-img--video' : ''}`}>
          {playable ? (
            <video
              className="lb-video"
              src={current.video}
              poster={current.src || undefined}
              controls
              playsInline
              autoPlay
              preload="metadata"
              aria-label={altOf(item)}
              onError={() => setFailed(true)}
            />
          ) : (
            <Img src={current.src} alt={altOf(item)} onFail={() => setFailed(true)} />
          )}
          {showFallback && (
            <div className="lb-fallback">
              {isVideo && <Icon name="play" size={40} stroke={1} />}
              <p>{isVideo ? 'This video plays on Instagram.' : 'This post is available on Instagram.'}</p>
              <a className="btn btn--gold" href={item.permalink} target="_blank" rel="noopener noreferrer">
                <Icon name="instagram" size={16} /> {isVideo ? 'Watch on Instagram' : 'View on Instagram'}
              </a>
            </div>
          )}
        </div>
        <figcaption className="lb-meta">
          <span><b>{item.cat}</b> — {item.caption}</span>
          <span className="lb-meta-side">
            {item.source === 'instagram' && item.kind === 'video' && item.id && (
              <Link className="lb-ig" to={reelPath(item)}>Reel page <Icon name="arrow" size={14} /></Link>
            )}
            {item.permalink && !showFallback && (
              <a className="lb-ig" href={item.permalink} target="_blank" rel="noopener noreferrer" aria-label="View this post on Instagram (opens in a new tab)">
                <Icon name="instagram" size={15} /> Instagram
              </a>
            )}
            <span aria-live="polite">
              {slides ? `${index + 1} / ${items.length} · slide ${slide + 1} of ${slides.length}` : `${index + 1} / ${items.length}`}
            </span>
          </span>
        </figcaption>
        {slides && (
          <div className="lb-dots" aria-hidden="true">
            {slides.map((s, i) => <span key={`${s.src}-${i}`} className={i === slide ? 'is-on' : ''} />)}
          </div>
        )}
      </figure>
      {many && (
        <>
          <button type="button" className="lb-btn lb-prev" aria-label={slides && slide > 0 ? 'Previous slide' : 'Previous'} onClick={() => step(-1)}><Icon name="arrowLeft" /></button>
          <button type="button" className="lb-btn lb-next" aria-label={slides && slide < slides.length - 1 ? 'Next slide' : 'Next'} onClick={() => step(1)}><Icon name="arrow" /></button>
        </>
      )}
    </div>
  );
}
