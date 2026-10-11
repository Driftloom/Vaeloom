'use client';

import React, { useId } from 'react';

import { XIcon } from '../../icons';
import { MIN_TOUCH_TARGET } from '../layout/touchTarget';
import { lockScroll, unlockScroll } from '../layout/scrollLock';
import { useFocusTrap } from '../layout/useFocusTrap';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-3xl',
};

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
}) => {
  // `aria-modal` was already declared here, which promises focus containment
  // this component did not implement. `drawerRef` existed but was never read.
  const drawerRef = useFocusTrap(isOpen, onClose);
  const titleId = useId();

  React.useEffect(() => {
    if (!isOpen) return;
    lockScroll();
    return () => {
      unlockScroll();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sStyle = sizeStyles[size] || sizeStyles.md;

  return (
    <div
      ref={drawerRef}
      className="fixed inset-0 z-50 flex justify-end overscroll-contain"
      role="dialog"
      aria-modal="true"
      // The drawer announced only "dialog": `title` is optional and nothing
      // ever pointed role="dialog" at the visible heading.
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : 'Drawer'}
      tabIndex={-1}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Body */}
      <div
        className={`relative z-10 w-full ${sStyle} bg-surface border-l border-border-subtle shadow-2xl flex flex-col h-full animate-slide-in-from-right duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div>
            {title && (
              <h3 id={titleId} className="text-base font-semibold text-text">
                {title}
              </h3>
            )}
            {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Close drawer"
            onClick={onClose}
            className={`inline-flex items-center justify-center p-1.5 text-text-muted hover:text-text rounded-md hover:bg-surface-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${MIN_TOUCH_TARGET}`}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-5 text-sm text-text">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-border-subtle bg-surface-200">{footer}</div>
        )}
      </div>
    </div>
  );
};

Drawer.displayName = 'Drawer';
