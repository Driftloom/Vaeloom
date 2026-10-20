import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ToolSubpage from './page';

const mockPush = jest.fn();
let mockParams = { workspaceId: 'ws-test-123', toolName: 'search_documents' };

jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

const mockToast = jest.fn();
jest.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

/**
 * CamelCased `GET /capabilities/tools/definitions` rows, the client shape after
 * `transformKeys` runs. Names, scopes, categories, and trust classes were read
 * out of the backend registry (`ALL_TOOLS` in
 * `apps/api/src/api/tools/definitions.py`); descriptions are neutral fixture
 * text and `$inputSchema`/`$outputSchema` mirror what the backend's
 * `_build_schema` produces for these tools.
 */
const FIXTURE_DEFINITIONS = [
  {
    name: 'search_documents',
    description: 'Search across workspace documents.',
    requiredScope: 'memory.read',
    category: 'memory_read',
    trustClass: 'first_party',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search for documents.' },
      },
      required: ['query'],
    },
    outputSchema: { type: 'object' },
  },
  {
    name: 'spawn_sub_agents',
    description: 'Fan a task out to sub agents.',
    requiredScope: 'agent.spawn',
    category: 'system',
    trustClass: 'core_trusted',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Prompt handed to the sub agents.' },
      },
      required: ['prompt'],
    },
    outputSchema: { type: 'object' },
  },
  {
    name: 'search_gmail',
    description: 'Search Gmail messages.',
    requiredScope: 'connector.gmail.read',
    category: 'connector_read',
    trustClass: 'first_party',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query.' },
      },
      required: ['query'],
    },
    outputSchema: { type: 'object' },
  },
];

jest.mock('@/lib/api-client', () => {
  const actual = jest.requireActual('@/lib/api-client');
  return {
    ...actual,
    capabilitiesApi: {
      listToolDefinitions: jest.fn(async () => JSON.parse(JSON.stringify(FIXTURE_DEFINITIONS))),
      list: jest.fn().mockResolvedValue([
        {
          id: 'tool-search_documents',
          name: 'search_documents',
          category: 'tool',
          enabled: true,
        },
      ]),
      update: jest.fn().mockResolvedValue({ id: 'tool-search_documents', enabled: false }),
      create: jest.fn().mockResolvedValue({ id: 'tool-search_documents' }),
      test: jest.fn().mockResolvedValue({
        status: 'success',
        executed: true,
        executionDurationMs: 25,
        validationErrors: [],
        result: { score: 95 },
      }),
    },
  };
});

describe('ToolSubpage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { workspaceId: 'ws-test-123', toolName: 'search_documents' };
  });

  it('renders breadcrumbs and tool header for a known tool', async () => {
    render(<ToolSubpage />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /search_documents/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Back to Tools')).toBeInTheDocument();
  });

  it('shows the served scope, suite, and trust class on the contract tab', async () => {
    render(<ToolSubpage />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /search_documents/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('memory.read')).toBeInTheDocument();
    expect(screen.getByText('Memory Graph')).toBeInTheDocument();
    expect(screen.getByText('first_party')).toBeInTheDocument();
  });

  it('renders an explicit not-found panel for an unknown name and nothing else', async () => {
    mockParams = { workspaceId: 'ws-test-123', toolName: 'unknown-tool-xyz' };
    render(<ToolSubpage />);

    await waitFor(() => {
      expect(screen.getByText(/Tool "unknown-tool-xyz" not found/i)).toBeInTheDocument();
    });

    const viewAllButton = screen.getByRole('button', { name: /View all Tools/i });
    fireEvent.click(viewAllButton);
    expect(mockPush).toHaveBeenCalledWith('/workspace/ws-test-123/capabilities?category=tools');

    // No detail scaffold may ride along with the not-found panel: the unknown
    // name resolves to a panel, never to a half-rendered definition.
    expect(screen.queryByText('Validate Schema & Dry-Run Invocation')).toBeNull();
    expect(screen.queryByText('Parameter Definitions')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
