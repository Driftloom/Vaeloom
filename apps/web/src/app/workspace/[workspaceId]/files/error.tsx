'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/shared/ErrorState';
import { captureError } from '@/lib/error-tracking';

export default function FilesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { route: 'files' });
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-md w-full">
        <ErrorState
          title="Document library error"
          message={error.message || 'Failed to index or retrieve workspace documents.'}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
