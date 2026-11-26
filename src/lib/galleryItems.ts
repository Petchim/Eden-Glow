/* =====================================================================
   INSTAGRAM POSTS → GALLERY ITEMS (no Firebase code here)
   ---------------------------------------------------------------------
   The same shape comes from the Worker's public cache (normal path) and
   from Firestore (fallback), so one converter serves both.
   ===================================================================== */
import type { GalleryImage, GallerySlide } from '../types/content.ts';

/** A published post as cached by the Worker / stored in galleryMedia (public fields). */
export interface MediaDoc {
  kind: 'image' | 'video' | 'carousel';
  isReel?: boolean;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  caption: string;
  takenAt: string;
  children?: { kind: 'image' | 'video'; mediaUrl: string | null; thumbnailUrl: string | null }[];
  category: string | null;
  featured: boolean;
  altText?: string;
  sortOrder: number;
  /** Instagram's like count, when Instagram provides one. */
  likeCount?: number | null;
}

/** Document ids look like ig_<Instagram media id>; anything else is never requested. */
export const isMediaId = (id: unknown): id is string => typeof id === 'string' && /^ig_[A-Za-z0-9_]{1,64}$/.test(id);

/** First line of an Instagram caption without trailing hashtags/mentions, for tiles. */
export function shortCaption(caption: string, max = 80): string {
  const line = String(caption || '').split(/\r?\n/).find((l) => l.replace(/[#@]\S+/g, '').trim()) || '';
  const text = line.replace(/(\s*[#@]\S+)+\s*$/g, '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function toGalleryItem(id: string, d: MediaDoc): GalleryImage | null {
  const cover = d.thumbnailUrl || (d.kind === 'image' ? d.mediaUrl : null) || '';
  const slides: GallerySlide[] | undefined =
    d.kind === 'carousel'
      ? (d.children || [])
          .map((c): GallerySlide => ({ kind: c.kind, src: c.thumbnailUrl || c.mediaUrl || '', video: c.kind === 'video' ? c.mediaUrl || undefined : undefined }))
          .filter((s) => s.src || s.video)
      : undefined;
  const caption = shortCaption(d.caption) || (d.kind === 'video' ? 'Video from our Instagram' : 'From our Instagram');
  const cat = d.category || 'Instagram';
  return {
    id,
    source: 'instagram',
    kind: d.kind,
    cat,
    caption,
    src: cover,
    full: d.kind === 'image' ? d.mediaUrl || cover : cover,
    video: d.kind === 'video' ? d.mediaUrl || undefined : undefined,
    slides,
    permalink: d.permalink,
    isReel: !!d.isReel,
    featured: !!d.featured,
    alt: d.altText?.trim() || `${cat}: ${shortCaption(d.caption, 140) || 'Instagram post from Eden Glow Studio'}`,
    takenAt: d.takenAt || undefined,
    fullCaption: String(d.caption || ''),
    likeCount: typeof d.likeCount === 'number' && d.likeCount >= 0 ? d.likeCount : undefined,
    // Instagram doesn't say a post's shape; Reels are 9:16, feed posts are usually 4:5.
    ratio: d.kind === 'video' ? 't' : 'p',
  };
}

/** Items that can actually be shown (have a cover or a video). */
export const showable = (items: (GalleryImage | null)[]): GalleryImage[] => items.filter((x): x is GalleryImage => !!x && !!(x.src || x.video));
