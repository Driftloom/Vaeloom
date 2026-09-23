'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/shared/ErrorState';
import { captureError } from '@/lib/error-tracking';

export default function CognitionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { route: 'cognition' });
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-md w-full">
        <ErrorState
          title="Cognition pipeline error"
          message={
            error.message || 'Unable to monitor cognitive telemetry or dispatch decision loops.'
          }
          onRetry={reset}
        />
      </div>
    </div>
  );
}
