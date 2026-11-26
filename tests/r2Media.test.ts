import { describe, expect, it, vi } from 'vitest';
import {
  generateR2ObjectKey,
  R2_CONFIG,
  resolveMediaPublicUrl,
  validateMediaFile,
} from '../src/config/media.ts';
import { createR2MediaMock, getMockPublishedMedia } from '../src/admin/mock/mediaMock.ts';
import { GALLERY_IMAGES } from '../src/data/images.ts';

describe('Cloudflare R2 Media Configuration & Key Generation', () => {
  it('defines correct bucket name and delivery base URL', () => {
    expect(R2_CONFIG.bucketName).toBe('eden-glow-media');
    expect(R2_CONFIG.publicBaseUrl).toBeDefined();
    expect(R2_CONFIG.publicBaseUrl.startsWith('http')).toBe(true);
  });

  it('generates predictable, secure object keys with appropriate folder prefixes', () => {
    const imgKey = generateR2ObjectKey('IMAGE', 'bridal_look_2026.jpg');
    expect(imgKey.storageKey.startsWith('gallery/images/')).toBe(true);
    expect(imgKey.storageKey.endsWith('.jpg')).toBe(true);
    expect(imgKey.fileName.startsWith('med_')).toBe(true);

    const vidKey = generateR2ObjectKey('VIDEO', 'salon_highlights.mp4');
    expect(vidKey.storageKey.startsWith('gallery/videos/')).toBe(true);
    expect(vidKey.storageKey.endsWith('.mp4')).toBe(true);
    expect(vidKey.fileName.startsWith('med_')).toBe(true);
  });

  it('resolves public delivery URLs cleanly without duplicate slashes', () => {
    const url = resolveMediaPublicUrl('gallery/images/test.jpg', 'https://media.edenglowstudio.com/');
    expect(url).toBe('https://media.edenglowstudio.com/gallery/images/test.jpg');
  });
});

