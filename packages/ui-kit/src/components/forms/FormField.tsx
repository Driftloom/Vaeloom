import React, { useId } from 'react';

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children:
    | React.ReactNode
    | ((props: { id: string; errorId?: string; hintId?: string }) => React.ReactNode);
  className?: string;
}

export function FormField({
  label,
  htmlFor: explicitId,
  required = false,
  hint,
  error,
  children,
  className = '',
}: FormFieldProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="block text-xs font-medium text-text">
            {label}
            {required && (
              <span className="text-error ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        </div>
      )}

      {typeof children === 'function' ? children({ id, errorId, hintId }) : children}

      {hint && !error && (
        <p id={hintId} className="text-xs text-text-dim">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="text-xs text-error font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
