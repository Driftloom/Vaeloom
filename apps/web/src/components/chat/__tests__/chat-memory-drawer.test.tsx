import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';

import { api } from '@/lib/api';
import { ChatMemoryDrawer } from '../ChatMemoryDrawer';

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn() },
}));

const getMock = api.get as jest.Mock;

function renderDrawer() {
  return render(
    <SWRConfig
      value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
    >
      <ChatMemoryDrawer isOpen onClose={jest.fn()} workspaceId="ws-1" />
    </SWRConfig>,
  );
}

describe('ChatMemoryDrawer honest failure state', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('renders an alert instead of a false empty state when the fetch fails', async () => {
    getMock.mockRejectedValueOnce(new Error('503'));

    renderDrawer();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Could not load memories')).toBeInTheDocument();
    expect(screen.queryByText('No memories found')).toBeNull();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('retry button re-fetches and renders memories when the service recovers', async () => {
    getMock.mockRejectedValueOnce(new Error('503'));
    getMock.mockResolvedValueOnce([
      { id: 'm1', type: 'profile', title: 'Recovered', content: 'c' },
    ]);

    renderDrawer();
    await screen.findByRole('alert');

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(await screen.findByTestId('memory-item-m1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('still renders the truthful empty state for a genuinely empty corpus', async () => {
    getMock.mockResolvedValueOnce([]);

    renderDrawer();

    expect(await screen.findByText('No memories found')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
