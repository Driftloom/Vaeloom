import React from 'react';

export interface ConfidenceMeterProps {
  value: number; // 0..1
  label?: string;
}

/**
 * Thresholds and tones are ui-kit `ConfidenceIndicator`'s (>=0.85 success,
 * >=0.70 warning, below error). This component previously inverted the signal:
 * it had no error tier at all, so a 0.4-confidence match rendered in the calm
 * accent fill while `ConfidenceIndicator` renders the same number as an error.
 *
 * The two cannot merge today, for two reasons that are properties of the
 * components rather than of this call site:
 *
 *  1. `ConfidenceIndicator` renders `{score}%` plus a status word and takes no
 *     children, so there is no slot for the `"{label}: {pct}%"` text this
 *     component's contract produces (asserted directly by `ApprovalCard.spec.tsx`).
 *  2. The affordances differ on purpose — a continuous bar with a numeric
 *     percentage is a quantitative read, a 6px dot plus "Needs verification" is
 *     qualitative triage. Collapsing them would force one job to lose its signal.
 *
 * Consolidating the scale (rather than the component) is what removes the
 * divergence: one definition of what a confidence number means.
 */
function meterTone(value: number): string {
  if (value >= 0.85) return 'bg-success';
  if (value >= 0.7) return 'bg-warning';
  return 'bg-error';
}

export function ConfidenceMeter({ value, label = 'Confidence' }: ConfidenceMeterProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-hover"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${percent}%`}
      >
        <div
          className={`h-full rounded-full ${meterTone(clamped)}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="font-mono text-xs text-text-muted">
        {label}: {percent}%
      </span>
    </div>
  );
}
