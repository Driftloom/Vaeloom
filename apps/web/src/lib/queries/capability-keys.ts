/**
 * Owners of every SWR cache entry the capabilities workbench reads or writes.
 *
 * Before this module each surface spelled its own key inline: the workbench
 * page, the four sibling panes and `useWorkspaceConnectors` all held private
 * strings, so an invalidation on one surface could not reach another and a
 * renamed key silently forked the cache. The key shapes defined here are the
 * single source the write paths invalidate through `invalidateCapabilities`.
 *
 * The connectors list keeps its URL key (it lives in `useWorkspaceConnectors`);
 * `connectorsKey` is the one definition of it, consumed by both the hook and
 * the sweep so the two can no longer drift.
 */

import { mutate } from 'swr';

export type CapabilityCacheScope = 'list' | 'skills' | 'agent-catalog' | 'plugin-registry';

export type CapabilityInvalidateScope = CapabilityCacheScope | 'connectors' | 'all';

type CapabilityArrayKey = readonly ['capabilities', string, CapabilityCacheScope];

/**
 * SWR treats each array literal as a new key; a stable identity per
 * workspace+scope keeps re-renders on one cache entry instead of refetching.
 */
const keyCache = new Map<string, CapabilityArrayKey>();

function canonicalKey(wsId: string, scope: CapabilityCacheScope): CapabilityArrayKey {
  const id = `${wsId} ${scope}`;
  const cached = keyCache.get(id);
  if (cached) return cached;
  const key = ['capabilities', wsId, scope] as const;
  keyCache.set(id, key);
  return key;
}

export const capabilityKeys = {
  list: (wsId: string): CapabilityArrayKey => canonicalKey(wsId, 'list'),
  skills: (wsId: string): CapabilityArrayKey => canonicalKey(wsId, 'skills'),
  agentCatalog: (wsId: string): CapabilityArrayKey => canonicalKey(wsId, 'agent-catalog'),
  pluginRegistry: (wsId: string): CapabilityArrayKey => canonicalKey(wsId, 'plugin-registry'),
};

export const connectorsKey = (wsId: string): string => `/connectors?workspace_id=${wsId}`;

const ALL_SCOPES: readonly CapabilityCacheScope[] = [
  'list',
  'skills',
  'agent-catalog',
  'plugin-registry',
];

/**
 * Revalidate registered keys through SWR's global mutate. `all` (the default)
 * sweeps every canonical scope plus the connectors list; a named scope touches
 * exactly one key. Without a workspace id it is a no-op, so callers with an
 * optional workspace need no guard of their own.
 */
export async function invalidateCapabilities(
  workspaceId: string,
  scope: CapabilityInvalidateScope = 'all',
): Promise<void> {
  if (!workspaceId) return;
  if (scope !== 'all') {
    const key =
      scope === 'connectors' ? connectorsKey(workspaceId) : canonicalKey(workspaceId, scope);
    await mutate(key, undefined, { revalidate: true });
    return;
  }
  await Promise.all([
    ...ALL_SCOPES.map((entry) =>
      mutate(canonicalKey(workspaceId, entry), undefined, { revalidate: true }),
    ),
    mutate(connectorsKey(workspaceId), undefined, { revalidate: true }),
  ]);
}
