import { useMemo, useState } from 'react';
import type { GalleryImage, GalleryRatio, GalleryVariant } from '../types/content.ts';
import { GALLERY_CATEGORIES } from '../data/images.ts';
import { useColumns, type Breakpoints } from '../hooks/useColumns.ts';
import Img from './ui/Img.tsx';
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

function Tile({ item, index, onOpen, sizes, forceRatio }: TileProps) {
  return (
    <button
      type="button"
      className="gtile zoom-on-hover"
      style={{ '--i': index, aspectRatio: forceRatio || (item.ratio && RATIO_CSS[item.ratio]) || RATIO_CSS.p }}
      onClick={() => onOpen(index)}
      aria-label={`Open image ${index + 1}: ${item.cat} — ${item.caption}`}
    >
      <Img src={item.src} alt={`${item.cat}: ${item.caption}`} sizes={sizes} />
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
}

export default function GalleryGrid({ items, variant = 'masonry', filters = false, filter: ctrlFilter, onFilter, columns, note = true }: GalleryGridProps) {
  const [ownFilter, setOwnFilter] = useState('All');
  const filter = ctrlFilter ?? ownFilter;
  const setFilter = onFilter ?? setOwnFilter;
  const [active, setActive] = useState(-1);
  const colCount = useColumns(columns);

  const shown = useMemo(
    () => (filter === 'All' ? items : items.filter((g) => g.cat === filter)),
    [items, filter],
  );
  const cols = useMemo(() => toColumns(shown, Math.min(colCount, Math.max(shown.length, 1))), [shown, colCount]);

  return (
    <div className={`ggrid ggrid--${variant}`}>
      {filters && (
        <div className="filters" role="group" aria-label="Filter gallery by category">
          {GALLERY_CATEGORIES.map((f) => {
            const n = f === 'All' ? items.length : items.filter((g) => g.cat === f).length;
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
      {filters && <p className="visually-hidden" aria-live="polite">{`Showing ${shown.length} ${filter === 'All' ? '' : filter} photos`}</p>}

      {variant === 'strip' ? (
        <ul className="gstrip">
          {shown.map((item, i) => (
            <li key={item.src}>
              <Tile item={item} index={i} onOpen={setActive} sizes="(max-width: 700px) 70vw, 20vw" forceRatio="4 / 5" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="gmasonry" key={filter}>
          {cols.map((col, c) => (
            <ul className="gcol" key={c}>
              {col.items.map(({ item, index }) => (
                <li key={item.src}>
                  <Tile item={item} index={index} onOpen={setActive} sizes={`(max-width: 700px) 50vw, ${Math.round(100 / colCount)}vw`} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}

      {note && <p className="fine gallery-note">Images shown are temporary stock photography, used for illustration — not Eden Glow Studio clients or results.</p>}
      {active >= 0 && <Lightbox items={shown} index={active} onChange={setActive} onClose={() => setActive(-1)} />}
    </div>
  );
}
