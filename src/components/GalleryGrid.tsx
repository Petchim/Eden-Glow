import { useMemo, useState, type ReactNode } from 'react';
import type { GalleryImage, GalleryRatio, GalleryVariant } from '../types/content.ts';
import { GALLERY_CATEGORIES, REELS_FILTER } from '../data/images.ts';
import { useColumns, type Breakpoints } from '../hooks/useColumns.ts';
import Img from './ui/Img.tsx';
import Icon from './ui/Icon.tsx';
import Lightbox from './Lightbox.tsx';

const RATIO_H: Record<GalleryRatio, number> = { p: 1.25, t: 1.5, s: 1, l: 0.75 }; // height ÷ width
const RATIO_CSS: Record<GalleryRatio, string> = { p: '4 / 5', t: '2 / 3', s: '1 / 1', l: '4 / 3' };

interface Placed {
  item: GalleryImage;
  /** Position in the full list, so the lightbox opens on the right photo. */
  index: number;
}

/* Places each photo in the currently shortest column, so the reading order stays left → right. */
function toColumns(items: GalleryImage[], count: number) {
  const cols = Array.from({ length: count }, () => ({ h: 0, items: [] as Placed[] }));
  items.forEach((item, index) => {
    const col = cols.reduce((a, b) => (b.h < a.h ? b : a));
    col.items.push({ item, index });
    col.h += (item.ratio && RATIO_H[item.ratio]) || 1.25;
  });
  return cols;
}

interface TileProps extends Placed {
  onOpen: (index: number) => void;
  sizes: string;
  forceRatio?: string;
}

/** 'All', a category, or the Instagram Reels filter (every imported video). */
export const matchesFilter = (g: GalleryImage, filter: string): boolean =>
  filter === 'All' || (filter === REELS_FILTER ? g.kind === 'video' && g.source === 'instagram' : g.cat === filter);

/** Stable React key: Instagram posts have an id, stock photos a unique src. */
export const itemKey = (item: GalleryImage): string => item.id || item.src;
export const itemAlt = (item: GalleryImage): string => item.alt || `${item.cat}: ${item.caption}`;

function Tile({ item, index, onOpen, sizes, forceRatio }: TileProps) {
  const video = item.kind === 'video';
  const what = video ? (item.isReel ? 'Play reel' : 'Play video') : item.kind === 'carousel' ? 'Open post' : 'Open image';
  return (
    <button
      type="button"
      className={`gtile zoom-on-hover ${video ? 'gtile--video' : ''}`}
      style={{ '--i': index, aspectRatio: forceRatio || (item.ratio && RATIO_CSS[item.ratio]) || RATIO_CSS.p }}
      onClick={() => onOpen(index)}
      aria-label={`${what} ${index + 1}: ${item.cat} — ${item.caption}${item.featured ? ' (featured)' : ''}`}
    >
      <Img src={item.src} alt={itemAlt(item)} sizes={sizes} />
      {video && <span className="gtile-play" aria-hidden="true"><Icon name="play" size={26} stroke={1.1} /></span>}
      {(item.source === 'instagram' || item.featured) && (
        <span className="gtile-badges" aria-hidden="true">
          {item.featured && <span className="gtile-badge gtile-badge--feat"><Icon name="sparkle" size={13} /></span>}
          {item.kind === 'carousel' && <span className="gtile-badge"><Icon name="copy" size={13} /></span>}
          {item.source === 'instagram' && <span className="gtile-badge"><Icon name="instagram" size={13} /></span>}
        </span>
      )}
      <span className="gtile-cap" aria-hidden="true"><b>{item.cat}</b>{item.caption}</span>
    </button>
  );
}

/**
 * Photo grid + lightbox.
 *  variant 'masonry' — responsive masonry columns (default)
 *  variant 'strip'   — one even row of square close-ups (scrolls sideways on phones)
 *  `filters` shows category buttons; pass `filter`/`onFilter` to control them (e.g. from the URL).
 */
interface GalleryGridProps {
  items: GalleryImage[];
  variant?: GalleryVariant;
  filters?: boolean;
  /** Controlled category filter (e.g. from the URL); uncontrolled when omitted. */
  filter?: string;
  onFilter?: (category: string) => void;
  columns?: Breakpoints;
  note?: boolean;
  /** Shown under the grid, above the note (e.g. "Load more"). */
  after?: ReactNode;
}

export default function GalleryGrid({ items, variant = 'masonry', filters = false, filter: ctrlFilter, onFilter, columns, note = true, after }: GalleryGridProps) {
  const [ownFilter, setOwnFilter] = useState('All');
  const filter = ctrlFilter ?? ownFilter;
  const setFilter = onFilter ?? setOwnFilter;
  const [active, setActive] = useState(-1);
  const colCount = useColumns(columns);

  const shown = useMemo(() => items.filter((g) => matchesFilter(g, filter)), [items, filter]);
  const cols = useMemo(() => toColumns(shown, Math.min(colCount, Math.max(shown.length, 1))), [shown, colCount]);
  const hasStock = shown.some((g) => g.source !== 'instagram');
  const hasInstagram = shown.some((g) => g.source === 'instagram');

  return (
    <div className={`ggrid ggrid--${variant}`}>
      {filters && (
        <div className="filters" role="group" aria-label="Filter gallery by category">
          {GALLERY_CATEGORIES.map((f) => {
            const n = items.filter((g) => matchesFilter(g, f)).length;
            return (
              <button
                key={f}
                type="button"
                className={`filter ${filter === f ? 'is-on' : ''}`}
                aria-pressed={filter === f}
                onClick={() => {
                  setFilter(f);
                  setActive(-1);
                }}
              >
                {f}<span className="filter-n" aria-hidden="true">{n}</span>
              </button>
            );
          })}
        </div>
      )}
      {filters && <p className="visually-hidden" aria-live="polite">{`Showing ${shown.length} ${filter === 'All' ? '' : filter} ${hasInstagram ? 'photos and videos' : 'photos'}`}</p>}

      {shown.length === 0 ? (
        <p className="gempty">
          {filter === REELS_FILTER ? 'Reels from our Instagram will appear here soon.' : `New ${filter.toLowerCase()} work is on its way. Take a look at another category in the meantime.`}
        </p>
      ) : variant === 'strip' ? (
        <ul className="gstrip">
          {shown.map((item, i) => (
            <li key={itemKey(item)}>
              <Tile item={item} index={i} onOpen={setActive} sizes="(max-width: 700px) 70vw, 20vw" forceRatio="4 / 5" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="gmasonry" key={filter}>
          {cols.map((col, c) => (
            <ul className="gcol" key={c}>
              {col.items.map(({ item, index }) => (
                <li key={itemKey(item)}>
                  <Tile item={item} index={index} onOpen={setActive} sizes={`(max-width: 700px) 50vw, ${Math.round(100 / colCount)}vw`} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}

      {after}
      {note && hasStock && (
        <p className="fine gallery-note">
          {hasInstagram
            ? 'Posts marked with the Instagram icon are from Eden Glow Studio’s Instagram. Other images are temporary stock photography, used for illustration — not Eden Glow Studio clients or results.'
            : 'Images shown are temporary stock photography, used for illustration — not Eden Glow Studio clients or results.'}
        </p>
      )}
      {active >= 0 && <Lightbox items={shown} index={active} onChange={setActive} onClose={() => setActive(-1)} />}
    </div>
  );
}
