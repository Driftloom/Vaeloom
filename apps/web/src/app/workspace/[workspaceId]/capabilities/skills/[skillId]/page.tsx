'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { Breadcrumb, Button, EmptyState } from '@vaeloom/ui-kit';
import { SEED_CAPABILITIES } from '@/lib/capabilities-data';
import { capabilitiesApi } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { PageHeader } from '@/components/shared/Page';
import { SkillDetailPane } from '@/components/capabilities/skills/SkillDetailPane';
import { SkillPlaygroundDrawer } from '@/components/capabilities/skills/SkillPlaygroundDrawer';
import { isSkill, mergeSkillRows } from '@/components/capabilities/skills/skill-row-helpers';
import type { SkillRow, SkillSaveOutcome } from '@/components/capabilities/skills/SkillCard';

export default function SkillSubpage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const workspaceId = (params?.['workspaceId'] as string) || 'default-workspace';
  const skillId = (params?.['skillId'] as string) || '';

  const [playgroundOpen, setPlaygroundOpen] = useState(false);

  const {
    data: serverSkills,
    isLoading,
    mutate: mutateSkills,
  } = useSWR(
    workspaceId ? ['workspace-skills', workspaceId] : null,
    () => capabilitiesApi.listSkills(workspaceId),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const seedSkills = useMemo(() => SEED_CAPABILITIES.filter(isSkill), []);
  const allSkills = useMemo(
    () => mergeSkillRows(seedSkills, serverSkills ?? []),
    [seedSkills, serverSkills],
  );

  const decodedSkillId = decodeURIComponent(skillId);
  const selectedRow = useMemo<SkillRow | null>(() => {
    if (!decodedSkillId) return null;
    return (
      allSkills.find(
        (row) =>
          row.key === decodedSkillId ||
          row.item.id === decodedSkillId ||
          row.slug === decodedSkillId ||
          row.item.name === decodedSkillId ||
          row.item.name.toLowerCase() === decodedSkillId.toLowerCase(),
      ) ?? null
    );
  }, [allSkills, decodedSkillId]);

  const handleToggleEnabled = useCallback(
    async (key: string, next: boolean) => {
      if (!selectedRow || !selectedRow.serverBacked || selectedRow.item.id === null) {
        toast({
          tone: 'warning',
          title: `Cannot ${next ? 'enable' : 'disable'} skill`,
          detail: 'This skill is not registered in the workspace. Install it first.',
        });
        return;
      }
      try {
        await capabilitiesApi.update(selectedRow.item.id, { enabled: next });
        void mutateSkills();
        toast({
          tone: next ? 'success' : 'warning',
          title: `${next ? 'Enabled' : 'Disabled'} ${selectedRow.item.name}`,
          detail: 'Saved to the workspace capability row.',
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: `Could not ${next ? 'enable' : 'disable'} ${selectedRow.item.name}`,
          detail: err instanceof Error ? err.message : 'The workspace was not changed.',
        });
      }
    },
    [selectedRow, mutateSkills, toast],
  );

  const handleInstall = useCallback(
    async (_key: string) => {
      if (!selectedRow) return;
      try {
        const created = await capabilitiesApi.create({
          name: selectedRow.item.name,
          category: 'skill',
          description: selectedRow.item.description,
          version: selectedRow.item.version ?? '1.0.0',
          author: selectedRow.item.author ?? 'Catalog',
          type: selectedRow.item.source,
          config: {
            doc: selectedRow.item.markdownDoc,
            tags: selectedRow.item.tags,
            autonomy: selectedRow.item.autonomy,
            ...(selectedRow.item.requiredScope
              ? { required_scope: selectedRow.item.requiredScope }
              : {}),
          },
        });
        void mutateSkills();
        toast({
          tone: 'success',
          title: `Installed ${selectedRow.item.name}`,
          detail: `Registered in this workspace as ${created.id}.`,
        });
      } catch (err) {
        toast({
          tone: 'error',
          title: `Could not install ${selectedRow.item.name}`,
          detail: err instanceof Error ? err.message : 'The workspace was not changed.',
        });
      }
    },
    [selectedRow, mutateSkills, toast],
  );

  const handleSaveDoc = useCallback(
    async (_key: string, doc: string): Promise<SkillSaveOutcome> => {
      if (!selectedRow) return 'failed';
      if (!selectedRow.serverBacked || selectedRow.item.id === null) {
        toast({
          tone: 'error',
          title: `Could not save instructions for ${selectedRow.item.name}`,
          detail:
            'This skill is not registered in the workspace. Install it first to customize instructions.',
        });
        return 'failed';
      }
      try {
        await capabilitiesApi.update(selectedRow.item.id, { config: { doc } });
        void mutateSkills();
        toast({
          tone: 'success',
          title: `Saved instructions for ${selectedRow.item.name}`,
          detail: 'Written to the workspace capability row.',
        });
        return 'server';
      } catch (err) {
        toast({
          tone: 'error',
          title: `Could not save ${selectedRow.item.name}`,
          detail: err instanceof Error ? err.message : 'The workspace was not changed.',
        });
        return 'failed';
      }
    },
    [selectedRow, mutateSkills, toast],
  );

  const handleDeleteRequest = useCallback(
    async (_row: SkillRow) => {
      if (!selectedRow || !selectedRow.serverBacked || selectedRow.item.id === null) {
        toast({
          tone: 'warning',
          title: 'Cannot delete skill',
          detail: 'The skill has no workspace capability row to delete.',
        });
        return;
      }
      try {
        await capabilitiesApi.delete(selectedRow.item.id);
        void mutateSkills();
        toast({
          tone: 'info',
          title: 'Skill deleted',
          detail: 'Removed from this workspace.',
        });
        router.push(`/workspace/${workspaceId}/capabilities?category=skills`);
      } catch (err) {
        toast({
          tone: 'error',
          title: 'Delete failed',
          detail: err instanceof Error ? err.message : 'The capability was not deleted.',
        });
      }
    },
    [selectedRow, mutateSkills, router, toast, workspaceId],
  );

  const handleCopyDoc = useCallback(
    (_key: string) => {
      if (!selectedRow?.item.markdownDoc) {
        toast({
          tone: 'warning',
          title: `Nothing to copy for ${selectedRow?.item.name ?? 'skill'}`,
          detail: 'No markdown instructions available for this skill.',
        });
        return;
      }
      navigator.clipboard
        ?.writeText(selectedRow.item.markdownDoc)
        .then(() =>
          toast({
            tone: 'info',
            title: `Copied instructions for ${selectedRow.item.name}`,
          }),
        )
        .catch(() =>
          toast({
            tone: 'error',
            title: 'Copy failed',
            detail: 'Clipboard access was blocked.',
          }),
        );
    },
    [selectedRow, toast],
  );

  const breadcrumbsBackUrl = `/workspace/${workspaceId}/capabilities?category=skills&skill=${encodeURIComponent(
    decodedSkillId,
  )}`;

  const breadcrumbItems = [
    { label: 'Capabilities', href: `/workspace/${workspaceId}/capabilities` },
    { label: 'Skills', href: breadcrumbsBackUrl },
    { label: selectedRow?.item.name ?? decodedSkillId, current: true },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 bg-background text-text antialiased overflow-hidden">
      <div className="shrink-0 px-4 sm:px-6 pt-4 border-b border-border-subtle bg-surface">
        <PageHeader
          title={selectedRow?.item.name ?? decodedSkillId}
          description={
            selectedRow?.item.description ||
            'Inspect, test, and manage execution contracts for this workspace skill.'
          }
          eyebrow="Capability Skill"
          breadcrumb={<Breadcrumb items={breadcrumbItems} />}
          actions={
            <div className="flex items-center gap-2">
              <Link href={breadcrumbsBackUrl}>
                <Button variant="secondary" size="sm">
                  Back to Skills
                </Button>
              </Link>
              {selectedRow && (
                <Button variant="primary" size="sm" onClick={() => setPlaygroundOpen(true)}>
                  Open Playground
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto">
        {!isLoading && !selectedRow ? (
          <div className="p-8 max-w-xl mx-auto">
            <EmptyState
              title={`Skill "${decodedSkillId}" not found`}
              description="This skill may not be installed or exists under another name in this workspace."
              action={{
                label: 'View all Skills',
                onClick: () =>
                  router.push(`/workspace/${workspaceId}/capabilities?category=skills`),
              }}
            />
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <SkillDetailPane
              selectedRow={selectedRow}
              isLoading={isLoading}
              onCloseMobileDetail={() => router.push(breadcrumbsBackUrl)}
              onOpenCreate={() =>
                router.push(`/workspace/${workspaceId}/capabilities?category=skills`)
              }
              onToggleEnabled={(key, next) => void handleToggleEnabled(key, next)}
              onInstall={(key) => void handleInstall(key)}
              onDeleteRequest={(row) => void handleDeleteRequest(row)}
              onCopyDoc={handleCopyDoc}
              onSaveDoc={handleSaveDoc}
              onOpenPlayground={() => setPlaygroundOpen(true)}
              workspaceId={workspaceId}
            />
          </div>
        )}
      </div>

      {selectedRow && (
        <SkillPlaygroundDrawer
          isOpen={playgroundOpen}
          onClose={() => setPlaygroundOpen(false)}
          selectedSkill={selectedRow}
          workspaceId={workspaceId}
          onInstall={(key) => void handleInstall(key)}
        />
      )}
    </div>
  );
}
