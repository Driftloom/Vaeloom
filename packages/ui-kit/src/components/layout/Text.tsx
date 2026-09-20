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
  primary: 'text-[var(--color-text-primary,#f4f4f5)]',
  secondary: 'text-[var(--color-text-secondary,#a1a1aa)]',
  muted: 'text-[var(--color-text-muted,#71717a)]',
  inverse: 'text-[var(--color-text-inverse,#09090b)]',
  danger: 'text-[var(--color-status-danger,#ef4444)]',
  success: 'text-[var(--color-status-success,#10b981)]',
  ai: 'text-[var(--color-ai-accent,#6366f1)]',
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
