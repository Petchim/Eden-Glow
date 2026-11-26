import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createBudget } from '../src/budget.ts';
import type { Env } from '../src/env.ts';
import { handle, makeContext } from '../src/index.ts';
import { createFirestoreRest } from '../src/firestore/rest.ts';
import { createGraphClient } from '../src/instagram/graph.ts';
import { mapMedia } from '../src/instagram/media.ts';
import { runIncremental } from '../src/sync/engine.ts';
import { saveConnection } from '../src/store/kv.ts';
import { fakeInstagram, memoryKV, post, publicCache, TEST_KEY_B64 } from './helpers.ts';

/* The Worker's Firestore REST code against the Auth + Firestore EMULATORS with the REAL
   firestore.rules: the Sync Bot can do exactly the approved gallery operations, nothing else.
   Runs under `npm test` (firebase emulators:exec). Never touches the real project. */
const PROJECT = 'demo-eden-glow';
const AUTH = '127.0.0.1:9099';
// Unique per run: other test files create their own users in the same Auth emulator.
const RUN = Date.now().toString(36);
const email = (who: string) => `worker-${who}-${RUN}@example.com`;
const FS = '127.0.0.1:8080';
let rules: RulesTestEnvironment;
const users: Record<string, { uid: string; token: string }> = {};

async function authUser(email: string): Promise<{ uid: string; token: string }> {
  const url = (op: string) => `http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${op}?key=demo-key`;
  const body = JSON.stringify({ email, password: 'emulator-only-password', returnSecureToken: true });
  let r = await fetch(url('signUp'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (!r.ok) r = await fetch(url('signInWithPassword'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const j = (await r.json()) as { localId: string; idToken: string };
  return { uid: j.localId, token: j.idToken };
}

const kvm = memoryKV();
const env: Env = {
  IG_KV: kvm.kv, FIREBASE_PROJECT_ID: PROJECT, FIREBASE_API_KEY: 'demo-key', INSTAGRAM_APP_ID: 'APP', INSTAGRAM_REDIRECT_URI: 'https://w.example/instagram/callback',
  ADMIN_ORIGINS: 'http://localhost:5173', INSTAGRAM_APP_SECRET: 'x', TOKEN_KEY: TEST_KEY_B64, SYNC_BOT_EMAIL: email('bot'), SYNC_BOT_PASSWORD: 'emulator-only-password',
  FIRESTORE_EMULATOR_HOST: FS, AUTH_EMULATOR_HOST: AUTH,
};
const raw = createFirestoreRest({ projectId: PROJECT, emulatorHost: FS, fetch: (u, i) => fetch(u, i) });
const synced = (id: string, over = {}) => ({ ...mapMedia(post(id), 'acct')!, ...over });

beforeAll(async () => {
  rules = await initializeTestEnvironment({ projectId: PROJECT, firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } });
  users.bot = await authUser(email('bot'));
  users.owner = await authUser(email('owner'));
  users.stranger = await authUser(email('stranger'));
  if (!users.bot.uid || !users.owner.uid || !users.stranger.uid) throw new Error('Could not create test users in the Auth emulator');
});
afterAll(() => rules?.cleanup());
beforeEach(async () => {
  await rules.clearFirestore().catch(() => rules.clearFirestore());
  for (const k of [...kvm.data.keys()]) kvm.data.delete(k);
  await rules.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'syncBots', users.bot.uid), { note: 'Instagram Worker' });
    await setDoc(doc(db, 'admins', users.owner.uid), { name: 'Owner', email: 'owner@example.com' });
    await setDoc(doc(db, 'customers', 'c1'), { name: 'Customer', phone: '+91 90000 00001', email: '', area: '', notes: '', status: 'active', createdAt: '2026-10-01' });
  });
});

