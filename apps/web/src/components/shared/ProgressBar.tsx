import React from 'react';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  color?: 'primary' | 'accent' | 'success' | 'warning';
  showValue?: boolean;
  className?: string;
}

const colorStyles: Record<string, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
};

export function ProgressBar({ value, max, label, color = 'primary', showValue = true, className = '' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;

  return (
    <div className={`space-y-1 ${className}`}>
      {(label || showValue) && (
        <div className="flex justify-between text-sm">
          {label && <span className="text-text-muted">{label}</span>}
          {showValue && <span className="font-mono text-text-muted">{pct}%</span>}
        </div>
      )}
      <div className="h-2 bg-surface-active rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorStyles[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
