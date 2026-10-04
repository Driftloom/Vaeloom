'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, ConfirmationDialog, EmptyState, Skeleton } from '@vaeloom/ui-kit';
import type { CapabilityItem } from '@/lib/capabilities-data';
import { SkillCard, type SkillRow, type SkillSaveOutcome } from './skills/SkillCard';
import { SkillDetailPane } from './skills/SkillDetailPane';
import { SkillFilterBar, type SkillCategoryFilter } from './skills/SkillFilterBar';
import { SkillPlaygroundDrawer } from './skills/SkillPlaygroundDrawer';
import { TriggerSimulatorModal } from './skills/TriggerSimulatorModal';

export type { SkillRow, SkillSaveOutcome };
export type SkillTab = 'installed' | 'browse';
export type SkillSort = 'most-used' | 'alphabetical' | 'recent';

/**
 * Classify a skill into career domain, agent architecture domain, or engineering tools domain.
 */
export function getSkillDomain(item: CapabilityItem): 'career' | 'agent' | 'engineering' {
  const text =
    `${item.name} ${(item.tags || []).join(' ')} ${item.description || ''}`.toLowerCase();
  if (
    text.includes('career') ||
    text.includes('resume') ||
    text.includes('ats') ||
    text.includes('interview') ||
    text.includes('job') ||
    text.includes('cover-letter') ||
    text.includes('hiring') ||
    text.includes('salary')
  ) {
    return 'career';
  }
  if (
    text.includes('agent') ||
    text.includes('workflow') ||
    text.includes('react') ||
    text.includes('harness') ||
    text.includes('loop') ||
    text.includes('orchestrat') ||
    text.includes('eval') ||
    text.includes('rag') ||
    text.includes('autonomy')
  ) {
    return 'agent';
  }
  return 'engineering';
}

interface SkillsViewProps {
  rows: SkillRow[];
  installedCount: number;
  browseCount: number;
  searchQuery: string;
  onClearSearch: () => void;
  tab: SkillTab;
  onTabChange: (tab: SkillTab) => void;
  sort: SkillSort;
  onSortChange: (sort: SkillSort) => void;
  selectedKey: string;
  onSelect: (key: string) => void;
  onToggleEnabled: (key: string, next: boolean) => void;
  onInstall: (key: string) => void;
  onSaveDoc: (key: string, doc: string) => Promise<SkillSaveOutcome>;
  onDelete: (key: string) => void;
  onCopyDoc: (key: string) => void;
  onOpenCreate: () => void;
  isLoading: boolean;
  error?: Error;
  onRetry: () => void;
  pendingKey: string | null;
}

function isNarrowViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return !window.matchMedia('(min-width: 1024px)').matches;
}

function SkillListSkeleton() {
  return (
    <div className="p-3 space-y-2" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton rounded="md" className="h-9 flex-1" />
          <Skeleton rounded="full" className="h-5 w-9" />
        </div>
      ))}
    </div>
  );
}

