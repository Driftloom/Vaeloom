'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { DynamicGraphViewer } from '@/lib/dynamic-imports';

export default function MemoryGraphPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;

  return <DynamicGraphViewer workspaceId={workspaceId} />;
}
