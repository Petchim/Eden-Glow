/* =====================================================================
   PUBLIC GALLERY CACHE — Workers KV, so visitors cost 0 Firestore reads.
   ---------------------------------------------------------------------
   Paged, so every change stays inside the Free plan's 10 ms of CPU:
     gallery:front      { total, pages: [page ids in display order], featured: [...] }   (public)
     gallery:page:<id>  { items: [≈50 posts, display order] }                            (public)
     gallery:meta       page ranges + post → page index                                  (Worker only)
     gallery:stamp      newest ownerUpdatedAt already applied (safety net)               (Worker only)
   All published posts are cached (no 600-post limit): the website loads
   the front, then pages as the visitor scrolls. A change touches only
   the page(s) holding the post (≈ 1–2 ms), never the whole gallery.
   Contains only what the website shows (no account id, no hidden posts).
   ===================================================================== */
import type { KVLike } from '../env.js';
import { getJson, putJson } from '../store/kv.js';

/** A page is split in two when it grows past PAGE_MAX (new posts arrive at the front). */
export const PAGE_MAX = 60;
export const FEATURED_MAX = 48;
export const FRONT_KEY = 'gallery:front';
export const META_KEY = 'gallery:meta';
export const STAMP_KEY = 'gallery:stamp';
export const pageKey = (id: string) => `gallery:page:${id}`;
export const isPageId = (id: string) => /^p\d{1,6}$/.test(id);

export interface CachedChild {
  kind: 'image' | 'video';
  mediaUrl: string | null;
  thumbnailUrl: string | null;
}
/** One published post as the website needs it (same field names as the Firestore document). */
export interface CachedPost {
  id: string;
  kind: 'image' | 'video' | 'carousel';
  isReel: boolean;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  caption: string;
  takenAt: string;
  children: CachedChild[];
  category: string | null;
  featured: boolean;
  altText: string;
  sortOrder: number;
  /** Instagram like count, when Instagram provides one. */
  likeCount: number | null;
}
export interface GalleryFront {
  v: 2;
  builtAt: string;
  total: number;
  pages: string[];
  featured: CachedPost[];
}
export interface GalleryPage {
  v: 2;
  id: string;
  items: CachedPost[];
}
interface PageInfo {
  id: string;
  /** Highest and lowest sortOrder on the page (display order is sortOrder descending). */
  max: number;
  min: number;
  count: number;
}
interface GalleryMeta {
  v: 2;
  nextId: number;
  order: PageInfo[];
  /** post id → page id */
  index: Record<string, string>;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown) => (typeof v === 'string' ? v : null);
const byOrder = (a: CachedPost, b: CachedPost) => b.sortOrder - a.sortOrder || (a.id < b.id ? -1 : 1);

/** A Firestore galleryMedia document → the public shape. Null unless it is published and still on Instagram. */
export function toCachedPost(id: string, d: Record<string, unknown>): CachedPost | null {
  if (d.status !== 'published' || d.available !== true) return null;
  const kind = d.kind === 'video' || d.kind === 'carousel' ? d.kind : 'image';
  return {
    id,
    kind,
    isReel: d.isReel === true,
    mediaUrl: strOrNull(d.mediaUrl),
    thumbnailUrl: strOrNull(d.thumbnailUrl),
    permalink: str(d.permalink),
    caption: str(d.caption),
    takenAt: str(d.takenAt),
    children: Array.isArray(d.children)
      ? (d.children as Record<string, unknown>[]).map((c) => ({ kind: c.kind === 'video' ? 'video' : 'image', mediaUrl: strOrNull(c.mediaUrl), thumbnailUrl: strOrNull(c.thumbnailUrl) }))
      : [],
    category: strOrNull(d.category),
    featured: d.featured === true,
    altText: str(d.altText),
    sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
    likeCount: typeof d.likeCount === 'number' ? d.likeCount : null,
  };
}

/** Worth updating the public count? (likes change constantly; small changes wait for the next write) */
export function likesChanged(oldCount: number | null, newCount: number | null): boolean {
  if (newCount === null) return oldCount !== null;
  if (oldCount === null) return true;
  return Math.abs(newCount - oldCount) >= Math.max(5, Math.ceil(oldCount * 0.1));
}

