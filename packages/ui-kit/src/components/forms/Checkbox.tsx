'use client';

import React from 'react';

import { CheckIcon, AlertCircleIcon } from '../../icons';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
  error?: string;
  hint?: string;
  indeterminate?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, hint, indeterminate, disabled, className = '', id, ...props }, ref) => {
    const generatedId = React.useId();
    const checkboxId = id || generatedId;
    const errorId = `${checkboxId}-error`;
    const hintId = `${checkboxId}-hint`;
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = !!indeterminate;
      }
    }, [indeterminate]);

    // The control is the single source of truth for validity. `error` used to be
    // accepted and silently discarded, so a caller marking a checkbox invalid saw
    // no error styling, no aria-invalid, and no announcement.
    const describedBy = [error ? errorId : null, hint && !error ? hintId : null]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={className}>
        <div className="flex items-start gap-2">
          {/* h-6 w-6 keeps the pointer target at 24px (WCAG 2.5.8 minimum); the
              visible 16px box is centred inside it. */}
          <label
            htmlFor={checkboxId}
            className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded ${
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
          >
            <input
              ref={innerRef}
              id={checkboxId}
              type="checkbox"
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy || undefined}
              className="peer sr-only"
              {...props}
            />
            <span
              aria-hidden="true"
              className={`h-4 w-4 rounded border transition-colors flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-100 ${
                disabled ? 'cursor-not-allowed opacity-50' : ''
              } ${
                props.checked || indeterminate
                  ? 'bg-action border-transparent text-white'
                  : error
                    ? 'bg-surface border-error'
                    : 'bg-surface border-border-subtle hover:border-border-strong'
              }`}
            >
              {props.checked && !indeterminate && <CheckIcon size={12} strokeWidth={3} />}
              {indeterminate && <div className="w-2 h-0.5 bg-white rounded-sm" />}
            </span>
          </label>
          {label && (
            <label
              htmlFor={checkboxId}
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

Checkbox.displayName = 'Checkbox';
