import React from 'react';

export interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  as?: React.ElementType;
  size?: 'xs' | 'sm' | 'base' | 'md' | 'lg';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'primary' | 'secondary' | 'muted' | 'inverse' | 'danger' | 'success' | 'ai';
  tabular?: boolean;
  truncate?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const sizeMap = {
  xs: 'text-xs leading-4',
  sm: 'text-sm leading-5',
  base: 'text-base leading-6',
  md: 'text-base leading-6',
  lg: 'text-lg leading-7',
};

const weightMap = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const colorMap = {
  primary: 'text-text',
  secondary: 'text-text-secondary',
  muted: 'text-text-muted',
  inverse: 'text-background',
  danger: 'text-error',
  success: 'text-success',
  ai: 'text-accent',
};

export const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  (
    {
      as: Component = 'p',
      size = 'sm',
      weight = 'normal',
      color = 'primary',
      tabular = false,
      truncate = false,
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    const sClass = sizeMap[size] || sizeMap.sm;
    const wClass = weightMap[weight] || weightMap.normal;
    const cClass = colorMap[color] || colorMap.primary;
    const numClass = tabular ? 'tabular-nums' : '';
    const truncClass = truncate ? 'truncate' : '';

    return (
      <Component
        ref={ref}
        className={`${sClass} ${wClass} ${cClass} ${numClass} ${truncClass} ${className}`.trim()}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Text.displayName = 'Text';
