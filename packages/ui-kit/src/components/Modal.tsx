'use client';

import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

import { MIN_TOUCH_TARGET } from './layout/touchTarget';
import { lockScroll, unlockScroll } from './layout/scrollLock';
import { useFocusTrap } from './layout/useFocusTrap';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const sizes: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  const dialogRef = useFocusTrap(isOpen, onClose);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    return () => {
      unlockScroll();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        className={`relative w-full ${sizes[size]} mx-4 max-h-[90dvh] flex flex-col bg-surface rounded-lg border border-border shadow-xl overscroll-contain`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 id={titleId} className="text-lg font-semibold text-text">
            {title}
          </h2>
          <button
            onClick={onClose}
            type="button"
            className={`inline-flex items-center justify-center rounded text-text-muted hover:text-text transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${MIN_TOUCH_TARGET}`}
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 text-text flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
          {children}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
};
