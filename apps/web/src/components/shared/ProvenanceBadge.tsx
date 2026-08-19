import React from 'react';

export interface ProvenanceItem {
  label: string;
  confidence?: number;
}

export function ProvenanceBadge({ label, confidence }: ProvenanceItem) {
  const clampedConfidence =
    typeof confidence === 'number' ? Math.min(1, Math.max(0, confidence)) : undefined;
  const percent = clampedConfidence !== undefined ? Math.round(clampedConfidence * 100) : undefined;
  const ariaLabel =
    percent !== undefined ? `Source: ${label}, Confidence: ${percent}%` : `Source: ${label}`;

  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-text-muted"
      aria-label={ariaLabel}
    >
      <span aria-hidden="true">◎</span>
      {label}
      {percent !== undefined && (
        <span className="text-info-muted" title={`Confidence ${percent}%`}>
          {percent}%
        </span>
      )}
    </span>
  );
}
