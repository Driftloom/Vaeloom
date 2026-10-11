import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    },
  };
});

describe('PluginSubpage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { workspaceId: 'ws-test-123', pluginId: 'summarizer' };
  });

  it('renders breadcrumbs and plugin header for a known plugin', async () => {
    render(<PluginSubpage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /summarizer/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Back to Plugins')).toBeInTheDocument();
  });

  it('renders empty state when plugin is not found', async () => {
    mockParams = { workspaceId: 'ws-test-123', pluginId: 'unknown-plugin-xyz' };
    render(<PluginSubpage />);

    await waitFor(() => {
      expect(screen.getByText(/Plugin "unknown-plugin-xyz" not found/i)).toBeInTheDocument();
    });

    const viewAllButton = screen.getByRole('button', { name: /View all Plugins/i });
    fireEvent.click(viewAllButton);
    expect(mockPush).toHaveBeenCalledWith('/workspace/ws-test-123/capabilities?category=plugins');
  });

  describe('the execution probe', () => {
    async function openProbeTab() {
      render(<PluginSubpage />);
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
