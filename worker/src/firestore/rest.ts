/* =====================================================================
   FIRESTORE REST CLIENT — minimal, for the Worker.
   ---------------------------------------------------------------------
   Every request carries a Firebase Auth ID token (the Sync Bot's, or the
   signed-in owner's), so firestore.rules apply exactly as they do to the
   website: the Worker has no privileged database access.
   Writes use documents:commit (atomic, up to 100 per request here).
   documents:batchWrite is NOT used: Firestore allows it only with admin
   (service-account) credentials, which this project deliberately has
   none of. Callers that need "create only if missing" handle the rare
   conflict with batchGet (see galleryRepo.ts).
   ===================================================================== */
import type { Fetch } from '../budget.js';

export type FsValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

/** A Firestore timestamp in queries (documents store server times as timestamps). */
export class Ts {
  constructor(readonly iso: string) {}
}

export function toValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Ts) return { timestampValue: v.iso };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isSafeInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
  throw new Error(`Unsupported value type: ${typeof v}`);
}

export function fromValue(v: FsValue): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue; // ISO, like the rest of the app
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return null;
}

export const toFields = (o: Record<string, unknown>): Record<string, FsValue> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toValue(v)]));
export const fromFields = (f: Record<string, FsValue>): Record<string, unknown> => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, fromValue(v)]));

export interface Doc {
  id: string;
  data: Record<string, unknown>;
}

export interface WriteOp {
  /** e.g. 'galleryMedia/ig_123' */
  path: string;
  data?: Record<string, unknown>;
  /** Only these fields are written (others untouched; a listed field missing from `data` is removed). */
  mask?: string[];
  mustNotExist?: boolean;
  mustExist?: boolean;
  /** Fields set to the server's request time (rules can check `== request.time`). */
  serverTime?: string[];
  delete?: boolean;
}

export class FirestoreError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Firestore's status name, e.g. 'ALREADY_EXISTS', 'NOT_FOUND', 'PERMISSION_DENIED', 'FAILED_PRECONDITION'. */
    readonly reason: string = '',
  ) {
    super(message);
    this.name = 'FirestoreError';
  }
  /** A "must (not) exist" condition failed (the whole commit was rejected). */
  get isPrecondition(): boolean {
    return ['ALREADY_EXISTS', 'NOT_FOUND', 'FAILED_PRECONDITION'].includes(this.reason);
  }
  get isDenied(): boolean {
    return this.reason === 'PERMISSION_DENIED' || this.status === 403;
  }
}

export const COMMIT_MAX = 100;

export type QueryOp = 'EQUAL' | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL' | 'LESS_THAN';
export interface StructuredQuery {
  collection: string;
  /** [field, value] = EQUAL, or [field, op, value]. */
  where?: ([field: string, value: unknown] | [field: string, op: QueryOp, value: unknown])[];
  orderBy?: [field: string, dir: 'ASCENDING' | 'DESCENDING'][];
  /** Start after this value of the first orderBy field. */
  startAfter?: unknown;
  offset?: number;
  limit?: number;
}

export interface FirestoreRest {
  get(path: string, token?: string): Promise<Doc | null>;
  query(q: StructuredQuery, token?: string): Promise<Doc[]>;
  /** Several documents in one request: path → document, or null if missing. */
  batchGet(paths: string[], token?: string): Promise<Map<string, Doc | null>>;
  /** Atomic: all writes apply or none (throws FirestoreError). At most COMMIT_MAX writes. */
  commit(ops: WriteOp[], token: string): Promise<void>;
}

