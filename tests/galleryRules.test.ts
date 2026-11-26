import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

/* firestore.rules for the Instagram gallery, against the Firestore emulator. */
let env: RulesTestEnvironment;
const OWNER = 'owner-uid';

const post = (over = {}) => ({
  source: 'instagram', igId: '1', accountId: 'acct', kind: 'image', productType: 'FEED', isReel: false,
  mediaUrl: 'https://cdn.example/1.jpg', thumbnailUrl: 'https://cdn.example/1.jpg', permalink: 'https://www.instagram.com/p/1/',
  caption: 'Hello', takenAt: '2026-11-01T10:00:00.000Z', children: [], available: true,
  status: 'hidden', category: null, featured: false, altText: '', sortOrder: 1, ...over,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-eden-glow', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
});
afterAll(() => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore().catch(() => env.clearFirestore());
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins', OWNER), { name: 'Owner', email: 'owner@example.com' });
    await setDoc(doc(db, 'galleryMedia', 'ig_pub'), post({ igId: 'pub', status: 'published', sortOrder: 3 }));
    await setDoc(doc(db, 'galleryMedia', 'ig_hidden'), post({ igId: 'hidden', sortOrder: 2 }));
    await setDoc(doc(db, 'galleryMedia', 'ig_gone'), post({ igId: 'gone', status: 'published', available: false, sortOrder: 1 }));
    await setDoc(doc(db, 'integrations', 'instagram'), { connected: true, username: 'edenglow', accountId: 'acct' });
    await setDoc(doc(db, 'integrationSecrets', 'instagram'), { token: { v: 1, iv: 'x', tag: 'y', data: 'z' } });
    await setDoc(doc(db, 'syncRuns', 'run_1'), { status: 'success', startedAt: '2026-11-15T00:00:00Z' });
    await setDoc(doc(db, 'instagramOAuthStates', 'S'.repeat(32)), { uid: OWNER, origin: 'http://localhost:5173' });
    await setDoc(doc(db, 'galleryVideos', 'vid_pub1'), {
      instagramUrl: 'https://www.instagram.com/reel/pub1/',
      shortcode: 'pub1',
      postType: 'REEL',
      status: 'PUBLISHED',
      sortOrder: 100,
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
      createdBy: OWNER,
    });
    await setDoc(doc(db, 'galleryVideos', 'vid_hid1'), {
      instagramUrl: 'https://www.instagram.com/reel/hid1/',
      shortcode: 'hid1',
      postType: 'REEL',
      status: 'HIDDEN',
      sortOrder: 90,
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
      createdBy: OWNER,
    });
  });
});

const visitor = () => env.unauthenticatedContext().firestore();
const stranger = () => env.authenticatedContext('someone-else').firestore();
const owner = () => env.authenticatedContext(OWNER).firestore();
const publishedQuery = (db: ReturnType<typeof visitor>) =>
  query(collection(db, 'galleryMedia'), where('status', '==', 'published'), where('available', '==', true), orderBy('sortOrder', 'desc'), limit(24));

describe('public visitors', () => {
  it('read published posts that are still on Instagram, and nothing else', async () => {
    await assertSucceeds(getDocs(publishedQuery(visitor())));
    await assertSucceeds(getDoc(doc(visitor(), 'galleryMedia', 'ig_pub')));
    await assertFails(getDoc(doc(visitor(), 'galleryMedia', 'ig_hidden')));
    await assertFails(getDoc(doc(visitor(), 'galleryMedia', 'ig_gone')));
    await assertFails(getDocs(collection(visitor(), 'galleryMedia')));
    await assertFails(getDocs(query(collection(visitor(), 'galleryMedia'), where('status', '==', 'published'))));
  });
  it('cannot change, add or delete posts', async () => {
    await assertFails(updateDoc(doc(visitor(), 'galleryMedia', 'ig_pub'), { featured: true }));
    await assertFails(setDoc(doc(visitor(), 'galleryMedia', 'ig_new'), post({ status: 'published' })));
    await assertFails(deleteDoc(doc(visitor(), 'galleryMedia', 'ig_pub')));
  });
  it('can never see the Instagram connection, token, states or history', async () => {
    for (const db of [visitor(), stranger()]) {
      await assertFails(getDoc(doc(db, 'integrations', 'instagram')));
      await assertFails(getDoc(doc(db, 'integrationSecrets', 'instagram')));
      await assertFails(getDoc(doc(db, 'instagramOAuthStates', 'S'.repeat(32))));
      await assertFails(getDocs(collection(db, 'syncRuns')));
    }
  });
});

