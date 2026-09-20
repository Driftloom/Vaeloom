import React from 'react';
import { BrainIcon, TrashIcon, EditIcon } from '../../icons';
import { ConfidenceIndicator } from '../ai/ConfidenceIndicator';

export interface MemoryCardProps {
  id: string;
  content: string;
  confidence: number;
  source: string;
  timestamp: string;
  entityCount?: number;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export const MemoryCard: React.FC<MemoryCardProps> = ({
  id,
  content,
  confidence,
  source,
  timestamp,
  entityCount,
  onEdit,
  onDelete,
  className = '',
}) => {
  return (
    <div
      className={`rounded-lg border border-[var(--color-border-subtle,#27272a)] bg-[var(--color-bg-surface,#111114)] p-4 hover:border-[var(--color-border-strong,#3f3f46)] transition-colors shadow-sm ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <BrainIcon size={16} className="text-[var(--color-ai-accent,#6366f1)]" />
          <ConfidenceIndicator score={confidence} showLabel={false} />
          <span className="text-xs text-[var(--color-text-muted,#71717a)] tabular-nums">
            {timestamp}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              type="button"
              aria-label="Edit memory"
              onClick={() => onEdit(id)}
              className="p-1 text-[var(--color-text-muted,#71717a)] hover:text-[var(--color-text-primary,#f4f4f5)] rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring,#3b82f6)]"
            >
              <EditIcon size={14} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label="Delete memory"
              onClick={() => onDelete(id)}
              className="p-1 text-[var(--color-text-muted,#71717a)] hover:text-[var(--color-status-danger,#ef4444)] rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring,#3b82f6)]"
            >
              <TrashIcon size={14} />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-primary,#f4f4f5)] leading-relaxed mb-3">
        {content}
      </p>

      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted,#71717a)] pt-2 border-t border-[var(--color-border-subtle,#27272a)]">
        <span>
          Source:{' '}
          <strong className="text-[var(--color-text-secondary,#a1a1aa)] font-medium">
            {source}
          </strong>
        </span>
        {entityCount !== undefined && (
          <span className="font-mono">
            {entityCount} linked {entityCount === 1 ? 'entity' : 'entities'}
          </span>
        )}
      </div>
    </div>
  );
};

MemoryCard.displayName = 'MemoryCard';
