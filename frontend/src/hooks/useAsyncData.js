import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiError } from '../services/api';

/**
 * Runs an async loader and exposes `{ data, loading, error, reload }`.
 *
 * The loader is kept in a ref so pages can pass an inline arrow function
 * without causing an infinite refetch loop. Pass the real inputs (filters,
 * page number, ...) in `deps`.
 */
export function useAsyncData(loader, deps = []) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    Promise.resolve()
      .then(() => loaderRef.current())
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught) => {
        if (active) setError(getApiError(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // The dependency list is intentionally controlled by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  return { data, loading, error, reload, setData };
}
