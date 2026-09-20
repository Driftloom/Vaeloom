import React from 'react';

export interface ConfidenceIndicatorProps {
  score: number; // 0.0 to 1.0 or 0 to 100
  showLabel?: boolean;
  className?: string;
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  score,
  showLabel = true,
  className = '',
}) => {
  const normalized = score > 1 ? score : Math.round(score * 100);

  let statusColor = 'bg-[var(--color-status-success,#10b981)] text-emerald-400';
  let statusText = 'High confidence';

  if (normalized < 70) {
    statusColor = 'bg-[var(--color-status-danger,#ef4444)] text-red-400';
    statusText = 'Needs verification';
  } else if (normalized < 85) {
    statusColor = 'bg-[var(--color-status-warning,#f59e0b)] text-amber-400';
    statusText = 'Moderate confidence';
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`.trim()}
      title={`${statusText} (${normalized}%)`}
    >
      <div className="w-1.5 h-1.5 rounded-full overflow-hidden bg-zinc-700">
        <div className={`w-full h-full ${statusColor.split(' ')[0]}`} />
      </div>
      <span className="tabular-nums text-[var(--color-text-primary,#f4f4f5)] font-mono">
        {normalized}%
      </span>
      {showLabel && (
        <span className="text-[11px] text-[var(--color-text-muted,#71717a)]">{statusText}</span>
      )}
    </div>
  );
};

ConfidenceIndicator.displayName = 'ConfidenceIndicator';
