'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/shared/ErrorState';
import { captureError } from '@/lib/error-tracking';

/**
 * Shared error boundary body for the memory sub-routes.
 *
 * Only `/memory` had an error boundary; `/memory/graph`, `/scale`, `/vault`,
 * `/corrections` and `/memory/[memoryId]` had none, so a throw in any of them
 * escaped to the workspace catch-all and lost the memory chrome entirely.
 */
export default function MemorySectionError({
  error,
  reset,
  route,
  title,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  route: string;
  title: string;
}) {
  useEffect(() => {
    captureError(error, { route });
  }, [error, route]);

  return (
    <div className="flex h-full items-center justify-center min-h-[60dvh] p-4">
      <div className="max-w-md w-full">
        <ErrorState
          title={title}
          message={error.message || 'Something went wrong loading this memory view.'}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