export function createFirestoreRest({ projectId, emulatorHost, fetch }: { projectId: string; emulatorHost?: string; fetch: Fetch }): FirestoreRest {
  const root = `projects/${projectId}/databases/(default)/documents`;
  const base = emulatorHost ? `http://${emulatorHost}/v1/${root}` : `https://firestore.googleapis.com/v1/${root}`;
  const headers = (token?: string): Record<string, string> => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });
  const idOf = (name: string) => name.slice(name.lastIndexOf('/') + 1);

  async function fail(res: Response): Promise<never> {
    let message = `Firestore request failed (${res.status}).`;
    let reason = '';
    try {
      const b = (await res.json()) as { error?: { message?: string; status?: string } } | { error?: { message?: string; status?: string } }[];
      const e = Array.isArray(b) ? b[0]?.error : b.error;
      if (e?.message) message = e.message.slice(0, 300);
      reason = e?.status || '';
    } catch {
      /* keep the default */
    }
    throw new FirestoreError(res.status, message, reason);
  }

  return {
    async get(path, token) {
      const res = await fetch(`${base}/${path}`, { headers: headers(token) });
      if (res.status === 404) return null;
      if (!res.ok) return fail(res);
      const d = (await res.json()) as { name: string; fields?: Record<string, FsValue> };
      return { id: idOf(d.name), data: fromFields(d.fields || {}) };
    },

    async query(q, token) {
      const structuredQuery: Record<string, unknown> = { from: [{ collectionId: q.collection }] };
      if (q.where?.length) {
        const filters = q.where.map((w) => {
          const [field, op, value] = w.length === 2 ? [w[0], 'EQUAL', w[1]] : w;
          return { fieldFilter: { field: { fieldPath: field }, op, value: toValue(value) } };
        });
        structuredQuery.where = filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } };
      }
      if (q.orderBy?.length) structuredQuery.orderBy = q.orderBy.map(([field, direction]) => ({ field: { fieldPath: field }, direction }));
      if (q.startAfter !== undefined) structuredQuery.startAt = { values: [toValue(q.startAfter)], before: false };
      if (q.offset) structuredQuery.offset = q.offset;
      if (q.limit) structuredQuery.limit = q.limit;
      const res = await fetch(`${base}:runQuery`, { method: 'POST', headers: headers(token), body: JSON.stringify({ structuredQuery }) });
      if (!res.ok) return fail(res);
      const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, FsValue> } }[];
      return rows.filter((r) => r.document).map((r) => ({ id: idOf(r.document!.name), data: fromFields(r.document!.fields || {}) }));
    },

    async batchGet(paths, token) {
      const out = new Map<string, Doc | null>();
      if (!paths.length) return out;
      const res = await fetch(`${base}:batchGet`, { method: 'POST', headers: headers(token), body: JSON.stringify({ documents: paths.map((p) => `${root}/${p}`) }) });
      if (!res.ok) return fail(res);
      const rows = (await res.json()) as { found?: { name: string; fields?: Record<string, FsValue> }; missing?: string }[];
      for (const r of rows) {
        if (r.found) out.set(r.found.name.slice(root.length + 1), { id: idOf(r.found.name), data: fromFields(r.found.fields || {}) });
        else if (r.missing) out.set(r.missing.slice(root.length + 1), null);
      }
      return out;
    },

    async commit(ops, token) {
      if (!ops.length) return;
      if (ops.length > COMMIT_MAX) throw new Error(`commit() takes at most ${COMMIT_MAX} writes`);
      const writes = ops.map((op) => {
        const name = `${root}/${op.path}`;
        if (op.delete) return { delete: name };
        const w: Record<string, unknown> = { update: { name, fields: toFields(op.data || {}) } };
        if (op.mask) w.updateMask = { fieldPaths: op.mask };
        if (op.mustNotExist) w.currentDocument = { exists: false };
        else if (op.mustExist) w.currentDocument = { exists: true };
        if (op.serverTime?.length) w.updateTransforms = op.serverTime.map((fieldPath) => ({ fieldPath, setToServerValue: 'REQUEST_TIME' }));
        return w;
      });
      const res = await fetch(`${base}:commit`, { method: 'POST', headers: headers(token), body: JSON.stringify({ writes }) });
      if (!res.ok) return fail(res);
    },
  };
}
