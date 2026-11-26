import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { GalleryImage } from '../types/content.ts';
import { BOOK_PATH, bookLink } from '../data/content.ts';
import { REELS_FILTER } from '../data/images.ts';
import { firebaseConfigured } from '../lib/firebaseConfig.ts';
import { cacheConfigured } from '../lib/galleryCache.ts';
import { usePageMeta } from '../hooks/usePageMeta.ts';
import CtaBand from '../components/CtaBand.tsx';
import ReelCard, { fmtLikes, fmtPostDate, useHoverPreview } from '../components/ReelCard.tsx';
import Img from '../components/ui/Img.tsx';
import Icon from '../components/ui/Icon.tsx';
import Reveal from '../components/ui/Reveal.tsx';
import { Accent } from '../components/ui/SectionTitle.tsx';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ok'; item: GalleryImage; related: GalleryImage[] };

/** Treatments the booking form knows; a reel in one of these categories pre-fills it. */
const BOOKABLE = ['Hair', 'Skin', 'Nails', 'Lashes', 'Makeup'];

/**
 * One Instagram Reel or video on its own page: large vertical player, title, caption, category,
 * date, Instagram link, related reels and a booking CTA. Engagement numbers are not shown: the
 * read-only Instagram permission used by the studio doesn't provide them, and none are invented.
 */
