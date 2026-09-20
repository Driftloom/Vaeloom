import React from 'react';

export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  attached?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ attached = false, className = '', children, ...props }, ref) => {
    if (attached) {
      return (
        <div
          ref={ref}
          role="group"
          className={`inline-flex rounded-md shadow-sm [&>button]:rounded-none [&>button:first-child]:rounded-l-md [&>button:last-child]:rounded-r-md [&>button:not(:first-child)]:-ml-[1px] ${className}`.trim()}
          {...props}
        >
          {children}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        role="group"
        className={`inline-flex items-center gap-2 ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  },
);

ButtonGroup.displayName = 'ButtonGroup';
