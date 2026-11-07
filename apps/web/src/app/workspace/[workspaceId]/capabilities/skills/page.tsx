import { redirect } from 'next/navigation';

/**
 * The skills index is an alias, not a surface: the canonical list lives on the
 * capabilities workbench with the skills category pre-selected. Redirect on the
 * server so there is no flash of an empty client shell, mirroring
 * `connectors/dynamic/page.tsx`.
 */
interface SkillsIndexPageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function SkillsIndexPage({ params }: SkillsIndexPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const workspaceId = resolvedParams?.workspaceId || 'default-workspace';
  redirect(`/workspace/${workspaceId}/capabilities?category=skills`);
}
