import React from 'react';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  error?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ label, error, disabled, className = '', id, ...props }, ref) => {
    const generatedId = React.useId();
    const radioId = id || generatedId;
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    return (
      <div className="flex items-center gap-2">
        <div className="relative flex items-center h-5">
          <input
            ref={innerRef}
            id={radioId}
            type="radio"
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <div
            className={`h-4 w-4 rounded-full border transition-colors flex items-center justify-center cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-focus-ring,#3b82f6)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--color-bg-canvas,#08080a)] ${
              disabled ? 'cursor-not-allowed opacity-50' : ''
            } ${
              props.checked
                ? 'border-[var(--color-action-primary,#3b82f6)] bg-[var(--color-action-primary,#3b82f6)]'
                : 'bg-[var(--color-bg-surface,#111114)] border-[var(--color-border-subtle,#27272a)] hover:border-[var(--color-border-strong,#3f3f46)]'
            }`}
            onClick={() => innerRef.current?.click()}
          >
            {props.checked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
          </div>
        </div>
        {label && (
          <label
            htmlFor={radioId}
            className={`text-sm text-[var(--color-text-primary,#f4f4f5)] select-none cursor-pointer ${
              disabled ? 'cursor-not-allowed opacity-50' : ''
            }`}
          >
            {label}
          </label>
        )}
      </div>
    );
  },
);

Radio.displayName = 'Radio';
