'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function ConnectorsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = (params?.['workspaceId'] as string) || 'default-workspace';

  useEffect(() => {
    router.replace(`/workspace/${workspaceId}/capabilities?category=connectors`);
  }, [router, workspaceId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <LoadingSpinner text="Redirecting to Connectors Directory..." />
      <p className="mt-4 text-xs text-[#71717a]">
        Connectors are now unified under Capabilities.{' '}
        <Link
          href={`/workspace/${workspaceId}/capabilities?category=connectors`}
          className="text-[#3b82f6] hover:underline"
        >
          Click here if not redirected automatically.
        </Link>
      </p>
    </div>
  );
}
