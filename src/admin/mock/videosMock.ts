import type { CreateVideoInput, GalleryVideo, VideoAdminApi, VideoStatus } from '../../types/video.ts';
import { parseInstagramUrl } from '../../utils/instagram.ts';
import { ApiError } from '../api/engine.ts';

const wait = <T>(v: T, ms = 120) => new Promise<T>((res) => setTimeout(() => res(structuredClone(v)), ms));

let mockVideos: GalleryVideo[] = [
  {
    id: 'vid_C7demoGlowReel1',
    instagramUrl: 'https://www.instagram.com/reel/C7demoGlowReel1/',
    shortcode: 'C7demoGlowReel1',
    postType: 'REEL',
    status: 'PUBLISHED',
    sortOrder: 1716000000000,
    createdAt: '2026-11-15T10:30:00.000Z',
    updatedAt: '2026-11-15T10:30:00.000Z',
    createdBy: 'demo-admin-uid',
  },
  {
    id: 'vid_C7demoHairVideo2',
    instagramUrl: 'https://www.instagram.com/p/C7demoHairVideo2/',
    shortcode: 'C7demoHairVideo2',
    postType: 'VIDEO',
    status: 'PUBLISHED',
    sortOrder: 1715900000000,
    createdAt: '2026-11-14T15:20:00.000Z',
    updatedAt: '2026-11-14T15:20:00.000Z',
    createdBy: 'demo-admin-uid',
  },
];

export function getMockPublishedVideos(): GalleryVideo[] {
  return mockVideos
    .filter((v) => v.status === 'PUBLISHED')
    .sort((a, b) => b.sortOrder - a.sortOrder);
}

export function createVideosMock(requireAuth: () => void): VideoAdminApi {
  return {
    async list(filter: 'ALL' | VideoStatus = 'ALL'): Promise<GalleryVideo[]> {
      requireAuth();
      const filtered = mockVideos.filter((v) => filter === 'ALL' || v.status === filter);
      const sorted = [...filtered].sort((a, b) => b.sortOrder - a.sortOrder);
      return wait(sorted);
    },

    async create(input: CreateVideoInput): Promise<GalleryVideo> {
      requireAuth();
      const parsed = parseInstagramUrl(input.url);
      if (!parsed.valid) {
        throw new ApiError(400, parsed.error);
      }

      if (mockVideos.some((v) => v.id === parsed.docId || v.shortcode === parsed.shortcode)) {
        throw new ApiError(409, 'This Instagram video has already been added to the gallery.');
      }

      const now = new Date().toISOString();
      const newVideo: GalleryVideo = {
        id: parsed.docId,
        instagramUrl: parsed.canonicalUrl,
        shortcode: parsed.shortcode,
        postType: parsed.postType,
        status: input.status === 'HIDDEN' ? 'HIDDEN' : 'PUBLISHED',
        sortOrder: Date.now(),
        createdAt: now,
        updatedAt: now,
        createdBy: 'demo-admin-uid',
      };

      mockVideos.unshift(newVideo);
      return wait(newVideo);
    },

    async setStatus(id: string, status: VideoStatus): Promise<GalleryVideo> {
      requireAuth();
      const item = mockVideos.find((v) => v.id === id);
      if (!item) throw new ApiError(404, 'Video not found.');

      item.status = status;
      item.updatedAt = new Date().toISOString();
      return wait({ ...item });
    },

    async reorder(id: string, direction: 'UP' | 'DOWN'): Promise<boolean> {
      requireAuth();
      const sorted = [...mockVideos].sort((a, b) => b.sortOrder - a.sortOrder);
      const idx = sorted.findIndex((v) => v.id === id);
      if (idx === -1) throw new ApiError(404, 'Video not found.');

      const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sorted.length) return false;

      const current = sorted[idx];
      const target = sorted[targetIdx];

      const tempOrder = current.sortOrder;
      current.sortOrder = target.sortOrder;
      target.sortOrder = tempOrder;

      current.updatedAt = new Date().toISOString();
      target.updatedAt = new Date().toISOString();

      return wait(true);
    },

    async delete(id: string): Promise<boolean> {
      requireAuth();
      const idx = mockVideos.findIndex((v) => v.id === id);
      if (idx === -1) throw new ApiError(404, 'Video not found.');
      mockVideos.splice(idx, 1);
      return wait(true);
    },
  };
}
