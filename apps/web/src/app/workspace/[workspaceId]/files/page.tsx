'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function WorkspaceFilesPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  useEffect(() => {
    if (workspaceId) {
      router.replace(`/workspace/${workspaceId}/documents`);
    }
  }, [workspaceId, router]);

  return null;
}
