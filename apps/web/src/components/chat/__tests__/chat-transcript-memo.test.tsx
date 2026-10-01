/**
 * The transcript's render-cost contract.
 *
 * A restored thread holds up to 200 messages and every agent message mounts a
 * react-markdown tree. The store coalesces streamed renders at 40ms as a
 * workaround for exactly this, which only lowers the frame rate of the problem: at
 * 40ms a 200-message transcript still re-parses 200 markdown trees 25 times a
 * second.
 *
 * These tests assert on the number of markdown renders, not on the DOM, because the
 * DOM is identical either way — a transcript that re-renders everything looks
 * correct and costs 25x what it should.
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';

import { ChatMessageList, type ChatMessageListProps } from '../ChatMessageList';
import type { ChatMessage } from '../types';

/* Counts how many times the markdown renderer ran and what it was handed. The
   `mock` prefix is what lets jest's hoisted factory close over this binding. */
const mockMarkdownRenders: string[] = [];

jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    mockMarkdownRenders.push(String(children));
    return <div data-testid="markdown">{children}</div>;
  };
});

jest.mock('remark-gfm', () => () => {});

function userMessage(id: string): ChatMessage {
  return {
    id,
    role: 'user',
    text: `question ${id}`,
    timestamp: '2026-09-22T09:59:00.000Z',
    status: 'complete',
  };
}

function agentMessage(id: string, text: string, status: ChatMessage['status'] = 'complete') {
  return {
    id,
    role: 'agent',
    text,
    timestamp: '2026-09-22T10:00:00.000Z',
    status,
    agentName: 'resume_agent',
  } satisfies ChatMessage;
}

/** Callbacks the parent is required to keep referentially stable. */
const STABLE_HANDLERS = {
  onCopy: jest.fn(),
  onRetry: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  onDecide: jest.fn(),
  onSend: jest.fn(),
} satisfies Pick<
  ChatMessageListProps,
  'onCopy' | 'onRetry' | 'onEdit' | 'onDelete' | 'onDecide' | 'onSend'
>;

function listProps(messages: ChatMessage[]): ChatMessageListProps {
  return {
    messages,
    busy: false,
    agentColors: {},
    emptyState: <p>Start typing to begin.</p>,
    ...STABLE_HANDLERS,
  };
}

beforeEach(() => {
  mockMarkdownRenders.length = 0;
});

describe('ChatMessageList — transcript render cost', () => {
  it('re-parses only the streaming message when a token arrives', () => {
    const settled = agentMessage('a-1', 'Here is your tailored summary.');
    const streaming = agentMessage('a-2', 'Drafting', 'streaming');
    const { rerender } = render(<ChatMessageList {...listProps([settled, streaming])} />);

    expect(mockMarkdownRenders).toHaveLength(2);
    mockMarkdownRenders.length = 0;

    // What `chat-store` does on a token: replace ONE message object, keep the rest.
    const nextStreaming = agentMessage('a-2', 'Drafting the plan', 'streaming');
    rerender(<ChatMessageList {...listProps([settled, nextStreaming])} />);

    expect(mockMarkdownRenders).toEqual(['Drafting the plan']);
    // The settled message is still on screen; it was skipped, not dropped.
    expect(screen.getByText('Here is your tailored summary.')).toBeInTheDocument();
    expect(screen.getByText('Drafting the plan')).toBeInTheDocument();
  });

  it('re-parses nothing when the transcript re-renders with unchanged props', () => {
    const messages = [
      userMessage('u-1'),
      agentMessage('a-1', 'Answer.'),
      agentMessage('a-2', 'More.'),
    ];
    const { rerender } = render(<ChatMessageList {...listProps(messages)} />);
    mockMarkdownRenders.length = 0;

    rerender(<ChatMessageList {...listProps(messages)} />);

    expect(mockMarkdownRenders).toEqual([]);
  });

  it('re-parses only the messages whose palette colour actually changed', () => {
    // `store.commands` arriving late repaints dots. Colour is a per-message prop, so
    // a repaint reaches exactly the messages of that agent.
    const resume = agentMessage('a-1', 'One.');
    const ats = { ...agentMessage('a-2', 'Two.'), agentName: 'ats' } satisfies ChatMessage;
    const before = { resume_agent: 'bg-sky-500', ats: 'bg-emerald-500' };
    const { rerender } = render(
      <ChatMessageList {...listProps([resume, ats])} agentColors={before} />,
    );
    mockMarkdownRenders.length = 0;

    rerender(
      <ChatMessageList
        {...listProps([resume, ats])}
        agentColors={{ ...before, resume_agent: 'bg-violet-500' }}
      />,
    );

    expect(mockMarkdownRenders).toEqual(['One.']);
  });

  it('still re-parses when a message is edited, which changes its object identity', () => {
    const original = userMessage('u-1');
    const { rerender } = render(<ChatMessageList {...listProps([original])} />);
    mockMarkdownRenders.length = 0;

    rerender(<ChatMessageList {...listProps([{ ...original, text: 'edited' }])} />);

    // A user message renders as plain text, not markdown, so nothing is re-parsed —
    // but the row must still update, which is what the memo boundary must not block.
    expect(screen.getByText('edited')).toBeInTheDocument();
    expect(screen.queryByText('question u-1')).not.toBeInTheDocument();
  });

  it('renders every message of a long transcript, so history is never silently dropped', () => {
    // The cost control here is the memo boundary, not a window: nothing is unmounted,
    // so scrollbar geometry and the live region both keep describing the whole thread.
    const messages = Array.from({ length: 60 }, (_, i) => agentMessage(`a-${i}`, `message ${i}`));
    render(<ChatMessageList {...listProps(messages)} />);

    expect(screen.getAllByTestId('markdown')).toHaveLength(60);
    expect(mockMarkdownRenders).toHaveLength(60);
  });
});
