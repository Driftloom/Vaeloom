/**
 * Task 2: singleowner registry for the capabilities workbench' SWR keys.
 * Highlights:
 *  - Key shape is ['capabilities', wsId, scope] for the four canonical scopes.
 *  - The connectors suite is keyed by its existing URL key, not an array;
 *    the registry owns its definition so useWorkspaceConnectors and the sweep
 *    can never disagree on spelling again.
 *  - invalidateCapabilities(global mutate, no data write) fires one
 *    revalidation per registered key for 'all' — and exactly one key for a
 *    scope. Single-arg mutate: passing `undefined` as the data argument is
 *    SWR's clear-the-cache idiom, which would wipe retained rows on every
 *    invalidation before the refetch answers.
 */

import { capabilityKeys, connectorsKey, invalidateCapabilities } from '../capability-keys';
import { mutate as globalMutate } from 'swr';

jest.mock('swr', () => {
  const actual = jest.requireActual('swr') as Record<string, unknown>;
  return { ...actual, mutate: jest.fn(async () => undefined) };
});

const mutateMock = globalMutate as unknown as jest.Mock;

beforeEach(() => {
  mutateMock.mockClear();
});

describe('capabilityKeys', () => {
  it('shapes every canonical key as [capabilities, workspaceId, scope]', () => {
    expect(capabilityKeys.list('ws-1')).toEqual(['capabilities', 'ws-1', 'list']);
    expect(capabilityKeys.skills('ws-1')).toEqual(['capabilities', 'ws-1', 'skills']);
    expect(capabilityKeys.agentCatalog('ws-1')).toEqual(['capabilities', 'ws-1', 'agent-catalog']);
    expect(capabilityKeys.pluginRegistry('ws-1')).toEqual([
      'capabilities',
      'ws-1',
      'plugin-registry',
    ]);
  });

  it('returns a stable array identity per workspace+scope so re-renders share one cache entry', () => {
    expect(capabilityKeys.list('ws-1')).toBe(capabilityKeys.list('ws-1'));
    expect(capabilityKeys.skills('ws-1')).toBe(capabilityKeys.skills('ws-1'));
    expect(capabilityKeys.agentCatalog('ws-1')).toBe(capabilityKeys.agentCatalog('ws-1'));
    expect(capabilityKeys.pluginRegistry('ws-1')).toBe(capabilityKeys.pluginRegistry('ws-1'));
  });

  it('keeps distinct scopes and workspaces distinct', () => {
    expect(capabilityKeys.list('ws-1')).not.toBe(capabilityKeys.skills('ws-1'));
    expect(capabilityKeys.list('ws-1')).not.toBe(capabilityKeys.list('ws-2'));
  });
});

describe('connectorsKey', () => {
  it('is the exact URL key useWorkspaceConnectors already fetches', () => {
    expect(connectorsKey('ws-1')).toBe('/connectors?workspace_id=ws-1');
  });

  it('interpolates the workspace id once, verbatim', () => {
    expect(connectorsKey('ws-9')).toBe('/connectors?workspace_id=ws-9');
  });
});

describe('invalidateCapabilities', () => {
  it("'all' revalidates each registered key exactly once", async () => {
    await invalidateCapabilities('ws-1');

    expect(mutateMock).toHaveBeenCalledTimes(5);
    expect(mutateMock).toHaveBeenNthCalledWith(1, capabilityKeys.list('ws-1'));
    expect(mutateMock).toHaveBeenNthCalledWith(2, capabilityKeys.skills('ws-1'));
    expect(mutateMock).toHaveBeenNthCalledWith(3, capabilityKeys.agentCatalog('ws-1'));
    expect(mutateMock).toHaveBeenNthCalledWith(4, capabilityKeys.pluginRegistry('ws-1'));
    expect(mutateMock).toHaveBeenNthCalledWith(5, connectorsKey('ws-1'));
  });

  it("scope 'list' touches only the list key", async () => {
    await invalidateCapabilities('ws-1', 'list');

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith(capabilityKeys.list('ws-1'));
  });

  it("scope 'skills' touches only the skills key", async () => {
    await invalidateCapabilities('ws-1', 'skills');

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith(capabilityKeys.skills('ws-1'));
  });

  it("scope 'agent-catalog' touches only the agent rows key", async () => {
    await invalidateCapabilities('ws-1', 'agent-catalog');

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith(capabilityKeys.agentCatalog('ws-1'));
  });

  it("scope 'plugin-registry' touches only the plugin key", async () => {
    await invalidateCapabilities('ws-1', 'plugin-registry');

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith(capabilityKeys.pluginRegistry('ws-1'));
  });

  it("scope 'connectors' touches only the connectors URL key", async () => {
    await invalidateCapabilities('ws-1', 'connectors');

    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(mutateMock).toHaveBeenCalledWith(connectorsKey('ws-1'));
  });

  it('is a no-op without a workspace id', async () => {
    await invalidateCapabilities('');

    expect(mutateMock).not.toHaveBeenCalled();

    await invalidateCapabilities('', 'skills');
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('resolves void whether or not a key was touched', async () => {
    await expect(invalidateCapabilities('ws-1', 'list')).resolves.toBeUndefined();
  });
});
