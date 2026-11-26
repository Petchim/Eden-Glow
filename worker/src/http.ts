/* =====================================================================
   HTTP HELPERS — JSON responses, errors and CORS.
   ---------------------------------------------------------------------
   Admin endpoints answer only browsers on the ADMIN_ORIGINS allow-list.
   The public gallery cache can be read from anywhere (it contains only
   what the website already shows).
   ===================================================================== */
import { parseOrigins } from './instagram/oauth.js';

/** An error whose message is safe to show the owner. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** On every response: the Worker serves data only, never pages, scripts or frames. */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
};

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...headers },
  });
}

export function errorResponse(e: HttpError, headers: Record<string, string> = {}): Response {
  return json({ error: { code: e.code, message: e.message } }, e.status, headers);
}

/** CORS headers for an admin endpoint, or null when the Origin is not allowed. */
export function adminCors(request: Request, allowedList: string): Record<string, string> | null {
  const origin = request.headers.get('Origin');
  if (!origin) return {}; // not a browser cross-origin call (curl, server): CORS doesn't apply
  if (!parseOrigins(allowedList).includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export const PUBLIC_CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export async function readJson<T>(request: Request, maxBytes = 4096): Promise<T> {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too-large', 'Request too large.');
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'bad-json', 'Invalid request.');
  }
}
