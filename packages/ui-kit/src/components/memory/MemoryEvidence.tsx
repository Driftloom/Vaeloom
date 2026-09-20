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
      className={`rounded-md border border-[var(--color-border-subtle,#27272a)] bg-[var(--color-bg-canvas,#08080a)] p-3 text-xs ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[var(--color-text-secondary,#a1a1aa)] font-medium">
          <FileTextIcon size={12} />
          <span>{sourceTitle}</span>
        </div>
        <span className="text-[10px] text-[var(--color-text-muted,#71717a)] tabular-nums">
          {extractedAt}
        </span>
      </div>

      <p className="text-[var(--color-text-secondary,#a1a1aa)] leading-relaxed italic border-l-2 border-[var(--color-border-strong,#3f3f46)] pl-2.5">
        "{snippet}"
      </p>

      {highlight && (
        <div className="mt-2 text-[11px] text-[var(--color-ai-accent,#6366f1)] font-mono">
          Key Extraction: <span className="underline">{highlight}</span>
        </div>
      )}
    </div>
  );
};

MemoryEvidence.displayName = 'MemoryEvidence';
