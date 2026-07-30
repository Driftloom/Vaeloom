'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { DynamicResumeBuilder } from '@/lib/dynamic-imports';

export default function ResumePage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        Loading...
      </div>
    );
  }

  return <DynamicResumeBuilder workspaceId={workspaceId} />;
}
