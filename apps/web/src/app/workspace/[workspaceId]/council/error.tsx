'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/shared/ErrorState';
import { captureError } from '@/lib/error-tracking';

export default function CouncilError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { route: 'council' });
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-md w-full">
        <ErrorState
          title="Council deliberation error"
          message={
            error.message || 'Failed to convene agent council deliberation or retrieve transcripts.'
          }
          onRetry={reset}
        />
      </div>
    </div>
  );
}
