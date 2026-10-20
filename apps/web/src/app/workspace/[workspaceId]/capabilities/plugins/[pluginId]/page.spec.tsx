import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { SWRConfig } from 'swr';
import PluginSubpage from './page';
import { pluginApi } from '@/lib/api-client';

const mockPush = jest.fn();
let mockParams = { workspaceId: 'ws-test-123', pluginId: 'summarizer' };

jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

const mockToast = jest.fn();
jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/lib/api-client', () => {
  const actual = jest.requireActual('@/lib/api-client');
  return {
    ...actual,
    pluginApi: {
      list: jest.fn().mockResolvedValue({
        plugins: [
          {
            id: 'plug-summarizer',
            name: 'summarizer',
            description: 'Extracts executive bullet summaries',
            status: 'ACTIVE',
            entry_point: 'summarizer.py',
            author: 'Vaeloom Core Team',
            version: '1.0.0',
            tags: ['Summarization'],
            hooks: ['post_process'],
            permissions: {},
          },
        ],
      }),
      setStatus: jest.fn().mockResolvedValue({ id: 'plug-summarizer', status: 'DISABLED' }),
      execute: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      executions: jest.fn().mockResolvedValue({ executions: [], total: 0, page: 1, page_size: 25 }),
      getPermissions: jest.fn().mockResolvedValue({ permissions: {} }),
    },
  };
});

/**
 * Each test gets its own SWR cache.
 *
 * SWR keys the execution and permission fetches on the plugin id, and the
 * provider is module-level, so without isolation a test re-renders the previous
 * test's resolved payload for the same key and asserts against its neighbour's
 * data.
 */
function renderSubpage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PluginSubpage />
    </SWRConfig>,
  );
}

