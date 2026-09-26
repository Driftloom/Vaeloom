import { redirect } from 'next/navigation';

export default async function DocumentsRedirectPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const resolved = await params;
  redirect(`/workspace/${resolved.workspaceId}/files`);
}
