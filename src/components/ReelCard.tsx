import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GalleryImage } from '../types/content.ts';
import Img from './ui/Img.tsx';
import Icon from './ui/Icon.tsx';

/** The page of one imported video: /gallery/reel/ig_<id>. */
export const reelPath = (item: GalleryImage): string => `/gallery/reel/${encodeURIComponent(item.id || '')}`;

/** "1,234 likes" — only for counts Instagram actually returned. */
export const fmtLikes = (n?: number): string => (typeof n === 'number' ? `${n.toLocaleString('en-IN')} like${n === 1 ? '' : 's'}` : '');

export const fmtPostDate = (iso?: string): string => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) && d.getFullYear() > 2000 ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
};

/** Inline hover previews only with a mouse, and never when the visitor prefers reduced motion. */
export function useHoverPreview(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    const update = () => setOk(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return ok;
}

interface ReelCardProps {
  item: GalleryImage;
  index: number;
  /** Open the full-screen viewer; without it the cover links to the reel's page. */
  onOpen?: (index: number) => void;
  preview: boolean;
}

/** A 9:16 reel card: cover (plays a muted preview on hover), Reel badge, category, title and Instagram link. */
export default function ReelCard({ item, index, onOpen, preview }: ReelCardProps) {
  const [playing, setPlaying] = useState(false);
  const label = `${item.isReel ? 'Reel' : 'Video'}: ${item.caption}`;
  const hover = {
    onPointerEnter: () => preview && item.video && setPlaying(true),
    onPointerLeave: () => setPlaying(false),
  };
  const cover = (
    <>
      <Img src={item.src} alt={item.alt || item.caption} sizes="(max-width: 600px) 50vw, (max-width: 1100px) 33vw, 25vw" />
      {/* the file is requested only while the pointer is over the card */}
      {playing && item.video && <video className="reel-preview" src={item.video} muted loop playsInline autoPlay preload="none" aria-hidden="true" tabIndex={-1} />}
      <span className="reel-play" aria-hidden="true"><Icon name="play" size={34} stroke={1} /></span>
      <span className="reel-badge" aria-hidden="true"><Icon name="instagram" size={12} /> {item.isReel ? 'Reel' : 'Video'}</span>
    </>
  );
  return (
    <article className="reel-card">
      {onOpen ? (
        <button type="button" className="reel" onClick={() => onOpen(index)} aria-label={`Play ${label}`} {...hover}>{cover}</button>
      ) : (
        <Link className="reel" to={reelPath(item)} aria-label={`Watch ${label}`} {...hover}>{cover}</Link>
      )}
      <div className="reel-meta">
        <span className="reel-cat">
          {item.cat}
          {typeof item.likeCount === 'number' && <span className="reel-likes"><Icon name="heart" size={12} /> {item.likeCount.toLocaleString('en-IN')}<span className="visually-hidden"> likes on Instagram</span></span>}
        </span>
        <h3 className="reel-title">
          <Link to={reelPath(item)}>{item.caption}</Link>
        </h3>
        {item.permalink && (
          <a className="reel-ig" href={item.permalink} target="_blank" rel="noopener noreferrer" aria-label={`View “${item.caption}” on Instagram (opens in a new tab)`}>
            <Icon name="instagram" size={14} /> View on Instagram
          </a>
        )}
      </div>
    </article>
  );
}
