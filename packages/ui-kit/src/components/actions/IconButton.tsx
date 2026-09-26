import React from 'react';

import { Spinner } from '../Spinner';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
}

const variantStyles = {
  primary: 'bg-action text-white hover:opacity-90 active:opacity-100',
  secondary:
    'bg-surface text-text border border-border-subtle hover:border-border-strong hover:bg-surface-200',
  ghost: 'bg-transparent text-text-secondary hover:text-text hover:bg-surface-200',
  danger: 'bg-error text-white hover:opacity-90',
  ai: 'bg-accent text-white hover:opacity-90',
};

const sizeStyles = {
  sm: 'h-7 w-7 rounded-md text-xs',
  md: 'h-9 w-9 rounded-md text-sm',
  lg: 'h-11 w-11 rounded-lg text-base',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      variant = 'ghost',
      size = 'md',
      loading = false,
      disabled = false,
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    const vStyle = variantStyles[variant] || variantStyles.ghost;
    const sStyle = sizeStyles[size] || sizeStyles.md;

    return (
      <button
        ref={ref}
        aria-label={ariaLabel}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-100 disabled:opacity-50 disabled:cursor-not-allowed ${vStyle} ${sStyle} ${className}`.trim()}
        {...props}
      >
        {loading ? <Spinner size={size === 'lg' ? 'md' : 'sm'} /> : children}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
