import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '@vaeloom/ui-kit';

describe('Modal', () => {
  it('renders title and children when open', () => {
    render(
      <Modal isOpen onClose={jest.fn()} title="Export data">
        <p>Your export is ready.</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Export data' })).toBeInTheDocument();
    expect(screen.getByText('Your export is ready.')).toBeInTheDocument();
  });

  it('returns null when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={jest.fn()} title="Hidden">
        <p>nope</p>
      </Modal>,
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('moves focus into the dialog when opened', () => {
    render(
      <Modal isOpen onClose={jest.fn()} title="Focus me">
        <button>First focusable</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Focus me' });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape', () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose} title="Escape me">
        <button>inside</button>
      </Modal>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
