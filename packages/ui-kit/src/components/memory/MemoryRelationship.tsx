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
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface text-xs ${className}`.trim()}
    >
      <span className="font-semibold text-text">{source}</span>
      <span className="text-2xs uppercase font-mono px-1.5 py-0.5 rounded bg-surface-200 text-text-muted flex items-center gap-1">
        {relation}
        <ChevronRightIcon size={10} />
      </span>
      <span className="font-semibold text-text">{target}</span>
      {confidence !== undefined && (
        <span className="text-2xs text-text-muted font-mono ml-1">
          ({Math.round(confidence * 100)}%)
        </span>
      )}
    </div>
  );
};

MemoryRelationship.displayName = 'MemoryRelationship';