describe('PluginSubpage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `clearAllMocks` drops call records but keeps implementations, so a
    // `jest.spyOn(...).mockResolvedValue(...)` from an earlier test would leak
    // into the next one. Restoring puts every method back on the module mock's
    // own default.
    jest.restoreAllMocks();
    mockParams = { workspaceId: 'ws-test-123', pluginId: 'summarizer' };
  });

  it('renders breadcrumbs and plugin header for a known plugin', async () => {
    renderSubpage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /summarizer/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Back to Plugins')).toBeInTheDocument();
  });

  it('renders empty state when plugin is not found', async () => {
    mockParams = { workspaceId: 'ws-test-123', pluginId: 'unknown-plugin-xyz' };
    renderSubpage();

    await waitFor(() => {
      expect(screen.getByText(/Plugin "unknown-plugin-xyz" not found/i)).toBeInTheDocument();
    });

    const viewAllButton = screen.getByRole('button', { name: /View all Plugins/i });
    fireEvent.click(viewAllButton);
    expect(mockPush).toHaveBeenCalledWith('/workspace/ws-test-123/capabilities?category=plugins');
  });

  it('does not invent an entrypoint the registry did not declare', async () => {
    pluginApi.list.mockResolvedValueOnce({
      plugins: [
        {
          id: 'plug-summarizer',
          name: 'summarizer',
          description: 'Extracts executive bullet summaries',
          status: 'ACTIVE',
          author: 'Vaeloom Core Team',
          version: '1.0.0',
          tags: ['Summarization'],
          hooks: ['post_process'],
          permissions: {},
        },
      ],
    });

    renderSubpage();

    expect(
      (await screen.findAllByText(/Extracts executive bullet summaries/i)).length,
    ).toBeGreaterThan(0);

    expect(screen.queryByText('summarizer.py')).not.toBeInTheDocument();
    const notReportedNodes = await screen.findAllByText('Not reported (by the registry)');
    expect(notReportedNodes.length).toBeGreaterThan(0);
  });

  it('requires confirmation before an irreversible delete', async () => {
    // This was the only destructive action in the capabilities feature that
    // fired on a single click, with no dialog and no undo.
    const deleted = jest.spyOn(pluginApi, 'delete');
    renderSubpage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /summarizer/i })).toBeInTheDocument();
    });

    fireEvent.click(await screen.findByRole('button', { name: /delete plugin/i }));
    const dialog = await screen.findByRole('dialog', { name: /delete this plugin\?/i });
    expect(deleted).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: /keep plugin/i }));
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /delete this plugin\?/i }),
      ).not.toBeInTheDocument();
    });
    expect(deleted).not.toHaveBeenCalled();
  });

  it('deletes only after the confirmation is accepted', async () => {
    const deleted = jest.spyOn(pluginApi, 'delete');
    renderSubpage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /summarizer/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /delete plugin/i }));
    const dialog = await screen.findByRole('dialog', { name: /delete this plugin\?/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete plugin$/i }));

    await waitFor(() => expect(deleted).toHaveBeenCalledWith('plug-summarizer'));
  });

  describe('the activity tab', () => {
    async function openActivityTab() {
      renderSubpage();
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /summarizer/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('tab', { name: /activity/i }));
    }

    it('reads the real run history from the registry', async () => {
      const executions = jest.spyOn(pluginApi, 'executions').mockResolvedValue({
        executions: [
          {
            id: 'exec-9',
            plugin_id: 'plug-summarizer',
            status: 'success',
            duration_ms: 88,
            created_at: '2026-10-01T09:00:00Z',
          },
          {
            id: 'exec-8',
            plugin_id: 'plug-summarizer',
            status: 'error',
            created_at: '2026-09-30T09:00:00Z',
          },
        ],
        total: 2,
        page: 1,
        page_size: 25,
      });

      await openActivityTab();

      await waitFor(() => expect(executions).toHaveBeenCalledTimes(1));
      expect(executions).toHaveBeenCalledWith('plug-summarizer', { page: 1, page_size: 25 });

      expect(await screen.findByText('2026-10-01T09:00:00Z')).toBeInTheDocument();
      expect(screen.getByText('2026-09-30T09:00:00Z')).toBeInTheDocument();
      expect(screen.getByText('88ms')).toBeInTheDocument();
      // An execution with no duration says so rather than inventing one.
      expect(screen.getByText('not reported')).toBeInTheDocument();
    });

    it('states plainly when nothing has ever run the plugin', async () => {
      jest
        .spyOn(pluginApi, 'executions')
        .mockResolvedValue({ executions: [], total: 0, page: 1, page_size: 25 });

      await openActivityTab();

      expect(await screen.findByText(/No executions have been recorded/i)).toBeInTheDocument();
      expect(screen.getByText(/Nothing has run it/i)).toBeInTheDocument();
    });

    it('renders the permissions the registry declares', async () => {
      jest.spyOn(pluginApi, 'getPermissions').mockResolvedValue({
        permissions: { on_tool_call: true, 'network:read': true },
      });

      await openActivityTab();

      expect(await screen.findByText('on_tool_call')).toBeInTheDocument();
      expect(screen.getByText('network:read')).toBeInTheDocument();
    });

    it('says when the registry declares no permissions, instead of rendering none', async () => {
      jest.spyOn(pluginApi, 'getPermissions').mockResolvedValue({ permissions: {} });

      await openActivityTab();

      expect(await screen.findByText(/registry declares no permissions/i)).toBeInTheDocument();
    });
  });

  describe('the execution probe', () => {
    async function openProbeTab() {
      renderSubpage();
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /summarizer/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('tab', { name: /execution probe/i }));
      return screen.getByRole('button', { name: /run plugin probe/i });
    }

    it('dispatches to POST /plugins/{id}/execute instead of inventing a result', async () => {
      const executed = jest.spyOn(pluginApi, 'execute').mockResolvedValue({
        id: 'exec-1',
        plugin_id: 'plug-summarizer',
        status: 'success',
        duration_ms: 42,
        output: { summary: 'Two-sentence digest of the payload.' },
        created_at: '2026-10-01T00:00:00Z',
      });

      const run = await openProbeTab();
      fireEvent.click(run);

      await waitFor(() => expect(executed).toHaveBeenCalledTimes(1));
      expect(executed).toHaveBeenCalledWith('plug-summarizer', {
        input: { text: expect.any(String) },
      });

      // The rendered output is the server's record, byte for byte.
      await waitFor(() => {
        expect(screen.getByText(/Two-sentence digest of the payload/)).toBeInTheDocument();
      });
      expect(screen.getByText(/"duration_ms": 42/)).toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'success', title: expect.stringContaining('Executed') }),
      );
    });

    it('does not claim success when the server reports a non-success status', async () => {
      const executed = jest.spyOn(pluginApi, 'execute').mockResolvedValue({
        id: 'exec-2',
        plugin_id: 'plug-summarizer',
        status: 'error',
        error_message: 'entrypoint raised ModuleNotFoundError: numpy',
        created_at: '2026-10-01T00:00:00Z',
      });

      const run = await openProbeTab();
      fireEvent.click(run);

      await waitFor(() => expect(executed).toHaveBeenCalledTimes(1));
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', title: expect.stringContaining('error') }),
      );
      expect(mockToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('successfully') }),
      );
      // The server's own message is surfaced verbatim.
      expect(screen.getByText(/ModuleNotFoundError: numpy/)).toBeInTheDocument();
    });

    it('reports a transport failure instead of rendering a result', async () => {
      const executed = jest
        .spyOn(pluginApi, 'execute')
        .mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8000'));

      const run = await openProbeTab();
      fireEvent.click(run);

      await waitFor(() => expect(executed).toHaveBeenCalledTimes(1));
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: 'error',
          detail: expect.stringContaining('ECONNREFUSED'),
        }),
      );
      expect(screen.queryByText(/Execution Output:/)).not.toBeInTheDocument();
    });
  });
});
