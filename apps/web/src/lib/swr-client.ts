import useSWR, { mutate } from 'swr';
import type { SWRConfiguration, SWRResponse, MutatorOptions } from 'swr';
import { useCallback } from 'react';

const globalConfig: SWRConfiguration = {
  dedupingInterval: 5000,
  revalidateOnFocus: false,
  errorRetryCount: 3,
  onError: (err: unknown) => {
    const msg = err instanceof Error ? err.message : 'Request failed';
    console.error('[SWR Global Error]', msg);
  },
};

export function setGlobalSWRConfig(config: Partial<SWRConfiguration>): void {
  Object.assign(globalConfig, config);
}

export function useApiGet<T>(
  key: string | null | undefined,
  fetcher: (() => Promise<T>) | null,
  options?: SWRConfiguration<T, Error>,
): SWRResponse<T, Error> {
  return useSWR<T>(key, fetcher ?? null, { ...globalConfig, ...options });
}

export function prefetchWorkspace(workspaceId: string): void {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8000';
  const paths = [
    `/workspaces/${workspaceId}`,
    `/workspaces/${workspaceId}/agents`,
    `/workspaces/${workspaceId}/memories`,
    `/workspaces/${workspaceId}/connectors`,
  ];
  for (const path of paths) {
    if (typeof window !== 'undefined') {
      const token = window.localStorage.getItem('vaeloom.accessToken');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      fetch(`${apiBase}/api/v1${path}`, { headers }).then((r) => r.json()).catch(() => {});
    }
  }
}

export function useMutateWorkspace(workspaceId: string) {
  const invalidate = useCallback(
    (opts?: MutatorOptions) => {
      const keys = [
        `/workspaces/${workspaceId}`,
        `/workspaces/${workspaceId}/agents`,
        `/workspaces/${workspaceId}/memories`,
        `/workspaces/${workspaceId}/connectors`,
      ];
      for (const key of keys) {
        mutate(key, undefined, opts);
      }
    },
    [workspaceId],
  );
  return { invalidate };
}
