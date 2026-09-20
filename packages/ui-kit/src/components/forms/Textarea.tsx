import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  className?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, disabled, id, className = '', ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-medium text-[var(--color-text-secondary,#a1a1aa)] mb-1.5"
          >
            {label}
            {props.required && (
              <span className="text-[var(--color-status-danger,#ef4444)] ml-1">*</span>
            )}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`w-full rounded-md border bg-[var(--color-bg-surface,#111114)] px-3 py-2 text-sm text-[var(--color-text-primary,#f4f4f5)] placeholder-[var(--color-text-muted,#71717a)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring,#3b82f6)] focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] ${
            error
              ? 'border-[var(--color-status-danger,#ef4444)]'
              : 'border-[var(--color-border-subtle,#27272a)] hover:border-[var(--color-border-strong,#3f3f46)]'
          } ${className}`.trim()}
          {...props}
        />
        {error && (
          <p
            id={errorId}
            className="mt-1 text-xs text-[var(--color-status-danger,#ef4444)]"
            role="alert"
          >
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1 text-xs text-[var(--color-text-muted,#71717a)]">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
