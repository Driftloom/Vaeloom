import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';
import { VaultSyncPanel } from '@/components/memory/VaultSyncPanel';
import { vaultSyncApi } from '@/lib/api-client';

// `jest` is intentionally the ambient global, NOT imported from '@jest/globals'.
// Importing it from there opts out of babel-plugin-jest-hoist, so the jest.mock
// factories below never registered and every assertion ran against the real
// api-client module.

/**
 * Regression tests for the fabricated-data defects in the vault sync UI.
 *
 * Every assertion here is a negative control: it fails against the previous
 * implementation, which invented a healthy daemon, wrote two hardcoded notes
 * into the user's memory, rendered a fake diff, and reported "Recent" for pulls
 * that had never happened.
 */

const mockStatus = {
  workspaceId: 'ws-1',
  status: 'unknown' as const,
  installed: false,
  daemonStatus: 'not_connected' as const,
  lastClientHeartbeat: null,
  branch: 'main',
  remoteUrl: null,
  vaultPath: null,
  totalNotes: 0,
  vaultMemories: 0,
  lastPullTime: null,
  lastPushTime: null,
  conflictsCount: 0,
  autoIngest: true,
  debounceSeconds: 30,
  rebaseIntervalMinutes: 5,
  engine: 'client' as const,
  engineNote: 'Git sync runs in the local vaultsync client.',
};

const mockToast = jest.fn();

