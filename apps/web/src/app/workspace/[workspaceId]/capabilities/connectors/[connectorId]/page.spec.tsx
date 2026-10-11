import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ConnectorSubpage from './page';

const mockPush = jest.fn();
let mockParams = { workspaceId: 'ws-test-123', connectorId: 'conn-github' };

jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

const mockToast = jest.fn();
jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('../../../../../../hooks/useWorkspace', () => ({
  useWorkspaceConnectors: () => ({
    connectors: [
      {
        id: 'conn-github',
        provider: 'github',
        status: 'connected',
        accountEmail: 'dev@vaeloom.app',
        lastSyncAt: '2026-03-01T10:00:00Z',
      },
    ],
    isLoading: false,
  }),
}));

jest.mock('@/lib/api-client', () => {
  const actual = jest.requireActual('@/lib/api-client');
  return {
    ...actual,
    connectorsApi: {
      get: jest.fn().mockResolvedValue({
        id: 'conn-github',
        name: 'GitHub',
        type: 'github',
        status: 'connected',
        lastSyncedAt: '2026-03-01T10:00:00Z',
        scopes: ['repo', 'read:user'],
      }),
      health: jest.fn().mockResolvedValue({
        status: 'healthy',
        latencyMs: 15,
      }),
      mcp: {
        sync: jest.fn().mockResolvedValue({ registered: ['github_list_repos'] }),
        listTools: jest.fn().mockResolvedValue({ tools: [] }),
      },
    },
  };
});

describe('ConnectorSubpage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { workspaceId: 'ws-test-123', connectorId: 'conn-github' };
  });

  it('renders breadcrumbs and connector title for a known connector', async () => {
    render(<ConnectorSubpage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /GitHub/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Back to Connectors')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Health Check/i })).toBeInTheDocument();
  });

  it('renders empty state when connector is not found', async () => {
    mockParams = { workspaceId: 'ws-test-123', connectorId: 'unknown-conn' };
    const { connectorsApi } = jest.requireMock('@/lib/api-client');
    connectorsApi.get.mockRejectedValueOnce(new Error('Not found'));

    render(<ConnectorSubpage />);

    await waitFor(() => {
      expect(screen.getByText(/Connector "unknown-conn" not found/i)).toBeInTheDocument();
    });

    const viewAllButton = screen.getByRole('button', { name: /View all Connectors/i });
    fireEvent.click(viewAllButton);
    expect(mockPush).toHaveBeenCalledWith(
      '/workspace/ws-test-123/capabilities?category=connectors',
    );
  });
});
