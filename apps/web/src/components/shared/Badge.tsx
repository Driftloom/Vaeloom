import React from 'react';
import { Badge as UiKitBadge } from '@vaeloom/ui-kit';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <UiKitBadge variant={variant} className={className}>
      {children}
    </UiKitBadge>
  );
}
