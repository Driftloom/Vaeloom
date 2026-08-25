'use client';

import { ErrorState } from '@/components/shared/ErrorState';
import { captureError } from '@/lib/error-tracking';
import { useParams } from 'next/navigation';

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  captureError(error);
  const params = useParams();

  return (
    <div className="flex h-full items-center justify-center min-h-[60vh]">
      <ErrorState
        title="Workspace error"
        message={error.message || `Failed to load workspace ${params['workspaceId']}.`}
        onRetry={reset}
      />
    </div>
  );
}
