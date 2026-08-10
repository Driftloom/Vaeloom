import React from 'react';

export interface ProvenanceItem {
  label: string;
  confidence?: number;
}

export function ProvenanceBadge({ label, confidence }: ProvenanceItem) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-text-muted">
      <span aria-hidden="true">◎</span>
      {label}
      {typeof confidence === 'number' && (
        <span className="text-info-muted" title={`Confidence ${Math.round(confidence * 100)}%`}>
          {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  );
}
