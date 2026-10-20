import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SWRConfig } from 'swr';
import McpSubpage from './page';
import { connectorsApi } from '@/lib/api-client';

const mockPush = jest.fn();
let mockParams = { workspaceId: 'ws-test-123', serverId: 'mcp-filesystem' };

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
    connectorsApi: {
      list: jest.fn().mockResolvedValue([
        {
          id: 'mcp-filesystem',
          name: 'Filesystem Server',
          type: 'mcp',
          status: 'connected',
          config: { transport: 'stdio', command: 'npx -y @modelcontextprotocol/server-filesystem' },
        },
      ]),
      mcp: {
        builtin: jest.fn().mockResolvedValue({ servers: [] }),
        listTools: jest.fn().mockResolvedValue({
          tools: [
            {
              name: 'read_file',
              description: 'Read file contents from filesystem',
              inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
            },
          ],
        }),
        sync: jest.fn().mockResolvedValue({ registered: ['read_file'] }),
        callTool: jest
          .fn()
          .mockResolvedValue({ content: [{ type: 'text', text: 'file content' }] }),
      },
    },
  };
});

function renderSubpage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <McpSubpage />
    </SWRConfig>,
  );
}

describe('McpSubpage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { workspaceId: 'ws-test-123', serverId: 'mcp-filesystem' };
  });

  it('renders breadcrumbs and server title for a configured MCP server', async () => {
    renderSubpage();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /Filesystem Server/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Back to MCP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sync Tools/i })).toBeInTheDocument();
  });

  it('renders the live transport the configured connector declares', async () => {
    connectorsApi.list.mockResolvedValueOnce([
      {
        id: 'mcp-filesystem',
        name: 'Filesystem Server',
        type: 'mcp',
        status: 'connected',
        config: { transport: 'http', url: 'http://127.0.0.1:7000/mcp' },
      },
    ]);

    renderSubpage();

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /Filesystem Server/i }),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText('stdio')).not.toBeInTheDocument();
    const transportNodes = await screen.findAllByText('http');
    expect(transportNodes.length).toBeGreaterThan(0);
  });

  it('renders empty state when MCP server is not found', async () => {
    mockParams = { workspaceId: 'ws-test-123', serverId: 'unknown-mcp-server-xyz' };
    renderSubpage();

    await waitFor(() => {
      expect(
        screen.getByText(/MCP Server "unknown-mcp-server-xyz" not found/i),
      ).toBeInTheDocument();
    });

    const viewAllButton = screen.getByRole('button', { name: /View all MCP Servers/i });
    fireEvent.click(viewAllButton);
    expect(mockPush).toHaveBeenCalledWith('/workspace/ws-test-123/capabilities?category=mcp');
  });
});
