import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useDataFetch — consistent data loading with loading/error/retry lifecycle.
 *
 * @param {Function} fetcher      — async function that returns the data
 * @param {Object}   options
 *   .transform   — map the raw API response to the shape the component needs
 *   .fallback    — value to use when fetcher throws (null = no fallback, show error)
 *   .deps        — extra dependency array entries that re-trigger the fetch
 *
 * Returns { data, loading, error, reload }
 */
export function useDataFetch(fetcher, { transform, fallback = null, deps = [] } = {}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw    = await fetcher();
      const result = transform ? transform(raw) : raw;
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (fallback !== null) {
        setData(fallback);
        setError(null);       // silent fallback — don't surface error to user
      } else {
        setError(err?.response?.data?.error ?? err?.message ?? "Failed to load data");
        setData(null);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher, fallback, ...deps]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}
