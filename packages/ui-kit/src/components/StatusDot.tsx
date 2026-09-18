import React from 'react';

export type StatusDotType = 'active' | 'idle' | 'warning' | 'error' | 'disabled';
export type StatusDotSize = 'sm' | 'md' | 'lg';

export interface StatusDotProps {
  status?: StatusDotType;
  pulse?: boolean;
  size?: StatusDotSize;
  label?: string;
  className?: string;
}

const sizeMap: Record<StatusDotSize, string> = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
};

const colorMap: Record<StatusDotType, string> = {
  active: 'bg-success',
  idle: 'bg-primary',
  warning: 'bg-warning',
  error: 'bg-error',
  disabled: 'bg-text-dim',
};

const pingColorMap: Record<StatusDotType, string> = {
  active: 'bg-success/60',
  idle: 'bg-primary/60',
  warning: 'bg-warning/60',
  error: 'bg-error/60',
  disabled: 'bg-text-dim/40',
};

export const StatusDot: React.FC<StatusDotProps> = ({
  status = 'idle',
  pulse = false,
  size = 'md',
  label,
  className = '',
}) => {
  const dotSize = sizeMap[size] ?? sizeMap['md'];
  const dotColor = colorMap[status] ?? colorMap['idle'];
  const pingColor = pingColorMap[status] ?? pingColorMap['idle'];

  return (
    <span className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {pulse && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full animate-ping opacity-75 ${pingColor}`}
          aria-hidden="true"
        />
      )}
      <span className={`relative inline-flex rounded-full ${dotSize} ${dotColor}`} />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
};
