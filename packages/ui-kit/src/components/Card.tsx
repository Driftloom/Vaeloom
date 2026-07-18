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
    md: 'p-4',
    lg: 'p-6',
  };

  const classes = [
    'bg-surface rounded-lg',
    bordered ? 'border border-border' : '',
    hover ? 'hover:bg-surface-hover hover:border-primary/50 transition-all cursor-pointer' : 'shadow-sm',
    paddings[padding],
    className,
  ].filter(Boolean).join(' ');

  return <div className={classes} {...props}>{children}</div>;
};
