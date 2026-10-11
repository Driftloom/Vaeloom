import '@testing-library/jest-dom';
import React, { useState } from 'react';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';

import { ChatComposer, type ChatComposerProps } from '../ChatComposer';
import { ChatWindow } from '../ChatWindow';
import type { ChatSkill, MentionTarget, SlashCommand } from '../types';
import * as workspaceHooks from '@/hooks/useWorkspace';

jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown-preview">{children}</div>;
  };
});
jest.mock('remark-gfm', () => () => {});

const mockSearchParams = new Map<string, string>();
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) ?? null,
  }),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('@/components/providers/RealtimeProvider', () => ({
  useRealtime: () => ({ status: 'connected' }),
}));

const TEST_SKILLS: ChatSkill[] = [
  {
    id: 'skill-resume-quantifier',
    name: 'resume-quantifier',
    slug: 'resume-quantifier',
    description: 'Calculate metrics for resume bullets',
    enabled: true,
  },
  {
    id: 'skill-ats-audit',
    name: 'ats-audit',
    slug: 'ats-audit',
    description: 'Comprehensive ATS parseability audit',
    enabled: true,
  },
  {
    id: 'skill-disabled',
    name: 'disabled-skill',
    slug: 'disabled-skill',
    description: 'Disabled skill test',
    enabled: false,
  },
];

const RAW_API_SKILLS = [
  ...TEST_SKILLS.map((s) => ({
    ...s,
    installed: true,
    category: 'skill',
    version: '1.0.0',
    status: s.enabled ? 'ENABLED' : 'DISABLED',
    author: 'system',
    type: 'bundled',
    runtime: 'markdown',
    config: {},
    usageCount: 0,
    lastUsedAt: null,
  })),
];

jest.mock('@/hooks/useWorkspace', () => ({
  useWorkspaceCapabilities: jest.fn(() => ({
    skills: RAW_API_SKILLS,
    isLoading: false,
    isError: null,
    mutate: jest.fn(),
  })),
}));

jest.mock('../chat-api', () => ({
  fetchSlashCommands: jest.fn(() =>
    Promise.resolve({
      commands: [
        { trigger: '/organize', desc: 'Organize files', agent: 'organize' },
        { trigger: '/resume', desc: 'Tailor resume', agent: 'resume' },
      ],
      state: 'ready',
    }),
  ),
  fetchAgentCatalog: jest.fn(() =>
    Promise.resolve({
      agents: [
        { name: 'resume', mission: 'Resume specialist', isCanonical: true },
        { name: 'ats', mission: 'ATS specialist', isCanonical: true },
      ],
      state: 'ready',
    }),
  ),
}));

jest.mock('../conversation-api', () => ({
  ...jest.requireActual('../conversation-api'),
  ConversationApi: {
    list: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue({ id: 'thread-1', messages: [] }),
    create: jest.fn().mockResolvedValue({ id: 'thread-1', messages: [] }),
    rename: jest.fn().mockResolvedValue({ id: 'thread-1', messages: [] }),
    remove: jest.fn().mockResolvedValue(undefined),
    clearMessages: jest.fn().mockResolvedValue(undefined),
    appendMessage: jest.fn().mockResolvedValue(undefined),
  },
}));

const COMMANDS: SlashCommand[] = [
  { trigger: '/organize', desc: 'Organize files', agent: 'organize' },
  { trigger: '/resume', desc: 'Tailor resume', agent: 'resume' },
];

const MENTIONS: MentionTarget[] = [
  { name: 'resume', mission: 'Resume specialist', kind: 'agent' },
  { name: 'ats', mission: 'ATS specialist', kind: 'agent' },
];

