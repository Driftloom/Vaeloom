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

// Same alpha-tinted status ramp Badge uses, so Alert and Badge cannot drift:
// a 10% status fill, a 30% status border, the status hue for body text and the
// lighter `-fg` slot for the icon. Every family clears WCAG AA for text on its
// own /10 tint in all three themes (worst case: light `info` at 5.13:1).
const variantConfig = {
  info: {
    bg: 'bg-info/10 text-info border-info/30',
    iconColor: 'text-info-fg',
    icon: InfoIcon,
    urgent: false,
  },
  success: {
    bg: 'bg-success/10 text-success border-success/30',
    iconColor: 'text-success-fg',
    icon: CheckIcon,
    urgent: false,
  },
  warning: {
    bg: 'bg-warning/10 text-warning border-warning/30',
    iconColor: 'text-warning-fg',
    icon: AlertTriangleIcon,
    urgent: true,
  },
  danger: {
    bg: 'bg-error/10 text-error border-error/30',
    iconColor: 'text-error-fg',
    icon: AlertCircleIcon,
    urgent: true,
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
    // `info` and `success` report state the user can wait for, so they announce
    // politely via role="status" and queue behind whatever is being read.
    // `warning` and `danger` need to interrupt, which is what role="alert"
    // (implicit aria-live="assertive") is for. All four were assertive before,
    // so a passive confirmation cut off the screen reader mid-sentence.
    <div
      role={config.urgent ? 'alert' : 'status'}
      aria-live={config.urgent ? 'assertive' : 'polite'}
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
