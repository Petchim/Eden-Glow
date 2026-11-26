/* =====================================================================
   MOCK CLOUDFLARE R2 MEDIA API (Demo Mode)
   ---------------------------------------------------------------------
   In-memory store for media management in local demo mode.
   Simulates upload progress, generates mock CDN URLs, and supports
   full CRUD (Publish, Hide, Reorder, Delete).
   ===================================================================== */

import type {
  MediaPublishStatus,
  MediaType,
  R2MediaAdminApi,
  R2MediaItem,
} from '../../types/media.ts';
import { generateR2ObjectKey, resolveMediaPublicUrl, validateMediaFile } from '../../config/media.ts';
import { ApiError } from '../api/engine.ts';

const wait = <T>(v: T, ms = 100) => new Promise<T>((res) => setTimeout(() => res(structuredClone(v)), ms));

let mockMedia: R2MediaItem[] = [
  {
    id: 'med_demo_img_1',
    fileName: 'signature-facial-glow.jpg',
    originalFileName: 'signature-facial-glow.jpg',
    mediaType: 'IMAGE',
    storageProvider: 'CLOUDFLARE_R2',
    storageKey: 'gallery/images/signature-facial-glow.jpg',
    publicUrl: '/images/home/service-skin.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 175081,
    status: 'PUBLISHED',
    sortOrder: 1716100000000,
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    createdBy: 'demo-admin-uid',
    title: 'Signature Glow Facial',
    caption: 'Hydration and gentle facial massage',
    category: 'Skin',
  },
  {
    id: 'med_demo_img_2',
    fileName: 'bridal-styling-hair.jpg',
    originalFileName: 'bridal-styling-hair.jpg',
    mediaType: 'IMAGE',
    storageProvider: 'CLOUDFLARE_R2',
    storageKey: 'gallery/images/bridal-styling-hair.jpg',
    publicUrl: '/images/home/service-hair.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 400530,
    status: 'PUBLISHED',
    sortOrder: 1716000000000,
    createdAt: '2026-11-19T14:30:00.000Z',
    updatedAt: '2026-11-19T14:30:00.000Z',
    createdBy: 'demo-admin-uid',
    title: 'Bridal Half-Up Curls',
    caption: 'Soft, lasting romantic waves for wedding occasion',
    category: 'Hair',
  },
  {
    id: 'med_demo_vid_1',
    fileName: 'studio-highlights.mp4',
    originalFileName: 'studio-highlights.mp4',
    mediaType: 'VIDEO',
    storageProvider: 'CLOUDFLARE_R2',
    storageKey: 'gallery/videos/studio-highlights.mp4',
    publicUrl: 'https://media.edenglowstudio.com/gallery/videos/studio-highlights.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 4500000,
    status: 'PUBLISHED',
    sortOrder: 1715900000000,
    createdAt: '2026-11-18T12:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
    createdBy: 'demo-admin-uid',
    title: 'Eden Glow Studio Tour',
    caption: 'A glimpse into our serene salon spaces',
    category: 'Salon Interior',
  },
];

export function getMockPublishedMedia(): R2MediaItem[] {
  return mockMedia
    .filter((m) => m.status === 'PUBLISHED')
    .sort((a, b) => b.sortOrder - a.sortOrder);
}

export function createR2MediaMock(requireAuth: () => void): R2MediaAdminApi {
  return {
    async list(
      filter: 'ALL' | MediaPublishStatus = 'ALL',
      typeFilter: 'ALL' | MediaType = 'ALL',
    ): Promise<R2MediaItem[]> {
      requireAuth();
      const filtered = mockMedia.filter((m) => {
        const matchesStatus = filter === 'ALL' || m.status === filter;
        const matchesType = typeFilter === 'ALL' || m.mediaType === typeFilter;
        return matchesStatus && matchesType;
      });
      const sorted = [...filtered].sort((a, b) => b.sortOrder - a.sortOrder);
      return wait(sorted);
    },

    async get(id: string): Promise<R2MediaItem | null> {
      requireAuth();
      const item = mockMedia.find((m) => m.id === id);
      return wait(item ? { ...item } : null);
    },

    async upload(
      file: File,
      meta: {
        title?: string;
        caption?: string;
        category?: string;
        status?: MediaPublishStatus;
      },
      onProgress?: (percent: number) => void,
    ): Promise<R2MediaItem> {
      requireAuth();

      // 1. Validation
      const validation = validateMediaFile(file);
      if (!validation.valid || !validation.mediaType) {
        throw new ApiError(400, validation.error || 'Invalid file.');
      }

      // 2. Simulated upload progress steps
      if (onProgress) {
        onProgress(15);
        await new Promise((r) => setTimeout(r, 60));
        onProgress(45);
        await new Promise((r) => setTimeout(r, 80));
        onProgress(85);
        await new Promise((r) => setTimeout(r, 70));
        onProgress(100);
      }

      // 3. Object key generation
      const { mediaId, fileName, storageKey } = generateR2ObjectKey(validation.mediaType, file.name);
      
      // In browser demo mode, construct an accessible URL (Object URL or CDN URL)
      // For preview persistence in demo, we can generate a data URL or object URL
      let localUrl = '';
      try {
        localUrl = URL.createObjectURL(file);
      } catch {
        localUrl = resolveMediaPublicUrl(storageKey);
      }

      const now = new Date().toISOString();
      const newItem: R2MediaItem = {
        id: mediaId,
        fileName,
        originalFileName: file.name,
        mediaType: validation.mediaType,
        storageProvider: 'CLOUDFLARE_R2',
        storageKey,
        publicUrl: localUrl || resolveMediaPublicUrl(storageKey),
        mimeType: file.type || (validation.mediaType === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
        sizeBytes: file.size,
        status: meta.status || 'PUBLISHED',
        sortOrder: Date.now(),
        createdAt: now,
        updatedAt: now,
        createdBy: 'demo-admin-uid',
        title: meta.title?.trim() || file.name.replace(/\.[^/.]+$/, ''),
        caption: meta.caption?.trim() || '',
        category: meta.category || (validation.mediaType === 'IMAGE' ? 'Hair' : undefined),
      };

      mockMedia.unshift(newItem);
      return wait(newItem, 50);
    },

    async setStatus(id: string, status: MediaPublishStatus): Promise<R2MediaItem> {
      requireAuth();
      const item = mockMedia.find((m) => m.id === id);
      if (!item) throw new ApiError(404, 'Media item not found.');

      item.status = status;
      item.updatedAt = new Date().toISOString();
      return wait({ ...item });
    },

    async reorder(id: string, direction: 'UP' | 'DOWN'): Promise<boolean> {
      requireAuth();
      const sorted = [...mockMedia].sort((a, b) => b.sortOrder - a.sortOrder);
      const idx = sorted.findIndex((m) => m.id === id);
      if (idx === -1) throw new ApiError(404, 'Media item not found.');

      const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sorted.length) return false;

      const current = sorted[idx];
      const target = sorted[targetIdx];

      const tempOrder = current.sortOrder;
      current.sortOrder = target.sortOrder;
      target.sortOrder = tempOrder;

      return wait(true);
    },

    async delete(id: string): Promise<boolean> {
      requireAuth();
      const idx = mockMedia.findIndex((m) => m.id === id);
      if (idx === -1) throw new ApiError(404, 'Media item not found.');

      mockMedia.splice(idx, 1);
      return wait(true);
    },
  };
}
