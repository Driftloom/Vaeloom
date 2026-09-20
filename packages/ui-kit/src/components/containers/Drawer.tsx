import React from 'react';
import { XIcon } from '../../icons';

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
  const drawerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sStyle = sizeStyles[size] || sizeStyles.md;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Body */}
      <div
        ref={drawerRef}
        className={`relative z-10 w-full ${sStyle} bg-[var(--color-bg-surface,#111114)] border-l border-[var(--color-border-subtle,#27272a)] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle,#27272a)]">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-[var(--color-text-primary,#f4f4f5)]">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-[var(--color-text-secondary,#a1a1aa)] mt-0.5">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close drawer"
            onClick={onClose}
            className="p-1.5 text-[var(--color-text-muted,#71717a)] hover:text-[var(--color-text-primary,#f4f4f5)] rounded-md hover:bg-[var(--color-bg-elevated,#18181c)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#3b82f6)]"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 text-sm text-[var(--color-text-primary,#f4f4f5)]">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-[var(--color-border-subtle,#27272a)] bg-[var(--color-bg-elevated,#18181c)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

Drawer.displayName = 'Drawer';
