/* =====================================================================
   CLOUDFLARE R2 MEDIA TYPES — Eden Glow Studio
   ---------------------------------------------------------------------
   Metadata for media files uploaded and hosted in Cloudflare R2.
   Firestore stores metadata only; binary files reside in Cloudflare R2.
   ===================================================================== */

export type MediaType = 'IMAGE' | 'VIDEO';
export type MediaStorageProvider = 'CLOUDFLARE_R2';
export type MediaPublishStatus = 'PUBLISHED' | 'HIDDEN';

export interface R2MediaItem {
  /** Deterministic ID or unique UUID, e.g. "med_abc123" */
  id: string;
  /** Sanitized unique filename in R2, e.g. "gallery_img_abc123.webp" */
  fileName: string;
  /** Original file name uploaded by admin, e.g. "bridal_hair_styling.jpg" */
  originalFileName: string;
  /** IMAGE or VIDEO */
  mediaType: MediaType;
  /** Always CLOUDFLARE_R2 */
  storageProvider: MediaStorageProvider;
  /** Full R2 object key, e.g. "gallery/images/gallery_img_abc123.jpg" */
  storageKey: string;
  /** Public CDN URL, e.g. "https://media.edenglowstudio.com/gallery/images/gallery_img_abc123.jpg" */
  publicUrl: string;
  /** MIME type, e.g. "image/jpeg" or "video/mp4" */
  mimeType: string;
  /** File size in bytes */
  sizeBytes: number;
  /** PUBLISHED or HIDDEN */
  status: MediaPublishStatus;
  /** Display sorting order (higher = appears first) */
  sortOrder: number;
  /** ISO 8601 timestamp string */
  createdAt: string;
  /** ISO 8601 timestamp string */
  updatedAt: string;
  /** Firebase Auth UID of the uploading admin */
  createdBy: string;
  /** Optional title or headline */
  title?: string;
  /** Optional caption or description */
  caption?: string;
  /** Category if applicable (Hair, Skin, Nails, Lashes, Makeup, Salon Interior, Transformations) */
  category?: string;
  /** Optional video thumbnail image URL */
  thumbnailUrl?: string;
  /** Video duration in seconds if known */
  durationSeconds?: number;
}

export interface CreateMediaUploadInput {
  file: File;
  title?: string;
  caption?: string;
  category?: string;
  status?: MediaPublishStatus;
}

export interface R2MediaAdminApi {
  list(filter?: 'ALL' | MediaPublishStatus, typeFilter?: 'ALL' | MediaType): Promise<R2MediaItem[]>;
  get(id: string): Promise<R2MediaItem | null>;
  upload(
    file: File,
    meta: {
      title?: string;
      caption?: string;
      category?: string;
      status?: MediaPublishStatus;
    },
    onProgress?: (percent: number) => void,
  ): Promise<R2MediaItem>;
  setStatus(id: string, status: MediaPublishStatus): Promise<R2MediaItem>;
  reorder(id: string, direction: 'UP' | 'DOWN'): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}
