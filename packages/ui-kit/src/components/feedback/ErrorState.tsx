import React from 'react';

import { AlertCircleIcon } from '../../icons';
import { Button } from '../Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  code?: string | number;
  onRetry?: () => void;
  actionText?: string;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this section.',
  code,
  onRetry,
  actionText = 'Try Again',
  className = '',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center p-8 rounded-card border border-error/30 bg-error/5 text-center max-w-md mx-auto my-8 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center mb-4">
        <AlertCircleIcon size={24} />
      </div>
      <h3 className="text-lg font-medium text-text">{title}</h3>
      {code && <span className="font-mono text-xs text-text-dim mt-0.5">Error code: {code}</span>}
      <p className="text-sm text-text-muted mt-2 mb-6">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {actionText}
        </Button>
      )}
    </div>
  );
}