export const SkillsView: React.FC<SkillsViewProps> = ({
  rows,
  installedCount,
  browseCount,
  searchQuery,
  onClearSearch,
  tab,
  onTabChange,
  sort,
  onSortChange,
  selectedKey,
  onSelect,
  onToggleEnabled,
  onInstall,
  onSaveDoc,
  onDelete,
  onCopyDoc,
  onOpenCreate,
  isLoading,
  error,
  onRetry,
  pendingKey,
}) => {
  const [confirmDelete, setConfirmDelete] = useState<SkillRow | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<SkillCategoryFilter>('all');
  const [trustFilter, setTrustFilter] = useState<string>('all');
  const [isTriggerSimOpen, setIsTriggerSimOpen] = useState(false);
  const [playgroundSkill, setPlaygroundSkill] = useState<SkillRow | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const { careerCount, agentCount, engineeringCount } = useMemo(() => {
    let c = 0;
    let a = 0;
    let e = 0;
    for (const r of rows) {
      const domain = getSkillDomain(r.item);
      if (domain === 'career') c++;
      else if (domain === 'agent') a++;
      else e++;
    }
    return { careerCount: c, agentCount: a, engineeringCount: e };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (categoryFilter !== 'all' && getSkillDomain(r.item) !== categoryFilter) {
        return false;
      }
      if (trustFilter !== 'all') {
        const rowTrust = r.item.trustClass || 'community';
        if (rowTrust !== trustFilter) return false;
      }
      return true;
    });
  }, [rows, categoryFilter, trustFilter]);

  const selectedRow = useMemo(
    () =>
      filteredRows.find((row) => row.key === selectedKey) ??
      filteredRows[0] ??
      rows.find((row) => row.key === selectedKey) ??
      rows[0] ??
      null,
    [filteredRows, rows, selectedKey],
  );

  const detailRef = useRef<HTMLDivElement>(null);
  const selectedButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedWasDetail = useRef(false);

  const handleSelect = useCallback(
    (key: string) => {
      onSelect(key);
      if (isNarrowViewport()) {
        setMobileDetailOpen(true);
      }
    },
    [onSelect],
  );

  const closeMobileDetail = useCallback(() => {
    setMobileDetailOpen(false);
    requestAnimationFrame(() => {
      selectedButtonRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileDetailOpen) {
        closeMobileDetail();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileDetailOpen, closeMobileDetail]);

  useEffect(() => {
    if (mobileDetailOpen && detailRef.current) {
      previouslyFocusedWasDetail.current = true;
      detailRef.current.focus();
    } else if (!mobileDetailOpen && previouslyFocusedWasDetail.current) {
      previouslyFocusedWasDetail.current = false;
      selectedButtonRef.current?.focus();
    }
  }, [mobileDetailOpen]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div role="alert" className="flex flex-col items-center gap-3 text-center max-w-md">
          <h2 className="text-base font-semibold text-text">Skills could not be loaded</h2>
          <p className="text-sm text-text-muted">{error.message}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const hasQuery = searchQuery.trim().length > 0;
  const nothingAtAll = installedCount === 0 && browseCount === 0;

  const listEmpty = (() => {
    if (nothingAtAll) {
      return (
        <EmptyState
          title="No skills available"
          description="This workspace has no skills and the server catalog returned nothing for the skill category."
          action={{ label: 'Create a skill', onClick: onOpenCreate }}
        />
      );
    }
    if (hasQuery) {
      return (
        <EmptyState
          title="No skills match this search"
          description={`Nothing in ${tab === 'installed' ? 'Installed' : 'Browse'} matches "${searchQuery.trim()}".`}
          action={{ label: 'Reset search', onClick: onClearSearch }}
        />
      );
    }
    if (tab === 'installed') {
      return (
        <EmptyState
          title="No skills installed"
          description={`${browseCount} skill${browseCount === 1 ? '' : 's'} in the catalog are not installed in this workspace yet.`}
          action={{ label: 'Browse the catalog', onClick: () => onTabChange('browse') }}
        />
      );
    }
    return (
      <EmptyState
        title="Nothing left to browse"
        description={`All ${installedCount} known skill${installedCount === 1 ? '' : 's'} ${installedCount === 1 ? 'is' : 'are'} already installed.`}
        action={{
          label: 'View installed',
          onClick: () => onTabChange('installed'),
          variant: 'secondary',
        }}
      />
    );
  })();

  return (
    <div className="flex-1 flex min-h-0 min-w-0 bg-background text-text overflow-hidden">
      <div
        className={`w-full lg:w-[320px] xl:w-[350px] shrink-0 border-r border-border bg-surface flex flex-col min-h-0 ${
          mobileDetailOpen ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <SkillFilterBar
          sort={sort}
          onSortChange={onSortChange}
          tab={tab}
          onTabChange={onTabChange}
          installedCount={installedCount}
          browseCount={browseCount}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          careerCount={careerCount}
          agentCount={agentCount}
          engineeringCount={engineeringCount}
          totalFilteredCount={rows.length}
          trustFilter={trustFilter}
          onTrustFilterChange={setTrustFilter}
          onOpenTriggerSimulator={() => setIsTriggerSimOpen(true)}
        />

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-1.5 pb-12">
          {isLoading ? (
            <SkillListSkeleton />
          ) : rows.length === 0 ? (
            <div className="p-4">{listEmpty}</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No skills match filters"
                description={`No skills in ${tab === 'installed' ? 'Installed' : 'Browse'} match category "${categoryFilter}" and trust level "${trustFilter}".`}
                action={{
                  label: 'Reset filters',
                  onClick: () => {
                    setCategoryFilter('all');
                    setTrustFilter('all');
                  },
                }}
              />
            </div>
          ) : (
            <ul aria-label="Skills" className="divide-y divide-border-subtle">
              {filteredRows.map((row) => {
                const isSelected = row.key === selectedRow?.key;
                const isPending = pendingKey === row.key;
                return (
                  <li key={row.key}>
                    <SkillCard
                      row={row}
                      isSelected={isSelected}
                      isPending={isPending}
                      onSelect={handleSelect}
                      onToggleEnabled={onToggleEnabled}
                      onInstall={onInstall}
                      buttonRef={isSelected ? selectedButtonRef : undefined}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div
        className={`flex-1 flex flex-col min-h-0 min-w-0 bg-background overflow-hidden ${
          mobileDetailOpen ? 'flex' : 'hidden lg:flex'
        }`}
      >
        <SkillDetailPane
          selectedRow={selectedRow}
          isLoading={isLoading}
          onCloseMobileDetail={closeMobileDetail}
          onOpenCreate={onOpenCreate}
          onToggleEnabled={onToggleEnabled}
          onInstall={onInstall}
          onDeleteRequest={(row) => setConfirmDelete(row)}
          onCopyDoc={onCopyDoc}
          onSaveDoc={onSaveDoc}
          onOpenPlayground={(row) => setPlaygroundSkill(row)}
          detailRef={detailRef}
        />
      </div>

      <ConfirmationDialog
        isOpen={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) onDelete(target.key);
        }}
        title="Delete this skill?"
        description={
          confirmDelete?.bundled
            ? 'Bundled skills cannot be deleted. The server answers 409 for them; disable the skill instead if you want it out of an agent run.'
            : 'This removes the skill from this workspace. It cannot be undone from here.'
        }
        confirmLabel="Delete skill"
        variant="destructive"
      />

      <SkillPlaygroundDrawer
        isOpen={playgroundSkill !== null}
        onClose={() => setPlaygroundSkill(null)}
        selectedSkill={playgroundSkill}
      />

      <TriggerSimulatorModal
        isOpen={isTriggerSimOpen}
        onClose={() => setIsTriggerSimOpen(false)}
        rows={rows}
        installedSkills={rows.filter((r) => r.installed)}
        onSelectSkill={(key) => {
          setIsTriggerSimOpen(false);
          handleSelect(key);
        }}
      />
    </div>
  );
};
