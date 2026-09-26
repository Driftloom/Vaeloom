import React from 'react';

import { InfoIcon, CheckIcon, AlertTriangleIcon, AlertCircleIcon, XIcon } from '../../icons';
import { MIN_TOUCH_TARGET } from '../layout/touchTarget';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  description?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const variantConfig = {
  info: {
    bg: 'bg-blue-950/30 border-blue-800/40 text-blue-200',
    iconColor: 'text-blue-400',
    icon: InfoIcon,
  },
  success: {
    bg: 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200',
    iconColor: 'text-emerald-400',
    icon: CheckIcon,
  },
  warning: {
    bg: 'bg-amber-950/30 border-amber-800/40 text-amber-200',
    iconColor: 'text-amber-400',
    icon: AlertTriangleIcon,
  },
  danger: {
    bg: 'bg-red-950/30 border-red-800/40 text-red-200',
    iconColor: 'text-red-400',
    icon: AlertCircleIcon,
  },
};

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  description,
  onClose,
  className = '',
  children,
}) => {
  const config = variantConfig[variant] || variantConfig.info;
  const IconComponent = config.icon;

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-3 rounded-lg border p-3.5 text-sm ${config.bg} ${className}`.trim()}
    >
      <div className={`mt-0.5 shrink-0 ${config.iconColor}`}>
        <IconComponent size={18} />
      </div>
      <div className="flex-1 min-w-0">
        {title && <h5 className="font-semibold text-sm mb-0.5 leading-5">{title}</h5>}
        {description && <div className="text-xs leading-relaxed opacity-90">{description}</div>}
        {children}
      </div>
      {onClose && (
        <button
          type="button"
          aria-label="Dismiss alert"
          onClick={onClose}
          className={`inline-flex items-center justify-center shrink-0 text-current opacity-60 hover:opacity-100 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-current ${MIN_TOUCH_TARGET}`}
        >
          <XIcon size={14} />
        </button>
      )}
    </div>
  );
};

Alert.displayName = 'Alert';
