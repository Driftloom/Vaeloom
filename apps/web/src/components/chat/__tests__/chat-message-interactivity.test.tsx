import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown">{children}</div>;
  };
});
jest.mock('remark-gfm', () => () => {});

import { ChatMessageItem } from '../ChatMessageItem';
import type { ChatMessage } from '../types';

const MSG_WITH_THOUGHT: ChatMessage = {
  id: 'msg-1',
  role: 'agent',
  text: '<thought>Analyzing candidate experience against ATS criteria...</thought>Here is the revised resume summary.',
  timestamp: new Date().toISOString(),
};

const MSG_STREAMING_THOUGHT: ChatMessage = {
  id: 'msg-2',
  role: 'agent',
  text: '<thought>Evaluating graph relationships for semantic match...',
  status: 'streaming',
  timestamp: new Date().toISOString(),
};

describe('ChatMessageItem Interactivity', () => {
  it('parses thought tag into collapsible thinking accordion', () => {
    render(
      <ChatMessageItem
        message={MSG_WITH_THOUGHT}
        agentColor="bg-action"
        onCopy={jest.fn()}
        onRetry={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onDecide={jest.fn()}
        onSend={jest.fn()}
      />,
    );

    expect(screen.getByText(/Thinking Process/i)).toBeInTheDocument();
    const accordionBtn = screen.getByRole('button', { name: /Toggle thinking process/i });
    expect(accordionBtn).toHaveAttribute('aria-expanded', 'false');

    // Content should not be visible before clicking toggle
    expect(
      screen.queryByText(/Analyzing candidate experience against ATS criteria/i),
    ).not.toBeInTheDocument();

    fireEvent.click(accordionBtn);
    expect(accordionBtn).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(/Analyzing candidate experience against ATS criteria/i),
    ).toBeInTheDocument();

    // Body content rendered outside the thought tag
    expect(screen.getByText(/Here is the revised resume summary/i)).toBeInTheDocument();
  });

  it('renders reasoning indicator when thought is streaming', () => {
    render(
      <ChatMessageItem
        message={MSG_STREAMING_THOUGHT}
        agentColor="bg-action"
        onCopy={jest.fn()}
        onRetry={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onDecide={jest.fn()}
        onSend={jest.fn()}
      />,
    );

    expect(screen.getByText(/Thinking Process/i)).toBeInTheDocument();
    expect(screen.getByText(/Reasoning/i)).toBeInTheDocument();
  });

  it('renders tool execution ladder with clean status and duration indicators', () => {
    const msgWithTools: ChatMessage = {
      id: 'msg-tools',
      role: 'agent',
      text: 'Execution complete.',
      timestamp: new Date().toISOString(),
      toolCalls: [
        { name: 'search_documents', status: 'done', kind: 'tool', latencyMs: 87 },
        { name: 'compile_ats_pdf', status: 'running', kind: 'tool' },
      ],
    };

    render(
      <ChatMessageItem
        message={msgWithTools}
        agentColor="bg-action"
        onCopy={jest.fn()}
        onRetry={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        onDecide={jest.fn()}
        onSend={jest.fn()}
      />,
    );

    expect(screen.getByText('search_documents')).toBeInTheDocument();
    expect(screen.getByText('done · 87ms')).toBeInTheDocument();
    expect(screen.getByText('compile_ats_pdf')).toBeInTheDocument();
  });
});
