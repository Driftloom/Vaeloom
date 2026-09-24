'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spinner } from '@vaeloom/ui-kit';

export default function DocumentsRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';

  useEffect(() => {
    if (workspaceId) {
      router.replace(`/workspace/${workspaceId}/files`);
    }
  }, [workspaceId, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
      <Spinner size="lg" />
      <span className="text-xs text-text-secondary">Redirecting to Documents & Files...</span>
    </div>
  );
}
