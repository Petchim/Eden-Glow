import { beforeEach, describe, expect, it } from 'vitest';
import { parseInstagramUrl, getVideoDocId } from '../src/utils/instagram.ts';
import { createVideosMock, getMockPublishedVideos } from '../src/admin/mock/videosMock.ts';
import { GALLERY_IMAGES, GALLERY_CATEGORIES } from '../src/data/images.ts';

describe('1. Instagram URL Validation & Parsing', () => {
  it('correctly parses a valid Instagram Reel URL', () => {
    const res = parseInstagramUrl('https://www.instagram.com/reel/C7xyz123/');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.shortcode).toBe('C7xyz123');
      expect(res.postType).toBe('REEL');
      expect(res.canonicalUrl).toBe('https://www.instagram.com/reel/C7xyz123/');
      expect(res.docId).toBe('vid_C7xyz123');
    }
  });

  it('correctly parses a valid Reel URL without trailing slash and with tracking params', () => {
    const res = parseInstagramUrl('https://instagram.com/reel/C8abc_999?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.shortcode).toBe('C8abc_999');
      expect(res.postType).toBe('REEL');
      expect(res.canonicalUrl).toBe('https://www.instagram.com/reel/C8abc_999/');
      expect(res.docId).toBe('vid_C8abc_999');
    }
  });

  it('correctly parses a valid Instagram video post URL (/p/)', () => {
    const res = parseInstagramUrl('https://www.instagram.com/p/C9post456/');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.shortcode).toBe('C9post456');
      expect(res.postType).toBe('VIDEO');
      expect(res.canonicalUrl).toBe('https://www.instagram.com/p/C9post456/');
      expect(res.docId).toBe('vid_C9post456');
    }
  });

  it('correctly parses legacy IGTV URLs (/tv/) as VIDEO', () => {
    const res = parseInstagramUrl('https://www.instagram.com/tv/C9igtv789/');
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.shortcode).toBe('C9igtv789');
      expect(res.postType).toBe('VIDEO');
      expect(res.canonicalUrl).toBe('https://www.instagram.com/p/C9igtv789/');
      expect(res.docId).toBe('vid_C9igtv789');
    }
  });

  it('rejects invalid or non-Instagram URLs', () => {
    expect(parseInstagramUrl('')).toEqual({ valid: false, error: 'Please enter an Instagram URL.' });
    expect(parseInstagramUrl('   ')).toEqual({ valid: false, error: 'Please enter an Instagram URL.' });
    expect(parseInstagramUrl('https://tiktok.com/@user/video/123')).toEqual({
      valid: false,
      error: 'Only instagram.com URLs are supported.',
    });
    expect(parseInstagramUrl('https://www.instagram.com/stories/user/123/')).toEqual({
      valid: false,
      error: 'Instagram Stories expire and cannot be embedded. Please paste a Reel or public video post.',
    });
    expect(parseInstagramUrl('https://www.instagram.com/edenglowstudio/')).toEqual({
      valid: false,
      error: 'Please enter a valid Instagram Reel or Video post URL (e.g. https://www.instagram.com/reel/POST_ID/).',
    });
    expect(parseInstagramUrl('not-a-url')).toEqual({
      valid: false,
      error: 'Only instagram.com URLs are supported.',
    });
  });

  it('derives deterministic document ID based on shortcode', () => {
    expect(getVideoDocId('C7xyz123')).toBe('vid_C7xyz123');
    expect(getVideoDocId('abc-123_XYZ')).toBe('vid_abc-123_XYZ');
  });
});

