import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PluginSubpage from './page';

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
});
