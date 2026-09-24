'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/shared/ErrorState';
import { captureError } from '@/lib/error-tracking';

export default function HistoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { route: 'history' });
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-md w-full">
        <ErrorState
          title="Activity log error"
          message={error.message || 'Failed to retrieve immutable audit and activity history.'}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
