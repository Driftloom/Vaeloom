import React from 'react';
import { Card } from '../Card';
import { Badge } from '../Badge';

export interface StatCardProps {
  label: string;
  value: string | number;
  delta?: {
    value: string | number;
    trend: 'up' | 'down' | 'neutral';
    label?: string;
  };
  icon?: React.ReactNode;
  caption?: string;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  delta,
  icon,
  caption,
  className = '',
  onClick,
}: StatCardProps) {
  const deltaVariant =
    delta?.trend === 'up' ? 'success' : delta?.trend === 'down' ? 'error' : 'default';

  return (
    <Card
      hover={Boolean(onClick)}
      className={`p-4 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-border-strong hover:bg-surface-hover' : ''
      } ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center text-text-muted shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-display font-semibold text-text tracking-tight">
          {value}
        </span>
        {delta && (
          <Badge variant={deltaVariant} size="sm">
            {delta.trend === 'up' ? '↑' : delta.trend === 'down' ? '↓' : '•'} {delta.value}
          </Badge>
        )}
      </div>

      {(caption || delta?.label) && (
        <p className="mt-1 text-xs text-text-dim truncate">{caption || delta?.label}</p>
      )}
    </Card>
  );
}
