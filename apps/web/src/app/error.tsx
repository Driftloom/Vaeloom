'use client';

import { ErrorState } from '@/components/shared/ErrorState';
import { captureError } from '@/lib/error-tracking';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  captureError(error);
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <ErrorState
        title="Something went wrong"
        message={error.message || 'An unexpected error occurred.'}
        onRetry={reset}
      />
    </main>
  );
}
