/* =====================================================================
   INSTAGRAM GALLERY — Firebase backend for the admin screens.
   ---------------------------------------------------------------------
   Reads:  galleryMedia, integrations/instagram, syncRuns (owner-only
           reads in firestore.rules).
   Writes: only the owner's fields on a post (status, category,
           featured, alt text, order, always stamped with ownerUpdatedAt)
           and the auto-publish switch on integrations/instagram;
           firestore.rules refuses anything else, so a mistake here can
           never alter what the sync owns.
   After a change the Worker is told to update the public cache
   (/gallery/revalidate); if that call is lost, the Worker's 15-minute
   check finds the change by its ownerUpdatedAt anyway.
   Actions that need the Instagram token (connect, disconnect, sync) go
   to the Cloudflare Worker with the owner's Firebase ID token; the
   Worker checks it is the owner. The token never comes to the browser.
   ===================================================================== */
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { firebase } from '../../lib/firebase.ts';
import { instagramApiUrl } from '../../lib/firebaseConfig.ts';
import { ApiError, fail } from './engine.ts';
import {
  MEDIA_CATEGORIES,
  type GalleryAdminApi,
  type GalleryCounts,
  type GalleryListQuery,
  type GalleryMediaPatch,
  type GalleryMediaRow,
  type InstagramStatus,
  type MediaStatus,
  type SyncRunRow,
} from './galleryTypes.ts';

/** Wraps each call with the owner check and error mapping used by the rest of the admin. */
export type Guard = <A extends unknown[], R>(fn: (...args: A) => R) => (...args: A) => Promise<Awaited<R>>;

/**
 * POST to the Instagram Worker with the owner's Firebase ID token. The Worker's error messages are
 * written for the owner, so they are passed through; no token or secret is ever in a response.
 */
