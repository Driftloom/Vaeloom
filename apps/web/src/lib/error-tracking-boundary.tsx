'use client';

import React from 'react';
import { ErrorTracker } from './error-tracking';

interface ErrorTrackingBoundaryProps {
  children: React.ReactNode;
}

interface ErrorTrackingBoundaryState {
  hasError: boolean;
}

export class ErrorTrackingBoundary extends React.Component<
  ErrorTrackingBoundaryProps,
  ErrorTrackingBoundaryState
> {
  constructor(props: ErrorTrackingBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  override componentDidMount(): void {
    // W-13: surface unhandled errors/rejections through the tracker façade.
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
      ErrorTracker.captureError(reason, { kind: 'unhandledrejection' });
    });
    window.addEventListener('error', (e) => {
      if (e.error) ErrorTracker.captureError(e.error, { kind: 'window.onerror' });
    });
  }

  static getDerivedStateFromError(): ErrorTrackingBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    ErrorTracker.captureError(error, { componentStack: errorInfo.componentStack ?? '' });
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
          <h3 className="text-lg font-semibold text-surface-900">Application Error</h3>
          <p className="mt-1 text-sm text-surface-500">
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
