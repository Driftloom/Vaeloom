import React from 'react';
import { Card } from '@vaeloom/ui-kit';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  header?: React.ReactNode;
  variant?: 'default' | 'elevated' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Panel — canonical section wrapper used across Profile and Settings pages.
 * Maps to the design system's Panel token (default = Card lg padding, border, surface bg).
 */
export function Panel({
  children,
  header,
  variant = 'default',
  padding = 'lg',
  className = '',
  ...props
}: PanelProps) {
  const variantClass =
    variant === 'elevated'
      ? 'shadow-lg'
      : variant === 'subtle'
        ? 'bg-background border-border/60'
        : '';

  return (
    <Card padding={padding} bordered className={`${variantClass} ${className}`} {...props}>
      {header && <div className="mb-4">{header}</div>}
      {children}
    </Card>
  );
}
