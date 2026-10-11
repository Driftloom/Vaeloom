'use client';

import { useCallback, useEffect, useRef } from 'react';

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Confine Tab/Shift+Tab to a dialog, move focus in on open and restore it on
 * close.
 *
 * `aria-modal="true"` is a promise to assistive tech that the rest of the page
 * is unreachable. Without a trap the promise is false: Tab walks straight out
 * of the drawer into background content that a screen-reader user was told
 * does not exist, and focus never returns to the trigger on close.
 *
 * Extracted from Modal, which had it inline, so Drawer and the application
 * drawers could adopt it instead of each rolling their own copy.
 */
export function useFocusTrap(isOpen: boolean, onEscape?: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        onEscape();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const focusables = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        e.preventDefault();
        ref.current.focus();
        return;
      }
      const first = focusables[0] as HTMLElement;
      const last = focusables[focusables.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onEscape],
  );

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const target =
      ref.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? ref.current ?? null;
    target?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore unconditionally when the trigger is still in the document.
      // Guarding on `ref.current.contains(...)` does not work: React detaches
      // the ref before this cleanup runs, so the check was always false and
      // focus was dropped on <body> instead of returning to the trigger.
      const prev = previouslyFocused.current;
      if (prev && prev.isConnected) prev.focus();
    };
  }, [isOpen, handleKeyDown]);

  return ref;
}
