import React from 'react';
import { Spinner } from './Spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...props
}) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';

  const variants: Record<string, string> = {
    primary: 'bg-primary text-background hover:bg-primary-hover focus:ring-primary active:bg-primary-active',
    secondary: 'bg-surface-hover text-text hover:bg-surface-active focus:ring-border border border-border',
    ghost: 'bg-transparent text-text hover:bg-surface-hover focus:ring-border',
    danger: 'bg-accent text-background hover:bg-accent-hover focus:ring-accent active:bg-accent-active',
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const classes = [base, variants[variant], sizes[size], fullWidth ? 'w-full' : '', className].filter(Boolean).join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading && <Spinner className="mr-2" size="sm" />}
      {children}
    </button>
  );
};