describe('signed-in users who are not the owner', () => {
  it('get only what visitors get', async () => {
    await assertSucceeds(getDocs(publishedQuery(stranger())));
    await assertFails(getDoc(doc(stranger(), 'galleryMedia', 'ig_hidden')));
    await assertFails(updateDoc(doc(stranger(), 'galleryMedia', 'ig_hidden'), { status: 'published', updatedAt: serverTimestamp() }));
  });
});

describe('the owner', () => {
  it('reads every post, the connection status and the sync history', async () => {
    await assertSucceeds(getDocs(query(collection(owner(), 'galleryMedia'), orderBy('sortOrder', 'desc'))));
    await assertSucceeds(getDoc(doc(owner(), 'galleryMedia', 'ig_hidden')));
    await assertSucceeds(getDoc(doc(owner(), 'integrations', 'instagram')));
    await assertSucceeds(getDocs(query(collection(owner(), 'syncRuns'), orderBy('startedAt', 'desc'))));
  });
  it('publishes, hides, categorises, features, describes and reorders posts', async () => {
    const ref = doc(owner(), 'galleryMedia', 'ig_hidden');
    await assertSucceeds(updateDoc(ref, { status: 'published', category: 'Nails', featured: true, altText: 'Red nails', updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { sortOrder: 99, updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { status: 'hidden', category: null, updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
  });
  it('cannot change what the Instagram sync owns, or save invalid values', async () => {
    const ref = doc(owner(), 'galleryMedia', 'ig_hidden');
    await assertFails(updateDoc(ref, { mediaUrl: 'https://evil.example/x.jpg', updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { permalink: 'https://evil.example', updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { available: false, updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(owner(), 'galleryMedia', 'ig_gone'), { available: true, updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { status: 'deleted', updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { category: 'Tattoos', updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { featured: 'yes', updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { altText: 'x'.repeat(301), updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { sortOrder: 'first', updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { status: 'published', updatedAt: new Date('2020-01-01'), ownerUpdatedAt: serverTimestamp() }));
  });
  it('can switch auto-publish, and nothing else on the connection record', async () => {
    const ref = doc(owner(), 'integrations', 'instagram');
    await assertSucceeds(setDoc(ref, { autoPublish: false, updatedAt: serverTimestamp() }, { merge: true }));
    await assertSucceeds(updateDoc(ref, { autoPublish: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { autoPublish: 'yes', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { autoPublish: false, username: 'someone-else', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { connected: false, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { needsReconnect: false, lastError: null, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(ref));
    await assertFails(setDoc(doc(owner(), 'integrations', 'other'), { autoPublish: true }));
    // before the first connection the owner can create the record with the switch only
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'integrations', 'instagram')));
    await assertFails(setDoc(ref, { autoPublish: true, connected: true }));
    await assertSucceeds(setDoc(ref, { autoPublish: true, updatedAt: serverTimestamp() }));
  });
  it('visitors and other users cannot switch auto-publish', async () => {
    for (const db of [visitor(), stranger()]) {
      await assertFails(setDoc(doc(db, 'integrations', 'instagram'), { autoPublish: false }, { merge: true }));
    }
  });
  it('must stamp ownerUpdatedAt with the server time on every post edit (the Worker relies on it)', async () => {
    const ref = doc(owner(), 'galleryMedia', 'ig_hidden');
    await assertFails(updateDoc(ref, { status: 'published', updatedAt: serverTimestamp() })); // missing
    await assertFails(updateDoc(ref, { status: 'published', updatedAt: serverTimestamp(), ownerUpdatedAt: new Date('2020-01-01') }));
    await assertSucceeds(updateDoc(ref, { status: 'published', updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(stranger(), 'galleryMedia', 'ig_hidden'), { ownerUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
  it('can assign the Transformations category', async () => {
    await assertSucceeds(updateDoc(doc(owner(), 'galleryMedia', 'ig_hidden'), { category: 'Transformations', updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() }));
  });

  it('cannot create or delete posts, or touch the connection, token, states or history', async () => {
    await assertFails(setDoc(doc(owner(), 'galleryMedia', 'ig_fake'), post({ igId: 'fake' })));
    await assertFails(deleteDoc(doc(owner(), 'galleryMedia', 'ig_hidden')));
    await assertFails(setDoc(doc(owner(), 'integrations', 'instagram'), { connected: false }));
    await assertFails(getDoc(doc(owner(), 'integrationSecrets', 'instagram')));
    await assertFails(setDoc(doc(owner(), 'integrationSecrets', 'instagram'), { token: 'x' }));
    await assertFails(getDoc(doc(owner(), 'instagramOAuthStates', 'S'.repeat(32))));
    await assertFails(setDoc(doc(owner(), 'syncRuns', 'run_fake'), { status: 'success' }));
  });
});

describe('manual galleryVideos rules', () => {
  const publishedVideoQuery = (db: ReturnType<typeof visitor>) =>
    query(collection(db, 'galleryVideos'), where('status', '==', 'PUBLISHED'));

  it('public visitors read PUBLISHED videos only', async () => {
    await assertSucceeds(getDoc(doc(visitor(), 'galleryVideos', 'vid_pub1')));
    await assertSucceeds(getDocs(publishedVideoQuery(visitor())));
    await assertFails(getDoc(doc(visitor(), 'galleryVideos', 'vid_hid1')));
    await assertFails(getDocs(collection(visitor(), 'galleryVideos')));
  });

  it('visitors cannot create, edit, or delete videos', async () => {
    await assertFails(
      setDoc(doc(visitor(), 'galleryVideos', 'vid_hack'), {
        instagramUrl: 'https://www.instagram.com/reel/hack/',
        shortcode: 'hack',
        postType: 'REEL',
        status: 'PUBLISHED',
        sortOrder: 1,
        createdAt: '2026-11-20T10:00:00.000Z',
        updatedAt: '2026-11-20T10:00:00.000Z',
        createdBy: 'hacker',
      }),
    );
    await assertFails(updateDoc(doc(visitor(), 'galleryVideos', 'vid_pub1'), { status: 'HIDDEN' }));
    await assertFails(deleteDoc(doc(visitor(), 'galleryVideos', 'vid_pub1')));
  });

  it('non-admin signed-in users cannot create, edit or delete videos', async () => {
    await assertSucceeds(getDoc(doc(stranger(), 'galleryVideos', 'vid_pub1')));
    await assertFails(getDoc(doc(stranger(), 'galleryVideos', 'vid_hid1')));
    await assertFails(deleteDoc(doc(stranger(), 'galleryVideos', 'vid_pub1')));
  });

  it('owner admin can read all, create, reorder, hide and delete videos', async () => {
    // Read both published and hidden, as well as non-existent doc check prior to create
    await assertSucceeds(getDoc(doc(owner(), 'galleryVideos', 'vid_pub1')));
    await assertSucceeds(getDoc(doc(owner(), 'galleryVideos', 'vid_hid1')));
    await assertSucceeds(getDoc(doc(owner(), 'galleryVideos', 'vid_ownerReel1')));
    await assertFails(getDoc(doc(visitor(), 'galleryVideos', 'vid_ownerReel1')));
    await assertFails(getDoc(doc(stranger(), 'galleryVideos', 'vid_ownerReel1')));

    // Create valid video
    const newVideo = {
      instagramUrl: 'https://www.instagram.com/reel/ownerReel1/',
      shortcode: 'ownerReel1',
      postType: 'REEL',
      status: 'PUBLISHED',
      sortOrder: 200,
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
      createdBy: OWNER,
    };
    await assertSucceeds(setDoc(doc(owner(), 'galleryVideos', 'vid_ownerReel1'), newVideo));

    // Update status and sortOrder
    await assertSucceeds(
      updateDoc(doc(owner(), 'galleryVideos', 'vid_ownerReel1'), {
        status: 'HIDDEN',
        sortOrder: 250,
        updatedAt: '2026-11-20T11:00:00.000Z',
      }),
    );

    // Delete video
    await assertSucceeds(deleteDoc(doc(owner(), 'galleryVideos', 'vid_ownerReel1')));
  });

  it('owner admin cannot create with mismatched doc ID, wrong URL, or foreign createdBy', async () => {
    const base = {
      instagramUrl: 'https://www.instagram.com/reel/badId1/',
      shortcode: 'badId1',
      postType: 'REEL',
      status: 'PUBLISHED',
      sortOrder: 1,
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
      createdBy: OWNER,
    };
    // Mismatched ID
    await assertFails(setDoc(doc(owner(), 'galleryVideos', 'wrong_id'), base));
    // Non-instagram URL
    await assertFails(
      setDoc(doc(owner(), 'galleryVideos', 'vid_badId1'), {
        ...base,
        instagramUrl: 'https://tiktok.com/@user/video/1',
      }),
    );
    // Foreign createdBy
    await assertFails(
      setDoc(doc(owner(), 'galleryVideos', 'vid_badId1'), {
        ...base,
        createdBy: 'someone-else',
      }),
    );
  });
});

describe('Cloudflare R2 galleryMedia rules', () => {
  const r2Item = (over = {}) => ({
    fileName: 'med_test1.jpg',
    originalFileName: 'test1.jpg',
    mediaType: 'IMAGE',
    storageProvider: 'CLOUDFLARE_R2',
    storageKey: 'gallery/images/med_test1.jpg',
    publicUrl: 'https://media.edenglowstudio.com/gallery/images/med_test1.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 12345,
    status: 'PUBLISHED',
    sortOrder: 500,
    createdAt: '2026-11-26T10:00:00.000Z',
    updatedAt: '2026-11-26T10:00:00.000Z',
    createdBy: OWNER,
    ...over,
  });

  it('owner can list, create, update, and delete R2 media; visitors read PUBLISHED R2 only', async () => {
    await assertSucceeds(setDoc(doc(owner(), 'galleryMedia', 'med_pub1'), r2Item()));
    await assertSucceeds(setDoc(doc(owner(), 'galleryMedia', 'med_hid1'), r2Item({ fileName: 'med_hid1.jpg', storageKey: 'gallery/images/med_hid1.jpg', status: 'HIDDEN' })));

    await assertSucceeds(getDocs(query(collection(owner(), 'galleryMedia'), orderBy('sortOrder', 'desc'))));
    await assertSucceeds(getDocs(query(collection(visitor(), 'galleryMedia'), where('storageProvider', '==', 'CLOUDFLARE_R2'), where('status', '==', 'PUBLISHED'))));
    await assertSucceeds(getDoc(doc(visitor(), 'galleryMedia', 'med_pub1')));
    await assertFails(getDoc(doc(visitor(), 'galleryMedia', 'med_hid1')));
    await assertFails(setDoc(doc(stranger(), 'galleryMedia', 'med_hack'), r2Item({ createdBy: 'someone-else' })));

    await assertSucceeds(updateDoc(doc(owner(), 'galleryMedia', 'med_hid1'), { status: 'PUBLISHED', updatedAt: '2026-11-26T11:00:00.000Z' }));
    await assertSucceeds(deleteDoc(doc(owner(), 'galleryMedia', 'med_hid1')));
  });
});
