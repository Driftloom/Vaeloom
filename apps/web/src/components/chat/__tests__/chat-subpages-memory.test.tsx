import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { MemoryVaultExplorer } from '../MemoryVaultExplorer';
import { memoryApi, vaultSyncApi, type VaultSyncStatus } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  memoryApi: { list: jest.fn() },
  vaultSyncApi: { getStatus: jest.fn() },
}));

const listMock = memoryApi.list as jest.Mock;
const statusMock = vaultSyncApi.getStatus as jest.Mock;

/**
 * Invariant tests for the chat vault tab's fabricated-data defects.
 *
 * The component used to render a hard-coded SEED_MEMORIES list behind a
 * hard-coded "Obsidian Vault Connected - CRDT Local Mirror Active" banner:
 * neither the rows nor the status claim came from the server, so a full API
 * outage rendered a healthy-looking vault. These tests pin every claim to the
 * mocked API responses.
 */

const row = (over: Record<string, unknown> = {}) => ({
  id: 'mem-1',
  type: 'career',
  status: 'active',
  title: 'Led the payments platform migration',
  summary: null,
  content: 'Migrated 40 services with zero downtime and no customer-visible errors.',
  sourceType: 'import',
  sourceLabel: 'Workday Resume',
  createdAt: '2026-10-15T10:00:00Z',
  ...over,
});

const connectedStatus = (over: Partial<VaultSyncStatus> = {}): VaultSyncStatus =>
  ({
    workspaceId: 'ws-1',
    status: 'in_sync',
    installed: true,
    daemonStatus: 'running',
    conflictsCount: 0,
    lastClientHeartbeat: '2026-10-18T10:00:00Z',
    branch: 'main',
    totalNotes: 12,
    vaultMemories: 8,
    autoIngest: true,
    debounceSeconds: 30,
    rebaseIntervalMinutes: 5,
    engine: 'client',
    engineNote: 'client',
    ...over,
  }) as VaultSyncStatus;

function renderExplorer(onCiteMemory = jest.fn()) {
  render(
    <SWRConfig
      value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
    >
      <MemoryVaultExplorer
        workspaceId="ws-1"
        onCiteMemory={onCiteMemory}
        onOpenVaultDrawer={jest.fn()}
      />
    </SWRConfig>,
  );
  return onCiteMemory;
}

beforeEach(() => {
  jest.clearAllMocks();
  statusMock.mockResolvedValue(connectedStatus());
});

describe('Memory Vault Explorer', () => {
  it('renders memories from the API and not the removed seed content', async () => {
    listMock.mockResolvedValue({
      memories: [
        row(),
        row({
          id: 'mem-2',
          type: 'document',
          title: 'Q3 performance review dossier',
          content: 'Self-assessment covering the platform migration and mentoring.',
        }),
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });

    renderExplorer();

    expect(
      await screen.findByPlaceholderText(/Search memories, skills, notes/i),
    ).toBeInTheDocument();
    expect(await screen.findByText('Led the payments platform migration')).toBeInTheDocument();
    expect(screen.getByText('Q3 performance review dossier')).toBeInTheDocument();
    // The seed rows were invented; none of them may survive into real renders.
    expect(screen.queryByText('Staff Distributed Systems Engineer Experience')).toBeNull();
    expect(screen.queryByText('AI Multi-Agent Career Copilot Architecture')).toBeNull();
    expect(screen.getByText('2 memories')).toBeInTheDocument();
  });

  it('discloses truncation instead of implying a complete list', async () => {
    listMock.mockResolvedValue({
      memories: Array.from({ length: 100 }, (_, i) =>
        row({ id: `mem-${i}`, title: `Memory ${i}` }),
      ),
      total: 111,
      page: 1,
      page_size: 100,
    });

    renderExplorer();

    expect(await screen.findByText('Showing 100 of 111 memories')).toBeInTheDocument();
  });

  it('shows a retryable error state when the memory list fails, and recovers on retry', async () => {
    listMock.mockRejectedValueOnce(new Error('API is down'));
    renderExplorer();

    expect(await screen.findByText('Memories unavailable')).toBeInTheDocument();
    expect(screen.getByText('Memory count unavailable')).toBeInTheDocument();

    listMock.mockResolvedValue({
      memories: [row()],
      total: 1,
      page: 1,
      page_size: 100,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Led the payments platform migration')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('filters by pills derived from the loaded corpus', async () => {
    listMock.mockResolvedValue({
      memories: [
        row(),
        row({ id: 'mem-2', type: 'document', title: 'Q3 performance review dossier' }),
      ],
      total: 2,
      page: 1,
      page_size: 100,
    });

    renderExplorer();
    await screen.findByText('Led the payments platform migration');

    // Both pills come from data; no invented taxonomy options.
    fireEvent.click(screen.getByRole('button', { name: '#career' }));
    expect(screen.getByText('Led the payments platform migration')).toBeInTheDocument();
    expect(screen.queryByText('Q3 performance review dossier')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'all' }));
    await waitFor(() => {
      expect(screen.getByText('Q3 performance review dossier')).toBeInTheDocument();
    });
  });

  it('cites the real memory content into the composer', async () => {
    listMock.mockResolvedValue({
      memories: [row()],
      total: 1,
      page: 1,
      page_size: 100,
    });

    const onCite = renderExplorer();
    await screen.findByText('Led the payments platform migration');

    fireEvent.click(screen.getByRole('button', { name: /Cite in Chat/i }));
    expect(onCite).toHaveBeenCalledWith(
      '[Memory Citation: Led the payments platform migration]\nMigrated 40 services with zero downtime and no customer-visible errors.',
    );
  });

  it('claims a connected vault only when the status reports one', async () => {
    listMock.mockResolvedValue({ memories: [row()], total: 1, page: 1, page_size: 100 });
    statusMock.mockResolvedValue(connectedStatus());

    renderExplorer();

    expect(await screen.findByText('Vault client connected')).toBeInTheDocument();
    // The removed hard-coded claims must never reappear.
    expect(screen.queryByText(/Obsidian Vault Connected/i)).toBeNull();
    expect(screen.queryByText(/CRDT Local Mirror Active/i)).toBeNull();
  });

  it('does not claim a connected vault when no client has reported', async () => {
    listMock.mockResolvedValue({ memories: [row()], total: 1, page: 1, page_size: 100 });
    statusMock.mockResolvedValue(
      connectedStatus({ daemonStatus: 'not_connected', lastClientHeartbeat: null }),
    );

    renderExplorer();

    expect(await screen.findByText('No vault client connected')).toBeInTheDocument();
    expect(screen.queryByText('Vault client connected')).toBeNull();
  });

  it('surfaces a reported sync failure instead of a healthy banner', async () => {
    listMock.mockResolvedValue({ memories: [row()], total: 1, page: 1, page_size: 100 });
    statusMock.mockResolvedValue(
      connectedStatus({ lastError: 'Merge halted: unresolved conflict in career.md' }),
    );

    renderExplorer();

    expect(await screen.findByText('Vault sync error')).toBeInTheDocument();
    expect(screen.getByText('Merge halted: unresolved conflict in career.md')).toBeInTheDocument();
    expect(screen.queryByText('Vault client connected')).toBeNull();
  });
});
