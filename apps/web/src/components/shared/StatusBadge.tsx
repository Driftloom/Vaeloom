import React from 'react';

export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  variant: StatusVariant;
  label: string;
  className?: string;
}

const variantStyles: Record<StatusVariant, string> = {
  success: 'bg-green-900/30 text-green-400 border-green-500/30',
  warning: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-900/30 text-red-400 border-red-500/30',
  info: 'bg-blue-900/30 text-blue-400 border-blue-500/30',
  neutral: 'bg-surface-active text-text-muted border-border',
};

export function StatusBadge({ variant, label, className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono border ${variantStyles[variant]} ${className}`}>
      {label}
    </span>
  );
}
