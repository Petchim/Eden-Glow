/* =====================================================================
   FIRESTORE + CLOUDFLARE R2 MEDIA API (Production Mode)
   ---------------------------------------------------------------------
   Handles media uploads to Cloudflare R2 and persists metadata in
   Firestore collection `galleryMedia/{mediaId}`.
   Uses XMLHttpRequest to stream real-time progress callbacks (0–100%).
   ===================================================================== */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { firebase } from '../../lib/firebase.ts';
import type {
  MediaPublishStatus,
  MediaType,
  R2MediaAdminApi,
  R2MediaItem,
} from '../../types/media.ts';
import {
  generateR2ObjectKey,
  R2_CONFIG,
  resolveMediaPublicUrl,
  validateMediaFile,
} from '../../config/media.ts';
import { ApiError } from './engine.ts';

export type Guard = <A extends unknown[], R>(fn: (...args: A) => R) => (...args: A) => Promise<Awaited<R>>;

function db(): Firestore {
  return firebase().db;
}

function mediaCol() {
  return collection(db(), 'galleryMedia');
}

/**
 * Upload binary file to Cloudflare Worker R2 Gateway with progress tracking.
 */
function uploadFileToR2(
  file: File,
  storageKey: string,
  onProgress?: (percent: number) => void,
): Promise<{ publicUrl: string }> {
  return new Promise((resolve, reject) => {
    const user = firebase().auth.currentUser;
    if (!user) {
      return reject(new ApiError(401, 'You must be signed in as an administrator to upload media.'));
    }

    user.getIdToken().then((token) => {
      const xhr = new XMLHttpRequest();
      const endpoint = `${R2_CONFIG.apiBaseUrl}/api/media/upload`;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ publicUrl: data.publicUrl || resolveMediaPublicUrl(storageKey) });
          } catch {
            resolve({ publicUrl: resolveMediaPublicUrl(storageKey) });
          }
        } else {
          // If Worker is not yet deployed or returns an error, provide clear guidance
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new ApiError(xhr.status, errData.message || 'Cloudflare R2 upload failed.'));
          } catch {
            reject(new ApiError(xhr.status || 502, `Cloudflare upload failed with HTTP ${xhr.status}.`));
          }
        }
      };

      xhr.onerror = () => {
        reject(
          new ApiError(
            503,
            'Unable to reach the Cloudflare R2 upload service. Verify the Worker address or configure local demo mode.',
          ),
        );
      };

      xhr.open('POST', endpoint);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('X-Storage-Key', storageKey);
      xhr.setRequestHeader('X-Original-Filename', encodeURIComponent(file.name));
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      xhr.send(file);
    }).catch(reject);
  });
}

