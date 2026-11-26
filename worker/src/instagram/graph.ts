/* =====================================================================
   INSTAGRAM API CLIENT — official "Instagram API with Instagram Login".
   ---------------------------------------------------------------------
   Talks only to Meta's documented endpoints (no scraping):
     • www.instagram.com/oauth/authorize      owner approves the app
     • api.instagram.com/oauth/access_token   code → short-lived token
     • graph.instagram.com/access_token       short → long-lived (~60 days)
     • graph.instagram.com/refresh_access_token
     • graph.instagram.com/{v}/me, /me/media  profile and published media
   Works for Instagram Business and Creator accounts.

   Runs in the Cloudflare Worker. Pure module: `fetch` is injectable (the
   Worker passes its request-budget counter), so it is unit-tested
   without network access. Access tokens travel in request
   URLs as Meta requires, so URLs are NEVER logged or put in errors.
   ===================================================================== */

/** Graph API version used for /me and /me/media. Check Meta's changelog when upgrading. */
export const GRAPH_VERSION = 'v23.0';
export const GRAPH_HOST = 'https://graph.instagram.com';
export const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
export const TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
/** Read-only access to the account's profile and published media. */
export const SCOPES = ['instagram_business_basic'];

export const MEDIA_FIELDS = [
  'id',
  'caption',
  'media_type',
  'media_product_type',
  'media_url',
  'thumbnail_url',
  'permalink',
  'timestamp',
  'like_count',
  'children{id,media_type,media_url,thumbnail_url}',
].join(',');
/** Items per page from /me/media (Meta caps this; 50 keeps responses small). */
export const PAGE_LIMIT = 50;
const TIMEOUT_MS = 15000;

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface RawChild {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
}
export interface RawMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  /** Omitted by Instagram when not available (e.g. likes hidden on the post). */
  like_count?: number;
  children?: { data?: RawChild[] };
}
export interface MediaPage {
  items: RawMedia[];
  /** Cursor for the next page, or null on the last page. */
  after: string | null;
}
export interface Profile {
  userId: string;
  username: string;
  accountType: string;
}
export interface TokenResult {
  accessToken: string;
  /** Seconds until expiry (long-lived tokens only). */
  expiresIn: number | null;
  userId?: string;
}

/** A failed Instagram API call, with Meta's error code but never the request URL or token. */
export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null = null,
    readonly subcode: number | null = null,
  ) {
    super(message);
    this.name = 'GraphError';
  }
  /** The token is expired, revoked or the app was removed: the owner must reconnect. */
  get isAuthError(): boolean {
    return this.code === 190 || this.status === 401 || (this.code === 10 && this.status === 403);
  }
  get isRateLimit(): boolean {
    return [4, 17, 32, 613].includes(this.code ?? -1) || this.status === 429;
  }
  /** Worth one more try (network trouble, Meta-side error, throttling). */
  get isTransient(): boolean {
    return this.status === 0 || this.status >= 500 || this.isRateLimit;
  }
}

interface MetaErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number; type?: string } | string;
  error_message?: string;
  error_type?: string;
  code?: number;
}

function toGraphError(status: number, body: unknown): GraphError {
  const b = (body || {}) as MetaErrorBody;
  if (b.error && typeof b.error === 'object') {
    return new GraphError(cleanMessage(b.error.message) || 'Instagram request failed.', status, b.error.code ?? null, b.error.error_subcode ?? null);
  }
  // api.instagram.com (token exchange) answers { error_type, code, error_message }
  return new GraphError(cleanMessage(b.error_message || (typeof b.error === 'string' ? b.error : '')) || 'Instagram request failed.', status, b.code ?? null);
}

/** Meta messages can echo request details; keep them short and strip anything token-like. */
function cleanMessage(m: string | undefined): string {
  return String(m || '')
    .replace(/(access_token|client_secret|code)=[^&\s]+/gi, '$1=[hidden]')
    .replace(/\b(IG|EA)[A-Za-z0-9]{20,}\b/g, '[hidden]')
    .slice(0, 300);
}

export interface GraphClientOptions {
  appId: string;
  appSecret: string;
  redirectUri: string;
  fetch?: FetchLike;
}

