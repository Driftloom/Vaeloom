import React from 'react';
import { ChevronRightIcon } from '../../icons';

export interface MemoryRelationshipProps {
  source: string;
  relation: string;
  target: string;
  confidence?: number;
  className?: string;
}

export const MemoryRelationship: React.FC<MemoryRelationshipProps> = ({
  source,
  relation,
  target,
  confidence,
  className = '',
}) => {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border-subtle,#27272a)] bg-[var(--color-bg-surface,#111114)] text-xs ${className}`.trim()}
    >
      <span className="font-semibold text-[var(--color-text-primary,#f4f4f5)]">{source}</span>
      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated,#18181c)] text-[var(--color-text-muted,#71717a)] flex items-center gap-1">
        {relation}
        <ChevronRightIcon size={10} />
      </span>
      <span className="font-semibold text-[var(--color-text-primary,#f4f4f5)]">{target}</span>
      {confidence !== undefined && (
        <span className="text-[10px] text-[var(--color-text-muted,#71717a)] font-mono ml-1">
          ({Math.round(confidence * 100)}%)
        </span>
      )}
    </div>
  );
};

MemoryRelationship.displayName = 'MemoryRelationship';
