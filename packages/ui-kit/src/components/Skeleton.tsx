import React from 'react';

export type SkeletonRounded = 'none' | 'sm' | 'md' | 'lg' | 'full';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: SkeletonRounded;
  className?: string;
}

const roundedMap: Record<SkeletonRounded, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export const Skeleton: React.FC<SkeletonProps> = ({ rounded = 'md', className = '', ...props }) => {
  const roundedClass = roundedMap[rounded] ?? roundedMap['md'];

  return (
    <div
      className={`animate-pulse bg-surface-hover/80 ${roundedClass} ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
};
