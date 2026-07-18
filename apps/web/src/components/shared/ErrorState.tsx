import React from 'react';

export interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-full min-h-[400px]" role="alert">
      <div className="text-accent mb-4 text-4xl">
        ⚠️
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
