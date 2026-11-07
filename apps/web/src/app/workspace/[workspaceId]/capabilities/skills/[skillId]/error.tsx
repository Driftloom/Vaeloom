'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/shared/ErrorState';
import { captureError } from '@/lib/error-tracking';

/**
 * Route error boundary. This catches render-time crashes only — SWR fetch
 * failures are handled in the page itself, where the last-known row can still
 * be shown with an offline-fallback notice.
 */
export default function SkillDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { route: 'capabilities/skills' });
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center min-h-[60dvh] p-4">
      <div className="max-w-md w-full">
        <ErrorState
          title="Skill page error"
          message={error.message || 'Unable to render this skill page.'}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
