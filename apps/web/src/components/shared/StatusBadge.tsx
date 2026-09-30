import React from 'react';
import { Badge as UiKitBadge } from '@vaeloom/ui-kit';

export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  variant: StatusVariant;
  label: string;
  className?: string;
}

/**
 * `neutral` has no ui-kit counterpart by that name; `default` is the neutral
 * surface treatment (`bg-surface-hover text-text-muted border-border`).
 * `font-mono` is applied through className rather than the ui-kit `mono` variant,
 * because that variant is a neutral-grey treatment and would discard the
 * semantic colour every other variant carries.
 */
const variantMap: Record<StatusVariant, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  neutral: 'default',
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
};

export function StatusBadge({ variant, label, className = '' }: StatusBadgeProps) {
  return (
    <UiKitBadge
      role="status"
      variant={variantMap[variant]}
      size="sm"
      className={`font-mono ${className}`.trim()}
    >
      {label}
    </UiKitBadge>
  );
}
