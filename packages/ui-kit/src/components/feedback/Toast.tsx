import React from 'react';
import { CheckIcon, AlertCircleIcon, InfoIcon, XIcon } from '../../icons';

export interface ToastProps {
  id: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  onDismiss: (id: string) => void;
  className?: string;
}

const typeConfig = {
  info: { icon: InfoIcon, color: 'text-[var(--color-action-primary,#3b82f6)]' },
  success: { icon: CheckIcon, color: 'text-[var(--color-status-success,#10b981)]' },
  warning: { icon: AlertCircleIcon, color: 'text-[var(--color-status-warning,#f59e0b)]' },
  error: { icon: AlertCircleIcon, color: 'text-[var(--color-status-danger,#ef4444)]' },
};

export const Toast: React.FC<ToastProps> = ({
  id,
  type = 'info',
  title,
  message,
  onDismiss,
  className = '',
}) => {
  const config = typeConfig[type] || typeConfig.info;
  const IconComponent = config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-lg border border-[var(--color-border-subtle,#27272a)] bg-[var(--color-bg-elevated,#18181c)] p-3.5 shadow-xl max-w-sm w-full ${className}`.trim()}
    >
      <div className={`shrink-0 mt-0.5 ${config.color}`}>
        <IconComponent size={18} />
      </div>
      <div className="flex-1 min-w-0">
        {title && (
          <h6 className="font-medium text-xs text-[var(--color-text-primary,#f4f4f5)] mb-0.5">
            {title}
          </h6>
        )}
        <p className="text-xs text-[var(--color-text-secondary,#a1a1aa)] leading-relaxed">
          {message}
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(id)}
        className="shrink-0 text-[var(--color-text-muted,#71717a)] hover:text-[var(--color-text-primary,#f4f4f5)] p-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring,#3b82f6)]"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
};

Toast.displayName = 'Toast';
