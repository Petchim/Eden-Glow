/* =====================================================================
   PUBLIC INSTAGRAM GALLERY — FIRESTORE FALLBACK
   ---------------------------------------------------------------------
   The website normally reads the Worker's cache (./galleryCache.ts) and
   costs no Firestore reads. This module is used only when the Worker
   is not configured or can't be reached. It reads galleryMedia with
   Firestore Lite (one-off REST reads; no listeners, no offline cache),
   loaded on demand by the Gallery and Reel pages only.
   Cost: up to 48 reads per gallery visit (featured 12 + page 24 +
   videos 12), 24 per "Load more", 1 per Reel page.

   firestore.rules lets visitors read a post only when the owner has
   published it and it is still on Instagram, so every query here must
   ask for exactly that: status == 'published' AND available == true.
   ===================================================================== */
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore/lite';
import type { GalleryImage } from '../types/content.ts';
import type { GalleryVideo } from '../types/video.ts';
import type { R2MediaItem } from '../types/media.ts';
import { appConfig, emulatorHost, firebaseConfigured, usingEmulators } from './firebaseConfig.ts';
import { isMediaId, showable, toGalleryItem, type MediaDoc } from './galleryItems.ts';

export { isMediaId, shortCaption, toGalleryItem } from './galleryItems.ts';

let db: Firestore | null = null;
function lite(): Firestore {
  if (db) return db;
  const app = getApps().length ? getApp() : initializeApp(appConfig());
  db = getFirestore(app);
  if (usingEmulators) connectFirestoreEmulator(db, emulatorHost, 8080);
  return db;
}

export interface MediaPage {
  items: GalleryImage[];
  /** Pass back to load the next page; null when there are no more. */
  cursor: number | null;
}

const published = (): QueryConstraint[] => [where('status', '==', 'published'), where('available', '==', true)];

async function run(constraints: QueryConstraint[], size: number): Promise<MediaPage> {
  const snap = await getDocs(query(collection(lite(), 'galleryMedia'), ...published(), ...constraints, orderBy('sortOrder', 'desc'), limit(size)));
  const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() as DocumentData as MediaDoc }));
  const last = docs[docs.length - 1];
  return { items: showable(docs.map((d) => toGalleryItem(d.id, d.data))), cursor: docs.length === size && last ? last.data.sortOrder : null };
}

/** Published posts, newest (or highest in the owner's order) first. */
export const listPublishedMedia = (cursor: number | null = null, size = 24): Promise<MediaPage> =>
  run(cursor == null ? [] : [startAfter(cursor)], size);

/** The owner's featured posts. */
export const listFeaturedMedia = (size = 12): Promise<MediaPage> => run([where('featured', '==', true)], size);

/** Published videos (Reels and other videos) for the Reels section. */
export const listVideos = (size = 12): Promise<MediaPage> => run([where('kind', '==', 'video')], size);

/**
 * One published post for its own page, or null when it doesn't exist, is hidden or is no longer
 * on Instagram (firestore.rules refuses those reads, which is reported here as "not found").
 */
export async function getPublishedMedia(id: string): Promise<GalleryImage | null> {
  if (!isMediaId(id)) return null;
  try {
    const snap = await getDoc(doc(lite(), 'galleryMedia', id));
    if (!snap.exists()) return null;
    const d = snap.data() as MediaDoc & { status?: string; available?: boolean };
    if (d.status !== 'published' || d.available !== true) return null;
    return toGalleryItem(snap.id, d);
  } catch (e) {
    if ((e as { code?: string } | null)?.code === 'permission-denied') return null;
    throw e;
  }
}

/**
 * Public list of published manual Instagram videos (Reels and video posts).
 * Public visitors can read status == 'PUBLISHED' only.
 */
export async function listPublishedVideos(): Promise<GalleryVideo[]> {
  if (import.meta.env.VITE_ADMIN_DEMO === 'true' || !firebaseConfigured()) {
    const { getMockPublishedVideos } = await import('../admin/mock/videosMock.ts');
    return getMockPublishedVideos();
  }

  try {
    let snap;
    try {
      snap = await getDocs(
        query(
          collection(lite(), 'galleryVideos'),
          where('status', '==', 'PUBLISHED'),
          orderBy('sortOrder', 'desc'),
          limit(50)
        )
      );
    } catch {
      // Fallback query without orderBy in case composite index is not yet built in Firestore
      snap = await getDocs(
        query(
          collection(lite(), 'galleryVideos'),
          where('status', '==', 'PUBLISHED'),
          limit(50)
        )
      );
    }
    const list = snap.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as Omit<GalleryVideo, 'id'>),
      }))
      .sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0));
    if (!list.length && import.meta.env.VITE_ADMIN_DEMO === 'true') {
      const { getMockPublishedVideos } = await import('../admin/mock/videosMock.ts');
      return getMockPublishedVideos();
    }
    return list;
  } catch (err) {
    if (import.meta.env.VITE_ADMIN_DEMO === 'true') {
      const { getMockPublishedVideos } = await import('../admin/mock/videosMock.ts');
      return getMockPublishedVideos();
    }
    throw err;
  }
}

/**
 * Public list of published Cloudflare R2 media (Images and Videos).
 * Public visitors can read status == 'PUBLISHED' only.
 */
export async function listPublishedR2Media(): Promise<R2MediaItem[]> {
  if (import.meta.env.VITE_ADMIN_DEMO === 'true' || !firebaseConfigured()) {
    const { getMockPublishedMedia } = await import('../admin/mock/mediaMock.ts');
    return getMockPublishedMedia();
  }

  try {
    let snap;
    try {
      snap = await getDocs(
        query(
          collection(lite(), 'galleryMedia'),
          where('storageProvider', '==', 'CLOUDFLARE_R2'),
          where('status', '==', 'PUBLISHED'),
          orderBy('sortOrder', 'desc'),
          limit(100),
        ),
      );
    } catch {
      // Fallback query without orderBy in case composite index is not yet built in Firestore
      snap = await getDocs(
        query(
          collection(lite(), 'galleryMedia'),
          where('storageProvider', '==', 'CLOUDFLARE_R2'),
          where('status', '==', 'PUBLISHED'),
          limit(100),
        ),
      );
    }
    const list = snap.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as Omit<R2MediaItem, 'id'>),
      }))
      .sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0));
    if (!list.length && import.meta.env.VITE_ADMIN_DEMO === 'true') {
      const { getMockPublishedMedia } = await import('../admin/mock/mediaMock.ts');
      return getMockPublishedMedia();
    }
    return list;
  } catch (err) {
    if (import.meta.env.VITE_ADMIN_DEMO === 'true') {
      const { getMockPublishedMedia } = await import('../admin/mock/mediaMock.ts');
      return getMockPublishedMedia();
    }
    throw err;
  }
}