export function createR2MediaApi(guard: Guard): R2MediaAdminApi {
  return {
    list: guard(async (
      filter: 'ALL' | MediaPublishStatus = 'ALL',
      typeFilter: 'ALL' | MediaType = 'ALL',
    ): Promise<R2MediaItem[]> => {
      // Order by sortOrder desc and filter in memory to avoid composite index dependencies
      const snap = await getDocs(query(mediaCol(), orderBy('sortOrder', 'desc'), limit(200)));
      return snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<R2MediaItem, 'id'>) }))
        .filter((item) => item.storageProvider === 'CLOUDFLARE_R2')
        .filter((item) => (filter === 'ALL' ? true : item.status === filter))
        .filter((item) => (typeFilter === 'ALL' ? true : item.mediaType === typeFilter));
    }),

    get: guard(async (id: string): Promise<R2MediaItem | null> => {
      const snap = await getDoc(doc(mediaCol(), id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...(snap.data() as Omit<R2MediaItem, 'id'>) };
    }),

    upload: guard(async (
      file: File,
      meta: {
        title?: string;
        caption?: string;
        category?: string;
        status?: MediaPublishStatus;
      },
      onProgress?: (percent: number) => void,
    ): Promise<R2MediaItem> => {
      // 1. Client-side file validation
      const validation = validateMediaFile(file);
      if (!validation.valid || !validation.mediaType) {
        throw new ApiError(400, validation.error || 'Invalid file format or size limit exceeded.');
      }

      const user = firebase().auth.currentUser;
      if (!user) {
        throw new ApiError(401, 'Your session has expired. Please sign in again.');
      }

      // 2. Predictable, secure key generation
      const { mediaId, fileName, storageKey } = generateR2ObjectKey(validation.mediaType, file.name);

      // 3. Upload to Cloudflare R2
      let publicUrl = resolveMediaPublicUrl(storageKey);
      if (R2_CONFIG.apiBaseUrl) {
        const uploadResult = await uploadFileToR2(file, storageKey, onProgress);
        publicUrl = uploadResult.publicUrl;
      } else {
        // If worker is not yet configured, simulate progress callback
        if (onProgress) {
          onProgress(50);
          await new Promise((r) => setTimeout(r, 100));
          onProgress(100);
        }
      }

      // 4. Save metadata document to Firestore
      const now = new Date().toISOString();
      const resolvedCategory = meta.category || (validation.mediaType === 'IMAGE' ? 'Hair' : undefined);

      const mediaDoc: Omit<R2MediaItem, 'id'> = {
        fileName,
        originalFileName: file.name,
        mediaType: validation.mediaType,
        storageProvider: 'CLOUDFLARE_R2',
        storageKey,
        publicUrl,
        mimeType: file.type || (validation.mediaType === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
        sizeBytes: file.size,
        status: meta.status || 'PUBLISHED',
        sortOrder: Date.now(),
        createdAt: now,
        updatedAt: now,
        createdBy: user.uid,
        title: meta.title?.trim() || file.name.replace(/\.[^/.]+$/, ''),
        caption: meta.caption?.trim() || '',
        ...(resolvedCategory ? { category: resolvedCategory } : {}),
      };

      await setDoc(doc(mediaCol(), mediaId), mediaDoc);

      return { id: mediaId, ...mediaDoc };
    }),

    setStatus: guard(async (id: string, status: MediaPublishStatus): Promise<R2MediaItem> => {
      const ref = doc(mediaCol(), id);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new ApiError(404, 'Media item not found.');

      const updatedAt = new Date().toISOString();
      await updateDoc(ref, { status, updatedAt });

      return {
        id: snap.id,
        ...(snap.data() as Omit<R2MediaItem, 'id'>),
        status,
        updatedAt,
      };
    }),

    reorder: guard(async (id: string, direction: 'UP' | 'DOWN'): Promise<boolean> => {
      const snap = await getDocs(query(mediaCol(), orderBy('sortOrder', 'desc'), limit(200)));
      const docs = snap.docs.filter((d) => d.data().storageProvider === 'CLOUDFLARE_R2');
      const idx = docs.findIndex((d) => d.id === id);
      if (idx === -1) throw new ApiError(404, 'Media item not found.');

      const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= docs.length) return false;

      const currentDoc = docs[idx];
      const targetDoc = docs[targetIdx];

      const currentOrder = currentDoc.data().sortOrder;
      const targetOrder = targetDoc.data().sortOrder;

      const now = new Date().toISOString();
      await Promise.all([
        updateDoc(doc(mediaCol(), currentDoc.id), { sortOrder: targetOrder, updatedAt: now }),
        updateDoc(doc(mediaCol(), targetDoc.id), { sortOrder: currentOrder, updatedAt: now }),
      ]);

      return true;
    }),

    delete: guard(async (id: string): Promise<boolean> => {
      const ref = doc(mediaCol(), id);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new ApiError(404, 'Media item not found.');

      const item = snap.data() as R2MediaItem;

      // Call Cloudflare Worker to delete the R2 object if API is reachable
      if (R2_CONFIG.apiBaseUrl && item.storageKey) {
        try {
          const token = await firebase().auth.currentUser?.getIdToken();
          if (token) {
            await fetch(`${R2_CONFIG.apiBaseUrl}/api/media/delete`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ storageKey: item.storageKey }),
            });
          }
        } catch (e) {
          console.warn('[R2 Delete] Object deletion request warning:', e);
        }
      }

      await deleteDoc(ref);
      return true;
    }),
  };
}
