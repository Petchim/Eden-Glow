import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GALLERY_CATEGORIES as SERVER_CATEGORIES } from '../worker/src/instagram/media.ts';
import { shortCaption, toGalleryItem } from '../src/lib/galleryItems.ts';
import { GALLERY_CATEGORIES, MEDIA_CATEGORY_LIST, REELS_FILTER } from '../src/data/images.ts';
import { MEDIA_CATEGORIES } from '../src/admin/api/galleryTypes.ts';

/* Website side of the Instagram gallery (the Worker's own tests are in worker/test/). */

describe('categories', () => {
  it('the website, admin, Worker and rules share one category list', () => {
    expect(MEDIA_CATEGORY_LIST).toEqual([...SERVER_CATEGORIES]);
    expect([...MEDIA_CATEGORIES]).toEqual([...SERVER_CATEGORIES]);
    expect(GALLERY_CATEGORIES).toEqual(['All', ...SERVER_CATEGORIES, REELS_FILTER]);
    // firestore.rules has to list the same categories
    const rules = readFileSync('firestore.rules', 'utf8');
    const listed = rules.match(/d\.category in \[([^\]]+)\]/)?.[1].split(',').map((s) => s.trim().replace(/'/g, ''));
    expect(listed).toEqual([...SERVER_CATEGORIES]);
  });
});

describe('public gallery items', () => {
  it('short captions drop hashtags, mentions and extra lines', () => {
    expect(shortCaption('Bridal glow for Sunday ✨ #bridal #makeup\nBook now')).toBe('Bridal glow for Sunday ✨');
    expect(shortCaption('#nails #gel\nGlossy red gel set')).toBe('Glossy red gel set');
    expect(shortCaption('x'.repeat(200), 20)).toHaveLength(20);
    expect(shortCaption('')).toBe('');
  });
  it('turns a stored (or cached) post into a gallery item the grid and viewer understand', () => {
    const base = { mediaUrl: 'https://cdn/v.mp4', thumbnailUrl: 'https://cdn/t.jpg', permalink: 'https://www.instagram.com/reel/1/', caption: 'Soft curls #hair', takenAt: '', featured: true, sortOrder: 1 };
    expect(toGalleryItem('ig_1', { ...base, kind: 'video', isReel: true, category: 'Hair', altText: '' })).toMatchObject({
      id: 'ig_1', source: 'instagram', kind: 'video', cat: 'Hair', caption: 'Soft curls', src: 'https://cdn/t.jpg', video: 'https://cdn/v.mp4', isReel: true, featured: true, ratio: 't', alt: 'Hair: Soft curls',
    });
    const img = toGalleryItem('ig_2', { ...base, kind: 'image', mediaUrl: 'https://cdn/i.jpg', thumbnailUrl: 'https://cdn/i.jpg', category: null, altText: 'Red nails' })!;
    expect(img).toMatchObject({ cat: 'Instagram', src: 'https://cdn/i.jpg', full: 'https://cdn/i.jpg', alt: 'Red nails' });
    expect(img.video).toBeUndefined();
    const car = toGalleryItem('ig_3', { ...base, kind: 'carousel', category: 'Nails', children: [{ kind: 'image', mediaUrl: 'https://cdn/a.jpg', thumbnailUrl: 'https://cdn/a.jpg' }, { kind: 'video', mediaUrl: 'https://cdn/b.mp4', thumbnailUrl: 'https://cdn/b.jpg' }] })!;
    expect(car.slides).toEqual([{ kind: 'image', src: 'https://cdn/a.jpg', video: undefined }, { kind: 'video', src: 'https://cdn/b.jpg', video: 'https://cdn/b.mp4' }]);
  });
});
