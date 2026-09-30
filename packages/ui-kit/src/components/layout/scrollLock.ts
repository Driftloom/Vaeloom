'use client';

import { useEffect } from 'react';

/**
 * Shared, reference-counted scroll locking for modals, drawers, and overlays.
 * Prevents background scroll leakage while compensating for scrollbar width
 * to avoid layout shifts.
 */

let lockCount = 0;
let originalStyles: {
  overflow: string;
  paddingRight: string;
  touchAction: string;
} | null = null;

export function lockScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (lockCount === 0) {
    const body = document.body;
    const documentElement = document.documentElement;

    originalStyles = {
      overflow: body.style.overflow || '',
      paddingRight: body.style.paddingRight || '',
      touchAction: body.style.touchAction || '',
    };

    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  lockCount++;
}

export function unlockScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (lockCount > 0) {
    lockCount--;
  }

  if (lockCount === 0 && originalStyles) {
    const body = document.body;
    body.style.overflow = originalStyles.overflow;
    body.style.paddingRight = originalStyles.paddingRight;
    body.style.touchAction = originalStyles.touchAction;
    originalStyles = null;
  }
}

/** Reset helper for testing environments to clear global lock state */
export function resetScrollLock(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    lockCount = 0;
    originalStyles = null;
    return;
  }
  if (originalStyles) {
    const body = document.body;
    body.style.overflow = originalStyles.overflow;
    body.style.paddingRight = originalStyles.paddingRight;
    body.style.touchAction = originalStyles.touchAction;
  }
  lockCount = 0;
  originalStyles = null;
}

export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    lockScroll();
    return () => {
      unlockScroll();
    };
  }, [locked]);
}
