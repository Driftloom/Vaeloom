'use client';

import React from 'react';
import { Panel, Spinner, ErrorState } from '@vaeloom/ui-kit';

export interface LoadablePanelProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  label: string;
  children: React.ReactNode;
}

/**
 * Standard loading / error / content shell for document detail tabs.
 * Distinct states: loading spinner, actionable error state with retry, or children.
 */
export const LoadablePanel: React.FC<LoadablePanelProps> = ({
  loading,
  error,
  onRetry,
  label,
  children,
}) => {
  if (loading) {
    return (
      <Panel padding="md" className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </Panel>
    );
  }
  if (error) {
    return (
      <ErrorState
        title={`Failed to load ${label}`}
        message={error}
        actionText={`Retry loading ${label}`}
        onRetry={onRetry}
      />
    );
  }
  return <>{children}</>;
};