describe('File Validation & Limits (Phase 3 & 4)', () => {
  it('accepts valid JPEG, PNG, and WebP images within 10 MB', () => {
    const jpg = new File(['dummy-bytes'], 'style.jpg', { type: 'image/jpeg' });
    const png = new File(['dummy-bytes'], 'look.png', { type: 'image/png' });
    const webp = new File(['dummy-bytes'], 'glow.webp', { type: 'image/webp' });

    expect(validateMediaFile(jpg).valid).toBe(true);
    expect(validateMediaFile(jpg).mediaType).toBe('IMAGE');
    expect(validateMediaFile(png).valid).toBe(true);
    expect(validateMediaFile(webp).valid).toBe(true);
  });

  it('accepts valid MP4 and WebM videos within 100 MB', () => {
    const mp4 = new File(['dummy-video'], 'reel.mp4', { type: 'video/mp4' });
    const webm = new File(['dummy-video'], 'tour.webm', { type: 'video/webm' });

    const mp4Res = validateMediaFile(mp4);
    expect(mp4Res.valid).toBe(true);
    expect(mp4Res.mediaType).toBe('VIDEO');

    const webmRes = validateMediaFile(webm);
    expect(webmRes.valid).toBe(true);
    expect(webmRes.mediaType).toBe('VIDEO');
  });

  it('rejects unsupported file formats', () => {
    const exe = new File(['malicious'], 'payload.exe', { type: 'application/x-msdownload' });
    const pdf = new File(['doc'], 'menu.pdf', { type: 'application/pdf' });

    const exeRes = validateMediaFile(exe);
    expect(exeRes.valid).toBe(false);
    expect(exeRes.error).toContain('Unsupported file format');

    const pdfRes = validateMediaFile(pdf);
    expect(pdfRes.valid).toBe(false);
  });

  it('rejects images exceeding 10 MB size limit', () => {
    const bigImg = new File([''], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(bigImg, 'size', { value: 11 * 1024 * 1024 });

    const res = validateMediaFile(bigImg);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('10 MB');
  });

  it('rejects videos exceeding 100 MB size limit', () => {
    const bigVid = new File([''], 'huge.mp4', { type: 'video/mp4' });
    Object.defineProperty(bigVid, 'size', { value: 105 * 1024 * 1024 });

    const res = validateMediaFile(bigVid);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('100 MB');
  });
});

describe('Cloudflare R2 Media Management Store (Phase 4, 6, 8)', () => {
  const api = createR2MediaMock(() => {});

  it('lists existing mock media items', async () => {
    const list = await api.list('ALL');
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('uploads a new image with progress callbacks and metadata', async () => {
    const progressSpy = vi.fn();
    const testFile = new File(['image-content'], 'test_hair.jpg', { type: 'image/jpeg' });

    const item = await api.upload(
      testFile,
      {
        title: 'Fresh Hair Cut',
        category: 'Hair',
        status: 'PUBLISHED',
      },
      progressSpy,
    );

    expect(item).toBeDefined();
    expect(item.id.startsWith('med_')).toBe(true);
    expect(item.mediaType).toBe('IMAGE');
    expect(item.storageProvider).toBe('CLOUDFLARE_R2');
    expect(item.status).toBe('PUBLISHED');
    expect(item.category).toBe('Hair');
    expect(progressSpy).toHaveBeenCalledWith(100);
  });

  it('uploads a new video with progress callbacks', async () => {
    const progressSpy = vi.fn();
    const testVideo = new File(['video-content'], 'salon_vlog.mp4', { type: 'video/mp4' });

    const item = await api.upload(
      testVideo,
      {
        title: 'Salon Transformation Video',
        status: 'HIDDEN',
      },
      progressSpy,
    );

    expect(item).toBeDefined();
    expect(item.mediaType).toBe('VIDEO');
    expect(item.status).toBe('HIDDEN');
    expect(progressSpy).toHaveBeenCalled();
  });

  it('toggles media status between PUBLISHED and HIDDEN', async () => {
    const list = await api.list('ALL');
    const first = list[0];
    const initialStatus = first.status;
    const targetStatus = initialStatus === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED';

    const updated = await api.setStatus(first.id, targetStatus);
    expect(updated.status).toBe(targetStatus);

    const reverted = await api.setStatus(first.id, initialStatus);
    expect(reverted.status).toBe(initialStatus);
  });

  it('reorders media items upward and downward', async () => {
    const list = await api.list('ALL');
    expect(list.length).toBeGreaterThanOrEqual(2);
    const second = list[1];

    const movedUp = await api.reorder(second.id, 'UP');
    expect(movedUp).toBe(true);

    const afterMove = await api.list('ALL');
    expect(afterMove[0].id).toBe(second.id);
  });

  it('deletes a media item', async () => {
    const testFile = new File(['temp'], 'to_delete.jpg', { type: 'image/jpeg' });
    const created = await api.upload(testFile, { title: 'To Delete', status: 'HIDDEN' });

    const deleted = await api.delete(created.id);
    expect(deleted).toBe(true);

    const found = await api.get(created.id);
    expect(found).toBeNull();
  });

  it('filters published media for public visitors (hidden media never exposed)', () => {
    const publishedOnly = getMockPublishedMedia();
    for (const item of publishedOnly) {
      expect(item.status).toBe('PUBLISHED');
    }
  });
});

describe('Stock Gallery Integrity (Phase 7)', () => {
  it('preserves all 40 original stock gallery images intact', () => {
    expect(GALLERY_IMAGES.length).toBe(40);
  });

  it('retains all 40 images with valid categories and ratios', () => {
    for (const img of GALLERY_IMAGES) {
      expect(img.cat).toBeDefined();
      expect(img.caption).toBeDefined();
      expect(img.src.startsWith('http')).toBe(true);
      expect(img.full.startsWith('http')).toBe(true);
    }
  });
});
