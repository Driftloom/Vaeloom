import React from 'react';

import { AlertCircleIcon, InfoIcon, XIcon } from '../../icons';
import { MIN_TOUCH_TARGET } from '../layout/touchTarget';

export interface BannerProps {
  variant?: 'info' | 'warning' | 'danger';
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
  className?: string;
}

const variantStyles = {
  info: 'bg-surface-200 border-primary text-text',
  warning: 'bg-warning/15 border-warning/30 text-warning',
  danger: 'bg-error/15 border-error/30 text-error',
};

export const Banner: React.FC<BannerProps> = ({
  variant = 'info',
  title,
  description,
  action,
  onClose,
  className = '',
}) => {
  const vStyle = variantStyles[variant] || variantStyles.info;

  return (
    <aside
      role="banner"
      className={`w-full border-b py-2.5 px-4 flex items-center justify-between gap-4 text-sm ${vStyle} ${className}`.trim()}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="shrink-0">
          {variant === 'info' ? <InfoIcon size={16} /> : <AlertCircleIcon size={16} />}
        </span>
        <span className="font-medium text-xs sm:text-sm truncate">{title}</span>
        {description && (
          <span className="hidden md:inline text-xs opacity-80 truncate">{description}</span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={`inline-flex items-center text-xs font-semibold underline hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-current ${MIN_TOUCH_TARGET}`}
          >
            {action.label}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            aria-label="Close banner"
            onClick={onClose}
            className={`inline-flex items-center justify-center opacity-60 hover:opacity-100 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-current ${MIN_TOUCH_TARGET}`}
          >
            <XIcon size={14} />
          </button>
        )}
      </div>
    </aside>
  );
};

Banner.displayName = 'Banner';
