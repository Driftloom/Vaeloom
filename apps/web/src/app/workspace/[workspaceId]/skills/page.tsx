'use client';

import React, { Suspense, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

function SkillsRedirectContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = (params?.['workspaceId'] as string) || 'default-workspace';

  useEffect(() => {
    const rawParams = new URLSearchParams(searchParams?.toString() || '');
    rawParams.set('category', 'skills');
    router.replace(`/workspace/${workspaceId}/capabilities?${rawParams.toString()}`);
  }, [router, workspaceId, searchParams]);

  const targetUrl = `/workspace/${workspaceId}/capabilities?category=skills${
    searchParams?.toString() ? `&${searchParams.toString()}` : ''
  }`;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <LoadingSpinner text="Redirecting to Skills Workbench..." />
      <p className="mt-4 text-xs text-text-muted">
        Skills are unified under Capabilities.{' '}
        <Link href={targetUrl} className="text-primary hover:underline">
          Click here if not redirected automatically.
        </Link>
      </p>
    </div>
  );
}

export default function SkillsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <LoadingSpinner text="Loading Skills Workbench..." />
        </div>
      }
    >
      <SkillsRedirectContent />
    </Suspense>
  );
}
