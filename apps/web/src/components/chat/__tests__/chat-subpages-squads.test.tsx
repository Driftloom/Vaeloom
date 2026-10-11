import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentSquadsView } from '../ChatSubpages';

describe('Dynamic Agent Squads View', () => {
  it('renders squad presets and activates a preset', () => {
    const onSelectSquad = jest.fn();
    const onActivateSquad = jest.fn();

    render(
      <AgentSquadsView
        selectedSquad={['career_coach']}
        onToggleAgent={jest.fn()}
        onSelectSquad={onSelectSquad}
        onActivateSquad={onActivateSquad}
      />,
    );

    expect(screen.getByText(/Full Executive Search/i)).toBeInTheDocument();
    expect(screen.getByText(/ATS & Technical Screener/i)).toBeInTheDocument();

    const presetBtn = screen.getByRole('button', { name: /Select Full Executive Search/i });
    fireEvent.click(presetBtn);
    expect(onSelectSquad).toHaveBeenCalled();

    const activateBtn = screen.getByRole('button', { name: /Activate Squad in Chat/i });
    fireEvent.click(activateBtn);
    expect(onActivateSquad).toHaveBeenCalled();
  });
});
