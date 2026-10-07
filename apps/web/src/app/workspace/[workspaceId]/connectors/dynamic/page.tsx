import { redirect } from 'next/navigation';

interface DynamicConnectorsPageProps {
  params: Promise<{ workspaceId: string }> | { workspaceId: string };
}

export default async function DynamicConnectorsPage({ params }: DynamicConnectorsPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const workspaceId = resolvedParams?.workspaceId || 'default-workspace';
  redirect(`/workspace/${workspaceId}/capabilities?category=connectors`);
}