/**
 * One batch of cache changes: loads only what it touches, writes each changed KV value once.
 * Usage: const tx = await CacheTx.open(kv); tx.upsert(p); tx.remove(id); await tx.commit(now);
 */
export class CacheTx {
  private pages = new Map<string, GalleryPage>();
  private dirty = new Set<string>();
  private dropped = new Set<string>();
  private metaDirty = false;
  private front: GalleryFront | null = null;
  private frontDirty = false;

  private constructor(
    private kv: KVLike,
    private meta: GalleryMeta,
  ) {}

  static async open(kv: KVLike): Promise<CacheTx> {
    const meta = (await getJson<GalleryMeta>(kv, META_KEY)) ?? { v: 2, nextId: 0, order: [], index: {} };
    return new CacheTx(kv, meta);
  }

  /** Is this post on the public site? (no KV read) */
  has(id: string): boolean {
    return id in this.meta.index;
  }
  get size(): number {
    return Object.keys(this.meta.index).length;
  }

  private async page(id: string): Promise<GalleryPage> {
    let p = this.pages.get(id);
    if (!p) {
      p = (await getJson<GalleryPage>(this.kv, pageKey(id))) ?? { v: 2, id, items: [] };
      this.pages.set(id, p);
    }
    return p;
  }
  private info(id: string) {
    return this.meta.order.find((o) => o.id === id)!;
  }
  private touch(p: GalleryPage) {
    this.dirty.add(p.id);
    const info = this.info(p.id);
    info.count = p.items.length;
    info.max = p.items[0]?.sortOrder ?? 0;
    info.min = p.items[p.items.length - 1]?.sortOrder ?? 0;
    this.metaDirty = true;
  }
  private async loadFront(): Promise<GalleryFront> {
    this.front ??= (await getJson<GalleryFront>(this.kv, FRONT_KEY)) ?? { v: 2, builtAt: '', total: 0, pages: [], featured: [] };
    return this.front;
  }

  /** The cached copy of a post (loads its page), or null. */
  async get(id: string): Promise<CachedPost | null> {
    const pid = this.meta.index[id];
    if (!pid) return null;
    return (await this.page(pid)).items.find((x) => x.id === id) ?? null;
  }

  async remove(id: string): Promise<void> {
    const pid = this.meta.index[id];
    if (pid) {
      const p = await this.page(pid);
      p.items = p.items.filter((x) => x.id !== id);
      delete this.meta.index[id];
      this.frontDirty = true;
      if (p.items.length) this.touch(p);
      else {
        this.meta.order = this.meta.order.filter((o) => o.id !== pid);
        this.dirty.delete(pid);
        this.dropped.add(pid);
        this.metaDirty = true;
      }
    }
    const f = await this.loadFront();
    if (f.featured.some((x) => x.id === id)) (f.featured = f.featured.filter((x) => x.id !== id)), (this.frontDirty = true);
  }

  async upsert(post: CachedPost): Promise<void> {
    const pid = this.meta.index[post.id];
    if (pid) {
      const p = await this.page(pid);
      const i = p.items.findIndex((x) => x.id === post.id);
      const info = this.info(pid);
      // same place in the order: replace in place (the common case: fresh links, new caption)
      if (i >= 0 && p.items[i].sortOrder === post.sortOrder) {
        p.items[i] = post;
        this.dirty.add(pid);
      } else if (i >= 0 && post.sortOrder <= info.max && post.sortOrder >= info.min) {
        p.items[i] = post;
        p.items.sort(byOrder);
        this.touch(p);
      } else {
        await this.remove(post.id);
        await this.insert(post);
      }
    } else await this.insert(post);
    await this.syncFeatured(post);
  }

  private async syncFeatured(post: CachedPost) {
    const f = await this.loadFront();
    const at = f.featured.findIndex((x) => x.id === post.id);
    if (post.featured) {
      if (at >= 0) f.featured[at] = post;
      else f.featured.push(post);
      f.featured.sort(byOrder);
      f.featured = f.featured.slice(0, FEATURED_MAX);
      this.frontDirty = true;
    } else if (at >= 0) {
      f.featured.splice(at, 1);
      this.frontDirty = true;
    }
  }

