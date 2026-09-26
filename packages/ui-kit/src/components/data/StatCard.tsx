import React from 'react';

import { ArrowDownIcon, ArrowUpIcon } from '../../icons';
import { Badge } from '../Badge';
import { Card } from '../Card';

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

  const TrendIcon =
    delta?.trend === 'up' ? ArrowUpIcon : delta?.trend === 'down' ? ArrowDownIcon : null;
  const trendWord = delta?.trend === 'up' ? 'up' : delta?.trend === 'down' ? 'down' : 'no change';

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
            {/* The trend glyph is decorative; screen readers get the sentence
                form instead of "up arrow 12%". */}
            <span className="inline-flex items-center gap-0.5" aria-hidden="true">
              {TrendIcon && <TrendIcon size={12} />}
              {delta.value}
            </span>
            <span className="sr-only">{`${trendWord} ${delta.value}`}</span>
          </Badge>
        )}
      </div>

      {(caption || delta?.label) && (
        <p className="mt-1 text-xs text-text-dim truncate">{caption || delta?.label}</p>
      )}
    </Card>
  );
}
