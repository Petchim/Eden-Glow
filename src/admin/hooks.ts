import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { ApiError } from './api/index.ts';
import { useAuth } from './auth.tsx';

/** Any thrown value as an ApiError, so screens can rely on `message` (and `status`/`fields` when the API set them). */
export const asApiError = (e: unknown): ApiError =>
  e instanceof ApiError ? e : new ApiError(500, e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.');

export interface ApiState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
}

/** Load data from the API; re-runs when `deps` change. A 401 signs the admin out. */
export function useApi<T>(fn: () => Promise<T>, deps: DependencyList = []) {
  const { expired } = useAuth();
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: true });
  const seq = useRef(0);

  const run = useCallback(() => {
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return fn().then(
      (data) => n === seq.current && setState({ data, error: null, loading: false }),
      (e: unknown) => {
        if (n !== seq.current) return;
        const error = asApiError(e);
        if (error.status === 401) expired();
        setState((s) => ({ ...s, error, loading: false }));
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run, setData: (data: T) => setState((s) => ({ ...s, data })) };
}

/** Wrap a submit action: tracks busy/error and blocks a second click while one is running. */
export function useAction() {
  const { expired } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const running = useRef(false);
  const run = useCallback(
    async <R>(fn: () => Promise<R>): Promise<R | undefined> => {
      if (running.current) return undefined;
      running.current = true;
      setBusy(true);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        const err = asApiError(e);
        if (err.status === 401) expired();
        setError(err);
        return undefined;
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [expired],
  );
  return { busy, error, setError, run };
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useAdminTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · Eden Glow Admin`;
  }, [title]);
}
