import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GALLERY_CATEGORIES, GALLERY_IMAGES } from '../data/images.ts';
import { BOOK_PATH } from '../data/content.ts';
import { usePageMeta } from '../hooks/usePageMeta.ts';
import GalleryGrid from '../components/GalleryGrid.tsx';
import CtaBand from '../components/CtaBand.tsx';
import SectionTitle from '../components/ui/SectionTitle.tsx';
import Reveal from '../components/ui/Reveal.tsx';
import Icon from '../components/ui/Icon.tsx';
import InstagramEmbed from '../components/InstagramEmbed.tsx';
import { listPublishedR2Media, listPublishedVideos } from '../lib/publicGallery.ts';
import type { GalleryVideo } from '../types/video.ts';
import type { R2MediaItem } from '../types/media.ts';
import type { GalleryImage } from '../types/content.ts';

type GalleryTab = 'images' | 'videos';

export default function Gallery() {
  usePageMeta(
    'Beauty Gallery',
    'Browse hair, skin, nail, lash, makeup and salon interior photography and studio videos from Eden Glow Studio’s beauty gallery.',
  );

  const [params, setParams] = useSearchParams();
  const currentTab: GalleryTab = params.get('tab') === 'videos' ? 'videos' : 'images';
  const requestedCategory = params.get('category');
  const activeCategory =
    requestedCategory && GALLERY_CATEGORIES.includes(requestedCategory) ? requestedCategory : 'All';

  // State
  const [r2Media, setR2Media] = useState<R2MediaItem[]>([]);
  const [instagramVideos, setInstagramVideos] = useState<GalleryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadAttempt, setReloadAttempt] = useState(0);

  // Tab switcher
  const onSelectTab = (tab: GalleryTab) => {
    const nextParams = new URLSearchParams(params);
    if (tab === 'videos') {
      nextParams.set('tab', 'videos');
      nextParams.delete('category');
    } else {
      nextParams.delete('tab');
    }
    setParams(nextParams, { replace: true, preventScrollReset: true });
  };

  // Image category filter switcher
  const onCategoryFilter = (cat: string) => {
    const nextParams = new URLSearchParams(params);
    nextParams.delete('tab');
    if (cat === 'All') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', cat);
    }
    setParams(nextParams, { replace: true, preventScrollReset: true });
  };

  // Fetch published media and videos
  useEffect(() => {
    let active = true;
    setLoading(true);
    setHasError(false);

    Promise.allSettled([listPublishedR2Media(), listPublishedVideos()]).then(([r2Res, igRes]) => {
      if (!active) return;

      if (r2Res.status === 'fulfilled') {
        const publishedR2 = r2Res.value.filter((m) => m.status === 'PUBLISHED');
        setR2Media(publishedR2);
      } else {
        console.warn('[Gallery] Failed to load R2 media:', r2Res.reason);
      }

      if (igRes.status === 'fulfilled') {
        const publishedIg = igRes.value.filter((v) => v.status === 'PUBLISHED');
        setInstagramVideos(publishedIg);
      } else {
        console.warn('[Gallery] Failed to load Instagram videos:', igRes.reason);
      }

      if (r2Res.status === 'rejected' && igRes.status === 'rejected') {
        setHasError(true);
      }

      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [reloadAttempt]);

  // Uploaded R2 videos
  const r2Videos = useMemo(() => r2Media.filter((m) => m.mediaType === 'VIDEO'), [r2Media]);

  // Combined images: uploaded R2 images + all 40 original stock images preserved
  const galleryImages: GalleryImage[] = useMemo(() => {
    const uploadedImages: GalleryImage[] = r2Media
      .filter((m) => m.mediaType === 'IMAGE')
      .map((m) => ({
        cat: m.category || 'Hair',
        caption: m.title || m.originalFileName,
        src: m.publicUrl,
        full: m.publicUrl,
        ratio: 'p',
      }));
    return [...uploadedImages, ...GALLERY_IMAGES];
  }, [r2Media]);

  const totalVideosCount = r2Videos.length + instagramVideos.length;

  return (
    <>
      <section className="section gpage" aria-labelledby="page-title">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link to="/">Home</Link>
              </li>
              <li aria-current="page">Gallery</li>
            </ol>
          </nav>

          <div className="gpage-head">
            <SectionTitle
              as="h1"
              eyebrow="Beauty gallery"
              lines={['A glimpse of', '*the glow.*']}
              id="page-title"
              className="gpage-title"
            />
            <Reveal delay={100}>
              <p className="lede">
                Hair, skin, nails, lashes, makeup, studio moments and client transformations. Explore our
                photography and studio videos.
              </p>
            </Reveal>

            {/* Gallery Section Mode Tabs */}
            <div className="gpage-tabs" role="tablist" aria-label="Gallery format">
              <button
                type="button"
                role="tab"
                id="tab-images"
                aria-selected={currentTab === 'images'}
                aria-controls="panel-images"
                className={`gpage-tab ${currentTab === 'images' ? 'is-active' : ''}`}
                onClick={() => onSelectTab('images')}
              >
                <span>Images ({galleryImages.length})</span>
              </button>
              <button
                type="button"
                role="tab"
                id="tab-videos"
                aria-selected={currentTab === 'videos'}
                aria-controls="panel-videos"
                className={`gpage-tab ${currentTab === 'videos' ? 'is-active' : ''}`}
                onClick={() => onSelectTab('videos')}
              >
                <Icon name="play" size={14} />
                <span>Videos {totalVideosCount > 0 ? `(${totalVideosCount})` : ''}</span>
              </button>
            </div>
          </div>

          {/* TAB 1: IMAGES */}
          {currentTab === 'images' && (
            <div id="panel-images" role="tabpanel" aria-labelledby="tab-images" className="gpage-panel">
              <div id="gallery-grid" className="gpage-grid">
                <GalleryGrid
                  items={galleryImages}
                  filters
                  filter={activeCategory}
                  onFilter={onCategoryFilter}
                />
              </div>
            </div>
          )}

          {/* TAB 2: VIDEOS */}
          {currentTab === 'videos' && (
            <div id="panel-videos" role="tabpanel" aria-labelledby="tab-videos" className="gpage-panel">
              {loading && !totalVideosCount ? (
                <div className="gpage-videos-loading" aria-live="polite">
                  <div className="gpage-video-skeleton" />
                  <div className="gpage-video-skeleton" />
                  <div className="gpage-video-skeleton" />
                </div>
              ) : hasError && !totalVideosCount ? (
                <div className="gpage-empty" aria-live="polite">
                  <div className="gpage-empty-icon">
                    <Icon name="play" size={32} />
                  </div>
                  <h2 className="gpage-empty-title">Couldn't load videos</h2>
                  <p className="gpage-empty-text">
                    We had trouble connecting to the video gallery just now. Please try again.
                  </p>
                  <button type="button" className="btn btn--line" onClick={() => setReloadAttempt((n) => n + 1)}>
                    <span>Try again</span>
                    <Icon name="arrow" size={14} />
                  </button>
                </div>
              ) : !totalVideosCount ? (
                <div className="gpage-empty" aria-live="polite">
                  <div className="gpage-empty-icon">
                    <Icon name="play" size={36} />
                  </div>
                  <h2 className="gpage-empty-title">No videos published yet</h2>
                  <p className="gpage-empty-text">
                    Our artists are crafting new transformations and studio highlights. Check back soon or browse our photography.
                  </p>
                  <button type="button" className="btn btn--line" onClick={() => onSelectTab('images')}>
                    <span>Browse Images</span>
                    <Icon name="arrow" size={14} />
                  </button>
                </div>
              ) : (
                <div className="gpage-videos-grid">
                  {/* Cloudflare R2 Uploaded Videos (HTML5 Video Players) */}
                  {r2Videos.map((vid) => (
                    <article key={vid.id} className="gpage-video-card">
                      <div className="gpage-r2-video-wrap">
                        <video
                          className="gpage-r2-video-player"
                          src={vid.publicUrl}
                          controls
                          playsInline
                          preload="metadata"
                          poster={vid.thumbnailUrl}
                        />
                      </div>
                      <div className="gpage-video-meta">
                        <div className="gpage-video-meta-col">
                          <span className="gpage-video-badge">
                            <Icon name="play" size={13} />
                            <span>{vid.category || 'Studio Video'}</span>
                          </span>
                          <h3 className="gpage-video-title">{vid.title || vid.originalFileName}</h3>
                        </div>
                      </div>
                    </article>
                  ))}

                  {/* Curated Instagram Embeds */}
                  {instagramVideos.map((vid) => (
                    <article key={vid.id} className="gpage-video-card">
                      <div className="gpage-video-embed">
                        <InstagramEmbed url={vid.instagramUrl} type={vid.postType} captioned={false} maxWidth={460} />
                      </div>
                      <div className="gpage-video-meta">
                        <span className="gpage-video-badge">
                          <Icon name="instagram" size={13} />
                          <span>{vid.postType === 'REEL' ? 'Instagram Reel' : 'Instagram Video'}</span>
                        </span>
                        <a
                          href={vid.instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gpage-video-link"
                          aria-label="Watch on Instagram (opens in a new tab)"
                        >
                          <span>Watch on Instagram</span>
                          <Icon name="arrow" size={12} />
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <CtaBand
        title={['Seen something', '*you love?*']}
        text="Share it in your enquiry and we’ll talk about your look."
        to={BOOK_PATH}
      />
    </>
  );
}
