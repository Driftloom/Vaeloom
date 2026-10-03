/**
 * Rendered contract for the chat component layer.
 *
 * The chat page was one 2,063-line component and was split into the modules
 * under `components/chat/`. The store, reducer, SSE parser and API client got
 * unit tests; the components got none. That gap is exactly where the two
 * classes of regression lived:
 *
 *   - Accessibility: the transcript was a plain scrollable `<div>`. No
 *     `role="log"`, no `aria-live`, no tab stop — a screen-reader user was
 *     never told a reply had arrived and a keyboard-only user could not reach
 *     the history at all.
 *   - Honesty: the renderer printed a green "98% Verified Intent Confidence"
 *     badge from a hardcoded `confidence: 0.98` written into the optimistic
 *     placeholder, a hardcoded `240ms`/`350ms` duration on every tool and
 *     sub-agent call, and "Durable execution in progress" the moment the
 *     client ran out of poll attempts. A number in a monospace font reads as a
 *     measurement whether or not one was taken.
 *
 * These assertions run against the real components. Only `react-markdown` is
 * stubbed, so a failure here can only mean the chat chrome itself broke.
 */
import '@testing-library/jest-dom';
import React, { createRef, useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { ChatComposer, type ChatComposerProps } from '../ChatComposer';
import { ChatEmptyState } from '../ChatEmptyState';
import { ChatHeader } from '../ChatHeader';
import { ChatMessageItem, type ChatMessageItemProps } from '../ChatMessageItem';
import { ChatMessageList, type ChatMessageListProps } from '../ChatMessageList';
import { ChatThreadRail } from '../ChatThreadRail';
import {
  MAX_INPUT_LENGTH,
  type ChatMessage,
  type MentionTarget,
  type SlashCommand,
  type Thread,
} from '../types';

/**
 * Markdown parsing is a third-party concern; these tests are about the chrome
 * around it. Stubbed the same way `capabilities/page.spec.tsx` already does it.
 */
jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown-preview">{children}</div>;
  };
});

jest.mock('remark-gfm', () => () => {});

/* `window.matchMedia` and `Element.prototype.scrollIntoView` come from
   `jest.setup.js`: jsdom implements neither, and a source file may not be edited
   to accommodate a test environment. The shared `matchMedia` evaluates
   `(min-width: 768px)` against the jsdom viewport, which is wide, so the rail
   renders as the static rail rather than the mobile drawer — the assertions below
   are about the rail's contents. */

/* ------------------------------------------------------------------ fixtures */

function agentMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm-1',
    role: 'agent',
    text: 'Drafted the plan.',
    timestamp: '2026-09-22T10:00:00.000Z',
    status: 'complete',
    agentName: 'resume_agent',
    ...overrides,
  };
}

function userMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'u-1',
    role: 'user',
    text: 'Tailor my resume',
    timestamp: '2026-09-22T09:59:00.000Z',
    status: 'complete',
    ...overrides,
  };
}

const COMMANDS: SlashCommand[] = [
  { trigger: '/organize', desc: 'Group your threads by topic', agent: 'memory' },
  { trigger: '/resume', desc: 'Tailor a resume to a job', agent: 'resume' },
];

const MENTIONS: MentionTarget[] = [
  { name: 'memory', mission: 'Recall stored facts' },
  { name: 'resume', mission: 'Tailor a resume' },
];

/* ------------------------------------------------------- ChatMessageItem ---- */

interface ItemSpies {
  container: HTMLElement;
  unmount: () => void;
  onCopy: jest.Mock;
  onRetry: jest.Mock;
  onEdit: jest.Mock;
  onDelete: jest.Mock;
  onDecide: jest.Mock;
  onSend: jest.Mock;
}

function renderItem(message: ChatMessage): ItemSpies {
  const spies = {
    onCopy: jest.fn(),
    onRetry: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onDecide: jest.fn(),
    onSend: jest.fn(),
  };
  const props: ChatMessageItemProps = {
    message,
    agentColor: 'bg-primary',
    ...spies,
  };
  const { container, unmount } = render(<ChatMessageItem {...props} />);
  return { container, unmount, ...spies };
}