async function callWorker<T>(path: string, body: unknown = {}): Promise<T> {
  if (!instagramApiUrl) throw new ApiError(503, 'The Instagram service is not set up yet (VITE_INSTAGRAM_API_URL is empty).');
  const user = firebase().auth.currentUser;
  if (!user) throw new ApiError(401, 'Your session has expired. Please sign in again.');
  let res: Response;
  try {
    res = await fetch(`${instagramApiUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
    });
  } catch {
    throw new ApiError(503, 'Can’t reach the Instagram service. Check the internet connection and try again.');
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok) throw new ApiError(res.status, data?.error?.message || 'Something went wrong. Please try again.');
  return data as T;
}

/** Tell the Worker which posts changed so the public gallery updates now. Never fails the owner's
 *  edit: if this is lost, the Worker's 15-minute check finds the change by ownerUpdatedAt. */
function notifyWorker(ids: string[], refreshLinks = false): void {
  if (!instagramApiUrl || !ids.length) return;
  callWorker('/gallery/revalidate', { ids, refreshLinks }).catch(() => {});
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

function toRow(id: string, d: DocumentData): GalleryMediaRow {
  return {
    id,
    kind: d.kind === 'video' || d.kind === 'carousel' ? d.kind : 'image',
    isReel: d.isReel === true,
    productType: str(d.productType, 'FEED'),
    caption: str(d.caption),
    permalink: str(d.permalink),
    mediaUrl: strOrNull(d.mediaUrl),
    thumbnailUrl: strOrNull(d.thumbnailUrl),
    children: Array.isArray(d.children)
      ? d.children.map((c: DocumentData) => ({ kind: c.kind === 'video' ? 'video' : 'image', mediaUrl: strOrNull(c.mediaUrl), thumbnailUrl: strOrNull(c.thumbnailUrl) }))
      : [],
    takenAt: str(d.takenAt),
    available: d.available === true,
    syncedAt: strOrNull(d.syncedAt),
    likeCount: typeof d.likeCount === 'number' ? d.likeCount : null,
    status: d.status === 'published' ? 'published' : 'hidden',
    category: MEDIA_CATEGORIES.includes(d.category) ? d.category : null,
    featured: d.featured === true,
    altText: str(d.altText),
    sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
  };
}

function validPatch(p: GalleryMediaPatch): GalleryMediaPatch {
  const out: GalleryMediaPatch = {};
  if (p.status !== undefined) {
    if (p.status !== 'hidden' && p.status !== 'published') fail(400, 'Choose Published or Hidden.');
    out.status = p.status;
  }
  if (p.category !== undefined) {
    if (p.category !== null && !MEDIA_CATEGORIES.includes(p.category)) fail(400, 'Choose one of the gallery categories.', { category: 'Choose a category.' });
    out.category = p.category;
  }
  if (p.featured !== undefined) out.featured = p.featured === true;
  if (p.altText !== undefined) {
    const t = String(p.altText).trim();
    if (t.length > 300) fail(400, 'Keep the description under 300 characters.', { altText: 'Keep it under 300 characters.' });
    out.altText = t;
  }
  if (!Object.keys(out).length) fail(400, 'Nothing to change.');
  return out;
}

export function createGalleryFirestoreApi(guard: Guard): GalleryAdminApi {
  const db = () => firebase().db;
  const media = () => collection(db(), 'galleryMedia');

  return {
    status: guard(async (): Promise<InstagramStatus> => {
      const snap = await getDoc(doc(db(), 'integrations', 'instagram'));
      const d = snap.data() || {};
      const lock = d.syncLock as { until?: string } | undefined;
      return {
        connected: d.connected === true,
        username: str(d.username),
        accountType: str(d.accountType),
        connectedAt: strOrNull(d.connectedAt),
        tokenExpiresAt: strOrNull(d.tokenExpiresAt),
        tokenRefreshedAt: strOrNull(d.tokenRefreshedAt),
        lastSyncAt: strOrNull(d.lastSyncAt),
        lastSyncStatus: d.lastSyncStatus ?? null,
        lastError: d.lastError ?? null,
        needsReconnect: d.needsReconnect === true,
        syncing: !!lock?.until && Date.parse(lock.until) > Date.now(),
        autoPublish: d.autoPublish !== false,
      };
    }),

    // count() queries: Firestore returns only the numbers, not the documents
    counts: guard(async (): Promise<GalleryCounts> => {
      const n = async (...c: QueryConstraint[]) => (await getCountFromServer(query(media(), ...c))).data().count;
      const [total, published, unavailable] = await Promise.all([
        n(),
        n(where('status', '==', 'published')),
        n(where('status', '==', 'published'), where('available', '==', false)),
      ]);
      return { total, published, hidden: total - published, unavailable };
    }),

    setAutoPublish: guard(async (on: boolean) => {
      await setDoc(doc(db(), 'integrations', 'instagram'), { autoPublish: on === true, updatedAt: serverTimestamp() }, { merge: true });
    }),

    list: guard(async ({ status = 'all', cursor = null, pageSize = 24 }: GalleryListQuery = {}) => {
      const c: QueryConstraint[] = [];
      if (status !== 'all') c.push(where('status', '==', status));
      c.push(orderBy('sortOrder', 'desc'));
      if (cursor != null) c.push(startAfter(cursor));
      c.push(limit(pageSize));
      const snap = await getDocs(query(media(), ...c));
      const items = snap.docs.map((d) => toRow(d.id, d.data()));
      return { items, cursor: items.length === pageSize ? items[items.length - 1].sortOrder : null };
    }),

    update: guard(async (id: string, patch: GalleryMediaPatch) => {
      const ref = doc(media(), id);
      const clean = validPatch(patch);
      await updateDoc(ref, { ...clean, updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() });
      const snap = await getDoc(ref);
      if (!snap.exists()) fail(404, 'That post no longer exists.');
      // a post just published gets fresh Instagram links (hidden posts' links aren't refreshed on schedule)
      notifyWorker([id], clean.status === 'published');
      return toRow(snap.id, snap.data());
    }),

    move: guard(async (id: string, direction: 'up' | 'down', status: 'all' | MediaStatus = 'all') => {
      const ref = doc(media(), id);
      const cur = await getDoc(ref);
      if (!cur.exists()) fail(404, 'That post no longer exists.');
      const order = cur.get('sortOrder') as number;
      // "up" = shown earlier = the next higher sortOrder
      const c: QueryConstraint[] = status !== 'all' ? [where('status', '==', status)] : [];
      c.push(direction === 'up' ? where('sortOrder', '>', order) : where('sortOrder', '<', order));
      c.push(orderBy('sortOrder', direction === 'up' ? 'asc' : 'desc'), limit(1));
      const next = await getDocs(query(media(), ...c));
      if (next.empty) return false;
      const other = next.docs[0].ref;
      await runTransaction(db(), async (tx) => {
        const [a, b] = [await tx.get(ref), await tx.get(other)];
        if (!a.exists() || !b.exists()) fail(409, 'The list changed. Please try again.');
        const [oa, ob] = [a.get('sortOrder') as number, b.get('sortOrder') as number];
        tx.update(ref, { sortOrder: ob, updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() });
        tx.update(other, { sortOrder: oa, updatedAt: serverTimestamp(), ownerUpdatedAt: serverTimestamp() });
      });
      notifyWorker([id, other.id]);
      return true;
    }),

    history: guard(async (): Promise<SyncRunRow[]> => {
      const snap = await getDocs(query(collection(db(), 'syncRuns'), orderBy('startedAt', 'desc'), limit(20)));
      return snap.docs.map((d) => ({ ...(d.data() as SyncRunRow), id: d.id }));
    }),

    connect: guard(() => callWorker<{ url: string }>('/instagram/connect', { returnTo: window.location.origin })),
    disconnect: guard(async () => {
      await callWorker('/instagram/disconnect');
    }),
    syncNow: guard((retryOf?: string) => callWorker<SyncRunRow>('/instagram/sync', retryOf ? { retryOf } : {})),
  };
}
