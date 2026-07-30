'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { DynamicChatWindow } from '@/lib/dynamic-imports';

export default function ChatPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  if (!workspaceId) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)] text-text-muted">
        Loading...
      </div>
    );
  }

  return <DynamicChatWindow workspaceId={workspaceId} />;
}
