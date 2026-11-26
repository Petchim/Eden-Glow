/* =====================================================================
   INSTAGRAM GALLERY — admin API types.
   ---------------------------------------------------------------------
   Implemented by ./galleryFirestore.ts (Firebase: Firestore reads and
   owner-only Cloud Functions) and ../mock/galleryMock.ts (demo mode).
   The access token never reaches the browser: the screens only see the
   connection status, posts and sync history.
   ===================================================================== */

/** Same list as the website's gallery filters (without 'All') and firestore.rules. */
export const MEDIA_CATEGORIES = ['Hair', 'Skin', 'Nails', 'Lashes', 'Makeup', 'Transformations', 'Salon Interior'] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];
export type MediaStatus = 'hidden' | 'published';
export type MediaKind = 'image' | 'video' | 'carousel';

export interface GalleryMediaChild {
  kind: 'image' | 'video';
  mediaUrl: string | null;
  thumbnailUrl: string | null;
}

export interface GalleryMediaRow {
  id: string;
  kind: MediaKind;
  isReel: boolean;
  productType: string;
  caption: string;
  permalink: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  children: GalleryMediaChild[];
  takenAt: string;
  /** False when the post is gone from Instagram, or Instagram is disconnected. */
  available: boolean;
  syncedAt: string | null;
  /** Instagram like count when available (null = Instagram didn't provide one). */
  likeCount: number | null;
  /* owner-managed */
  status: MediaStatus;
  category: MediaCategory | null;
  featured: boolean;
  altText: string;
  sortOrder: number;
}

export interface GalleryMediaPatch {
  status?: MediaStatus;
  category?: MediaCategory | null;
  featured?: boolean;
  altText?: string;
}

export interface GalleryListQuery {
  status?: 'all' | MediaStatus;
  /** From the previous page's `cursor`. */
  cursor?: number | null;
  pageSize?: number;
}

export interface GalleryPage {
  items: GalleryMediaRow[];
  cursor: number | null;
}

export type SyncErrorCode = 'not-connected' | 'already-running' | 'too-soon' | 'needs-reconnect' | 'rate-limited' | 'instagram-error' | 'internal';

export interface InstagramStatus {
  connected: boolean;
  username: string;
  accountType: string;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  tokenRefreshedAt: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: 'success' | 'failed' | 'running' | null;
  lastError: { code: SyncErrorCode; message: string; at: string } | null;
  needsReconnect: boolean;
  /** A sync holds the lock right now. */
  syncing: boolean;
  /** New posts go straight to the website (default) instead of waiting, hidden, for approval. */
  autoPublish: boolean;
}

export interface GalleryCounts {
  total: number;
  published: number;
  hidden: number;
  /** Published but no longer on Instagram (not shown on the website). */
  unavailable: number;
}

export interface SyncRunRow {
  id: string;
  trigger: 'manual' | 'scheduled' | 'retry' | 'connect' | 'refresh';
  retryOf?: string | null;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  fetched: number;
  created: number;
  updated: number;
  removed: number;
  skipped: number;
  complete: boolean;
  error: { code: SyncErrorCode; message: string } | null;
}

export interface GalleryAdminApi {
  status(): Promise<InstagramStatus>;
  /** Totals for the summary cards. */
  counts(): Promise<GalleryCounts>;
  setAutoPublish(on: boolean): Promise<void>;
  list(query?: GalleryListQuery): Promise<GalleryPage>;
  update(id: string, patch: GalleryMediaPatch): Promise<GalleryMediaRow>;
  /** Swap display order with the neighbouring post (within the same status when `status` is given). */
  move(id: string, direction: 'up' | 'down', status?: 'all' | MediaStatus): Promise<boolean>;
  history(): Promise<SyncRunRow[]>;
  /** The Instagram approval page to send the owner to. */
  connect(): Promise<{ url: string }>;
  disconnect(): Promise<void>;
  syncNow(retryOf?: string): Promise<SyncRunRow>;
}