function ComposerHarness({
  initialValue = '',
  skills = TEST_SKILLS.filter((s) => s.enabled),
  onValueChange,
  ...rest
}: Partial<ChatComposerProps> & {
  initialValue?: string;
  skills?: ChatSkill[];
  onValueChange?: (v: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);

  return (
    <ChatComposer
      value={value}
      onChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
      onSubmit={jest.fn()}
      onStop={jest.fn()}
      busy={false}
      commands={COMMANDS}
      commandsState="ready"
      mentionTargets={[
        ...MENTIONS,
        ...skills.map((s) => ({
          name: s.slug || s.name,
          mission: s.description,
          kind: 'skill' as const,
          slug: s.slug,
        })),
      ]}
      selectedAgent="auto"
      onSelectAgent={jest.fn()}
      attachment={null}
      onAttachment={jest.fn()}
      maxLength={1000}
      enabledSkills={skills}
      activeSkill={activeSkill}
      onActiveSkillChange={setActiveSkill}
      {...rest}
    />
  );
}

describe('ChatComposer — Skills integration', () => {
  it('includes /skill:<slug> in slash commands popup for all enabled skills with distinct badge', () => {
    render(<ComposerHarness />);
    const textbox = screen.getByRole('combobox', { name: 'Chat message' });

    fireEvent.change(textbox, { target: { value: '/' } });

    const listbox = screen.getByRole('listbox', { name: 'Slash commands' });
    const options = within(listbox).getAllByRole('option');

    // 2 built-in commands + 2 enabled skills = 4
    expect(options).toHaveLength(4);

    expect(within(listbox).getByText('/skill:resume-quantifier')).toBeInTheDocument();
    expect(within(listbox).getByText('Calculate metrics for resume bullets')).toBeInTheDocument();
    expect(within(listbox).getByText('/skill:ats-audit')).toBeInTheDocument();

    // Verify distinct SKILL badge is rendered for skill commands
    const skillBadges = within(listbox).getAllByText('SKILL');
    expect(skillBadges).toHaveLength(2);

    // Disabled skill is NOT listed
    expect(within(listbox).queryByText('/skill:disabled-skill')).not.toBeInTheDocument();
  });

  it('inserts /skill:<slug> and shows active skill chip above input when selected', () => {
    const onValueChange = jest.fn();
    render(<ComposerHarness onValueChange={onValueChange} />);
    const textbox = screen.getByRole('combobox', { name: 'Chat message' });

    fireEvent.change(textbox, { target: { value: '/' } });

    const listbox = screen.getByRole('listbox', { name: 'Slash commands' });
    const skillOption = within(listbox).getByText('/skill:resume-quantifier');

    fireEvent.mouseDown(skillOption);

    expect(onValueChange).toHaveBeenLastCalledWith('/skill:resume-quantifier ');
    expect(screen.getByTestId('active-skill-chip')).toBeInTheDocument();
    expect(screen.getByTestId('active-skill-chip')).toHaveTextContent('/skill:resume-quantifier');
  });

  it('removes active skill chip when remove button is clicked', () => {
    const onValueChange = jest.fn();
    render(<ComposerHarness onValueChange={onValueChange} />);
    const textbox = screen.getByRole('combobox', { name: 'Chat message' });

    fireEvent.change(textbox, { target: { value: '/' } });
    const listbox = screen.getByRole('listbox', { name: 'Slash commands' });
    fireEvent.mouseDown(within(listbox).getByText('/skill:resume-quantifier'));

    const removeBtn = screen.getByRole('button', {
      name: /Remove active skill resume-quantifier/i,
    });
    fireEvent.click(removeBtn);

    expect(screen.queryByTestId('active-skill-chip')).not.toBeInTheDocument();
    expect(onValueChange).toHaveBeenLastCalledWith('');
  });

  it('allows mentioning active skills with @ alongside agents with @<slug>: format', () => {
    const onValueChange = jest.fn();
    render(<ComposerHarness onValueChange={onValueChange} />);
    const textbox = screen.getByRole('combobox', { name: 'Chat message' });

    fireEvent.change(textbox, { target: { value: '@' } });

    const listbox = screen.getByRole('listbox', { name: 'Agents' });
    const options = within(listbox).getAllByRole('option');

    // 2 agents + 2 enabled skills = 4
    expect(options).toHaveLength(4);

    expect(within(listbox).getByText('@resume-quantifier')).toBeInTheDocument();
    expect(within(listbox).getByText('@ats-audit')).toBeInTheDocument();

    // Distinct SKILL badge in mentions popup
    const skillBadges = within(listbox).getAllByText('SKILL');
    expect(skillBadges).toHaveLength(2);

    // Commit skill mention
    fireEvent.mouseDown(within(listbox).getByText('@resume-quantifier'));

    // Should insert @resume-quantifier:
    expect(onValueChange).toHaveBeenLastCalledWith('@resume-quantifier: ');
    expect(screen.getByTestId('active-skill-chip')).toBeInTheDocument();
  });

  it('excludes skills from the agent select dropdown', () => {
    render(<ComposerHarness />);

    const select = screen.getByLabelText('Active agent');
    const optionValues = within(select)
      .getAllByRole('option')
      .map((o) => (o as HTMLOptionElement).value);

    expect(optionValues).toContain('auto');
    expect(optionValues).toContain('resume');
    expect(optionValues).toContain('ats');
    expect(optionValues).not.toContain('resume-quantifier');
    expect(optionValues).not.toContain('ats-audit');
  });
});

describe('ChatWindow — Deep-link and Skills loading', () => {
  beforeEach(() => {
    mockSearchParams.clear();
  });

  it('sets initial prompt and target skill directive when ?skill=... is present in URL', async () => {
    mockSearchParams.set('skill', 'resume-quantifier');

    render(<ChatWindow workspaceId="ws-test" />);

    await waitFor(() => {
      const textbox = screen.getByRole('combobox', { name: 'Chat message' }) as HTMLTextAreaElement;
      expect(textbox.value).toBe('/skill:resume-quantifier ');
    });

    expect(screen.getByTestId('active-skill-chip')).toBeInTheDocument();
    expect(screen.getByTestId('active-skill-chip')).toHaveTextContent('/skill:resume-quantifier');
  });

  it('combines ?skill=... and ?prompt=... into skill directive prompt', async () => {
    mockSearchParams.set('skill', 'ats-audit');
    mockSearchParams.set('prompt', 'audit my latest resume against Ashby');

    render(<ChatWindow workspaceId="ws-test" />);

    await waitFor(() => {
      const textbox = screen.getByRole('combobox', { name: 'Chat message' }) as HTMLTextAreaElement;
      expect(textbox.value).toBe('/skill:ats-audit audit my latest resume against Ashby');
    });

    expect(screen.getByTestId('active-skill-chip')).toBeInTheDocument();
    expect(screen.getByTestId('active-skill-chip')).toHaveTextContent('/skill:ats-audit');
  });
});