  private async insert(post: CachedPost): Promise<void> {
    const order = this.meta.order;
    let target: PageInfo;
    if (!order.length) {
      target = { id: `p${this.meta.nextId++}`, max: post.sortOrder, min: post.sortOrder, count: 0 };
      order.push(target);
      this.pages.set(target.id, { v: 2, id: target.id, items: [] });
    } else {
      // the first page whose lowest post is not newer than this one; else the last page
      target = order.find((o) => post.sortOrder >= o.min) ?? order[order.length - 1];
    }
    const p = await this.page(target.id);
    p.items.push(post);
    p.items.sort(byOrder);
    this.meta.index[post.id] = p.id;
    this.frontDirty = true;
    this.touch(p);
    if (p.items.length > PAGE_MAX) {
      // split: the older half moves to a new page right after this one
      const half = Math.ceil(p.items.length / 2);
      const moved: GalleryPage = { v: 2, id: `p${this.meta.nextId++}`, items: p.items.slice(half) };
      p.items = p.items.slice(0, half);
      order.splice(order.findIndex((o) => o.id === p.id) + 1, 0, { id: moved.id, max: 0, min: 0, count: 0 });
      this.pages.set(moved.id, moved);
      for (const x of moved.items) this.meta.index[x.id] = moved.id;
      this.touch(p);
      this.touch(moved);
    }
  }

  /** Write every changed value once. Returns the number of KV writes + deletes. */
  async commit(now: Date): Promise<number> {
    let ops = 0;
    for (const id of this.dirty) {
      const p = this.pages.get(id);
      if (p) (await putJson(this.kv, pageKey(id), p), (ops += 1));
    }
    for (const id of this.dropped) (await this.kv.delete(pageKey(id)), (ops += 1));
    if (this.metaDirty) (await putJson(this.kv, META_KEY, this.meta), (ops += 1));
    if (this.frontDirty) {
      const f = await this.loadFront();
      f.v = 2;
      f.builtAt = now.toISOString();
      f.total = Object.keys(this.meta.index).length;
      f.pages = this.meta.order.map((o) => o.id);
      await putJson(this.kv, FRONT_KEY, f);
      ops += 1;
    }
    this.dirty.clear();
    this.dropped.clear();
    this.metaDirty = this.frontDirty = false;
    return ops;
  }

  /** Remove every post (disconnect). */
  async clear(now: Date): Promise<void> {
    for (const o of this.meta.order) this.dropped.add(o.id);
    this.meta = { v: 2, nextId: this.meta.nextId, order: [], index: {} };
    this.metaDirty = true;
    this.front = { v: 2, builtAt: '', total: 0, pages: [], featured: [] };
    this.frontDirty = true;
    this.dirty.clear();
    await this.commit(now);
  }
}

/* ---------- Instagram link expiry ---------- */
/**
 * Instagram CDN links carry their expiry as `oe=<hex unix seconds>`. Returns ms, or null when the
 * link has no readable expiry (then it is always treated as expiring).
 */
export function linkExpiry(url: string | null): number | null {
  if (!url) return null;
  const m = /[?&]oe=([0-9A-Fa-f]{6,10})(?:&|$)/.exec(url);
  if (!m) return null;
  const s = parseInt(m[1], 16);
  return Number.isFinite(s) && s > 1e9 ? s * 1000 : null;
}
/** Does any file link of this post expire before `before` (or have no readable expiry)? */
export function linksExpireBefore(p: Pick<CachedPost, 'mediaUrl' | 'thumbnailUrl' | 'children'>, before: number): boolean {
  const urls = [p.mediaUrl, p.thumbnailUrl, ...p.children.flatMap((c) => [c.mediaUrl, c.thumbnailUrl])].filter((u): u is string => !!u);
  if (!urls.length) return false;
  return urls.some((u) => {
    const e = linkExpiry(u);
    return e === null || e < before;
  });
}
