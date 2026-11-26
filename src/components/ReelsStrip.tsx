import { useState } from 'react';
import type { GalleryImage } from '../types/content.ts';
import { BUSINESS, hasInstagram } from '../config/business.ts';
import Icon from './ui/Icon.tsx';
import Reveal from './ui/Reveal.tsx';
import SectionTitle from './ui/SectionTitle.tsx';
import Lightbox from './Lightbox.tsx';
import ReelCard, { useHoverPreview } from './ReelCard.tsx';

const SHOWN = 8;

/**
 * "Reels from the studio": the published Instagram videos as an even grid of 9:16 cards
 * (4 across on desktop, 2 on phones). Tapping a cover opens the full-screen viewer; the title
 * opens the reel's own page. `onSeeAll` switches the gallery below to the Instagram Reels filter.
 */
export default function ReelsStrip({ items, onSeeAll }: { items: GalleryImage[]; onSeeAll?: () => void }) {
  const [active, setActive] = useState(-1);
  const preview = useHoverPreview();
  if (!items.length) return null;
  const shown = items.slice(0, SHOWN);
  return (
    <section className="reels" aria-labelledby="reels-title">
      <div className="reels-head">
        <SectionTitle eyebrow="From our Instagram" lines={['Reels from', '*the studio.*']} id="reels-title" />
        <Reveal delay={100} className="reels-links">
          {onSeeAll && items.length > 1 && (
            <button type="button" className="tlink" onClick={onSeeAll}>
              <span>All reels</span><Icon name="arrow" />
            </button>
          )}
          {hasInstagram() && (
            <a className="tlink" href={BUSINESS.instagramUrl} target="_blank" rel="noopener noreferrer">
              <span>{BUSINESS.instagramHandle || 'Follow on Instagram'}</span><Icon name="arrow" />
            </a>
          )}
        </Reveal>
      </div>
      <ul className="reels-grid">
        {shown.map((item, i) => (
          <li key={item.id || item.src}>
            <ReelCard item={item} index={i} onOpen={setActive} preview={preview} />
          </li>
        ))}
      </ul>
      {active >= 0 && <Lightbox items={shown} index={active} onChange={setActive} onClose={() => setActive(-1)} />}
    </section>
  );
}
