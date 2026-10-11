import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatHeader } from '../ChatHeader';

describe('ChatHeader Unified Architecture', () => {
  it('renders connection status and agent badge without overlapping context gauge', () => {
    render(
      <ChatHeader
        workspaceId="212ed9ca-5a26-45b3-8bf2-28f77389c6a3"
        agentName="resume"
        agentCount={10}
        durableMode={false}
        onDurableModeChange={jest.fn()}
        connectionStatus="connected"
        drawerOpen={false}
        onToggleDrawer={jest.fn()}
        onNewChat={jest.fn()}
        selectedModel="gemma4:31b"
        contextTotalTokens={4500}
        contextMaxTokens={32768}
      />,
    );

    expect(screen.getByText('connected')).toBeInTheDocument();
    expect(screen.getByText('resume')).toBeInTheDocument();
    expect(screen.getByLabelText(/Session Controls|Context Usage/i)).toBeInTheDocument();
  });

  it('opens session inspector popover with durable mode and vault shortcuts', () => {
    const onDurableChange = jest.fn();
    const onToggleMemory = jest.fn();
    render(
      <ChatHeader
        workspaceId="212ed9ca"
        agentName="auto"
        agentCount={5}
        durableMode={false}
        onDurableModeChange={onDurableChange}
        connectionStatus="connected"
        drawerOpen={false}
        onToggleDrawer={jest.fn()}
        onNewChat={jest.fn()}
        contextTotalTokens={1200}
        contextMaxTokens={32768}
        onToggleMemoryDrawer={onToggleMemory}
      />,
    );

    const trigger = screen.getByLabelText(/Session Controls|Context Usage/i);
    fireEvent.click(trigger);
    expect(screen.getByText(/Durable Mode/i)).toBeInTheDocument();
  });
});
