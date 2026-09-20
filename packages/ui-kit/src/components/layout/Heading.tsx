import React from 'react';

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  weight?: 'medium' | 'semibold' | 'bold';
  color?: 'primary' | 'secondary' | 'muted';
  className?: string;
  children?: React.ReactNode;
}

const sizeMap = {
  sm: 'text-base font-display font-medium leading-6',
  md: 'text-lg font-display font-medium leading-7',
  lg: 'text-xl font-display font-medium leading-7',
  xl: 'text-2xl font-display font-medium leading-8 tracking-tight',
  '2xl': 'text-3xl font-display font-medium leading-9 tracking-tight',
  '3xl': 'text-4xl font-display font-medium leading-10 tracking-tight',
};

const defaultSizeByLevel: Record<number, 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'> = {
  1: '2xl',
  2: 'xl',
  3: 'lg',
  4: 'md',
  5: 'sm',
  6: 'sm',
};

const colorMap = {
  primary: 'text-text',
  secondary: 'text-text-secondary',
  muted: 'text-text-muted',
};

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level = 2, size, weight, color = 'primary', className = '', children, ...props }, ref) => {
    const Component = `h${level}` as React.ElementType;
    const computedSize = size || defaultSizeByLevel[level] || 'xl';
    const sClass = sizeMap[computedSize];
    const cClass = colorMap[color];
    const wClass = weight ? `font-${weight}` : '';

    return (
      <Component
        ref={ref}
        className={`${sClass} ${cClass} ${wClass} ${className}`.trim()}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Heading.displayName = 'Heading';