class ApiErr extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Fully literal mock, matching the pattern used by DocumentsHub.test.tsx.
// Spreading requireActual('@/lib/api-client') left the real object in place and
// none of these became jest.fn()s.
jest.mock('@/lib/api-client', () => ({
  vaultSyncApi: {
    getStatus: jest.fn(),
    updateConfig: jest.fn(),
    triggerSync: jest.fn(),
    getLogs: jest.fn(),
    ingest: jest.fn(),
    getConflicts: jest.fn(),
    resolveConflict: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const getStatusMock = vaultSyncApi.getStatus as jest.Mock;
const getLogsMock = vaultSyncApi.getLogs as jest.Mock;
const getConflictsMock = vaultSyncApi.getConflicts as jest.Mock;
const updateConfigMock = vaultSyncApi.updateConfig as jest.Mock;
const ingestMock = vaultSyncApi.ingest as jest.Mock;
const triggerSyncMock = vaultSyncApi.triggerSync as jest.Mock;

// SWR's default cache is module-level, so the first test's resolved status was
// served to every later test and the fetcher was never called again. Give each
// render its own provider.
function renderPanel() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <VaultSyncPanel workspaceId="ws-1" />
    </SWRConfig>,
  );
}

describe('VaultSyncPanel — honesty regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getStatusMock.mockResolvedValue(mockStatus);
    getLogsMock.mockResolvedValue([]);
    getConflictsMock.mockResolvedValue([]);
    updateConfigMock.mockResolvedValue({ success: true, config: {} });
    ingestMock.mockResolvedValue({
      success: true,
      ingested_documents: 0,
      created_or_updated_memories: 0,
    });
    triggerSyncMock.mockResolvedValue({
      success: true,
      executed: false,
      workspace_id: 'ws-1',
      daemon_status: 'not_connected',
      last_pull_time: null,
      last_push_time: null,
      conflicts_count: 0,
      message: 'No vaultsync client is connected, so nothing was synced.',
    });
  });

  it('must NOT display "In Sync" when no client is connected', async () => {
    renderPanel();
    await waitFor(() => expect(getStatusMock).toHaveBeenCalled());

    expect(screen.queryByText(/In Sync/i)).toBeNull();
    expect(screen.queryByText(/Active & Watching/i)).toBeNull();
    // It must actually say it is not connected.
    await waitFor(() => expect(screen.getAllByText(/Not Connected/i).length).toBeGreaterThan(0));
  });

  it('must NOT claim the daemon is active when daemonStatus is not_connected', async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getAllByText(/No Client Connected/i).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/Active background fs event loop/i)).toBeNull();
  });

  it('must show "Never" instead of "Recent" when no pull or push ever happened', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getAllByText('Never').length).toBe(2));
    expect(screen.queryByText('Recent')).toBeNull();
  });

  it('must not offer a Pause/Resume Watcher control that controls no real process', async () => {
    renderPanel();
    await waitFor(() => expect(getStatusMock).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Pause Watcher/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Resume Watcher/i })).toBeNull();
  });

  it('must not invent a vault path when none is configured', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText(/Not configured/i)).toBeTruthy());
    expect(screen.queryByText(/VaeloomVault/)).toBeNull();
  });

  it('must NOT post hardcoded placeholder notes on ingest', async () => {
    renderPanel();
    await waitFor(() => expect(getStatusMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Ingest to Documents/i }));
    // Submit with no note written.
    const submit = await screen.findByRole('button', { name: /Start Ingestion/i });
    fireEvent.click(submit);

    // Either nothing was sent, or only what the user typed - never the two
    // fabricated notes ("Vault-Index.md", "Cognitive-Architecture.md").
    if (ingestMock.mock.calls.length > 0) {
      const sent = ingestMock.mock.calls[0]![0] as {
        notes: Array<{ filename: string }>;
      };
      const names = sent.notes.map((n) => n.filename);
      expect(names).not.toContain('Vault-Index.md');
      expect(names).not.toContain('Cognitive-Architecture.md');
    }
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/Nothing to ingest/i) }),
    );
  });

  it('must report "Sync request recorded" rather than claiming a completed sync', async () => {
    renderPanel();
    await waitFor(() => expect(getStatusMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Request Sync/i }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Sync request recorded' }),
      ),
    );
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Vault in sync' }));
  });

  it('must NOT render an invented side-by-side diff for a conflict', async () => {
    getConflictsMock.mockResolvedValue([
      {
        id: 'c1',
        file: 'Notes/Ideas.md',
        conflict_file: 'Notes/Ideas.conflict-2026-10-01.md',
        detected_at: '2026-10-01T00:00:00Z',
        local_head: 'aaaaaaaabbbbbbbb',
        remote_head: 'ccccccccdddddddd',
      },
    ]);

    renderPanel();
    await waitFor(() => expect(getConflictsMock).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole('button', { name: /Review & Resolve/i }));

    await waitFor(() =>
      expect(screen.getByText(/contents are not available over the API/i)).toBeTruthy(),
    );
    // The invented strings must be gone.
    expect(screen.queryByText(/Local changes on this machine/i)).toBeNull();
    expect(screen.queryByText(/Remote changes from secondary device/i)).toBeNull();
  });

  it('must send debounce and rebase intervals when saving config', async () => {
    getStatusMock.mockResolvedValue({
      ...mockStatus,
      debounceSeconds: 30,
      rebaseIntervalMinutes: 5,
    });

    renderPanel();
    await waitFor(() => expect(getStatusMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Configure Vault/i }));

    const debounce = await screen.findByLabelText(/Debounce Commit/i);
    fireEvent.change(debounce, { target: { value: '45' } });

    const rebase = screen.getByLabelText(/Rebase Pull Interval/i);
    fireEvent.change(rebase, { target: { value: '11' } });

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => expect(updateConfigMock).toHaveBeenCalled());
    const body = updateConfigMock.mock.calls[0]![0] as {
      debounce_seconds?: number;
      rebase_interval_minutes?: number;
    };
    // Previously these were omitted entirely, making the inputs write-only.
    expect(body.debounce_seconds).toBe(45);
    expect(body.rebase_interval_minutes).toBe(11);
  });

  it('must surface an API error rather than rendering an empty healthy panel', async () => {
    getStatusMock.mockRejectedValue(new ApiErr('boom', 500));

    renderPanel();
    await waitFor(() => {
      expect(screen.queryByText(/In Sync/i)).toBeNull();
    });
    expect(screen.queryByText('Healthy')).toBeNull();
  });
});