/** Every `title` the browser would surface as a tooltip on this subtree. */
function declaredTitles(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[title]')).map(
    (node) => node.getAttribute('title') ?? '',
  );
}

describe('ChatMessageItem — confidence honesty', () => {
  it('renders no confidence badge when the backend reported none', () => {
    // The optimistic placeholder used to carry `confidence: 0.98`, so a green
    // "98% Verified Intent Confidence" badge appeared before any model ran.
    const { container } = renderItem(agentMessage({ confidence: undefined }));

    expect(container.textContent ?? '').not.toMatch(/%/);
    expect(declaredTitles(container)).not.toContain('Intent confidence reported by the router');
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('renders the router-reported percentage and attributes it to the router, not to verification', () => {
    const { container } = renderItem(agentMessage({ confidence: 0.98 }));

    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(screen.getByTitle('Intent confidence reported by the router')).toHaveTextContent('98%');
    // "Verified" is a claim about the world. Nothing verifies a router score.
    expect(declaredTitles(container).join(' | ')).not.toMatch(/verified/i);
    expect(container.textContent ?? '').not.toMatch(/verified/i);
  });

  it('colours a low score as a failure rather than always reassuring green', () => {
    const high = renderItem(agentMessage({ confidence: 0.98 }));
    const highBadge = screen.getByText('98%');
    expect(highBadge.className).toContain('text-success');
    high.unmount();
    renderItem(agentMessage({ confidence: 0.12 }));
    const lowBadge = screen.getByText('12%');
    expect(lowBadge.className).toContain('text-error');
    expect(lowBadge.className).not.toContain('text-success');
  });
});

describe('ChatMessageItem — tool telemetry honesty', () => {
  it('renders no duration for a tool the backend never timed', () => {
    // The old renderer printed a hardcoded `240ms` for every tool and `350ms`
    // for every sub-agent, which reads as a measurement and is not one.
    const { container } = renderItem(
      agentMessage({
        toolCalls: [
          { name: 'search_documents', status: 'done', kind: 'tool' },
          { name: 'resume_tailor', status: 'running', kind: 'sub_agent' },
        ],
      }),
    );

    expect(container.textContent ?? '').not.toMatch(/\d+\s*ms/);
    expect(screen.getByText('search_documents')).toBeInTheDocument();
    expect(screen.getByText('resume_tailor')).toBeInTheDocument();
  });

  it('renders the measured duration when the backend reported one', () => {
    renderItem(
      agentMessage({
        toolCalls: [{ name: 'search_documents', status: 'done', kind: 'tool', latencyMs: 87 }],
      }),
    );

    expect(screen.getByText('done · 87ms')).toBeInTheDocument();
  });
});

describe('ChatMessageItem — run status honesty', () => {
  it('says the client stopped waiting rather than claiming the run is in progress or complete', () => {
    // `background` means the workflow is live server-side but this client gave
    // up polling. Rendering it as "in progress" is a promise the client cannot
    // keep; rendering it as complete is a lie the user may act on.
    const { container } = renderItem(agentMessage({ status: 'background' }));

    const notice = screen.getByText(/stopped waiting for updates/i);
    expect(notice).toBeInTheDocument();
    expect(notice.textContent ?? '').not.toMatch(/\bin progress\b/i);
    expect(notice.textContent ?? '').not.toMatch(/\bcomplete(d)?\b/i);
    expect(screen.queryByText(/Durable execution in progress/i)).not.toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(/\bin progress\b/i);
  });

  it('renders a stopped indicator when the user stopped generation', () => {
    renderItem(agentMessage({ status: 'stopped' }));
    expect(screen.getByText('Stopped.')).toBeInTheDocument();
  });

  it('surfaces the backend error text and a Retry control, and does not duplicate it as Regenerate', () => {
    const spies = renderItem(
      agentMessage({
        status: 'error',
        error: { message: 'Upstream model timed out', code: 'UPSTREAM_TIMEOUT' },
      }),
    );

    expect(screen.getByText('Upstream model timed out (UPSTREAM_TIMEOUT)')).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retry);
    expect(spies.onRetry).toHaveBeenCalledWith('m-1');
    // One affordance, not two identical buttons.
    expect(screen.queryByRole('button', { name: 'Regenerate' })).not.toBeInTheDocument();
  });

  it('gives the streaming caret a text alternative instead of only a styled block', () => {
    const { container } = renderItem(agentMessage({ status: 'streaming' }));

    // The caret span is decorative and must carry no text of its own, or the
    // two alternatives would double up in the accessibility tree.
    const caret = container.querySelector('span[aria-hidden="true"].animate-pulse');
    expect(caret).not.toBeNull();
    expect(caret?.textContent).toBe('');
    expect(screen.getByText('Assistant is responding')).toHaveClass('sr-only');
  });

  it('requires a second click to delete a message', () => {
    const spies = renderItem(userMessage());

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(spies.onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(spies.onDelete).toHaveBeenCalledWith('u-1');
  });

  it('renders the agent label in plain words rather than leaking snake_case', () => {
    renderItem(agentMessage({ agentName: 'resume_agent' }));
    expect(screen.getByText('resume agent')).toBeInTheDocument();
    expect(screen.queryByText('resume_agent')).not.toBeInTheDocument();
  });

  it('announces the copy confirmation through a live region', () => {
    const spies = renderItem(agentMessage());

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(spies.onCopy).toHaveBeenCalledWith('m-1');
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
  });
});

/* ------------------------------------------------------ ChatMessageList ----- */

function listProps(overrides: Partial<ChatMessageListProps> = {}): ChatMessageListProps {
  return {
    messages: [userMessage()],
    busy: false,
    agentColors: {},
    emptyState: <p>Start typing to begin.</p>,
    onCopy: jest.fn(),
    onRetry: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onDecide: jest.fn(),
    onSend: jest.fn(),
    ...overrides,
  };
}

describe('ChatMessageList — transcript accessibility', () => {
  it('exposes the transcript as a polite log so a new reply is announced', () => {
    // This is the fix: a scrollable div announced nothing, so a screen-reader
    // user had no idea a reply had arrived.
    render(<ChatMessageList {...listProps()} />);

    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('aria-relevant', 'additions text');
  });

  it('puts the log role on the node the auto-scroll hook is attached to', () => {
    // If the scroll container and the live region were different elements, the
    // ResizeObserver would be watching a node that never scrolls.
    const scrollRef = createRef<HTMLDivElement>();
    render(<ChatMessageList {...listProps({ scrollRef })} />);

    expect(scrollRef.current).toBe(screen.getByRole('log'));
  });

  it('is reachable by keyboard so the history can be scrolled without a pointer', () => {
    render(<ChatMessageList {...listProps()} />);

    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('tabindex', '0');
    log.focus();
    expect(log).toHaveFocus();
  });

  it('reflects the busy prop on the log so assistive tech can say work is happening', () => {
    const { rerender } = render(<ChatMessageList {...listProps({ busy: true })} />);
    expect(screen.getByRole('log')).toHaveAttribute('aria-busy', 'true');

    rerender(<ChatMessageList {...listProps({ busy: false })} />);
    expect(screen.getByRole('log')).toHaveAttribute('aria-busy', 'false');
  });

  it('renders the empty state instead of an empty log when there are no messages', () => {
    render(<ChatMessageList {...listProps({ messages: [] })} />);

    expect(screen.getByText('Start typing to begin.')).toBeInTheDocument();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });

  it('keeps the pending indicator outside the log so a wait is not announced twice', () => {
    render(
      <ChatMessageList
        {...listProps({
          busy: true,
          messages: [userMessage(), agentMessage({ status: 'complete' })],
        })}
      />,
    );

    const log = screen.getByRole('log');
    // Exactly one live region for the wait: a second one would announce it twice.
    const statuses = screen.getAllByRole('status');
    const [pending] = statuses;
    if (statuses.length !== 1 || !pending) {
      throw new Error(`expected exactly one status region, found ${statuses.length}`);
    }
    expect(log.contains(pending)).toBe(false);
    // The bouncing dots are decorative; the words are the announcement.
    expect(screen.getByText('Waiting for the agent to respond')).toBeInTheDocument();
  });

  it('shows no separate pending indicator while a message is already streaming', () => {
    // The old UI rendered an empty bubble AND a "Thinking" row for one turn.
    render(
      <ChatMessageList
        {...listProps({
          busy: true,
          messages: [userMessage(), agentMessage({ status: 'streaming' })],
        })}
      />,
    );

    expect(screen.queryByText('Waiting for the agent to respond')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('status')).toHaveLength(0);
    expect(screen.getByText('Assistant is responding')).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------ ChatComposer -- */

type HarnessProps = Omit<ChatComposerProps, 'value' | 'onChange'> & {
  initialValue?: string;
  onValueChange?: (value: string) => void;
};

/** The composer is fully controlled, so the tests drive a stateful host. */
function ComposerHarness({ initialValue = '', onValueChange, ...rest }: HarnessProps): JSX.Element {
  const [value, setValue] = useState(initialValue);
  return (
    <ChatComposer
      {...rest}
      value={value}
      onChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
    />
  );
}

interface ComposerSpies {
  onSubmit: jest.Mock;
  onStop: jest.Mock;
  onSelectAgent: jest.Mock;
  onAttachment: jest.Mock;
  onValueChange: jest.Mock;
}

function renderComposer(overrides: Partial<HarnessProps> = {}): ComposerSpies {
  const spies: ComposerSpies = {
    onSubmit: jest.fn(),
    onStop: jest.fn(),
    onSelectAgent: jest.fn(),
    onAttachment: jest.fn(),
    onValueChange: jest.fn(),
  };
  render(
    <ComposerHarness
      onSubmit={spies.onSubmit}
      onStop={spies.onStop}
      busy={false}
      commands={COMMANDS}
      commandsState="ready"
      mentionTargets={MENTIONS}
      selectedAgent="auto"
      onSelectAgent={spies.onSelectAgent}
      attachment={null}
      onAttachment={spies.onAttachment}
      maxLength={MAX_INPUT_LENGTH}
      onValueChange={spies.onValueChange}
      {...overrides}
    />,
  );
  return spies;
}

function composerTextbox(): HTMLTextAreaElement {
  return screen.getByRole('combobox', { name: 'Chat message' });
}

function typeInComposer(text: string): void {
  fireEvent.change(composerTextbox(), { target: { value: text } });
}

/**
 * Options belonging to the trigger popup. The agent `<select>` renders plain
 * `<option>` children, which carry an implicit `option` role and are not part of
 * the popup, so they must not be counted here.
 */
function popupOptions(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
}

describe('ChatComposer — control names relied on by the e2e suite', () => {
  it('labels the composer, the send control and the attach control', () => {
    renderComposer();

    expect(composerTextbox()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attach file' })).toBeInTheDocument();
  });

  it('replaces send with a stop control whose accessible name and tooltip agree', () => {
    // They used to disagree, so a sighted user hovered "Stop generating" and a
    // screen-reader user heard "Stop generation" — two names for one control.
    renderComposer({ busy: true });

    const stop = screen.getByRole('button', { name: 'Stop generation' });
    expect(stop).toHaveAttribute('title', 'Stop generating');
    expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
  });

  it('calls onStop from the stop control', () => {
    const spies = renderComposer({ busy: true });
    fireEvent.click(screen.getByRole('button', { name: 'Stop generation' }));
    expect(spies.onStop).toHaveBeenCalledTimes(1);
  });
});

describe('ChatComposer — trigger detection', () => {
  it('opens a slash-command listbox for a slash at the start of a token', () => {
    renderComposer();
    typeInComposer('/');

    const listbox = screen.getByRole('listbox', { name: 'Slash commands' });
    expect(within(listbox).getAllByRole('option')).toHaveLength(COMMANDS.length);
    expect(composerTextbox()).toHaveAttribute('aria-expanded', 'true');
    expect(composerTextbox().getAttribute('aria-controls')).toBe(listbox.id);
  });

  it('does not open the command listbox over a pasted URL', () => {
    // The old positional `lastIndexOf('/')` check opened an empty palette
    // across the composer for any text containing a slash.
    renderComposer();
    typeInComposer('https://x.com/pricing');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(popupOptions()).toHaveLength(0);
    expect(composerTextbox()).toHaveAttribute('aria-expanded', 'false');
  });

  it('does not open the agent listbox over an email address', () => {
    renderComposer();
    typeInComposer('me@corp.com');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(popupOptions()).toHaveLength(0);
  });

  it('opens the agent listbox for a mention at the start of a token', () => {
    renderComposer();
    typeInComposer('ask @mem');

    const listbox = screen.getByRole('listbox', { name: 'Agents' });
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('@memory');
  });
});

describe('ChatComposer — keyboard operation of the popup', () => {
  it('starts on the first option and moves aria-activedescendant with ArrowDown', () => {
    renderComposer();
    typeInComposer('/');

    const listbox = screen.getByRole('listbox', { name: 'Slash commands' });
    const [firstOptionId, secondOptionId] = within(listbox)
      .getAllByRole('option')
      .map((option) => option.id);
    expect(firstOptionId).toBeTruthy();
    expect(secondOptionId).toBeTruthy();

    expect(composerTextbox()).toHaveAttribute('aria-activedescendant', firstOptionId);
    expect(within(listbox).getByRole('option', { selected: true })).toHaveTextContent('/organize');

    fireEvent.keyDown(composerTextbox(), { key: 'ArrowDown' });
    expect(composerTextbox()).toHaveAttribute('aria-activedescendant', secondOptionId);
    expect(within(listbox).getByRole('option', { selected: true })).toHaveTextContent('/resume');
  });

  it('commits the active option on Enter instead of sending a raw slash', () => {
    const spies = renderComposer();
    typeInComposer('/');

    fireEvent.keyDown(composerTextbox(), { key: 'ArrowDown' });
    fireEvent.keyDown(composerTextbox(), { key: 'Enter' });

    expect(spies.onValueChange).toHaveBeenLastCalledWith('/resume ');
    expect(spies.onSelectAgent).toHaveBeenCalledWith('resume');
    expect(spies.onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('ChatComposer — length limit is enforced, not just counted', () => {
  it('sets maxLength on the textarea', () => {
    renderComposer();
    expect(composerTextbox()).toHaveAttribute('maxlength', String(MAX_INPUT_LENGTH));
  });

  it('blocks sending once the limit is reached', () => {
    renderComposer({ maxLength: 10, initialValue: '0123456789' });
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });
});

describe('ChatComposer — command loading honesty', () => {
  it('renders no command list and explains the failure when the command load failed', () => {
    // `commands` is passed alongside `commandsState` as two independent props, so
    // a retained list plus a failed reload is a representable state. Showing it
    // would present a stale palette as live data with no indication that the
    // reload failed. See the defect report: this currently fails.
    renderComposer({ commandsState: 'error', commandsError: 'Command service unavailable' });
    typeInComposer('/');

    expect(popupOptions()).toHaveLength(0);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByText('Command service unavailable')).toBeInTheDocument();
    expect(composerTextbox()).toHaveAttribute('aria-expanded', 'false');
  });

  it('falls back to a plain explanation when the failure carried no detail', () => {
    renderComposer({ commandsState: 'error' });
    typeInComposer('/');

    expect(screen.getByText('Agent commands are unavailable.')).toBeInTheDocument();
    expect(popupOptions()).toHaveLength(0);
  });

  it('renders no command list when a failed load also produced an empty list', () => {
    // The state `chat-store` actually reaches today: `fetchSlashCommands`
    // returns `commands: []` on every error path. This path is honest today and
    // is what keeps the two error tests above from reading as broken coverage.
    renderComposer({
      commandsState: 'error',
      commands: [],
      commandsError: 'Command service unavailable',
    });
    typeInComposer('/');

    expect(popupOptions()).toHaveLength(0);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByText('Command service unavailable')).toBeInTheDocument();
  });

  it('explains an empty command catalogue rather than showing an empty palette', () => {
    renderComposer({ commands: [] });
    typeInComposer('/');

    expect(popupOptions()).toHaveLength(0);
    expect(screen.getByText('No commands published for this workspace.')).toBeInTheDocument();
  });
});

/* ---------------------------------------------------------- ChatThreadRail -- */

function thread(id: string, title: string, messageCount = 0): Thread {
  return {
    id,
    title,
    createdAt: '2026-09-22T08:00:00.000Z',
    updatedAt: '2026-09-22T08:00:00.000Z',
    messages: Array.from({ length: messageCount }, (_, i) => agentMessage({ id: `${id}-m${i}` })),
  };
}

interface RailSpies {
  onOpenChange: jest.Mock;
  onSelect: jest.Mock;
  onNew: jest.Mock;
  onRename: jest.Mock;
  onDelete: jest.Mock;
  onClear: jest.Mock;
}

/**
 * The row's own button. Anchored at the start of the accessible name so it does
 * not also match the per-thread "Actions for <title>" trigger beside it.
 */
function threadRow(title: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${title}`) });
}

function renderRail(overrides: Partial<Parameters<typeof ChatThreadRail>[0]> = {}): RailSpies {
  const spies: RailSpies = {
    onOpenChange: jest.fn(),
    onSelect: jest.fn(),
    onNew: jest.fn(),
    onRename: jest.fn(),
    onDelete: jest.fn(),
    onClear: jest.fn(),
  };
  render(
    <ChatThreadRail
      threads={[thread('t-1', 'Quarterly planning'), thread('t-2', 'Standup notes')]}
      activeId="t-1"
      open={false}
      agentCount={7}
      commandsAvailable={11}
      {...spies}
      {...overrides}
    />,
  );
  return spies;
}

describe('pointer-driven disclosure (regression)', () => {
  /**
   * Reproduces the browser's real event order. `fireEvent.click` alone cannot see
   * this class of bug: a mouse press is `mousedown` then `click`, and the rail's
   * outside-press handler runs on the first one.
   *
   * The disclosure panel is a SIBLING of the thread row inside the <li>, so an
   * outside-press check anchored on the row reported every press inside the panel
   * as "outside", closed the menu on `mousedown`, and the `click` that followed
   * then landed on nothing. Rename/Clear/Delete were mouse-dead while keyboard
   * activation kept working, which is why 306 unit tests stayed green and only a
   * real browser surfaced it.
   */
  function press(el: Element): void {
    fireEvent.mouseDown(el);
    fireEvent.click(el);
  }

  it('keeps the disclosure open long enough for Delete to be pressed', () => {
    renderRail();

    press(screen.getByRole('button', { name: 'Actions for Quarterly planning' }));
    press(screen.getByRole('button', { name: /^delete$/i }));

    expect(screen.getByRole('button', { name: /^confirm delete$/i })).toBeInTheDocument();
  });

  it('does not fire onDelete until the confirmation is pressed', () => {
    const spies = renderRail();

    press(screen.getByRole('button', { name: 'Actions for Quarterly planning' }));
    press(screen.getByRole('button', { name: /^delete$/i }));

    expect(spies.onDelete).not.toHaveBeenCalled();

    press(screen.getByRole('button', { name: /^confirm delete$/i }));

    expect(spies.onDelete).toHaveBeenCalledTimes(1);
    expect(spies.onDelete).toHaveBeenCalledWith('t-1');
  });

  it('still closes the disclosure on a press genuinely outside it', () => {
    renderRail();

    press(screen.getByRole('button', { name: 'Actions for Quarterly planning' }));
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument();
  });
});

describe('ChatThreadRail', () => {
  it('is a named complementary landmark that the e2e suite can locate by its visible heading', () => {
    renderRail();

    const rail = screen.getByRole('complementary', { name: 'Conversations' });
    expect(rail.tagName).toBe('ASIDE');
    expect(rail).toHaveTextContent('THREADS');
  });

  it('marks the active thread with aria-current instead of colour alone', () => {
    renderRail();

    // Colour-only selection fails WCAG 1.4.1: the current thread was
    // indistinguishable to a screen reader or in forced-colours mode.
    expect(threadRow('Quarterly planning')).toHaveAttribute('aria-current', 'true');
    expect(threadRow('Standup notes')).not.toHaveAttribute('aria-current');
  });

  it('names each thread action trigger after the thread it acts on', () => {
    renderRail();

    const trigger = screen.getByRole('button', { name: 'Actions for Quarterly planning' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(trigger.getAttribute('aria-controls') ?? '')).not.toBeNull();
  });

  it('renders the drawer backdrop as a decorative click target, not a focusable button', () => {
    // It used to be a full-viewport <button> with no content: one empty stop in
    // the tab order that a screen reader announced as an unlabelled button.
    const { container } = render(
      <ChatThreadRail
        threads={[thread('t-1', 'Quarterly planning')]}
        activeId="t-1"
        open
        agentCount={7}
        commandsAvailable={11}
        onOpenChange={jest.fn()}
        onSelect={jest.fn()}
        onNew={jest.fn()}
        onRename={jest.fn()}
        onDelete={jest.fn()}
        onClear={jest.fn()}
      />,
    );

    const backdrop = container.querySelector<HTMLElement>('div[aria-hidden="true"][tabindex="-1"]');
    expect(backdrop).not.toBeNull();
    expect(backdrop?.tagName).toBe('DIV');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop?.getAttribute('tabindex')).toBe('-1');
  });

  it('requires a save step before renaming a thread', () => {
    const spies = renderRail();

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Standup notes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(spies.onRename).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Rename Standup notes' }), {
      target: { value: 'Renamed thread' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(spies.onRename).toHaveBeenCalledWith('t-2', 'Renamed thread');
  });

  it('requires a confirmation before clearing a thread', () => {
    const spies = renderRail();

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Standup notes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(spies.onClear).not.toHaveBeenCalled();
    expect(screen.getByText(/conversation is kept/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm clear' }));
    expect(spies.onClear).toHaveBeenCalledWith('t-2');
  });

  it('requires a confirmation before deleting a thread and says it is irreversible', () => {
    const spies = renderRail();

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Standup notes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(spies.onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(spies.onDelete).toHaveBeenCalledWith('t-2');
  });

  it('filters by title and says so when nothing matches', () => {
    renderRail();
    const search = screen.getByRole('searchbox', { name: 'Search conversations' });

    fireEvent.change(search, { target: { value: 'stand' } });
    expect(threadRow('Standup notes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Quarterly planning/ })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'no such thread' } });
    expect(screen.getByText('No conversations match')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Standup notes/ })).not.toBeInTheDocument();
  });

  it('prints no agent count while the count is unknown', () => {
    renderRail({ agentCount: null });

    const rail = screen.getByRole('complementary', { name: 'Conversations' });
    expect(rail).toHaveTextContent('Loading agents…');
    // "0" or a stale number would read as a real measurement of the catalogue.
    expect(rail.textContent ?? '').not.toMatch(/\d+\s+agents/);
  });
});

/* -------------------------------------------------------------- ChatHeader -- */

function renderHeader(overrides: Partial<Parameters<typeof ChatHeader>[0]> = {}): void {
  render(
    <ChatHeader
      workspaceId="ws-abcd1234"
      agentName="auto"
      agentCount={7}
      durableMode={false}
      onDurableModeChange={jest.fn()}
      connectionStatus="connected"
      drawerOpen={false}
      onToggleDrawer={jest.fn()}
      onNewChat={jest.fn()}
      {...overrides}
    />,
  );
}

describe('ChatHeader', () => {
  it('emits exactly one level-1 heading named Chat, which the live e2e suite asserts', () => {
    renderHeader();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Chat' })).toBeInTheDocument();
  });

  it('gives the drawer trigger a name plus its expanded and controlled state', () => {
    const { rerender } = render(
      <ChatHeader
        workspaceId="ws-abcd1234"
        agentName="auto"
        agentCount={7}
        durableMode={false}
        onDurableModeChange={jest.fn()}
        connectionStatus="connected"
        drawerOpen={false}
        onToggleDrawer={jest.fn()}
        onNewChat={jest.fn()}
      />,
    );

    const hamburger = screen.getByRole('button', { name: 'Toggle conversation list' });
    expect(hamburger).toHaveAttribute('aria-expanded', 'false');
    // The rail it opens is the element the e2e suite and focus return target.
    expect(hamburger).toHaveAttribute('aria-controls', 'chat-thread-rail');

    rerender(
      <ChatHeader
        workspaceId="ws-abcd1234"
        agentName="auto"
        agentCount={7}
        durableMode={false}
        onDurableModeChange={jest.fn()}
        connectionStatus="connected"
        drawerOpen
        onToggleDrawer={jest.fn()}
        onNewChat={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Toggle conversation list' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('prints no agent count while the count is unknown and the real one when it lands', () => {
    const { rerender, container } = render(
      <ChatHeader
        workspaceId="ws-abcd1234"
        agentName="auto"
        agentCount={null}
        durableMode={false}
        onDurableModeChange={jest.fn()}
        connectionStatus="connected"
        drawerOpen={false}
        onToggleDrawer={jest.fn()}
        onNewChat={jest.fn()}
      />,
    );

    expect(screen.getByText('Loading agents…')).toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(/\d+\s+agents/);

    rerender(
      <ChatHeader
        workspaceId="ws-abcd1234"
        agentName="auto"
        agentCount={7}
        durableMode={false}
        onDurableModeChange={jest.fn()}
        connectionStatus="connected"
        drawerOpen={false}
        onToggleDrawer={jest.fn()}
        onNewChat={jest.fn()}
      />,
    );
    expect(screen.getByText('7 agents · QA gate')).toBeInTheDocument();
  });
});

/* ---------------------------------------------------------- ChatEmptyState -- */

/** Product names the previous quick prompts named, which shipped a real company's data. */
const REAL_COMPANY =
  /\b(linear|notion|slack|github|stripe|vercel|figma|gmail|google drive|salesforce|hubspot|airtable|asana|jira|trello|dropbox|zoom|shopify|atlassian|datadog)\b/i;

describe('ChatEmptyState', () => {
  it('renders no command chips when the command catalogue failed to load', () => {
    render(
      <ChatEmptyState
        commands={COMMANDS}
        commandsState="error"
        commandsError="Command service unavailable"
        onPickCommand={jest.fn()}
        onSend={jest.fn()}
      />,
    );

    expect(screen.queryByRole('group', { name: 'Agent commands' })).not.toBeInTheDocument();
    // Command chips are the only controls labelled with a leading slash.
    const labels = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(labels.filter((t) => t.startsWith('/'))).toEqual([]);
    expect(screen.getByText('Command service unavailable')).toBeInTheDocument();
  });

  it('says commands are unavailable when the failure carried no detail', () => {
    render(
      <ChatEmptyState
        commands={COMMANDS}
        commandsState="error"
        onPickCommand={jest.fn()}
        onSend={jest.fn()}
      />,
    );

    expect(screen.getByText('Agent commands are unavailable right now')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Agent commands' })).not.toBeInTheDocument();
  });

  it('sends the full prompt behind a quick-prompt chip, not the chip label', () => {
    const onSend = jest.fn();
    render(
      <ChatEmptyState
        commands={[]}
        commandsState="ready"
        onPickCommand={jest.fn()}
        onSend={onSend}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'What can you do?' }));
    expect(onSend).toHaveBeenCalledWith('What can you do here? Which agents are available to me?');
  });

  it('names no real company in its built-in copy', () => {
    // It used to hardcode a "Linear" prompt, which is both a specific vendor
    // and a billable integration the workspace may not have.
    const { container } = render(
      <ChatEmptyState
        commands={[]}
        commandsState="ready"
        onPickCommand={jest.fn()}
        onSend={jest.fn()}
      />,
    );

    expect(container.textContent ?? '').not.toMatch(REAL_COMPANY);
  });

  it('offers a command chip only when the backend actually published commands', () => {
    render(
      <ChatEmptyState
        commands={COMMANDS}
        commandsState="ready"
        onPickCommand={jest.fn()}
        onSend={jest.fn()}
      />,
    );

    const group = screen.getByRole('group', { name: 'Agent commands' });
    expect(within(group).getByRole('button', { name: /\/organize/ })).toBeInTheDocument();
  });
});
