import React from 'react';

export interface ProgressProps {
  value: number; // 0 - 100
  max?: number;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'success' | 'ai';
  className?: string;
}

const heightMap = {
  sm: 'h-1.5',
  md: 'h-2.5',
};

const variantMap = {
  primary: 'bg-action',
  success: 'bg-success',
  ai: 'bg-accent',
};

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  label,
  showValue = false,
  size = 'md',
  variant = 'primary',
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const hClass = heightMap[size] || heightMap.md;
  const vClass = variantMap[variant] || variantMap.primary;

  return (
    <div className={`w-full ${className}`.trim()}>
      {(label || showValue) && (
        <div className="flex justify-between items-center text-xs text-text-secondary mb-1">
          {label && <span>{label}</span>}
          {showValue && <span className="tabular-nums">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
        className={`w-full bg-surface-200 rounded-full overflow-hidden border border-border-subtle ${hClass}`}
      >
        <div
          className={`${vClass} h-full transition-all duration-300 ease-out rounded-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

Progress.displayName = 'Progress';