export function createGraphClient({ appId, appSecret, redirectUri, fetch: fetchImpl }: GraphClientOptions) {
  const doFetch: FetchLike = fetchImpl ?? (globalThis.fetch as unknown as FetchLike);

  async function request<T>(url: string, init?: Parameters<FetchLike>[1], attempt = 0): Promise<T> {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await doFetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      const err = new GraphError('Could not reach Instagram.', 0);
      if (attempt === 0) return request<T>(url, init, 1);
      throw err;
    }
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (!res.ok || (body && typeof body === 'object' && 'error' in body)) {
      const err = toGraphError(res.status, body);
      // one retry for Meta-side trouble (not for throttling: retrying makes it worse)
      if (attempt === 0 && err.isTransient && !err.isRateLimit) return request<T>(url, init, 1);
      throw err;
    }
    return body as T;
  }

  const graph = (path: string, params: Record<string, string>) => `${GRAPH_HOST}${path}?${new URLSearchParams(params)}`;

  return {
    /** Where to send the owner to approve the app. `state` ties the answer to this request. */
    authorizeUrl(state: string): string {
      const q = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES.join(','),
        state,
      });
      return `${AUTHORIZE_URL}?${q}`;
    },

    /** Authorization code → short-lived user token. */
    async exchangeCode(code: string): Promise<TokenResult> {
      const body = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        // Instagram appends "#_" to the code in the redirect; it is not part of the code
        code: code.replace(/#_$/, ''),
      }).toString();
      const r = await request<{ access_token?: string; user_id?: number | string; data?: { access_token?: string; user_id?: number | string }[] }>(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      // Meta has answered both { access_token, user_id } and { data: [{ … }] } here
      const d = r.data?.[0] ?? r;
      if (!d.access_token) throw new GraphError('Instagram did not return an access token.', 502);
      return { accessToken: d.access_token, expiresIn: null, userId: d.user_id != null ? String(d.user_id) : undefined };
    },

    /** Short-lived token → long-lived token (about 60 days). */
    async longLived(shortToken: string): Promise<TokenResult> {
      const r = await request<{ access_token?: string; expires_in?: number }>(
        graph('/access_token', { grant_type: 'ig_exchange_token', client_secret: appSecret, access_token: shortToken }),
      );
      if (!r.access_token) throw new GraphError('Instagram did not return a long-lived token.', 502);
      return { accessToken: r.access_token, expiresIn: r.expires_in ?? null };
    },

    /** Extends a long-lived token by another ~60 days. Token must be at least 24 hours old and unexpired. */
    async refresh(token: string): Promise<TokenResult> {
      const r = await request<{ access_token?: string; expires_in?: number }>(
        graph('/refresh_access_token', { grant_type: 'ig_refresh_token', access_token: token }),
      );
      if (!r.access_token) throw new GraphError('Instagram did not return a refreshed token.', 502);
      return { accessToken: r.access_token, expiresIn: r.expires_in ?? null };
    },

    async profile(token: string): Promise<Profile> {
      const r = await request<{ user_id?: string | number; id?: string; username?: string; account_type?: string }>(
        graph(`/${GRAPH_VERSION}/me`, { fields: 'user_id,username,account_type', access_token: token }),
      );
      return { userId: String(r.user_id ?? r.id ?? ''), username: r.username || '', accountType: r.account_type || '' };
    },

    /** One page of the account's published media, newest first. */
    async mediaPage(token: string, after?: string | null, limit = PAGE_LIMIT): Promise<MediaPage> {
      const params: Record<string, string> = { fields: MEDIA_FIELDS, limit: String(Math.min(Math.max(limit, 1), PAGE_LIMIT)), access_token: token };
      if (after) params.after = after;
      const r = await request<{ data?: RawMedia[]; paging?: { cursors?: { after?: string }; next?: string } }>(graph(`/${GRAPH_VERSION}/me/media`, params));
      const items = Array.isArray(r.data) ? r.data : [];
      // `next` is only present when another page exists; the cursor alone is not proof of that
      const next = r.paging?.next ? r.paging?.cursors?.after || null : null;
      return { items, after: next };
    },

    /** One post by its Instagram media id (fresh, unexpired file links). */
    async mediaById(token: string, mediaId: string): Promise<RawMedia> {
      if (!/^[0-9A-Za-z_]{1,64}$/.test(mediaId)) throw new GraphError('Invalid media id.', 400);
      return request<RawMedia>(graph(`/${GRAPH_VERSION}/${mediaId}`, { fields: MEDIA_FIELDS, access_token: token }));
    },
  };
}

export type GraphClient = ReturnType<typeof createGraphClient>;
