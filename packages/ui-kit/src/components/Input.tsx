import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  id,
  className = '',
  ...props
}) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  const baseClasses =
    'block w-full rounded-lg border bg-surface-100 px-3 py-2 text-sm text-text shadow-sm transition-colors placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed';
  const normalClasses = 'border-border focus:border-accent focus:ring-accent/20';
  const errorClasses = 'border-error focus:border-error focus:ring-error/20';

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`${baseClasses} ${error ? errorClasses : normalClasses} ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && <p className="text-sm text-text-muted">{helperText}</p>}
    </div>
  );
};
