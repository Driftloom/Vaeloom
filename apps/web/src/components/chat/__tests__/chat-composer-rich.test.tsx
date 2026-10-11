import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChatComposer } from '../ChatComposer';

describe('ChatComposer Rich Capabilities', () => {
  it('renders voice transcription placeholder slot and accessible token gauge', () => {
    render(
      <ChatComposer
        value="Hello world"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onStop={jest.fn()}
        busy={false}
        commands={[]}
        commandsState="ready"
        mentionTargets={[]}
        selectedAgent="auto"
        onSelectAgent={jest.fn()}
        attachment={null}
        onAttachment={jest.fn()}
        maxLength={10000}
      />,
    );

    expect(screen.getByLabelText(/Voice Input/i)).toBeInTheDocument();
    expect(screen.getByText(/~3 tok · 11\/10000/i)).toBeInTheDocument();
  });
});
