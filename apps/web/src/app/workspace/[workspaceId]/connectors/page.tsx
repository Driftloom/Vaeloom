'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

interface ConnectorsPageProps {
  params?: Promise<{ workspaceId: string }> | { workspaceId: string };
}

export default function ConnectorsPage(_props?: ConnectorsPageProps) {
  const routeParams = useParams();
  const router = useRouter();
  const workspaceId = (routeParams?.['workspaceId'] as string) || 'default-workspace';
  const targetUrl = `/workspace/${workspaceId}/capabilities?category=connectors`;

  useEffect(() => {
    router.replace(targetUrl);
  }, [router, targetUrl]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
      <h2 className="text-base font-semibold text-text mb-2">
        Connectors are now unified under Capabilities
      </h2>
      <p className="text-sm text-text-muted mb-4">
        Redirecting you to the unified capabilities matrix...
      </p>
      <Link href={targetUrl} className="text-sm text-action hover:underline font-medium">
        Click here if you are not redirected automatically
      </Link>
    </div>
  );
}
