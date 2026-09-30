import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { Modal } from '../Modal';

// This package has no `@testing-library/jest-dom` dependency, so assertions are
// written against real DOM properties rather than the `toBeInTheDocument` family.

describe('Modal', () => {
  it('renders title and children when open', () => {
    render(
      <Modal isOpen onClose={jest.fn()} title="Export data">
        <p>Your export is ready.</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Export data' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    // The accessible name must come from the rendered heading, not a bare string.
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)?.textContent).toBe('Export data');

    expect(screen.getByText('Your export is ready.').textContent).toBe('Your export is ready.');
  });

  it('returns null when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={jest.fn()} title="Hidden">
        <p>nope</p>
      </Modal>,
    );
    // Asserted against `document`, not just the render container: when open the
    // dialog is portalled to `document.body`, so a container-only check would
    // pass even if the portal leaked a closed dialog into the tree.
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(screen.queryByText('nope')).toBeNull();
  });

  it('moves focus into the dialog when opened', () => {
    render(
      <Modal isOpen onClose={jest.fn()} title="Focus me">
        <button>First focusable</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Focus me' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    // The first focusable in the dialog is the header close control, not the
    // caller's first child, so assert which control actually received focus.
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close');
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
