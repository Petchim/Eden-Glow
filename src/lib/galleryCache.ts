/* =====================================================================
   PUBLIC INSTAGRAM GALLERY — the Worker's cache (normal path)
   ---------------------------------------------------------------------
   GET <VITE_INSTAGRAM_API_URL>/gallery.json      front: total, page ids, featured posts
   GET <VITE_INSTAGRAM_API_URL>/gallery/page/<id> one page (≈50 posts, display order)
   Served from Cloudflare KV: visitors cost no Firestore reads at all.
   No Firebase code here, so the gallery stays light.
   ===================================================================== */
import type { GalleryImage } from '../types/content.ts';
import { instagramApiUrl } from './firebaseConfig.ts';
import { isMediaId, showable, toGalleryItem, type MediaDoc } from './galleryItems.ts';

type CachedPost = MediaDoc & { id: string };
export interface CacheFront {
  total: number;
  pages: string[];
  featured: GalleryImage[];
}

export const cacheConfigured = (): boolean => /^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)/.test(instagramApiUrl);

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${instagramApiUrl}${path}`, { credentials: 'omit' });
  if (!res.ok) throw new Error(`Gallery cache ${res.status}`);
  return (await res.json()) as T;
}
const convert = (posts: CachedPost[] | undefined) => showable((posts || []).map((p) => toGalleryItem(p.id, p)));

export async function loadFront(): Promise<CacheFront> {
  const f = await getJson<{ total?: number; pages?: string[]; featured?: CachedPost[] }>('/gallery.json');
  return { total: f.total ?? 0, pages: Array.isArray(f.pages) ? f.pages.filter((p) => /^p\d{1,6}$/.test(p)) : [], featured: convert(f.featured) };
}

export async function loadPage(id: string): Promise<GalleryImage[]> {
  if (!/^p\d{1,6}$/.test(id)) return [];
  return convert((await getJson<{ items?: CachedPost[] }>(`/gallery/page/${id}`)).items);
}

/**
 * A post for its Reel page, looked up in the front and the first `maxPages` pages (browser-cached
 * after a gallery visit). Null if not found there: the caller may fall back to one Firestore read.
 */
export async function findInCache(id: string, maxPages = 3): Promise<{ item: GalleryImage | null; nearby: GalleryImage[] }> {
  if (!isMediaId(id)) return { item: null, nearby: [] };
  const front = await loadFront();
  const nearby: GalleryImage[] = [...front.featured];
  let item = front.featured.find((x) => x.id === id) ?? null;
  for (const pid of front.pages.slice(0, maxPages)) {
    const items = await loadPage(pid);
    nearby.push(...items);
    item ??= items.find((x) => x.id === id) ?? null;
    if (item && nearby.filter((x) => x.kind === 'video').length >= 8) break;
  }
  return { item, nearby };
}
