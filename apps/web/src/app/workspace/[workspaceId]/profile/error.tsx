'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/shared/ErrorState';
import { captureError } from '@/lib/error-tracking';

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-md w-full">
        <ErrorState
          title="Profile could not be loaded"
          message={
            error.message || 'An error occurred while loading your profile and memory graph.'
          }
          onRetry={reset}
        />
      </div>
    </div>
  );
}
