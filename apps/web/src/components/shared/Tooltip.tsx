import React from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ content, children, side = 'top', className = '' }: TooltipProps) {
  const [visible, setVisible] = React.useState(false);
  const id = React.useId();

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {React.cloneElement(children, { 'aria-describedby': id } as React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>)}
      {visible && (
        <span
          id={id}
          role="tooltip"
          className={`absolute z-50 px-2 py-1 text-xs text-text bg-surface border border-border rounded shadow-lg whitespace-nowrap pointer-events-none ${positionClasses[side]}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
