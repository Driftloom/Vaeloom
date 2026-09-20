import React from 'react';

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  gap?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8';
  className?: string;
  children?: React.ReactNode;
}

const colMap: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5',
  6: 'grid-cols-1 sm:grid-cols-3 lg:grid-cols-6',
  12: 'grid-cols-12',
};

const gapMap: Record<string, string> = {
  '0': 'gap-0',
  '1': 'gap-1',
  '2': 'gap-2',
  '3': 'gap-3',
  '4': 'gap-4',
  '5': 'gap-5',
  '6': 'gap-6',
  '8': 'gap-8',
};

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ columns = 1, gap = '4', className = '', children, ...props }, ref) => {
    const colClass = colMap[columns] || 'grid-cols-1';
    const gapClass = gapMap[gap] || 'gap-4';

    return (
      <div ref={ref} className={`grid ${colClass} ${gapClass} ${className}`.trim()} {...props}>
        {children}
      </div>
    );
  },
);

Grid.displayName = 'Grid';
