/**
 * SkillsView enterprise test suite.
 *
 * Verifies:
 * - Domain categorization (Career & ATS, Agent Architecture, Engineering Tools)
 * - Trust class filtering
 * - Selection, telemetry card rendering, and Markdown viewing
 * - Edit instructions flow
 * - Live Diagnostic Playground drawer
 * - Trigger Simulator modal
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { SkillsView, type SkillRow } from '../SkillsView';
import type { CapabilityItem } from '@/lib/capabilities-data';

jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown-preview">{children}</div>;
  };
});

jest.mock('remark-gfm', () => () => {});

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ workspaceId: 'ws-test' }),
}));

const mockTestCapability = jest.fn();
const mockValidateDraft = jest.fn();

jest.mock('@/lib/api-client', () => {
  const actual = jest.requireActual('@/lib/api-client');
  return {
    ...actual,
    capabilitiesApi: {
      ...actual.capabilitiesApi,
      testCapability: (...args: unknown[]) => mockTestCapability(...args),
      validateDraft: (...args: unknown[]) => mockValidateDraft(...args),
    },
  };
});

function makeItem(name: string, overrides: Partial<CapabilityItem> = {}): CapabilityItem {
  return {
    id: `item-${name}`,
    name,
    category: 'skills',
    description: `Description for ${name}`,
    status: 'active',
    enabled: true,
    version: '1.2.0',
    author: 'Vaeloom Core Team',
    source: 'built-in',
    runtime: 'python',
    tags: ['ats', 'resume'],
    triggers: ['review resume', 'ats scan'],
    markdownDoc: `# ${name}\n\nOperating guidelines and instructions for ${name}.`,
    requiredScope: 'workspace.read',
    trustClass: 'core_trusted',
    autonomy: 'supervised',
    usageCount: 42,
    lastUsedAt: '2026-09-30T10:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-30T10:00:00Z',
    ...overrides,
  };
}

function makeRow(
  name: string,
  overrides: Partial<SkillRow> = {},
  itemOverrides: Partial<CapabilityItem> = {},
): SkillRow {
  return {
    key: `key-${name}`,
    item: makeItem(name, itemOverrides),
    installed: true,
    bundled: true,
    slug: name,
    serverBacked: true,
    ...overrides,
  };
}

describe('SkillsView enterprise suite', () => {
  const defaultProps = {
    installedCount: 3,
    browseCount: 2,
    searchQuery: '',
    onClearSearch: jest.fn(),
    tab: 'installed' as const,
    onTabChange: jest.fn(),
    sort: 'most-used' as const,
    onSortChange: jest.fn(),
    selectedKey: 'key-ats-resume-builder',
    onSelect: jest.fn(),
    onToggleEnabled: jest.fn(),
    onInstall: jest.fn(),
    onSaveDoc: jest.fn().mockResolvedValue('server'),
    onDelete: jest.fn(),
    onCopyDoc: jest.fn(),
    onOpenCreate: jest.fn(),
    isLoading: false,
    onRetry: jest.fn(),
    pendingKey: null,
  };

  const sampleRows: SkillRow[] = [
    makeRow(
      'ats-resume-builder',
      { installed: true },
      {
        tags: ['ats', 'resume', 'career'],
        triggers: ['review resume', 'ats audit'],
        trustClass: 'core_trusted',
      },
    ),
    makeRow(
      'ai-agents-orchestration',
      { installed: true },
      {
        tags: ['agent', 'orchestration', 'workflow'],
        triggers: ['orchestrate agents', 'multi-agent'],
        trustClass: 'enterprise',
      },
    ),
    makeRow(
      'git-release-manager',
      { installed: true },
      {
        tags: ['engineering', 'git', 'release'],
        triggers: ['cut release', 'tag version'],
        trustClass: 'community',
      },
    ),
    makeRow(
      'career-coaching',
      { installed: false, serverBacked: false },
      {
        tags: ['career', 'interview', 'salary'],
        triggers: ['career coaching', 'mock interview'],
        trustClass: 'core_trusted',
      },
    ),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders skill list with domain filters and installed count', () => {
    render(<SkillsView {...defaultProps} rows={sampleRows} />);

    expect(screen.getByRole('button', { name: /^Installed \(3\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Browse \(2\)/i })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Skills' });
    expect(within(list).getByText('ats-resume-builder')).toBeInTheDocument();
    expect(within(list).getByText('ai-agents-orchestration')).toBeInTheDocument();
    expect(within(list).getByText('git-release-manager')).toBeInTheDocument();
  });

  it('filters skills by career domain when Career & ATS pill is clicked', () => {
    render(<SkillsView {...defaultProps} rows={sampleRows} />);

    const careerPill = screen.getByRole('button', { name: /Career & ATS/i });
    fireEvent.click(careerPill);

    const list = screen.getByRole('list', { name: 'Skills' });
    expect(within(list).getByText('ats-resume-builder')).toBeInTheDocument();
    expect(within(list).queryByText('git-release-manager')).not.toBeInTheDocument();
  });

  it('filters skills by agent domain when Agent Architecture pill is clicked', () => {
    render(<SkillsView {...defaultProps} rows={sampleRows} />);

    const agentPill = screen.getByRole('button', { name: /Agent Architecture/i });
    fireEvent.click(agentPill);

    const list = screen.getByRole('list', { name: 'Skills' });
    expect(within(list).getByText('ai-agents-orchestration')).toBeInTheDocument();
    expect(within(list).queryByText('ats-resume-builder')).not.toBeInTheDocument();
    expect(within(list).queryByText('git-release-manager')).not.toBeInTheDocument();
  });

  it('renders rich markdown with SkillMarkdownViewer when viewing instructions', () => {
    render(<SkillsView {...defaultProps} rows={sampleRows} selectedKey="key-ats-resume-builder" />);

    expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
    expect(screen.getByText(/Operating guidelines and instructions/i)).toBeInTheDocument();
  });

  it('toggles edit mode on Edit instructions click and can cancel', () => {
    render(<SkillsView {...defaultProps} rows={sampleRows} selectedKey="key-ats-resume-builder" />);

    const editBtn = screen.getByRole('button', { name: /Edit instructions/i });
    fireEvent.click(editBtn);

    const textarea = screen.getByPlaceholderText(
      /# Enter skill rules, triggers and instructions in markdown/i,
    );
    expect(textarea).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(
      screen.queryByPlaceholderText(/# Enter skill rules, triggers and instructions in markdown/i),
    ).not.toBeInTheDocument();
  });

  it('opens and closes the Live Diagnostic Playground drawer', async () => {
    mockTestCapability.mockResolvedValueOnce({
      status: 'success',
      latencyMs: 12.5,
      output: {
        syntax_valid: true,
        rules_checked: 8,
        violations: [],
        estimated_tokens: 340,
        token_budget: 1500,
        within_budget: true,
        trigger_matched: true,
        trigger_detail: 'Matched trigger phrase',
        preview: '# ats-resume-builder safe preview...',
      },
      error: null,
      executed: true,
    });

    render(<SkillsView {...defaultProps} rows={sampleRows} selectedKey="key-ats-resume-builder" />);

    const playgroundBtn = screen.getByRole('button', {
      name: /Open Playground for ats-resume-builder/i,
    });
    fireEvent.click(playgroundBtn);

    expect(
      screen.getByRole('dialog', { name: /Skill Diagnostic Playground: ats-resume-builder/i }),
    ).toBeInTheDocument();

    const runBtn = screen.getByRole('button', { name: /Execute Diagnostic Test/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(mockTestCapability).toHaveBeenCalledWith(
        'key-ats-resume-builder',
        expect.objectContaining({
          sample_message: expect.any(String),
        }),
      );
    });

    expect(await screen.findByText(/Diagnostic Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/340 \/ 1500 tokens/i)).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Close playground/i });
    fireEvent.click(closeBtn);

    expect(
      screen.queryByRole('dialog', { name: /Skill Diagnostic Playground/i }),
    ).not.toBeInTheDocument();
  });

  it('launches the playground skill into chat with skill slug and mapped agent params', async () => {
    mockTestCapability.mockResolvedValueOnce({
      status: 'success',
      latencyMs: 12.5,
      output: {
        syntax_valid: true,
        rules_checked: 8,
        violations: [],
        estimated_tokens: 340,
        token_budget: 1500,
        within_budget: true,
        trigger_matched: true,
        trigger_detail: 'Matched trigger phrase',
        preview: '# ats-resume-builder safe preview...',
      },
      error: null,
      executed: true,
    });

    render(
      <SkillsView
        {...defaultProps}
        workspaceId="ws-test"
        rows={sampleRows}
        selectedKey="key-ats-resume-builder"
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Open Playground for ats-resume-builder/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Execute Diagnostic Test/i }));

    await waitFor(() => {
      expect(mockTestCapability).toHaveBeenCalled();
    });

    fireEvent.click(await screen.findByRole('button', { name: /Launch in Live Chat/i }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain('/workspace/ws-test/chat?');
    expect(pushedUrl).toContain('skill=ats-resume-builder');
    expect(pushedUrl).toContain('agent=resume');
    expect(pushedUrl).toContain('prompt=');
  });

  it('re-derives the open playground from live rows so install state updates without reopening', () => {
    const { rerender } = render(
      <SkillsView {...defaultProps} rows={sampleRows} selectedKey="key-career-coaching" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Open Playground for career-coaching/i }));

    const dialog = screen.getByRole('dialog', {
      name: /Skill Diagnostic Playground: career-coaching/i,
    });
    expect(within(dialog).getByText('Catalog')).toBeInTheDocument();

    const installedRows = sampleRows.map((row) =>
      row.key === 'key-career-coaching' ? { ...row, installed: true, serverBacked: true } : row,
    );
    rerender(
      <SkillsView {...defaultProps} rows={installedRows} selectedKey="key-career-coaching" />,
    );

    const liveDialog = screen.getByRole('dialog', {
      name: /Skill Diagnostic Playground: career-coaching/i,
    });
    expect(within(liveDialog).getByText('Installed')).toBeInTheDocument();
    expect(within(liveDialog).queryByText('Catalog')).not.toBeInTheDocument();
  });

  it('opens Trigger Simulator modal and evaluates prompt matching', async () => {
    render(<SkillsView {...defaultProps} rows={sampleRows} />);

    const simBtn = screen.getByRole('button', { name: /Trigger Simulator/i });
    fireEvent.click(simBtn);

    expect(
      screen.getByRole('dialog', { name: /Skill Trigger & Intent Simulator/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Active Injections:/i)).toBeInTheDocument();

    const closeBtn = within(
      screen.getByRole('dialog', { name: /Skill Trigger & Intent Simulator/i }),
    ).getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);

    expect(
      screen.queryByRole('dialog', { name: /Skill Trigger & Intent Simulator/i }),
    ).not.toBeInTheDocument();
  });

  it('contains focus inside the Trigger Simulator and closes on Escape', () => {
    render(<SkillsView {...defaultProps} rows={sampleRows} />);

    fireEvent.click(screen.getByRole('button', { name: /Trigger Simulator/i }));
    const dialog = screen.getByRole('dialog', { name: /Skill Trigger & Intent Simulator/i });

    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close');

    expect(document.body.style.overflow).toBe('hidden');

    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: /Skill Trigger & Intent Simulator/i }),
    ).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('matches filler-word-separated trigger tokens and states the token-set rule', () => {
    render(<SkillsView {...defaultProps} rows={sampleRows} />);

    fireEvent.click(screen.getByRole('button', { name: /Trigger Simulator/i }));
    const dialog = screen.getByRole('dialog', { name: /Skill Trigger & Intent Simulator/i });
    const textarea = within(dialog).getByPlaceholderText(/e.g. Audit my resume bullets/i);

    fireEvent.change(textarea, { target: { value: 'what is the weather in oslo' } });
    expect(within(dialog).getByText(/No active skills matched this prompt/i)).toBeInTheDocument();

    fireEvent.change(textarea, {
      target: { value: 'Please orchestrate the agents for this task' },
    });
    expect(within(dialog).getByText('ai-agents-orchestration')).toBeInTheDocument();
    expect(within(dialog).getByText(/Matched triggers: .orchestrate agents./)).toBeInTheDocument();

    expect(
      within(dialog).getByText(
        'Simulation uses token-set matching: every word of a declared trigger must appear somewhere in the message, in any order.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/whitespace-collapsed/)).not.toBeInTheDocument();
  });

  it('shows a distinct empty state when no skills are installed', () => {
    render(<SkillsView {...defaultProps} rows={[]} />);

    fireEvent.click(screen.getByRole('button', { name: /Trigger Simulator/i }));
    const dialog = screen.getByRole('dialog', { name: /Skill Trigger & Intent Simulator/i });

    expect(within(dialog).getByText(/No installed skills to simulate/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/No active skills matched/i)).not.toBeInTheDocument();
  });

  it('derives playground trigger details from the shared token-set matcher', async () => {
    mockValidateDraft.mockResolvedValueOnce({ status: 'success', rulesChecked: 8, violations: [] });

    render(<SkillsView {...defaultProps} rows={sampleRows} selectedKey="key-career-coaching" />);

    fireEvent.click(screen.getByRole('button', { name: /Open Playground for career-coaching/i }));
    const dialog = screen.getByRole('dialog', {
      name: /Skill Diagnostic Playground: career-coaching/i,
    });

    fireEvent.change(
      within(dialog).getByPlaceholderText(/Enter a prompt to simulate agent execution/i),
      { target: { value: "I'd like career and coaching guidance" } },
    );
    fireEvent.click(within(dialog).getByRole('button', { name: /Execute Diagnostic Test/i }));

    expect(await within(dialog).findByText('TRIGGER FIRED')).toBeInTheDocument();
    expect(within(dialog).getByText('Matched triggers: career coaching')).toBeInTheDocument();
  });

  it('renders the server-reported token budget and states it in the copy', async () => {
    mockTestCapability.mockResolvedValueOnce({
      status: 'success',
      latencyMs: 10,
      output: {
        syntax_valid: true,
        rules_checked: 8,
        violations: [],
        estimated_tokens: 340,
        token_budget: 4000,
        within_budget: true,
        trigger_matched: true,
        trigger_detail: 'Matched trigger phrase',
        preview: '# ats-resume-builder safe preview...',
      },
      error: null,
      executed: true,
    });

    render(<SkillsView {...defaultProps} rows={sampleRows} selectedKey="key-ats-resume-builder" />);

    fireEvent.click(
      screen.getByRole('button', { name: /Open Playground for ats-resume-builder/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Execute Diagnostic Test/i }));

    expect(await screen.findByText(/340 \/ 4000 tokens/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Skills are allocated a bounded slice (4000 tokens) of the prompt window to protect memory and tool schemas.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/1,500/)).not.toBeInTheDocument();
  });

  it('omits the budget number for client-simulated catalog skills', async () => {
    mockValidateDraft.mockResolvedValueOnce({
      status: 'success',
      rulesChecked: 8,
      violations: [],
    });

    render(<SkillsView {...defaultProps} rows={sampleRows} selectedKey="key-career-coaching" />);

    fireEvent.click(screen.getByRole('button', { name: /Open Playground for career-coaching/i }));
    const dialog = screen.getByRole('dialog', {
      name: /Skill Diagnostic Playground: career-coaching/i,
    });

    fireEvent.click(within(dialog).getByRole('button', { name: /Execute Diagnostic Test/i }));

    expect(await within(dialog).findByText(/tokens estimated/i)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('progressbar', { name: /Token consumption/i }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/1,500/)).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Skills are allocated a bounded slice of the prompt window to protect memory and tool schemas.',
      ),
    ).toBeInTheDocument();
  });

  it('provides 1-click Download .skill.md action', () => {
    const createObjectURLMock = jest.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = jest.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    render(<SkillsView {...defaultProps} rows={sampleRows} selectedKey="key-ats-resume-builder" />);

    const downloadBtn = screen.getByRole('button', {
      name: /Download ats-resume-builder markdown document/i,
    });
    fireEvent.click(downloadBtn);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalled();
  });

  it('pins the IA contract: the detail pane links to the full skill page', () => {
    const { unmount } = render(
      <SkillsView {...defaultProps} rows={sampleRows} workspaceId="ws-123" />,
    );

    const link = screen.getByRole('link', { name: /Open Full Page/ });
    expect(link).toHaveAttribute(
      'href',
      '/workspace/ws-123/capabilities/skills/ats-resume-builder',
    );

    unmount();
    render(<SkillsView {...defaultProps} rows={sampleRows} />);
    expect(screen.queryByRole('link', { name: /Open Full Page/ })).not.toBeInTheDocument();
  });

  it('pins the IA contract: on narrow viewports, selecting a skill swaps the pane in place', () => {
    const originalInnerWidth = window.innerWidth;
    window.innerWidth = 375;

    try {
      const { container } = render(
        <SkillsView {...defaultProps} rows={sampleRows} workspaceId="ws-123" />,
      );
      const [listColumn, detailColumn] = Array.from(
        container.firstElementChild!.children,
      ) as HTMLElement[];

      expect(listColumn.classList.contains('hidden')).toBe(false);
      expect(detailColumn.classList.contains('hidden')).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'ats-resume-builder' }));

      expect(listColumn.classList.contains('hidden')).toBe(true);
      expect(detailColumn.classList.contains('hidden')).toBe(false);
      expect(mockPush).not.toHaveBeenCalled();

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(listColumn.classList.contains('hidden')).toBe(false);
      expect(detailColumn.classList.contains('hidden')).toBe(true);
      expect(mockPush).not.toHaveBeenCalled();
    } finally {
      window.innerWidth = originalInnerWidth;
    }
  });

  it('pins the selected-row styling to the surface-selected token', () => {
    render(<SkillsView {...defaultProps} rows={sampleRows} />);

    const selectedCard = screen.getByRole('button', { name: 'ats-resume-builder' }).closest('div');
    const unselectedCard = screen
      .getByRole('button', { name: 'ai-agents-orchestration' })
      .closest('div');

    expect(selectedCard).toHaveClass('bg-surface-selected');
    expect(selectedCard).not.toHaveClass('text-primary');
    expect(unselectedCard).not.toHaveClass('bg-surface-selected');
  });
});
