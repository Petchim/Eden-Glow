export type VideoStatus = 'PUBLISHED' | 'HIDDEN';
export type VideoPostType = 'REEL' | 'VIDEO';

export interface GalleryVideo {
  id: string; // vid_SHORTCODE
  instagramUrl: string;
  shortcode: string;
  postType: VideoPostType;
  status: VideoStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreateVideoInput {
  url: string;
  status?: VideoStatus;
}

export interface VideoAdminApi {
  list(filter?: 'ALL' | VideoStatus): Promise<GalleryVideo[]>;
  create(input: CreateVideoInput): Promise<GalleryVideo>;
  setStatus(id: string, status: VideoStatus): Promise<GalleryVideo>;
  reorder(id: string, direction: 'UP' | 'DOWN'): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}
