import { describe, expect, it } from 'vitest';
import { createGraphClient, GraphError, MEDIA_FIELDS, type FetchLike } from '../src/instagram/graph.ts';

/* The Instagram API client against a fake fetch: no network. */
type Call = { url: string; init?: Parameters<FetchLike>[1] };
function fakeFetch(responses: { status?: number; body: unknown; throws?: boolean }[]) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift();
    if (!r) throw new Error('unexpected request');
    if (r.throws) throw new Error('network down');
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.body };
  };
  return { fetch, calls };
}
const client = (fetch: FetchLike) => createGraphClient({ appId: 'APPID', appSecret: 'SECRET', redirectUri: 'https://example.com/cb', fetch });

describe('authorize URL', () => {
  it('uses Instagram Login with the read-only business scope and the state', () => {
    const u = new URL(client(fakeFetch([]).fetch).authorizeUrl('STATE123'));
    expect(u.origin + u.pathname).toBe('https://www.instagram.com/oauth/authorize');
    expect(u.searchParams.get('client_id')).toBe('APPID');
    expect(u.searchParams.get('redirect_uri')).toBe('https://example.com/cb');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('scope')).toBe('instagram_business_basic');
    expect(u.searchParams.get('state')).toBe('STATE123');
    expect(u.toString()).not.toContain('SECRET');
  });
});

describe('token exchange', () => {
  it('posts the code (without the trailing #_) and accepts both response shapes', async () => {
    const f = fakeFetch([{ body: { access_token: 'SHORT1', user_id: 17841 } }, { body: { data: [{ access_token: 'SHORT2', user_id: '9' }] } }]);
    const c = client(f.fetch);
    expect(await c.exchangeCode('abc#_')).toEqual({ accessToken: 'SHORT1', expiresIn: null, userId: '17841' });
    expect(await c.exchangeCode('def')).toMatchObject({ accessToken: 'SHORT2', userId: '9' });
    expect(f.calls[0].url).toBe('https://api.instagram.com/oauth/access_token');
    expect(f.calls[0].init?.method).toBe('POST');
    const body = new URLSearchParams(f.calls[0].init?.body);
    expect(body.get('code')).toBe('abc');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_secret')).toBe('SECRET');
  });

  it('exchanges for a long-lived token and refreshes it', async () => {
    const f = fakeFetch([{ body: { access_token: 'LONG', expires_in: 5184000 } }, { body: { access_token: 'LONG2', expires_in: 5184000 } }]);
    const c = client(f.fetch);
    expect(await c.longLived('SHORT')).toEqual({ accessToken: 'LONG', expiresIn: 5184000 });
    expect(await c.refresh('LONG')).toEqual({ accessToken: 'LONG2', expiresIn: 5184000 });
    expect(new URL(f.calls[0].url).searchParams.get('grant_type')).toBe('ig_exchange_token');
    expect(new URL(f.calls[1].url).pathname).toBe('/refresh_access_token');
    expect(new URL(f.calls[1].url).searchParams.get('grant_type')).toBe('ig_refresh_token');
  });
});

describe('media pages', () => {
  it('asks for every field the gallery needs and follows the cursor only while `next` exists', async () => {
    const f = fakeFetch([
      { body: { data: [{ id: '1' }, { id: '2' }], paging: { cursors: { after: 'CUR' }, next: 'https://graph.instagram.com/…' } } },
      { body: { data: [{ id: '3' }], paging: { cursors: { after: 'END' } } } },
    ]);
    const c = client(f.fetch);
    const p1 = await c.mediaPage('TOKEN');
    expect(p1).toEqual({ items: [{ id: '1' }, { id: '2' }], after: 'CUR' });
    const p2 = await c.mediaPage('TOKEN', p1.after);
    expect(p2.after).toBeNull(); // a cursor without `next` is the last page
    const q = new URL(f.calls[0].url).searchParams;
    expect(q.get('fields')).toBe(MEDIA_FIELDS);
    for (const field of ['media_type', 'media_product_type', 'media_url', 'thumbnail_url', 'permalink', 'timestamp', 'caption', 'like_count', 'children{']) expect(MEDIA_FIELDS).toContain(field);
    expect(new URL(f.calls[1].url).searchParams.get('after')).toBe('CUR');
  });
});

describe('errors', () => {
  it('classifies an expired token as needing reconnection and never echoes the token', async () => {
    const f = fakeFetch([{ status: 400, body: { error: { message: 'Error validating access token: access_token=IGQVJsecretsecretsecretsecret expired', type: 'OAuthException', code: 190 } } }]);
    const err = await client(f.fetch).mediaPage('IGQVJsecretsecretsecretsecret').catch((e) => e);
    expect(err).toBeInstanceOf(GraphError);
    expect(err.isAuthError).toBe(true);
    expect(err.message).not.toContain('IGQVJsecret');
  });

  it('retries once on a Meta-side 500, but not on throttling', async () => {
    const ok = fakeFetch([{ status: 500, body: { error: { message: 'oops', code: 2 } } }, { body: { data: [] } }]);
    await expect(client(ok.fetch).mediaPage('T')).resolves.toEqual({ items: [], after: null });
    expect(ok.calls).toHaveLength(2);

    const limited = fakeFetch([{ status: 400, body: { error: { message: 'Application request limit reached', code: 4 } } }]);
    const err = await client(limited.fetch).mediaPage('T').catch((e) => e);
    expect(err.isRateLimit).toBe(true);
    expect(limited.calls).toHaveLength(1);
  });

  it('retries a network failure once, then reports it', async () => {
    const f = fakeFetch([{ body: null, throws: true }, { body: null, throws: true }]);
    const err = await client(f.fetch).profile('T').catch((e) => e);
    expect(err).toBeInstanceOf(GraphError);
    expect(err.status).toBe(0);
    expect(f.calls).toHaveLength(2);
  });
});

describe('single post (refresh links when the owner publishes a hidden post)', () => {
  it('asks for the same fields by media id and rejects malformed ids without a request', async () => {
    const f = fakeFetch([{ body: { id: '178', media_type: 'IMAGE' } }]);
    const c = client(f.fetch);
    expect(await c.mediaById('TOKEN', '178')).toMatchObject({ id: '178' });
    const u = new URL(f.calls[0].url);
    expect(u.pathname).toMatch(/\/v[\d.]+\/178$/);
    expect(u.searchParams.get('fields')).toBe(MEDIA_FIELDS);
    await expect(c.mediaById('TOKEN', '../me')).rejects.toBeInstanceOf(GraphError);
    expect(f.calls).toHaveLength(1);
  });
});
