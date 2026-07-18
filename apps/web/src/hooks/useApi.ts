import { useCallback, useEffect, useRef, useState } from 'react';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiResult<T> extends UseApiState<T> {
  refetch: () => Promise<void>;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  options?: { deps?: unknown[]; enabled?: boolean },
): UseApiResult<T> {
  const { deps = [], enabled = true } = options ?? {};
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const activeRef = useRef(true);

  const fetchData = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcher();
      if (activeRef.current) {
        setState({ data, loading: false, error: null });
      }
    } catch (err) {
      if (activeRef.current) {
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Request failed',
        });
      }
    }
  }, deps);

  useEffect(() => {
    activeRef.current = true;
    if (enabled) {
      void fetchData();
    }
    return () => {
      activeRef.current = false;
    };
  }, [fetchData, enabled]);

  return { ...state, refetch: fetchData };
}
