import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth.jsx';

/** Load data from the API; re-runs when `deps` change. A 401 signs the admin out. */
export function useApi(fn, deps = []) {
  const { expired } = useAuth();
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const seq = useRef(0);

  const run = useCallback(() => {
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return fn().then(
      (data) => n === seq.current && setState({ data, error: null, loading: false }),
      (error) => {
        if (n !== seq.current) return;
        if (error?.status === 401) expired();
        setState((s) => ({ ...s, error, loading: false }));
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}

/** Wrap a submit action: tracks busy/error and blocks a second click while one is running. */
export function useAction() {
  const { expired } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const running = useRef(false);
  const run = useCallback(
    async (fn) => {
      if (running.current) return undefined;
      running.current = true;
      setBusy(true);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        if (e?.status === 401) expired();
        setError(e);
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

export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useAdminTitle(title) {
  useEffect(() => {
    document.title = `${title} · Eden Glow Admin`;
  }, [title]);
}
