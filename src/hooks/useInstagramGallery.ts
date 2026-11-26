import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GalleryImage } from '../types/content.ts';
import { firebaseConfigured } from '../lib/firebaseConfig.ts';
import { cacheConfigured } from '../lib/galleryCache.ts';

export interface InstagramGallery {
  /** Featured posts first, then the rest in the owner's order (no duplicates). */
  items: GalleryImage[];
  /** Published videos / Reels for the Reels section (featured first). */
  videos: GalleryImage[];
  /** True until the first answer (false at once when nothing is configured). */
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

type Source =
  | { kind: 'cache'; pages: string[]; next: number }
  | { kind: 'firestore'; cursor: number | null }
  | { kind: 'none' };

const FALLBACK_PAGE = 24;

/**
 * Published Instagram posts for the public gallery. Normally read from the Worker's cache
 * (Cloudflare KV, no Firestore reads); if that is not set up or not reachable, from Firestore.
 * Loaded after the page renders, so stock photos show at once and a slow or failed request never
 * blocks the gallery: it just leaves the Instagram posts out (with a quiet retry link).
 */
export function useInstagramGallery(): InstagramGallery {
  const enabled = cacheConfigured() || firebaseConfigured();
  const [featured, setFeatured] = useState<GalleryImage[]>([]);
  const [posts, setPosts] = useState<GalleryImage[]>([]);
  const [extraVideos, setExtraVideos] = useState<GalleryImage[]>([]);
  const [source, setSource] = useState<Source>({ kind: 'none' });
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    if (!enabled) return undefined;
    setLoading(true);
    setError(false);
    (async () => {
      if (cacheConfigured()) {
        try {
          const cache = await import('../lib/galleryCache.ts');
          const front = await cache.loadFront();
          const first = front.pages.length ? await cache.loadPage(front.pages[0]) : [];
          if (!live.current) return;
          setFeatured(front.featured);
          setPosts(first);
          setExtraVideos([]);
          setSource({ kind: 'cache', pages: front.pages, next: 1 });
          return;
        } catch (e) {
          console.warn('[gallery] Worker cache unavailable, using Firestore', e);
        }
      }
      if (!firebaseConfigured()) throw new Error('No gallery source available');
      const fs = await import('../lib/publicGallery.ts');
      const [f, p, v] = await Promise.all([fs.listFeaturedMedia(), fs.listPublishedMedia(null, FALLBACK_PAGE), fs.listVideos()]);
      if (!live.current) return;
      setFeatured(f.items);
      setPosts(p.items);
      setExtraVideos(v.items);
      setSource({ kind: 'firestore', cursor: p.cursor });
    })()
      .catch((e: unknown) => {
        if (!live.current) return;
        console.warn('[gallery] Instagram posts could not be loaded', e);
        setError(true);
      })
      .finally(() => live.current && setLoading(false));
    return () => {
      live.current = false;
    };
  }, [enabled, attempt]);

  const loadMore = useCallback(() => {
    if (loadingMore) return;
    if (source.kind === 'cache' && source.next < source.pages.length) {
      setLoadingMore(true);
      import('../lib/galleryCache.ts')
        .then((cache) => cache.loadPage(source.pages[source.next]))
        .then((items) => {
          if (!live.current) return;
          setPosts((prev) => [...prev, ...items]);
          setSource({ ...source, next: source.next + 1 });
        })
        .catch(() => live.current && setError(true))
        .finally(() => live.current && setLoadingMore(false));
    } else if (source.kind === 'firestore' && source.cursor != null) {
      setLoadingMore(true);
      import('../lib/publicGallery.ts')
        .then((fs) => fs.listPublishedMedia(source.cursor, FALLBACK_PAGE))
        .then((p) => {
          if (!live.current) return;
          setPosts((prev) => [...prev, ...p.items]);
          setSource({ kind: 'firestore', cursor: p.cursor });
        })
        .catch(() => live.current && setError(true))
        .finally(() => live.current && setLoadingMore(false));
    }
  }, [source, loadingMore]);

  const items = useMemo(() => {
    const ids = new Set(featured.map((f) => f.id));
    return [...featured, ...posts.filter((p) => !ids.has(p.id))];
  }, [featured, posts]);
  const videos = useMemo(() => {
    const seen = new Set<string | undefined>();
    return [...items, ...extraVideos].filter((x) => x.kind === 'video' && !seen.has(x.id) && (seen.add(x.id), true)).slice(0, 12);
  }, [items, extraVideos]);

  return {
    items,
    videos,
    loading,
    loadingMore,
    error,
    hasMore: (source.kind === 'cache' && source.next < source.pages.length) || (source.kind === 'firestore' && source.cursor != null),
    loadMore,
    retry: () => setAttempt((n) => n + 1),
  };
}
