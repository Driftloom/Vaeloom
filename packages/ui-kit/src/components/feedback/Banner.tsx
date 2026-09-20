import React from 'react';
import { AlertCircleIcon, InfoIcon, XIcon } from '../../icons';

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
  info: 'bg-[var(--color-bg-elevated,#18181c)] border-[var(--color-action-primary,#3b82f6)] text-[var(--color-text-primary,#f4f4f5)]',
  warning: 'bg-amber-950/40 border-amber-600/50 text-amber-200',
  danger: 'bg-red-950/40 border-red-600/50 text-red-200',
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
            className="text-xs font-semibold underline hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-current"
          >
            {action.label}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            aria-label="Close banner"
            onClick={onClose}
            className="p-1 opacity-60 hover:opacity-100 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-current"
          >
            <XIcon size={14} />
          </button>
        )}
      </div>
    </aside>
  );
};

Banner.displayName = 'Banner';
