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
  default: 'bg-surface border-border-subtle',
  elevated: 'bg-surface-200 border-border-strong shadow-lg',
  subtle: 'bg-surface-100 border-border-subtle',
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
          <div className="border-b border-border-subtle px-4 py-3 bg-surface">{header}</div>
        )}
        <div className={pStyle}>{children}</div>
        {footer && (
          <div className="border-t border-border-subtle px-4 py-2.5 bg-surface">{footer}</div>
        )}
      </div>
    );
  },
);

Panel.displayName = 'Panel';
