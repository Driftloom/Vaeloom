import React from 'react';

export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  variant: StatusVariant;
  label: string;
  className?: string;
}

const variantStyles: Record<StatusVariant, string> = {
  // Semantic tokens resolve per theme (Wave 03) — AA contrast in both.
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  error: 'bg-error/10 text-error border-error/30',
  info: 'bg-info/10 text-info border-info/30',
  neutral: 'bg-surface-active text-text-muted border-border',
};

export function StatusBadge({ variant, label, className = '' }: StatusBadgeProps) {
  return (
    <span
      role="status"
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono border ${variantStyles[variant]} ${className}`}
    >
      {label}
    </span>
  );
}
