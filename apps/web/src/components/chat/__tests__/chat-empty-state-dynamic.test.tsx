import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatEmptyState } from '../ChatEmptyState';

describe('Dynamic Chat Empty State', () => {
  it('renders category tabs and adapts to active resume agent', () => {
    const onSend = jest.fn();
    render(
      <ChatEmptyState
        commands={[
          { trigger: '/ats', agent: 'resume', description: 'Run ATS audit', color: '#10b981' },
        ]}
        commandsState="ready"
        onPickCommand={jest.fn()}
        onSend={onSend}
        activeAgent="resume"
      />,
    );

    expect(screen.getByText(/Resume & Career Focused/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run ATS Resume Audit/i })).toBeInTheDocument();

    const starterBtn = screen.getByRole('button', { name: /Run ATS Resume Audit/i });
    fireEvent.click(starterBtn);
    expect(onSend).toHaveBeenCalled();
  });
});
