/* =====================================================================
   CLOUDFLARE R2 MEDIA CONFIGURATION & VALIDATION
   ---------------------------------------------------------------------
   Central media configuration for Eden Glow Studio.
   Defines storage buckets, delivery domains, allowed MIME types,
   and file size limits.
   ===================================================================== */

import type { MediaType } from '../types/media.ts';

export const R2_CONFIG = {
  bucketName: 'eden-glow-media',
  // Preferred custom domain; fallbacks to window.location.origin or relative path if unconfigured
  publicBaseUrl: import.meta.env.VITE_MEDIA_BASE_URL || 'https://media.edenglowstudio.com',
  apiBaseUrl: import.meta.env.VITE_MEDIA_API_URL || import.meta.env.VITE_INSTAGRAM_API_URL || '',
};

export const MEDIA_LIMITS = {
  maxImageSizeBytes: 10 * 1024 * 1024, // 10 MB
  maxVideoSizeBytes: 100 * 1024 * 1024, // 100 MB
  allowedImageMimes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
  ] as const,
  allowedVideoMimes: [
    'video/mp4',
    'video/webm',
    'video/quicktime', // .mov
  ] as const,
  allowedImageExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.svg'] as const,
  allowedVideoExtensions: ['.mp4', '.webm', '.mov'] as const,
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mediaType?: MediaType;
}

export function validateMediaFile(file: File): FileValidationResult {
  const mime = file.type.toLowerCase();
  const ext = (file.name.slice(file.name.lastIndexOf('.')) || '').toLowerCase();

  const isImageMime = (MEDIA_LIMITS.allowedImageMimes as readonly string[]).includes(mime);
  const isVideoMime = (MEDIA_LIMITS.allowedVideoMimes as readonly string[]).includes(mime);
  const isImageExt = (MEDIA_LIMITS.allowedImageExtensions as readonly string[]).includes(ext);
  const isVideoExt = (MEDIA_LIMITS.allowedVideoExtensions as readonly string[]).includes(ext);

  if (!isImageMime && !isVideoMime && !isImageExt && !isVideoExt) {
    return {
      valid: false,
      error: 'Unsupported file format. Supported: JPG, PNG, WEBP, SVG, MP4, WebM.',
    };
  }

  const mediaType: MediaType = isVideoMime || isVideoExt ? 'VIDEO' : 'IMAGE';

  if (mediaType === 'IMAGE') {
    if (file.size > MEDIA_LIMITS.maxImageSizeBytes) {
      return {
        valid: false,
        error: `Image exceeds the 10 MB size limit (current: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      };
    }
  } else {
    if (file.size > MEDIA_LIMITS.maxVideoSizeBytes) {
      return {
        valid: false,
        error: `Video exceeds the 100 MB size limit (current: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      };
    }
  }

  return { valid: true, mediaType };
}

/**
 * Generate a predictable, collision-resistant object key for R2.
 * Structure: gallery/{images|videos}/{uniqueId}.{extension}
 */
export function generateR2ObjectKey(mediaType: MediaType, originalFileName: string): {
  mediaId: string;
  fileName: string;
  storageKey: string;
} {
  const ext = (originalFileName.slice(originalFileName.lastIndexOf('.')) || (mediaType === 'VIDEO' ? '.mp4' : '.jpg')).toLowerCase();
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  const mediaId = `med_${timestamp}_${randomPart}`;
  const fileName = `${mediaId}${ext}`;
  const folder = mediaType === 'VIDEO' ? 'videos' : 'images';
  const storageKey = `gallery/${folder}/${fileName}`;

  return { mediaId, fileName, storageKey };
}

/**
 * Resolve public delivery URL with safety checks.
 */
export function resolveMediaPublicUrl(storageKey: string, baseUrl = R2_CONFIG.publicBaseUrl): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanKey = storageKey.replace(/^\/+/, '');
  return `${cleanBase}/${cleanKey}`;
}
