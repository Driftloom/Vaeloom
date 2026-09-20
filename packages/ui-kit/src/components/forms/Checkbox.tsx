import React from 'react';
import { CheckIcon } from '../../icons';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  error?: string;
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, indeterminate, disabled, className = '', id, ...props }, ref) => {
    const generatedId = React.useId();
    const checkboxId = id || generatedId;
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = !!indeterminate;
      }
    }, [indeterminate]);

    return (
      <div className="flex items-start gap-2">
        <div className="relative flex items-center h-5">
          <input
            ref={innerRef}
            id={checkboxId}
            type="checkbox"
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <div
            className={`h-4 w-4 rounded border transition-colors flex items-center justify-center cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-100 ${
              disabled ? 'cursor-not-allowed opacity-50' : ''
            } ${
              props.checked || indeterminate
                ? 'bg-action border-transparent text-white'
                : 'bg-surface border-border-subtle hover:border-border-strong'
            }`}
            onClick={() => innerRef.current?.click()}
          >
            {props.checked && !indeterminate && <CheckIcon size={12} strokeWidth={3} />}
            {indeterminate && <div className="w-2 h-0.5 bg-white rounded-sm" />}
          </div>
        </div>
        {label && (
          <label
            htmlFor={checkboxId}
            className={`text-sm text-text select-none cursor-pointer ${
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

Checkbox.displayName = 'Checkbox';
