'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function FileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const documentId = params?.['documentId'] as string | undefined;

  useEffect(() => {
    if (workspaceId && documentId) {
      router.replace(`/workspace/${workspaceId}/documents/${documentId}`);
    }
  }, [workspaceId, documentId, router]);

  return null;
}
