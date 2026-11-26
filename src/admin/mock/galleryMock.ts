/* =====================================================================
   INSTAGRAM GALLERY — DEMO BACKEND (VITE_ADMIN_DEMO=true only).
   ---------------------------------------------------------------------
   Lets the Instagram Gallery screen be tried without Firebase or a Meta
   app. "Connecting" pretends to link @edenglow.demo and "imports" a few
   of the website's temporary stock photos as demo posts. Nothing is
   sent to Instagram; data lives in memory and resets on reload.
   ===================================================================== */
import { GALLERY_IMAGES } from '../../data/images.ts';
import { ApiError } from '../api/engine.ts';
import {
  MEDIA_CATEGORIES,
  type GalleryAdminApi,
  type GalleryMediaPatch,
  type GalleryMediaRow,
  type InstagramStatus,
  type MediaCategory,
  type SyncRunRow,
} from '../api/galleryTypes.ts';

const wait = <T>(v: T, ms = 200) => new Promise<T>((res) => setTimeout(() => res(structuredClone(v)), ms));
const HOUR = 3600 * 1000;

function demoPosts(now: number): GalleryMediaRow[] {
  return GALLERY_IMAGES.slice(0, 10).map((g, i) => {
    const kind = i % 4 === 1 ? 'video' : i % 5 === 3 ? 'carousel' : 'image';
    const taken = now - (i + 1) * 30 * HOUR;
    return {
      id: `ig_demo${i + 1}`,
      kind,
      isReel: kind === 'video',
      productType: kind === 'video' ? 'REELS' : 'FEED',
      caption: `Demo post: ${g.caption}. #edenglow #demo`,
      permalink: 'https://www.instagram.com/',
      mediaUrl: kind === 'video' ? null : g.full,
      thumbnailUrl: g.src,
      children: kind === 'carousel' ? [g, GALLERY_IMAGES[(i + 11) % GALLERY_IMAGES.length]].map((c) => ({ kind: 'image' as const, mediaUrl: c.full, thumbnailUrl: c.src })) : [],
      takenAt: new Date(taken).toISOString(),
      available: true,
      syncedAt: new Date(now).toISOString(),
      likeCount: null,
      status: i < 3 ? 'published' : 'hidden',
      category: i < 3 && (MEDIA_CATEGORIES as readonly string[]).includes(g.cat) ? (g.cat as MediaCategory) : null,
      featured: i === 0,
      altText: '',
      sortOrder: taken,
    };
  });
}

export function createGalleryMock(requireAuth: () => void): GalleryAdminApi {
  let posts: GalleryMediaRow[] = [];
  const runs: SyncRunRow[] = [];
  const status: InstagramStatus = {
    connected: false, username: '', accountType: '', connectedAt: null, tokenExpiresAt: null, tokenRefreshedAt: null,
    lastSyncAt: null, lastSyncStatus: null, lastError: null, needsReconnect: false, syncing: false, autoPublish: true,
  };
  const sorted = () => [...posts].sort((a, b) => b.sortOrder - a.sortOrder);

  function sync(trigger: SyncRunRow['trigger'], retryOf: string | null = null): SyncRunRow {
    const now = Date.now();
    // like the real sync: new posts are published with auto-publish on, hidden with it off
    const fresh = posts.length ? null : demoPosts(now).map((p): GalleryMediaRow => ({ ...p, status: status.autoPublish ? 'published' : 'hidden' }));
    if (fresh) posts = fresh;
    const run: SyncRunRow = {
      id: `run_demo${runs.length + 1}`, trigger, retryOf, status: 'success', startedAt: new Date(now).toISOString(), finishedAt: new Date(now + 1200).toISOString(),
      fetched: posts.length, created: fresh ? fresh.length : 0, updated: fresh ? 0 : posts.length, removed: 0, skipped: 0, complete: true, error: null,
    };
    runs.unshift(run);
    Object.assign(status, { lastSyncAt: run.finishedAt, lastSyncStatus: 'success', lastError: null });
    return run;
  }

  return {
    async status() {
      requireAuth();
      return wait(status, 120);
    },
    async counts() {
      requireAuth();
      const published = posts.filter((p) => p.status === 'published').length;
      return wait({ total: posts.length, published, hidden: posts.length - published, unavailable: posts.filter((p) => p.status === 'published' && !p.available).length }, 80);
    },
    async setAutoPublish(on: boolean) {
      requireAuth();
      status.autoPublish = on;
      return wait(undefined, 120);
    },
    async list({ status: s = 'all', cursor = null, pageSize = 24 } = {}) {
      requireAuth();
      const all = sorted().filter((p) => (s === 'all' || p.status === s) && (cursor == null || p.sortOrder < cursor));
      const items = all.slice(0, pageSize);
      return wait({ items, cursor: all.length > pageSize ? items[items.length - 1].sortOrder : null });
    },
    async update(id: string, patch: GalleryMediaPatch) {
      requireAuth();
      const p = posts.find((x) => x.id === id);
      if (!p) throw new ApiError(404, 'That post no longer exists.');
      if (patch.altText !== undefined && patch.altText.trim().length > 300) throw new ApiError(400, 'Keep the description under 300 characters.', { altText: 'Keep it under 300 characters.' });
      Object.assign(p, patch, patch.altText !== undefined ? { altText: patch.altText.trim() } : {});
      return wait(p, 120);
    },
    async move(id, direction, s = 'all') {
      requireAuth();
      const list = sorted().filter((p) => s === 'all' || p.status === s);
      const i = list.findIndex((p) => p.id === id);
      const j = direction === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= list.length) return wait(false);
      [list[i].sortOrder, list[j].sortOrder] = [list[j].sortOrder, list[i].sortOrder];
      return wait(true, 120);
    },
    async history() {
      requireAuth();
      return wait(runs.slice(0, 20), 120);
    },
    async connect() {
      requireAuth();
      const now = new Date();
      Object.assign(status, {
        connected: true, username: 'edenglow.demo', accountType: 'BUSINESS', connectedAt: now.toISOString(),
        tokenRefreshedAt: now.toISOString(), tokenExpiresAt: new Date(now.getTime() + 60 * 24 * HOUR).toISOString(), needsReconnect: false,
      });
      sync('connect');
      // the real flow leaves for Instagram and comes back here
      return wait({ url: '/admin/gallery?instagram=connected' }, 400);
    },
    async disconnect() {
      requireAuth();
      Object.assign(status, { connected: false, tokenExpiresAt: null });
      posts.forEach((p) => (p.available = false));
      return wait(undefined);
    },
    async syncNow(retryOf?: string) {
      requireAuth();
      if (!status.connected) throw new ApiError(409, 'Instagram is not connected yet.');
      return wait(sync(retryOf ? 'retry' : 'manual', retryOf ?? null), 900);
    },
  };
}