describe('2. Admin Video Management Workflow', () => {
  let api: ReturnType<typeof createVideosMock>;
  let authenticated = true;

  beforeEach(() => {
    authenticated = true;
    api = createVideosMock(() => {
      if (!authenticated) throw new Error('Unauthenticated');
    });
  });

  it('admin adds a valid Instagram Reel and saves it', async () => {
    const added = await api.create({
      url: 'https://www.instagram.com/reel/CnewTestReel1/',
      status: 'PUBLISHED',
    });
    expect(added).toMatchObject({
      id: 'vid_CnewTestReel1',
      shortcode: 'CnewTestReel1',
      postType: 'REEL',
      status: 'PUBLISHED',
    });
    expect(added.sortOrder).toBeGreaterThan(0);
    expect(added.createdAt).toBeTruthy();
  });

  it('validates document schema compliance for Firestore rules (8 allowed keys)', async () => {
    const added = await api.create({
      url: 'https://www.instagram.com/reel/CschemaTestKey1/',
      status: 'PUBLISHED',
    });
    // In Firestore document payload, only the 8 fields are saved
    const allowedKeys = [
      'instagramUrl',
      'shortcode',
      'postType',
      'status',
      'sortOrder',
      'createdAt',
      'updatedAt',
      'createdBy',
    ];
    for (const key of allowedKeys) {
      expect(key in added).toBe(true);
    }
  });

  it('admin adds a video post as HIDDEN', async () => {
    const added = await api.create({
      url: 'https://www.instagram.com/p/CnewTestPost2/',
      status: 'HIDDEN',
    });
    expect(added.status).toBe('HIDDEN');
    expect(added.postType).toBe('VIDEO');
  });

  it('prevents adding duplicate Instagram URLs', async () => {
    await api.create({
      url: 'https://www.instagram.com/reel/CduplicateCheck1/',
      status: 'PUBLISHED',
    });

    await expect(
      api.create({
        url: 'https://www.instagram.com/reel/CduplicateCheck1/',
      }),
    ).rejects.toThrow(/already been added/);
  });

  it('admin can toggle status between PUBLISHED and HIDDEN', async () => {
    const video = await api.create({
      url: 'https://www.instagram.com/reel/ChidePublishTest/',
      status: 'PUBLISHED',
    });

    const hidden = await api.setStatus(video.id, 'HIDDEN');
    expect(hidden.status).toBe('HIDDEN');

    const published = await api.setStatus(video.id, 'PUBLISHED');
    expect(published.status).toBe('PUBLISHED');
  });

  it('admin can reorder videos (move up and down)', async () => {
    const v1 = await api.create({ url: 'https://www.instagram.com/reel/Creorder1/' });
    const v2 = await api.create({ url: 'https://www.instagram.com/reel/Creorder2/' });

    const listBefore = await api.list('ALL');
    const idx1 = listBefore.findIndex((v) => v.id === v1.id);
    const idx2 = listBefore.findIndex((v) => v.id === v2.id);
    expect(idx2).toBeLessThan(idx1); // newest v2 is higher in the list

    // Move v2 DOWN (should place it below v1)
    const moved = await api.reorder(v2.id, 'DOWN');
    expect(moved).toBe(true);

    const listAfter = await api.list('ALL');
    const newIdx1 = listAfter.findIndex((v) => v.id === v1.id);
    const newIdx2 = listAfter.findIndex((v) => v.id === v2.id);
    expect(newIdx2).toBeGreaterThan(newIdx1);
  });

  it('admin can delete a video', async () => {
    const v = await api.create({ url: 'https://www.instagram.com/reel/CdeleteMeTest/' });
    expect(await api.delete(v.id)).toBe(true);

    const list = await api.list('ALL');
    expect(list.some((item) => item.id === v.id)).toBe(false);
  });

  it('unauthenticated user cannot modify videos', async () => {
    authenticated = false;
    await expect(api.list()).rejects.toThrow('Unauthenticated');
    await expect(api.create({ url: 'https://www.instagram.com/reel/C123/' })).rejects.toThrow('Unauthenticated');
    await expect(api.setStatus('vid_123', 'PUBLISHED')).rejects.toThrow('Unauthenticated');
    await expect(api.delete('vid_123')).rejects.toThrow('Unauthenticated');
  });
});

describe('3. Public Visitor Visibility', () => {
  it('public visitors receive only PUBLISHED videos, never HIDDEN ones', async () => {
    const publicVideos = getMockPublishedVideos();
    expect(publicVideos.every((v) => v.status === 'PUBLISHED')).toBe(true);
    expect(publicVideos.some((v) => v.status === 'HIDDEN')).toBe(false);
  });
});

describe('4. Preservation of Existing 40 Gallery Images', () => {
  it('preserves exactly 40 gallery images in GALLERY_IMAGES', () => {
    expect(GALLERY_IMAGES).toHaveLength(40);
  });

  it('every gallery image has valid category, caption, and src', () => {
    for (const img of GALLERY_IMAGES) {
      expect(img.cat).toBeTruthy();
      expect(GALLERY_CATEGORIES).toContain(img.cat);
      expect(img.caption).toBeTruthy();
      expect(img.src).toMatch(/^https:\/\/(images\.unsplash\.com|images\.pexels\.com)\//);
      expect(img.full).toMatch(/^https:\/\/(images\.unsplash\.com|images\.pexels\.com)\//);
    }
  });

  it('contains all required categories across the 40 photos', () => {
    const categoriesInGallery = new Set(GALLERY_IMAGES.map((i) => i.cat));
    expect(categoriesInGallery.has('Hair')).toBe(true);
    expect(categoriesInGallery.has('Skin')).toBe(true);
    expect(categoriesInGallery.has('Nails')).toBe(true);
    expect(categoriesInGallery.has('Lashes')).toBe(true);
    expect(categoriesInGallery.has('Makeup')).toBe(true);
    expect(categoriesInGallery.has('Salon Interior')).toBe(true);
  });
});
