import React from 'react';
import {
  ErrorState as UiKitErrorState,
  type ErrorStateProps as UiKitErrorStateProps,
} from '@vaeloom/ui-kit';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  code?: string | number;
  onRetry?: () => void;
  actionText?: string;
  className?: string;
}

export function ErrorState(props: ErrorStateProps) {
  return <UiKitErrorState {...props} />;
}
