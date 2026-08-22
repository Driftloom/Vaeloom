import React from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<AlertVariant, { container: string; icon: string }> = {
  info: {
    container: 'bg-blue-900/20 border-blue-500/30 text-info',
    icon: 'â„¹',
  },
  success: {
    container: 'bg-success/10 border-success/30 text-success',
    icon: 'âœ“',
  },
  warning: {
    container: 'bg-warning/10 border-warning/30 text-warning',
    icon: 'âš ',
  },
  error: {
    container: 'bg-error/10 border-error/30 text-error',
    icon: 'âœ•',
  },
};

export function Alert({ variant = 'info', title, children, action, className = '' }: AlertProps) {
  const styles = variantStyles[variant];
  const role = variant === 'error' ? 'alert' : 'status';

  return (
    <div
      role={role}
      className={`flex items-start gap-3 p-4 rounded-lg border ${styles.container} ${className}`}
    >
      <span className="text-lg shrink-0" aria-hidden="true">
        {styles.icon}
      </span>
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium text-sm mb-1">{title}</p>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
