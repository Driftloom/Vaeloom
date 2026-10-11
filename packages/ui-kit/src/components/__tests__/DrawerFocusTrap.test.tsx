import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { Drawer } from '../containers/Drawer';
import { Modal } from '../Modal';

/**
 * `aria-modal="true"` is a claim. These tests exist so the claim is kept:
 * Drawer declared it while trapping nothing, and Drawer shipped that way.
 *
 * Assertions use document.activeElement rather than toHaveFocus because
 * jest-dom matchers are not installed in this package's jest setup.
 */

const OUTSIDE_BUTTON_LABEL = 'Background button';

const focusedIs = (label: string) =>
  document.activeElement === screen.getByRole('button', { name: label });

function Background() {
  return (
    <div>
      <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
      <Drawer isOpen onClose={jest.fn()} title="Test drawer">
        <button type="button">First inside</button>
        <button type="button">Last inside</button>
      </Drawer>
    </div>
  );
}

function ModalHost() {
  return (
    <div>
      <button type="button">{OUTSIDE_BUTTON_LABEL}</button>
      <Modal isOpen onClose={jest.fn()} title="Test modal">
        <button type="button">Only inside</button>
      </Modal>
    </div>
  );
}

describe('Drawer focus containment', () => {
  // The first focusable in DOM order is the header's close button, so opening
  // a drawer parks focus there rather than in the body.
  it('moves focus into the drawer when it opens', () => {
    render(<Background />);
    expect(focusedIs('Close drawer')).toBe(true);
    expect(focusedIs(OUTSIDE_BUTTON_LABEL)).toBe(false);
  });

  it('exposes an accessible name from the title', () => {
    render(<Background />);
    // getByRole with a name is the assertion: it throws if the dialog is
    // unnamed or named differently.
    const dialog = screen.getByRole('dialog', { name: 'Test drawer' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('wraps Tab from the last control back to the first', () => {
    render(<Background />);
    screen.getByRole('button', { name: 'Last inside' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(focusedIs('Close drawer')).toBe(true);
  });

  it('wraps Shift+Tab from the first control back to the last', () => {
    render(<Background />);
    screen.getByRole('button', { name: 'Close drawer' }).focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(focusedIs('Last inside')).toBe(true);
  });

  it('does not let Tab escape to the background page', () => {
    render(<Background />);
    screen.getByRole('button', { name: 'Last inside' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(focusedIs(OUTSIDE_BUTTON_LABEL)).toBe(false);
  });

  it('restores focus to the trigger when it closes', () => {
    function Host() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Open drawer
          </button>
          <Drawer isOpen={open} onClose={() => setOpen(false)} title="Test drawer">
            <button type="button">Inside</button>
          </Drawer>
        </div>
      );
    }
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'Open drawer' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(focusedIs('Close drawer')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }));
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Modal focus containment', () => {
  it('moves focus inside and keeps Tab from escaping', () => {
    render(<ModalHost />);
    expect(focusedIs('Close')).toBe(true);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(focusedIs(OUTSIDE_BUTTON_LABEL)).toBe(false);
  });
});
