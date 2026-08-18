import React from 'react';

export interface ConfidenceMeterProps {
  value: number; // 0..1
  label?: string;
}

function meterTone(value: number): string {
  if (value >= 0.8) return 'bg-success';
  if (value >= 0.5) return 'bg-warning';
  return 'bg-accent';
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
      <span className="font-mono text-[11px] text-text-muted">
        {label}: {percent}%
      </span>
    </div>
  );
}
