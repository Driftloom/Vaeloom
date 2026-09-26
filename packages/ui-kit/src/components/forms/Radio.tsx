import React from 'react';

import { AlertCircleIcon } from '../../icons';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  error?: string;
  hint?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ label, error, hint, disabled, className = '', id, ...props }, ref) => {
    const generatedId = React.useId();
    const radioId = id || generatedId;
    const errorId = `${radioId}-error`;
    const hintId = `${radioId}-hint`;
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    // `error` used to be destructured and discarded, so a caller marking a radio
    // group invalid saw no styling, no aria-invalid, and no announcement.
    const describedBy = [error ? errorId : null, hint && !error ? hintId : null]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          {/* h-6 w-6 keeps the pointer target at 24px (WCAG 2.5.8 minimum). */}
          <label
            htmlFor={radioId}
            className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
          >
            <input
              ref={innerRef}
              id={radioId}
              type="radio"
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy || undefined}
              className="peer sr-only"
              {...props}
            />
            <span
              aria-hidden="true"
              className={`h-4 w-4 rounded-full border transition-colors flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-100 ${
                disabled ? 'cursor-not-allowed opacity-50' : ''
              } ${
                props.checked
                  ? 'border-action bg-action'
                  : error
                    ? 'bg-surface border-error'
                    : 'bg-surface border-border-subtle hover:border-border-strong'
              }`}
            >
              {props.checked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </span>
          </label>
          {label && (
            <label
              htmlFor={radioId}
              className={`text-sm text-text select-none leading-5 ${
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              } ${error ? 'text-error' : ''}`}
            >
              {label}
            </label>
          )}
        </div>
        {hint && !error && (
          <p id={hintId} className="mt-1 text-xs text-text-muted pl-8">
            {hint}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            role="alert"
            className="mt-1 flex items-start gap-1 text-xs text-error pl-8"
          >
            <AlertCircleIcon size={12} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  },
);

Radio.displayName = 'Radio';
