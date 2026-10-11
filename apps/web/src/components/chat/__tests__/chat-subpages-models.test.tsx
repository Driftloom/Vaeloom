import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelMatrixView } from '../ChatSubpages';
import type { ModelOption } from '../types';

const TEST_MODELS: ModelOption[] = [
  {
    id: 'gemma4:31b',
    name: 'Ollama Cloud Gemma 4 31B',
    provider: 'ollama',
    tier: 'balanced',
    contextWindow: 32768,
    maxTokens: 32768,
    description: 'Balanced enterprise model',
    status: 'ready',
  },
];

describe('Model Matrix View Tuner', () => {
  it('renders interactive temperature presets and updates temperature', () => {
    const onTemperatureChange = jest.fn();
    render(
      <ModelMatrixView
        availableModels={TEST_MODELS}
        selectedModel="gemma4:31b"
        onSelectModel={jest.fn()}
        temperature={0.7}
        onTemperatureChange={onTemperatureChange}
      />,
    );

    expect(screen.getByText(/Creative \(1.0\)/i)).toBeInTheDocument();
    const creativeBtn = screen.getByRole('button', { name: /Creative/i });
    fireEvent.click(creativeBtn);
    expect(onTemperatureChange).toHaveBeenCalledWith(1.0);
  });
});
