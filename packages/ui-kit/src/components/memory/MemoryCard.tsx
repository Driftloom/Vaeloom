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
      className={`rounded-lg border border-border-subtle bg-surface p-4 hover:border-border-strong transition-colors shadow-sm ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <BrainIcon size={16} className="text-accent" />
          <ConfidenceIndicator score={confidence} showLabel={false} />
          <span className="text-xs text-text-muted tabular-nums">{timestamp}</span>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              type="button"
              aria-label="Edit memory"
              onClick={() => onEdit(id)}
              className="p-1 text-text-muted hover:text-text rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <EditIcon size={14} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label="Delete memory"
              onClick={() => onDelete(id)}
              className="p-1 text-text-muted hover:text-error rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <TrashIcon size={14} />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-text leading-relaxed mb-3">{content}</p>

      <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border-subtle">
        <span>
          Source: <strong className="text-text-secondary font-medium">{source}</strong>
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
