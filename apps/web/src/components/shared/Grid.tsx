import React from 'react';

type GridCols = 1 | 2 | 3 | 4 | 6 | 12;

interface GridProps {
  children: React.ReactNode;
  cols?: GridCols;
  gap?: number;
  className?: string;
}

const colClasses: Record<GridCols, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  12: 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-12',
};

export function Grid({ children, cols = 3, gap = 4, className = '' }: GridProps) {
  return <div className={`grid ${colClasses[cols]} gap-${gap} ${className}`}>{children}</div>;
}

type StackDirection = 'vertical' | 'horizontal';

interface StackProps {
  children: React.ReactNode;
  direction?: StackDirection;
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  className?: string;
}

export function Stack({
  children,
  direction = 'vertical',
  gap = 4,
  align = 'stretch',
  className = '',
}: StackProps) {
  const alignClasses: Record<string, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  };

  return (
    <div
      className={`flex ${direction === 'horizontal' ? 'flex-row' : 'flex-col'} gap-${gap} ${alignClasses[align]} ${className}`}
    >
      {children}
    </div>
  );
}
