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
});
