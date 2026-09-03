'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal fetch-on-dependency-change hook.
 *
 * Deliberately not a data-fetching library: the app has ~12 list screens with
 * identical needs (load, show a spinner, show an error, refetch on filter
 * change), and adding a client cache would be a new dependency for no
 * demonstrable gain here.
 *
 * The request counter guards against out-of-order responses — typing in a
 * search box fires several overlapping requests and the slowest one must not
 * overwrite the newest result.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
): { data: T | null; loading: boolean; error: unknown; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  // `fn` is a fresh closure on every render; keeping it in a ref means the
  // effect re-runs only when `deps` change, not on every parent re-render.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const requestId = ++latest.current;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fnRef
      .current()
      .then((result) => {
        if (cancelled || requestId !== latest.current) return;
        setData(result);
      })
      .catch((err) => {
        if (cancelled || requestId !== latest.current) return;
        setError(err);
      })
      .finally(() => {
        if (cancelled || requestId !== latest.current) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

/** Debounces a value so a search box does not fire a request per keystroke. */
export function useDebounced<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
