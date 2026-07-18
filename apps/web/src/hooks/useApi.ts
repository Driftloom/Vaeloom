import { useCallback, useEffect, useRef, useState } from 'react';

export type SSEEvent = { event: string; data: unknown };

export function useSSE(url: string, onEvent: (event: SSEEvent) => void, onError?: (err: Error) => void): () => void {
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let buffer = '';

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`SSE ${res.status}`);
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No body');
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) currentEvent = line.slice(7);
            else if (line.startsWith('data: ')) {
              try { onEvent({ event: currentEvent, data: JSON.parse(line.slice(6)) }); } catch { /* skip malformed */ }
            }
          }
        }
      })
      .catch((err) => { if (err.name !== 'AbortError') onError?.(err); });

    return () => controller.abort();
  }, [url, onEvent, onError]);

  useEffect(() => { const cleanup = start(); return () => { cleanup?.(); }; }, [start]);

  return () => abortRef.current?.abort();
}

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
