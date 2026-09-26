import React from 'react';

import { CheckIcon, AlertCircleIcon, InfoIcon, XIcon } from '../../icons';
import { MIN_TOUCH_TARGET } from '../layout/touchTarget';

export interface ToastProps {
  id: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  onDismiss: (id: string) => void;
  className?: string;
}

const typeConfig = {
  info: { icon: InfoIcon, color: 'text-info' },
  success: { icon: CheckIcon, color: 'text-success' },
  warning: { icon: AlertCircleIcon, color: 'text-warning' },
  error: { icon: AlertCircleIcon, color: 'text-error' },
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
      className={`flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-200 p-3.5 shadow-xl max-w-sm w-full ${className}`.trim()}
    >
      <div className={`shrink-0 mt-0.5 ${config.color}`}>
        <IconComponent size={18} />
      </div>
      <div className="flex-1 min-w-0">
        {title && <h6 className="font-medium text-xs text-text mb-0.5">{title}</h6>}
        <p className="text-xs text-text-secondary leading-relaxed">{message}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(id)}
        className={`shrink-0 inline-flex items-center justify-center text-text-muted hover:text-text rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-accent -mr-1 ${MIN_TOUCH_TARGET}`}
      >
        <XIcon size={14} />
      </button>
    </div>
  );
};

Toast.displayName = 'Toast';
