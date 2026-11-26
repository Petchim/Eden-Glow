import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { firebase } from '../../lib/firebase.ts';
import { parseInstagramUrl } from '../../utils/instagram.ts';
import type { CreateVideoInput, GalleryVideo, VideoAdminApi, VideoStatus } from '../../types/video.ts';
import { ApiError } from './engine.ts';

export type Guard = <A extends unknown[], R>(fn: (...args: A) => R) => (...args: A) => Promise<Awaited<R>>;

function toVideo(id: string, d: DocumentData): GalleryVideo {
  return {
    id,
    instagramUrl: typeof d.instagramUrl === 'string' ? d.instagramUrl : '',
    shortcode: typeof d.shortcode === 'string' ? d.shortcode : '',
    postType: d.postType === 'VIDEO' ? 'VIDEO' : 'REEL',
    status: d.status === 'HIDDEN' ? 'HIDDEN' : 'PUBLISHED',
    sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : new Date().toISOString(),
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : new Date().toISOString(),
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : '',
  };
}

export function createVideosFirestoreApi(guard: Guard): VideoAdminApi {
  const db = () => firebase().db;
  const col = () => collection(db(), 'galleryVideos');

  return {
    list: guard(async (filter: 'ALL' | VideoStatus = 'ALL'): Promise<GalleryVideo[]> => {
      // Order by sortOrder desc; filter in memory to avoid requiring a composite index
      const snap = await getDocs(query(col(), orderBy('sortOrder', 'desc')));
      const all = snap.docs.map((d) => toVideo(d.id, d.data()));
      return filter === 'ALL' ? all : all.filter((v) => v.status === filter);
    }),

    create: guard(async (input: CreateVideoInput): Promise<GalleryVideo> => {
      const parsed = parseInstagramUrl(input.url);
      if (!parsed.valid) {
        throw new ApiError(400, parsed.error);
      }

      const user = firebase().auth.currentUser;
      if (!user) {
        throw new ApiError(401, 'Your session has expired. Please sign in again.');
      }

      const videoRef = doc(col(), parsed.docId);
      const existing = await getDoc(videoRef);
      if (existing.exists()) {
        throw new ApiError(409, 'This Instagram video has already been added to the gallery.');
      }

      const now = new Date().toISOString();
      // Exclude 'id' from the document body to strictly satisfy firestore.rules hasOnly()
      const status: VideoStatus = input.status === 'HIDDEN' ? 'HIDDEN' : 'PUBLISHED';
      const videoData = {
        instagramUrl: parsed.canonicalUrl,
        shortcode: parsed.shortcode,
        postType: parsed.postType,
        status,
        sortOrder: Date.now(),
        createdAt: now,
        updatedAt: now,
        createdBy: user.uid,
      };

      await setDoc(videoRef, videoData);
      return {
        id: parsed.docId,
        ...videoData,
      };
    }),

    setStatus: guard(async (id: string, status: VideoStatus): Promise<GalleryVideo> => {
      const videoRef = doc(col(), id);
      const snap = await getDoc(videoRef);
      if (!snap.exists()) {
        throw new ApiError(404, 'Video not found.');
      }

      const now = new Date().toISOString();
      await updateDoc(videoRef, {
        status,
        updatedAt: now,
      });

      return toVideo(id, { ...snap.data(), status, updatedAt: now });
    }),

    reorder: guard(async (id: string, direction: 'UP' | 'DOWN'): Promise<boolean> => {
      const snap = await getDocs(query(col(), orderBy('sortOrder', 'desc')));
      const all = snap.docs.map((d) => ({ ref: d.ref, ...toVideo(d.id, d.data()) }));
      const idx = all.findIndex((v) => v.id === id);
      if (idx === -1) throw new ApiError(404, 'Video not found.');

      // "UP" means earlier in list (higher sortOrder), so swap with idx - 1
      // "DOWN" means later in list (lower sortOrder), so swap with idx + 1
      const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= all.length) return false;

      const current = all[idx];
      const target = all[targetIdx];

      const now = new Date().toISOString();
      await Promise.all([
        updateDoc(current.ref, { sortOrder: target.sortOrder, updatedAt: now }),
        updateDoc(target.ref, { sortOrder: current.sortOrder, updatedAt: now }),
      ]);

      return true;
    }),

    delete: guard(async (id: string): Promise<boolean> => {
      const videoRef = doc(col(), id);
      const snap = await getDoc(videoRef);
      if (!snap.exists()) {
        throw new ApiError(404, 'Video not found.');
      }
      await deleteDoc(videoRef);
      return true;
    }),
  };
}
