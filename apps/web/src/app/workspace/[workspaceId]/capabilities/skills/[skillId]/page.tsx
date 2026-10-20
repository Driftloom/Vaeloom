'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Button, EmptyState } from '@vaeloom/ui-kit';
import { SEED_CAPABILITIES } from '@/lib/capabilities-data';
import { capabilitiesApi } from '@/lib/api-client';
import { ErrorState } from '@/components/shared/ErrorState';
import { CapabilityDetailLayout } from '@/components/capabilities/CapabilityDetailLayout';
import { SkillDetailPane } from '@/components/capabilities/skills/SkillDetailPane';
import { SkillPlaygroundDrawer } from '@/components/capabilities/skills/SkillPlaygroundDrawer';
import { CapabilitySubpageSkeleton } from '@/components/capabilities/CapabilitySubpageSkeleton';
import { isSkill, mergeSkillRows } from '@/components/capabilities/skills/skill-row-helpers';
import { useSkillActions } from '@/components/capabilities/skills/useSkillActions';
import type { SkillRow } from '@/components/capabilities/skills/SkillCard';

export default function SkillSubpage() {
  const params = useParams();
  const router = useRouter();

  const workspaceId = (params?.['workspaceId'] as string) || 'default-workspace';
  const skillId = (params?.['skillId'] as string) || '';

  const [playgroundOpen, setPlaygroundOpen] = useState(false);

  const {
    data: serverSkills,
    error: skillsError,
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

  const resolveRow = useCallback(() => selectedRow ?? undefined, [selectedRow]);

  const handleDeleted = useCallback(() => {
    router.push(`/workspace/${workspaceId}/capabilities?category=skills`);
  }, [router, workspaceId]);

  const {
    pendingKey,
    toggleEnabled: handleToggleEnabled,
    install: handleInstall,
    saveDoc: handleSaveDoc,
    copyDoc: handleCopyDoc,
    deleteSkill,
  } = useSkillActions({
    resolveRow,
    mutateSkills,
    onDeleted: handleDeleted,
  });

  const handleDeleteRequest = useCallback(
    (row: SkillRow) => {
      void deleteSkill(row.key);
    },
    [deleteSkill],
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
    <CapabilityDetailLayout
      eyebrow="Capability Skill"
      title={selectedRow?.item.name ?? decodedSkillId}
      description={
        selectedRow?.item.description ||
        'Inspect, test, and manage execution contracts for this workspace skill.'
      }
      backHref={breadcrumbsBackUrl}
      backLabel="Back to Skills"
      breadcrumbs={breadcrumbItems}
      showRail={false}
    >
      {selectedRow && (
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setPlaygroundOpen(true)}>
            Open Playground
          </Button>
        </div>
      )}

      {skillsError && selectedRow && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 border border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning rounded-lg"
        >
          <span>
            The workspace skill list could not be loaded, so this page is showing offline fallback
            data.
          </span>
          <Button variant="secondary" size="sm" onClick={() => void mutateSkills()}>
            Retry
          </Button>
        </div>
      )}

      {isLoading && !selectedRow ? (
        <CapabilitySubpageSkeleton eyebrow="Capability Skill" />
      ) : skillsError && !selectedRow ? (
        <div className="p-8 max-w-xl mx-auto">
          <ErrorState
            title="Couldn't load this skill"
            message={
              (skillsError as Error).message ||
              'The skill list could not be loaded. Check your connection and try again.'
            }
            onRetry={() => void mutateSkills()}
          />
        </div>
      ) : !selectedRow ? (
        <div className="p-8 max-w-xl mx-auto">
          <EmptyState
            title={`Skill "${decodedSkillId}" not found`}
            description="This skill may not be installed or exists under another name in this workspace."
            action={{
              label: 'View all Skills',
              onClick: () => router.push(`/workspace/${workspaceId}/capabilities?category=skills`),
            }}
          />
        </div>
      ) : (
        <div className="h-full flex flex-col">
          <SkillDetailPane
            selectedRow={selectedRow}
            isLoading={isLoading}
            isPending={pendingKey !== null && pendingKey === selectedRow.key}
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

      {selectedRow && (
        <SkillPlaygroundDrawer
          isOpen={playgroundOpen}
          onClose={() => setPlaygroundOpen(false)}
          selectedSkill={selectedRow}
          workspaceId={workspaceId}
          onInstall={(key) => void handleInstall(key)}
        />
      )}
    </CapabilityDetailLayout>
  );
}
