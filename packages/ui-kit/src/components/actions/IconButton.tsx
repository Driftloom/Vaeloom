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
  primary:
    'bg-[var(--color-action-primary,#3b82f6)] text-white hover:opacity-90 active:opacity-100',
  secondary:
    'bg-[var(--color-bg-surface,#111114)] text-[var(--color-text-primary,#f4f4f5)] border border-[var(--color-border-subtle,#27272a)] hover:border-[var(--color-border-strong,#3f3f46)] hover:bg-[var(--color-bg-elevated,#18181c)]',
  ghost:
    'bg-transparent text-[var(--color-text-secondary,#a1a1aa)] hover:text-[var(--color-text-primary,#f4f4f5)] hover:bg-[var(--color-bg-elevated,#18181c)]',
  danger: 'bg-[var(--color-status-danger,#ef4444)] text-white hover:opacity-90',
  ai: 'bg-[var(--color-ai-accent,#6366f1)] text-white hover:opacity-90',
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
        className={`inline-flex items-center justify-center font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#3b82f6)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-canvas,#08080a)] disabled:opacity-50 disabled:cursor-not-allowed ${vStyle} ${sStyle} ${className}`.trim()}
        {...props}
      >
        {loading ? <Spinner size={size === 'lg' ? 'md' : 'sm'} /> : children}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
