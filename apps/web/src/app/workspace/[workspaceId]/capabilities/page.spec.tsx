import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
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

  it('renders the header and all 5 category tabs with counts', () => {
    render(<CapabilitiesPage />);

    expect(screen.getByRole('heading', { name: 'Capabilities' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Skills/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Agents/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tools/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /MCP/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Plugins/i })).toBeInTheDocument();
  });

  it('defaults to Skills tab and shows skills like acceptance-criteria-review', () => {
    render(<CapabilitiesPage />);

    expect(screen.getAllByText('acceptance-criteria-review').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Changes apply to new sessions')).toBeInTheDocument();
  });

  it('switches to Agents tab and displays agent items', () => {
    render(<CapabilitiesPage />);

    const agentsTab = screen.getByRole('tab', { name: /Agents/i });
    fireEvent.click(agentsTab);

    expect(screen.getAllByText('organization').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('memory').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('resume').length).toBeGreaterThanOrEqual(1);
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

    const searchInput = screen.getByPlaceholderText(/Try "general"/i);
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
  });

  it('switches to Test Playground tab and triggers execution test', async () => {
    render(<CapabilitiesPage />);

    const testSubTab = screen.getByRole('button', { name: /Test Playground/i });
    fireEvent.click(testSubTab);

    expect(screen.getByText('Test Input Payload (JSON)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Execute Run/i })).toBeInTheDocument();

    const executeBtn = screen.getByRole('button', { name: /Execute Run/i });
    fireEvent.click(executeBtn);

    const outputHeader = await screen.findByText('Execution Output');
    expect(outputHeader).toBeInTheDocument();
    expect(screen.getByText('200 OK')).toBeInTheDocument();
  });

  it('toggles the Hub browser visibility and triggers Update installed toast', () => {
    render(<CapabilitiesPage />);

    expect(screen.getByText('Capabilities Hub')).toBeInTheDocument();
    expect(screen.getByText('Capabilities & Plugin Catalog')).toBeInTheDocument();

    // Toggle collapse
    const hideBtn = screen.getByRole('button', { name: /Hide the hub browser/i });
    fireEvent.click(hideBtn);

    expect(screen.queryByText('Capabilities & Plugin Catalog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show the hub browser/i })).toBeInTheDocument();

    // Toggle expand
    const showBtn = screen.getByRole('button', { name: /Show the hub browser/i });
    fireEvent.click(showBtn);
    expect(screen.getByText('Capabilities & Plugin Catalog')).toBeInTheDocument();

    // Trigger update installed
    const updateBtn = screen.getByRole('button', { name: /Update installed/i });
    fireEvent.click(updateBtn);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'info',
        title: expect.stringContaining('Updating installed capabilities'),
      }),
    );
  });

  it('installs a capability from the Hub into the workspace via 1-click', () => {
    render(<CapabilitiesPage />);

    // Find a hub install button
    const addBtns = screen.getAllByRole('button', { name: /\+ Add to workspace/i });
    expect(addBtns.length).toBeGreaterThan(0);

    // Click the first install button
    fireEvent.click(addBtns[0]);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'success',
        title: expect.stringMatching(/Installed/i),
      }),
    );
  });

  it('opens and submits Import Capability from Git / URL modal', async () => {
    jest.useFakeTimers();
    render(<CapabilitiesPage />);

    const importBtn = screen.getByRole('button', { name: /Import URL \/ Git/i });
    fireEvent.click(importBtn);

    expect(screen.getByText('Import Capability from Git / URL')).toBeInTheDocument();

    const urlInput = screen.getByPlaceholderText(/https:\/\/github\.com/i);
    fireEvent.change(urlInput, {
      target: { value: 'https://github.com/vaeloom/skills-community/tree/main/rag-eval' },
    });

    const submitBtn = screen.getByRole('button', { name: /Import & Activate/i });
    await act(async () => {
      fireEvent.click(submitBtn);
      jest.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'success',
        title: expect.stringContaining('Imported'),
      }),
    );
    jest.useRealTimers();
  });

  it('filters Hub items when clicking category pills and dynamically updates subheader', () => {
    render(<CapabilitiesPage />);

    // Click Memory category pill
    const memoryPill = screen.getByRole('button', { name: /Memory/i });
    fireEvent.click(memoryPill);

    // Dynamic subheader should update
    expect(screen.getByText(/Episodic recall, knowledge graph storage/i)).toBeInTheDocument();

    // Cards for memory should appear
    expect(screen.getByText('chroma-vector-vault')).toBeInTheDocument();
    expect(screen.queryByText('No catalog items match criteria')).not.toBeInTheDocument();

    // Click Automation category pill
    const automationPill = screen.getByRole('button', { name: /Automation/i });
    fireEvent.click(automationPill);

    expect(screen.getByText(/Scheduled cron triggers, webhook relays/i)).toBeInTheDocument();
    expect(screen.getByText('cron-workflow-scheduler')).toBeInTheDocument();
    expect(screen.queryByText('No catalog items match criteria')).not.toBeInTheDocument();
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
});
