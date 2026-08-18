import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-active text-text-muted border-border',
  success: 'bg-green-900/30 text-green-400 border-green-500/30',
  warning: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-900/30 text-red-400 border-red-500/30',
  info: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono border ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
