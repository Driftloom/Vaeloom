import React from 'react';

export interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px]"
      role="alert"
    >
      <div className="text-accent mb-4 flex items-center justify-center">
        <svg
          className="w-12 h-12 text-error"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-display font-medium mb-2 text-accent">{title}</h2>
      <p className="text-text-muted max-w-sm mb-6">{message}</p>
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}
