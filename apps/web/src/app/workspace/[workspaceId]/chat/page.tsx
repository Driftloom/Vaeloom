'use client';

import { useParams } from 'next/navigation';
import { DynamicChatWindow } from '@/lib/dynamic-imports';

export default function ChatPage() {
  const params = useParams();
  // `workspaceId` is a statically declared segment in the route tree, so useParams()
  // always yields it. The old `if (!workspaceId)` fallback was unreachable, and the
  // bare "Loading..." string it rendered had no live region for screen readers.
  const workspaceId = params['workspaceId'] as string;

  // DynamicChatWindow stays dynamic: the ChatWindow chunk (agent catalog, executor,
  // resume pipeline, markdown rendering) is far too large for the chat route's
  // critical path.
  return <DynamicChatWindow workspaceId={workspaceId} />;
}
