import React from 'react';
import {
  EmptyState as UiKitEmptyState,
  EmptyStateProps as UiKitEmptyStateProps,
} from '@vaeloom/ui-kit';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState(props: EmptyStateProps) {
  return <UiKitEmptyState {...props} />;
}
