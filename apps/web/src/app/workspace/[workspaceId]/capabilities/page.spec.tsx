import React from 'react';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import CapabilitiesPage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'ws-test-123' }),
}));

jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown-preview">{children}</div>;
  };
});

jest.mock('remark-gfm', () => () => {});

const mockToast = jest.fn();
jest.mock('../../../../components/shared/Toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

jest.mock('@/lib/api-client', () => ({
  agentCatalogApi: {
    get: jest.fn().mockResolvedValue({
      agents: [],
      total: 0,
      canonicalCount: 0,
      toolDefinitions: {},
    }),
  },
  capabilitiesApi: {
    test: jest.fn().mockResolvedValue({
      status: 'success',
      capability: 'test-cap',
      category: 'tools',
      timestamp: '2026-09-20T00:00:00Z',
      executionDurationMs: 25,
      validationErrors: [],
      result: { ok: true },
    }),
  },
  connectorsApi: {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'conn-1', name: 'test', type: 'mcp' }),
    update: jest.fn().mockResolvedValue({ id: 'conn-1', name: 'test', type: 'mcp' }),
    delete: jest.fn().mockResolvedValue(undefined),
    mcp: {
      builtin: jest.fn().mockResolvedValue({ builtin_servers: [] }),
      listTools: jest.fn().mockResolvedValue([]),
      refreshTools: jest.fn().mockResolvedValue([]),
      sync: jest
        .fn()
        .mockResolvedValue({ connector_id: 'conn-1', registered: [], bridged_total: 0 }),
      call: jest.fn().mockResolvedValue({ result: 'ok' }),
    },
    composio: {
      status: jest.fn().mockResolvedValue({ enabled: false, popular_apps: [], total_apps: 0 }),
      apps: jest
        .fn()
        .mockResolvedValue({ total: 0, limit: 1600, offset: 0, apps: [], categories: [] }),
      authUrl: jest.fn().mockResolvedValue({ url: 'https://example.com' }),
      sync: jest.fn().mockResolvedValue({ registered: [] }),
    },
  },
}));

jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: undefined,
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
  })),
}));

jest.mock('../../../../hooks/useWorkspace', () => ({
  useWorkspaceConnectors: () => ({
    connectors: [],
    isLoading: false,
    isError: null,
    mutate: jest.fn(),
  }),
}));

