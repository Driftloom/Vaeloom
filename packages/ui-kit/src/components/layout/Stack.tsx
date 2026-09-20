import React from 'react';

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'col';
  gap?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12';
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const gapMap: Record<string, string> = {
  '0': 'gap-0',
  '1': 'gap-1',
  '2': 'gap-2',
  '3': 'gap-3',
  '4': 'gap-4',
  '5': 'gap-5',
  '6': 'gap-6',
  '8': 'gap-8',
  '10': 'gap-10',
  '12': 'gap-12',
};

const alignMap = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const justifyMap = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      direction = 'col',
      gap = '4',
      align = 'stretch',
      justify = 'start',
      wrap = false,
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    const dirClass = direction === 'row' ? 'flex flex-row' : 'flex flex-col';
    const gapClass = gapMap[gap] || 'gap-4';
    const alignClass = alignMap[align] || '';
    const justifyClass = justifyMap[justify] || '';
    const wrapClass = wrap ? 'flex-wrap' : 'flex-nowrap';

    return (
      <div
        ref={ref}
        className={`${dirClass} ${gapClass} ${alignClass} ${justifyClass} ${wrapClass} ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Stack.displayName = 'Stack';
