import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

function Probe() {
  const { toast } = useToast();
  return (
    <button
      onClick={() => toast({ tone: 'success', title: 'Saved', detail: 'Correction applied' })}
    >
      fire
    </button>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders a toast on trigger and dismisses it', async () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Correction applied')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(6100);
    });
    await waitFor(() => {
      expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    });
  });

  it('announces the notification region politely', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    );
    expect(screen.getByRole('region', { name: 'Notifications' })).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });
});