export default function ReelDetail() {
  const { id = '' } = useParams();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const preview = useHoverPreview();

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    setFailed(false);
    if (!cacheConfigured() && !firebaseConfigured()) {
      setState({ status: 'missing' });
      return undefined;
    }
    (async (): Promise<State> => {
      let item: GalleryImage | null = null;
      let nearby: GalleryImage[] = [];
      // 1. the Worker's cache (no Firestore reads)
      if (cacheConfigured()) {
        try {
          ({ item, nearby } = await (await import('../lib/galleryCache.ts')).findInCache(id));
        } catch {
          /* fall back below */
        }
      }
      // 2. an older post (or no cache): one Firestore read
      if (!item && firebaseConfigured()) {
        const fs = await import('../lib/publicGallery.ts');
        item = await fs.getPublishedMedia(id);
        if (item && !nearby.length) nearby = (await fs.listVideos(16)).items;
      }
      if (!item) return { status: 'missing' };
      const found = item;
      const videos = nearby.filter((v, i, all) => v.kind === 'video' && v.id !== found.id && all.findIndex((x) => x.id === v.id) === i);
      // same category first, then the newest of the rest
      const related = [...videos.filter((v) => v.cat === found.cat), ...videos.filter((v) => v.cat !== found.cat)].slice(0, 4);
      return { status: 'ok', item: found, related };
    })()
      .then((s) => live && setState(s))
      .catch((e: unknown) => {
        console.warn('[reel] could not be loaded', e);
        if (live) setState({ status: 'error' });
      });
    return () => {
      live = false;
    };
  }, [id, attempt]);

  const item = state.status === 'ok' ? state.item : null;
  usePageMeta(
    item ? `${item.caption} — ${item.isReel ? 'Reel' : 'Video'}` : 'Reel',
    item ? `${item.cat} ${item.isReel ? 'reel' : 'video'} from Eden Glow Studio’s Instagram: ${item.caption}` : 'A reel from Eden Glow Studio’s Instagram.',
    { noindex: state.status === 'missing' },
  );

  const crumbs = (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        <li><Link to="/">Home</Link></li>
        <li><Link to="/gallery">Gallery</Link></li>
        <li><Link to={`/gallery?category=${encodeURIComponent(REELS_FILTER)}`}>Reels</Link></li>
        {item && <li aria-current="page">{item.caption}</li>}
      </ol>
    </nav>
  );

  if (state.status !== 'ok' || !item) {
    return (
      <section className="section rdetail rdetail--empty" aria-live="polite">
        <div className="wrap">
          {crumbs}
          {state.status === 'loading' ? (
            <div className="rdetail-skeleton" aria-busy="true"><span /><span /></div>
          ) : (
            <div className="rdetail-missing">
              <h1 className="h2"><Accent text={state.status === 'error' ? 'Couldn’t load this *reel.*' : 'This reel isn’t *here.*'} /></h1>
              <p className="lede">{state.status === 'error' ? 'Please check your connection and try again.' : 'It may have been removed from our Instagram or from the gallery.'}</p>
              <div className="rdetail-actions">
                {state.status === 'error' && <button type="button" className="btn btn--gold" onClick={() => setAttempt((n) => n + 1)}>Try again</button>}
                <Link className="btn btn--line" to="/gallery">Back to the gallery</Link>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  const date = fmtPostDate(item.takenAt);
  const playable = !!item.video && !failed;
  const book = BOOKABLE.includes(item.cat) ? bookLink(item.cat) : BOOK_PATH;

  return (
    <>
      <section className="section rdetail" aria-labelledby="reel-title">
        <div className="wrap">
          <div className="rdetail-top">
            {crumbs}
            <Link className="tlink rdetail-back" to={`/gallery?category=${encodeURIComponent(REELS_FILTER)}`}><Icon name="arrowLeft" /><span>All reels</span></Link>
          </div>

          <div className="rdetail-grid">
            <Reveal variant="fade" className="rdetail-media">
              {playable ? (
                <video className="rdetail-video" src={item.video} poster={item.src || undefined} controls playsInline preload="metadata" aria-label={item.alt || item.caption} onError={() => setFailed(true)} />
              ) : (
                <div className="rdetail-fallback">
                  <Img src={item.src} alt={item.alt || item.caption} />
                  {item.permalink && (
                    <a className="rdetail-fallback-cta" href={item.permalink} target="_blank" rel="noopener noreferrer">
                      <Icon name="play" size={44} stroke={1} />
                      <span>Watch on Instagram</span>
                    </a>
                  )}
                </div>
              )}
            </Reveal>

            <div className="rdetail-info">
              <p className="eyebrow rdetail-meta">
                <span>{item.cat}</span>
                {date && <><span aria-hidden="true">·</span><time dateTime={item.takenAt}>{date}</time></>}
              </p>
              <h1 className="rdetail-title" id="reel-title">{item.caption}</h1>
              <ul className="rdetail-tags" aria-label="About this video">
                <li><Icon name="instagram" size={13} /> Instagram {item.isReel ? 'Reel' : 'video'}</li>
                <li>9:16 vertical</li>
                <li>{item.cat}</li>
                {typeof item.likeCount === 'number' && (
                  <li><Icon name="heart" size={13} /> {fmtLikes(item.likeCount)} on Instagram</li>
                )}
              </ul>

              <p className="rdetail-label"><span>01</span> The look</p>
              {item.fullCaption ? <p className="rdetail-caption">{item.fullCaption}</p> : <p className="rdetail-caption">{item.caption}</p>}

              <div className="rdetail-actions">
                <Link className="btn btn--gold" to={book}>Book this look <Icon name="arrow" /></Link>
                {item.permalink && (
                  <a className="btn btn--line" href={item.permalink} target="_blank" rel="noopener noreferrer">
                    <Icon name="instagram" size={16} /> View on Instagram
                  </a>
                )}
              </div>
            </div>
          </div>

          {state.related.length > 0 && (
            <div className="rdetail-more">
              <div className="rdetail-more-head">
                <p className="rdetail-label"><span>02</span> More reels</p>
                <Link className="tlink" to={`/gallery?category=${encodeURIComponent(REELS_FILTER)}`}><span>View all reels</span><Icon name="arrow" /></Link>
              </div>
              <ul className="reels-grid">
                {state.related.map((r, i) => (
                  <li key={r.id}><ReelCard item={r} index={i} preview={preview} /></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
      <CtaBand title={['Want a look', '*like this?*']} text="Tell us what you loved about it and we’ll plan your appointment." to={book} />
    </>
  );
}
