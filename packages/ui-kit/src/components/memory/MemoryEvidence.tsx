import React from 'react';
import { FileTextIcon } from '../../icons';

export interface MemoryEvidenceProps {
  sourceTitle: string;
  sourceUri?: string;
  extractedAt: string;
  snippet: string;
  highlight?: string;
  className?: string;
}

export const MemoryEvidence: React.FC<MemoryEvidenceProps> = ({
  sourceTitle,
  sourceUri,
  extractedAt,
  snippet,
  highlight,
  className = '',
}) => {
  return (
    <div
      className={`rounded-md border border-border-subtle bg-surface-100 p-3 text-xs ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-text-secondary font-medium">
          <FileTextIcon size={12} />
          <span>{sourceTitle}</span>
        </div>
        <span className="text-2xs text-text-muted tabular-nums">{extractedAt}</span>
      </div>

      <p className="text-text-secondary leading-relaxed italic border-l-2 border-border-strong pl-2.5">
        "{snippet}"
      </p>

      {highlight && (
        <div className="mt-2 text-xs text-accent font-mono">
          Key Extraction: <span className="underline">{highlight}</span>
        </div>
      )}
    </div>
  );
};

MemoryEvidence.displayName = 'MemoryEvidence';