describe('the Sync Bot, through the Worker’s REST code and the real rules', () => {
  it('creates new posts once (duplicate-safe), updates only Instagram fields, writes status and history', async () => {
    const { ctx } = await makeContext(env, createBudget(500));
    const now = new Date();
    expect(await ctx.repo.createPosts([synced('1'), synced('2')], { autoPublish: true, now })).toEqual({ created: ['1', '2'], existed: [] });
    expect(await ctx.repo.createPosts([synced('1'), synced('3')], { autoPublish: false, now })).toEqual({ created: ['3'], existed: ['1'] });

    // the owner makes choices; the bot's next update must not disturb them
    const owner = createFirestoreRest({ projectId: PROJECT, emulatorHost: FS, fetch: (u, i) => fetch(u, i) });
    await owner.commit([{ path: 'galleryMedia/ig_1', data: { featured: true, category: 'Nails' }, mask: ['featured', 'category'], serverTime: ['updatedAt', 'ownerUpdatedAt'] }], users.owner.token);
    await ctx.repo.updateSynced([synced('1', { caption: 'New caption', mediaUrl: 'https://cdn.example/new.jpg', likeCount: 57 })], now);
    const p1 = (await raw.get('galleryMedia/ig_1', users.owner.token))!.data;
    expect(p1).toMatchObject({ caption: 'New caption', mediaUrl: 'https://cdn.example/new.jpg', likeCount: 57, featured: true, category: 'Nails', status: 'published' });

    await ctx.repo.writeStatus({ connected: true, username: 'edenglow', lastSyncStatus: 'success', lastError: null });
    await ctx.repo.writeRun({ id: 'run_abc123', trigger: 'manual', retryOf: null, status: 'success', startedAt: now.toISOString(), finishedAt: now.toISOString(), pages: 1, fetched: 2, created: 2, updated: 0, removed: 0, skipped: 0, complete: true, error: null });
    expect(await ctx.repo.getPost('ig_3')).toMatchObject({ status: 'hidden' });
    expect(await ctx.repo.markUnavailable(['2'], now)).toBe(1);
    expect((await ctx.repo.getPost('ig_2'))!.available).toBe(false);
    // the owner's change is visible to the safety-net query (ownerUpdatedAt, server time)
    await owner.commit([{ path: 'galleryMedia/ig_3', data: { status: 'published' }, mask: ['status'], serverTime: ['updatedAt', 'ownerUpdatedAt'] }], users.owner.token);
    const changed = await ctx.repo.ownerChangedSince(null, 20);
    expect(changed.map((r) => r.id)).toEqual(['ig_1', 'ig_3']);
    expect(await ctx.repo.ownerChangedSince(changed[1].ownerUpdatedAt, 20)).toEqual([]);
    expect(await ctx.repo.pruneRuns(0)).toBe(1);
  });

  it('is refused everything outside the approved gallery operations', async () => {
    const { ctx } = await makeContext(env, createBudget(500));
    await ctx.repo.createPosts([synced('1')], { autoPublish: true, now: new Date() });
    const bot = users.bot.token;
    const denied = (op: Parameters<typeof raw.commit>[0][number]) => expect(raw.commit([op], bot)).rejects.toMatchObject({ status: 403 });

    await expect(raw.get('customers/c1', bot)).rejects.toMatchObject({ status: 403 });
    await expect(raw.get(`admins/${users.owner.uid}`, bot)).rejects.toMatchObject({ status: 403 });
    await denied({ path: 'galleryMedia/ig_1', data: { featured: true }, mask: ['featured'], serverTime: ['updatedAt'] });
    await denied({ path: 'galleryMedia/ig_1', data: { status: 'hidden' }, mask: ['status'], serverTime: ['updatedAt'] });
    await denied({ path: 'galleryMedia/ig_1', data: { sortOrder: 1 }, mask: ['sortOrder'], serverTime: ['updatedAt'] });
    await denied({ path: 'galleryMedia/ig_1', data: { igId: '999' }, mask: ['igId'], serverTime: ['updatedAt'] });
    await denied({ path: 'galleryMedia/ig_1', data: { mediaUrl: 'javascript:alert(1)' }, mask: ['mediaUrl'], serverTime: ['updatedAt'] });
    await denied({ path: 'galleryMedia/ig_1', delete: true });
    await denied({ path: 'galleryMedia/ig_1', data: { likeCount: -1 }, mask: ['likeCount'], serverTime: ['updatedAt'] });
    await denied({ path: 'galleryMedia/ig_9', data: { ...synced('9'), status: 'published', category: null, featured: true, altText: '', sortOrder: 1 }, mustNotExist: true, serverTime: ['updatedAt'] });
    await denied({ path: 'galleryMedia/ig_wrongid', data: { ...synced('8'), status: 'published', category: null, featured: false, altText: '', sortOrder: 1 }, mustNotExist: true, serverTime: ['updatedAt'] });
    await denied({ path: 'integrations/instagram', data: { autoPublish: false }, mask: ['autoPublish'], serverTime: ['updatedAt'] });
    await denied({ path: 'galleryMedia/ig_1', data: {}, mask: [], serverTime: ['updatedAt', 'ownerUpdatedAt'] });
    await denied({ path: 'customers/c2', data: { name: 'Injected', phone: '+91 90000 00002', email: '', area: '', notes: '', status: 'active', createdAt: '2026-10-01' } });
    await denied({ path: `admins/${users.bot.uid}`, data: { name: 'Bot' } });
    await denied({ path: `syncBots/${users.stranger.uid}`, data: { note: 'x' } });
    await denied({ path: 'syncRuns/not_a_run', data: { status: 'success' } });
  });

  it('a signed-in user who is not the Sync Bot cannot write gallery posts or status', async () => {
    const t = users.stranger.token;
    await expect(raw.commit([{ path: 'galleryMedia/ig_5', data: { ...synced('5'), status: 'published', category: null, featured: false, altText: '', sortOrder: 1 }, mustNotExist: true, serverTime: ['updatedAt'] }], t)).rejects.toMatchObject({ status: 403 });
    await expect(raw.commit([{ path: 'integrations/instagram', data: { connected: true }, mask: ['connected'], serverTime: ['updatedAt'] }], t)).rejects.toMatchObject({ status: 403 });
  });
});

