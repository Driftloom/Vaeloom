'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/shared/ErrorState';
import { captureError } from '@/lib/error-tracking';

export default function DocumentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { route: 'documents' });
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center min-h-[60dvh] p-4">
      <div className="max-w-md w-full">
        <ErrorState
          title="Document library error"
          message={error.message || 'Failed to list, index, or retrieve workspace documents.'}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
