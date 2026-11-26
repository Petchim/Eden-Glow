/* =====================================================================
   GALLERY MEDIA MODEL — galleryMedia/{id} in Cloud Firestore.
   ---------------------------------------------------------------------
   Two owners, never mixed:
     • SYNC fields   — written only by the Instagram sync (the Cloudflare
                       Worker, signed in as the Sync Bot; firestore.rules
                       limit it to these fields). Written when a post is
                       new or changed, and for published posts when their
                       file links are refreshed (every 6 hours).
     • ADMIN fields  — written only by the owner in the admin panel
                       (firestore.rules allows nothing else). The sync
                       sets them once, when a post is first imported
                       (published or hidden per the auto-publish
                       setting), and never touches them again.
   Pure module: shared by the functions and their unit tests.
   ===================================================================== */
import type { RawChild, RawMedia } from './graph.js';

/** Same list as GALLERY_CATEGORIES on the website (without 'All') and firestore.rules. */
export const GALLERY_CATEGORIES = ['Hair', 'Skin', 'Nails', 'Lashes', 'Makeup', 'Transformations', 'Salon Interior'] as const;
export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

export type MediaKind = 'image' | 'video' | 'carousel';
export type MediaStatus = 'hidden' | 'published';

export interface MediaChild {
  id: string;
  kind: 'image' | 'video';
  mediaUrl: string | null;
  thumbnailUrl: string | null;
}

/** Fields the sync owns. */
export interface SyncedMediaFields {
  source: 'instagram';
  igId: string;
  accountId: string;
  kind: MediaKind;
  /** Instagram's media_product_type: FEED, REELS, STORY, AD … */
  productType: string;
  isReel: boolean;
  /** Direct file URL from Instagram's CDN. Expires; refreshed by every sync. Null when Instagram withholds it. */
  mediaUrl: string | null;
  /** Still image for tiles: the video cover, the photo itself, or the first carousel slide. */
  thumbnailUrl: string | null;
  permalink: string;
  caption: string;
  /** When it was posted on Instagram (ISO). */
  takenAt: string;
  children: MediaChild[];
  /** False when the post is no longer on Instagram (or the account was disconnected). */
  available: boolean;
  /** Instagram's like count when it provides one (null = not available; never estimated). */
  likeCount: number | null;
}

/** Fields the owner manages. */
export interface AdminMediaFields {
  status: MediaStatus;
  category: GalleryCategory | null;
  featured: boolean;
  altText: string;
  /** Higher shows first. Starts as the post time, so new posts lead; "move up/down" swaps values. */
  sortOrder: number;
}

export const SYNC_FIELDS: (keyof SyncedMediaFields)[] = [
  'source', 'igId', 'accountId', 'kind', 'productType', 'isReel', 'mediaUrl', 'thumbnailUrl', 'permalink', 'caption', 'takenAt', 'children', 'available', 'likeCount',
];
export const ADMIN_FIELDS: (keyof AdminMediaFields)[] = ['status', 'category', 'featured', 'altText', 'sortOrder'];

export const mediaDocId = (igId: string): string => `ig_${igId}`;

const MAX_CAPTION = 2200; // Instagram's own caption limit
const MAX_CHILDREN = 20;

/** Only https URLs are kept, so nothing else can end up in an <img> or <video> on the site. */
const httpsUrl = (u: unknown): string | null => {
  if (typeof u !== 'string' || u.length > 2048) return null;
  try {
    return new URL(u).protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
};
const permalinkUrl = (u: unknown): string | null => {
  const url = httpsUrl(u);
  if (!url) return null;
  const host = new URL(url).hostname;
  return host === 'www.instagram.com' || host === 'instagram.com' ? url : null;
};

const kindOf = (t: string | undefined): MediaKind => (t === 'VIDEO' ? 'video' : t === 'CAROUSEL_ALBUM' ? 'carousel' : 'image');

function mapChild(c: RawChild): MediaChild | null {
  if (!c?.id) return null;
  const kind = c.media_type === 'VIDEO' ? 'video' : 'image';
  const mediaUrl = httpsUrl(c.media_url);
  return { id: String(c.id), kind, mediaUrl, thumbnailUrl: kind === 'video' ? httpsUrl(c.thumbnail_url) : mediaUrl };
}

/**
 * Instagram's media object → the fields the sync writes. Returns null for items that can't be
 * shown on the website (no id or no valid Instagram permalink).
 */
export function mapMedia(raw: RawMedia, accountId: string): SyncedMediaFields | null {
  if (!raw?.id) return null;
  const permalink = permalinkUrl(raw.permalink);
  if (!permalink) return null;
  const kind = kindOf(raw.media_type);
  const children = kind === 'carousel' ? (raw.children?.data || []).slice(0, MAX_CHILDREN).map(mapChild).filter((c): c is MediaChild => !!c) : [];
  const mediaUrl = httpsUrl(raw.media_url);
  const thumbnailUrl =
    kind === 'video'
      ? httpsUrl(raw.thumbnail_url)
      : kind === 'carousel'
        ? children[0]?.thumbnailUrl ?? mediaUrl
        : mediaUrl;
  const taken = raw.timestamp ? new Date(raw.timestamp) : null;
  const productType = String(raw.media_product_type || 'FEED').toUpperCase().slice(0, 20);
  return {
    source: 'instagram',
    igId: String(raw.id),
    accountId,
    kind,
    productType,
    isReel: productType === 'REELS',
    mediaUrl,
    thumbnailUrl,
    permalink,
    caption: String(raw.caption || '').slice(0, MAX_CAPTION),
    takenAt: taken && !Number.isNaN(taken.getTime()) ? taken.toISOString() : new Date(0).toISOString(),
    children,
    available: true,
    likeCount: typeof raw.like_count === 'number' && Number.isFinite(raw.like_count) && raw.like_count >= 0 ? Math.floor(raw.like_count) : null,
  };
}

/**
 * Admin fields for a post seen for the first time. With auto-publish on (the default) it goes
 * straight to the website; with it off it waits, hidden, for the owner. Either way this runs only
 * once per post: later syncs never change these fields.
 */
export function initialAdminFields(m: SyncedMediaFields, autoPublish = true): AdminMediaFields {
  return {
    status: autoPublish ? 'published' : 'hidden',
    category: null,
    featured: false,
    altText: '',
    sortOrder: Date.parse(m.takenAt) || 0,
  };
}

/** Document fields the sync may write (firestore.rules allow the Sync Bot exactly these). */
export const SYNC_WRITE_FIELDS = [...SYNC_FIELDS, 'syncedAt', 'unavailableSince'] as const;

/**
 * Fingerprint of everything about a post EXCEPT its file links (which Instagram re-signs on every
 * request). Equal fingerprints = nothing worth writing; links are refreshed separately.
 * FNV-1a 32-bit: fast (CPU budget) and only compared against its own earlier value.
 */
export function fingerprint(m: SyncedMediaFields): string {
  const s = [m.kind, m.productType, m.permalink, m.takenAt, m.caption, m.children.map((c) => `${c.id}:${c.kind}`).join(','), m.mediaUrl ? 1 : 0].join('\u0001');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
