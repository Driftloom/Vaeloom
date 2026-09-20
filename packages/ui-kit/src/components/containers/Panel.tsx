import React from 'react';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

const variantStyles = {
  default: 'bg-[var(--color-bg-surface,#111114)] border-[var(--color-border-subtle,#27272a)]',
  elevated:
    'bg-[var(--color-bg-elevated,#18181c)] border-[var(--color-border-strong,#3f3f46)] shadow-lg',
  subtle: 'bg-[var(--color-bg-canvas,#08080a)] border-[var(--color-border-subtle,#27272a)]',
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  (
    { variant = 'default', padding = 'md', header, footer, className = '', children, ...props },
    ref,
  ) => {
    const vStyle = variantStyles[variant] || variantStyles.default;
    const pStyle = paddingStyles[padding];

    return (
      <div
        ref={ref}
        className={`rounded-lg border overflow-hidden ${vStyle} ${className}`.trim()}
        {...props}
      >
        {header && (
          <div className="border-b border-[var(--color-border-subtle,#27272a)] px-4 py-3 bg-[var(--color-bg-surface,#111114)]">
            {header}
          </div>
        )}
        <div className={pStyle}>{children}</div>
        {footer && (
          <div className="border-t border-[var(--color-border-subtle,#27272a)] px-4 py-2.5 bg-[var(--color-bg-surface,#111114)]">
            {footer}
          </div>
        )}
      </div>
    );
  },
);

Panel.displayName = 'Panel';
