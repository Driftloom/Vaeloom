'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { DynamicGraphViewer } from '@/lib/dynamic-imports';
import { MemoryCorrectionPanel } from '@/components/memory/MemoryCorrectionPanel';

export default function MemoryGraphPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;

  return (
    <div className="h-full">
      <DynamicGraphViewer workspaceId={workspaceId} />
      <MemoryCorrectionPanel />
    </div>
  );
}