describe('CapabilitiesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('renders the header and all 6 category tabs with counts', () => {
    render(<CapabilitiesPage />);

    expect(screen.getByRole('heading', { name: 'Capabilities' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Skills/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Connectors/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /MCP/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Plugins/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tools/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Agents/i })).toBeInTheDocument();
  });

  it('switches to Connectors tab and displays canonical connectors and studio link', () => {
    render(<CapabilitiesPage />);

    const connectorsTab = screen.getByRole('tab', { name: /Connectors/i });
    fireEvent.click(connectorsTab);

    expect(screen.getByText('Google Drive')).toBeInTheDocument();
    expect(screen.getByText('Full Connectors Studio')).toBeInTheDocument();
  });

  it('defaults to Skills tab and shows skills like acceptance-criteria-review', () => {
    render(<CapabilitiesPage />);

    expect(screen.getAllByText('acceptance-criteria-review').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Copy Spec')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Installed \(/i })).toBeInTheDocument();
  });

  it('switches to Agents tab and displays agent items', () => {
    render(<CapabilitiesPage />);

    const agentsTab = screen.getByRole('tab', { name: /Agents/i });
    fireEvent.click(agentsTab);

    expect(screen.getAllByText('organization').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('memory').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('resume').length).toBeGreaterThanOrEqual(1);

    // Verify direct Chat with Agent link
    const chatLink = screen.getByRole('link', { name: /Chat with/i });
    expect(chatLink).toBeInTheDocument();
    expect(chatLink).toHaveAttribute('href', expect.stringContaining('/chat?agent='));

    // Verify subtabs switching to Memory & Scopes
    const scopesSubtab = screen.getByRole('button', { name: /Memory & Scopes/i });
    fireEvent.click(scopesSubtab);
    expect(screen.getByText(/Read Scopes/i)).toBeInTheDocument();
  });

  it('switches to Tools tab and displays tools like search_documents', () => {
    render(<CapabilitiesPage />);

    const toolsTab = screen.getByRole('tab', { name: /Tools/i });
    fireEvent.click(toolsTab);

    expect(screen.getAllByText('search_documents').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('query_graph').length).toBeGreaterThanOrEqual(1);
  });

  it('filters capabilities based on search input', () => {
    render(<CapabilitiesPage />);

    const searchInput = screen.getByPlaceholderText(/Filter installed skills/i);
    fireEvent.change(searchInput, { target: { value: 'accessibility' } });

    expect(screen.getAllByText('accessibility-testing').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('acceptance-criteria-review')).not.toBeInTheDocument();
  });

  it('toggles a capability on and off and triggers toast notification', () => {
    render(<CapabilitiesPage />);

    const toggleButton = screen.getByRole('switch', { name: /Toggle acceptance-criteria-review/i });
    expect(toggleButton).toHaveAttribute('aria-checked', 'true');

    // Click toggle to disable
    fireEvent.click(toggleButton);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'warning',
        title: expect.stringContaining('Disabled acceptance-criteria-review'),
      }),
    );
  });

  it('opens and submits custom capability modal', () => {
    render(<CapabilitiesPage />);

    const newBtn = screen.getByRole('button', { name: /New Capability/i });
    fireEvent.click(newBtn);

    expect(screen.getByText('Add Custom Capability')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/e\.g\. code-synthesizer/i);
    fireEvent.change(nameInput, { target: { value: 'custom-eval-skill' } });

    const submitBtn = screen.getByRole('button', { name: /Create Capability/i });
    act(() => {
      fireEvent.click(submitBtn);
    });

    expect(screen.getAllByText('custom-eval-skill').length).toBeGreaterThanOrEqual(1);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'success',
        title: expect.stringContaining('Created custom-eval-skill'),
      }),
    );

    // Click the newly created custom skill to inspect it
    const customSkillItem = screen.getAllByText('custom-eval-skill')[0];
    act(() => {
      fireEvent.click(customSkillItem);
    });

    // Verify Delete button is visible for custom skill and deletes it
    const deleteBtn = screen.getByRole('button', { name: /Delete/i });
    expect(deleteBtn).toBeInTheDocument();
    act(() => {
      fireEvent.click(deleteBtn);
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'info',
        title: 'Skill deleted',
      }),
    );
  });

  it('edits skill instructions and saves updated definition', () => {
    render(<CapabilitiesPage />);

    const editBtn = screen.getByRole('button', { name: /Edit/i });
    fireEvent.click(editBtn);

    expect(screen.getAllByRole('button', { name: /Save Changes/i }).length).toBeGreaterThanOrEqual(
      1,
    );
    const textarea = screen.getByRole('textbox', { name: /Skill Instructions/i });
    fireEvent.change(textarea, { target: { value: '# Updated Instructions\n\n- Custom rule 1' } });

    const saveBtn = screen.getAllByRole('button', { name: /Save Changes/i })[0];
    act(() => {
      fireEvent.click(saveBtn);
    });

    expect(screen.getByText(/# Updated Instructions/i)).toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'success',
        title: expect.stringContaining('Saved instructions'),
      }),
    );
  });

  it('instantiates a capability from enterprise preset scaffolds in 1 click', () => {
    render(<CapabilitiesPage />);

    const newBtn = screen.getByRole('button', { name: /New Capability/i });
    fireEvent.click(newBtn);

    // Click Presets tab
    const presetsTab = screen.getByRole('button', { name: /⚡ Presets/i });
    fireEvent.click(presetsTab);

    expect(screen.getByText('Enterprise Production Scaffolds')).toBeInTheDocument();

    // Click "Use Template" for REST API Webhook Tool
    const webhookTemplate = screen.getByText('REST API Webhook Tool');
    expect(webhookTemplate).toBeInTheDocument();
    fireEvent.click(webhookTemplate);

    // Form should now be loaded with webhook details
    expect(screen.getByDisplayValue('rest-api-webhook')).toBeInTheDocument();

    // Submit the capability
    const submitBtn = screen.getByRole('button', { name: /Create Capability/i });
    act(() => {
      fireEvent.click(submitBtn);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'success',
        title: expect.stringContaining('Created rest-api-webhook'),
      }),
    );
  });

  it('switches to MCP category in Studio Builder and configures protocol settings', () => {
    render(<CapabilitiesPage />);

    const newBtn = screen.getByRole('button', { name: /New Capability/i });
    fireEvent.click(newBtn);

    const dialog = screen.getByRole('dialog');
    // Click MCP category chip inside modal dialog
    const mcpChip = within(dialog).getByRole('button', { name: /MCP/i });
    fireEvent.click(mcpChip);

    expect(screen.getByText('MCP Protocol Configuration')).toBeInTheDocument();
    expect(screen.getByText('MCP v2 Standard')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/e\.g\. code-synthesizer/i);
    fireEvent.change(nameInput, { target: { value: 'vault-sqlite-mcp' } });

    const submitBtn = within(dialog).getByRole('button', { name: /Create Capability/i });
    act(() => {
      fireEvent.click(submitBtn);
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'success',
        title: expect.stringContaining('Created vault-sqlite-mcp'),
      }),
    );
  });

  it('switches to MCP tab and displays verified catalog and mcp control plane', async () => {
    render(<CapabilitiesPage />);

    const mcpTab = screen.getByRole('tab', { name: /MCP/i });
    await act(async () => {
      fireEvent.click(mcpTab);
    });

    await waitFor(() => {
      expect(screen.getByText('Verified Catalog')).toBeInTheDocument();
      expect(screen.getByText('SQLite Memory MCP')).toBeInTheDocument();
      expect(screen.getByText('Local Filesystem MCP')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Inspector & Tools/i })).toBeInTheDocument();
    });
  });
});
