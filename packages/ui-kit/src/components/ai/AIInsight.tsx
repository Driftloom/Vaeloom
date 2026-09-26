import React from 'react';

import { BrainIcon } from '../../icons';
import { Badge } from '../Badge';
import { Card } from '../Card';
import { MIN_TOUCH_TARGET } from '../layout/touchTarget';

export interface AIInsightProps {
  title: string;
  description: string;
  sourceAgent?: string;
  confidence?: number;
  recommendation?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function AIInsight({
  title,
  description,
  sourceAgent = 'Career Agent',
  confidence,
  recommendation,
  actionText,
  onAction,
  className = '',
}: AIInsightProps) {
  return (
    <Card
      className={`p-4 border-l-4 border-l-primary bg-gradient-to-r from-primary/5 via-surface to-surface transition-all ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <BrainIcon size={14} />
          </div>
          <span className="text-xs font-semibold text-text uppercase tracking-wider">
            {sourceAgent} Insight
          </span>
        </div>
        {confidence !== undefined && (
          <Badge variant="primary" size="sm">
            {Math.round(confidence * 100)}% match
          </Badge>
        )}
      </div>

      <h4 className="mt-2 text-sm font-semibold text-text">{title}</h4>
      <p className="mt-1 text-xs text-text-muted leading-relaxed">{description}</p>

      {recommendation && (
        <div className="mt-3 p-2.5 rounded bg-surface-hover/80 border border-border/60 text-xs">
          <strong className="text-primary font-medium">Recommended Action:</strong>{' '}
          <span className="text-text-secondary">{recommendation}</span>
        </div>
      )}

      {actionText && onAction && (
        <div className="mt-3 pt-2 border-t border-border/50 flex justify-end">
          <button
            type="button"
            onClick={onAction}
            className={`inline-flex items-center text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${MIN_TOUCH_TARGET}`}
          >
            {actionText} →
          </button>
        </div>
      )}
    </Card>
  );
}
