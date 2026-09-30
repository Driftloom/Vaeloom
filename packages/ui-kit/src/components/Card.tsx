import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  bordered?: boolean;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  bordered = true,
  hover = false,
  ...props
}) => {
  const paddings: Record<string, string> = {
    none: '',
    sm: 'p-3',
    // Responsive padding, matching the `.card` class alias in globals.css.
    // `sm:p-5` was the established behaviour across the ~77 files that use the
    // class; converging on `p-4` alone would have been a silent visual
    // regression on every desktop card.
    md: 'p-4 sm:p-5',
    lg: 'p-6',
  };

  const classes = [
    'bg-surface rounded-xl',
    bordered ? 'border border-border' : '',
    hover
      ? 'hover:bg-surface-hover hover:border-surface-300 transition-all cursor-pointer shadow-card hover:shadow-card-hover'
      : 'shadow-card',
    paddings[padding],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};
