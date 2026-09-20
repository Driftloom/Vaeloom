import React from 'react';

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Divider = React.forwardRef<HTMLHRElement, DividerProps>(
  ({ orientation = 'horizontal', className = '', ...props }, ref) => {
    if (orientation === 'vertical') {
      return (
        <div
          role="separator"
          aria-orientation="vertical"
          className={`inline-block w-[1px] self-stretch bg-border-subtle ${className}`.trim()}
        />
      );
    }

    return (
      <hr
        ref={ref}
        role="separator"
        aria-orientation="horizontal"
        className={`w-full border-t border-border-subtle my-4 ${className}`.trim()}
        {...props}
      />
    );
  },
);

Divider.displayName = 'Divider';
