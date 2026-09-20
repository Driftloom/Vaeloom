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

  let statusColor = 'bg-success text-success';
  let statusText = 'High confidence';

  if (normalized < 70) {
    statusColor = 'bg-error text-error';
    statusText = 'Needs verification';
  } else if (normalized < 85) {
    statusColor = 'bg-warning text-warning';
    statusText = 'Moderate confidence';
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`.trim()}
      title={`${statusText} (${normalized}%)`}
    >
      <div className="w-1.5 h-1.5 rounded-full overflow-hidden bg-surface-300">
        <div className={`w-full h-full ${statusColor.split(' ')[0]}`} />
      </div>
      <span className="tabular-nums text-text font-mono">{normalized}%</span>
      {showLabel && <span className="text-xs text-text-muted">{statusText}</span>}
    </div>
  );
};

ConfidenceIndicator.displayName = 'ConfidenceIndicator';