describe('end to end through the emulators', () => {
  it('imports from (fake) Instagram through the real rules and builds the public cache', async () => {
    const { ctx, key } = await makeContext(env, createBudget(500));
    const ig = fakeInstagram(Array.from({ length: 12 }, (_, i) => post(`e${i}`, {}, Date.now() - i * 3600e3)));
    ctx.graph = createGraphClient({ appId: 'APP', appSecret: 'x', redirectUri: 'https://w.example/cb', fetch: ig.fetch });
    const conn = { accessToken: 'T', accountId: 'acct', username: 'edenglow', accountType: 'BUSINESS', refreshedAt: new Date().toISOString(), expiresAt: null };
    await saveConnection(env.IG_KV, key, conn);
    const run = await runIncremental(ctx, conn); // first run starts the import (12 posts = one step)
    expect(run).toMatchObject({ status: 'success', created: 12, complete: true });
    expect(publicCache(kvm).items).toHaveLength(12);
    await rules.withSecurityRulesDisabled(async (c) => {
      expect((await getDoc(doc(c.firestore(), 'integrations', 'instagram'))).data()).toMatchObject({ lastSyncStatus: 'success' });
      expect((await getDoc(doc(c.firestore(), 'syncRuns', run.id))).exists()).toBe(true);
    });
  });

  it('owner-only Worker endpoint: the owner can revalidate, another signed-in user cannot', async () => {
    const { ctx } = await makeContext(env, createBudget(500));
    await ctx.repo.createPosts([synced('7')], { autoPublish: true, now: new Date() });
    const call = (token: string) =>
      handle(new Request('https://w.example/gallery/revalidate', { method: 'POST', headers: { Origin: 'http://localhost:5173', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: ['ig_7'] }) }), env);
    expect((await call(users.stranger.token)).status).toBe(403);
    const res = await call(users.owner.token);
    expect(res.status).toBe(200);
    expect(publicCache(kvm).items.map((p) => p.id)).toEqual(['ig_7']);
  });
});
