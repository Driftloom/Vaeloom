import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'mono';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const base = 'inline-flex items-center gap-1 font-medium rounded-full border transition-colors';

  const variants: Record<string, string> = {
    default: 'bg-surface-hover text-text-muted border-border',
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    error: 'bg-error/10 text-error border-error/30',
    info: 'bg-info/10 text-info border-info/30',
    mono: 'bg-surface-hover text-text font-mono border-border',
  };

  const sizes: Record<string, string> = {
    sm: 'px-2 py-0.5 text-xs leading-4',
    md: 'px-2.5 py-1 text-xs leading-4',
  };

  const classes = [base, variants[variant], sizes[size], className].filter(Boolean).join(' ');

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
};
