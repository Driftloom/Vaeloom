'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  ButtonGroup,
  ConfirmationDialog,
  EmptyState,
  FormField,
  IconButton,
  Select,
  Skeleton,
  Spinner,
  StatusDot,
  Switch,
  Tabs,
  TabPanel,
  Textarea,
  Tooltip,
} from '@vaeloom/ui-kit';
import type { CapabilityItem } from '@/lib/capabilities-data';
import { formatRelativeTime } from '@/lib/capabilities-data';

export type SkillTab = 'installed' | 'browse';
export type SkillSort = 'most-used' | 'alphabetical' | 'recent';

/**
 * One row as the page resolved it. The page owns the merge and owns every write,
 * so this component never decides what is true about a skill: it only renders.
 *
 * `installed` is the single definition used for the tab counts, the tab badge and
 * the row's affordances. It is NOT `enabled`: a disabled skill is still installed,
 * and conflating the two is what used to make disabling look like deletion.
 */
export interface SkillRow {
  key: string;
  item: CapabilityItem;
  installed: boolean;
  bundled: boolean;
  slug: string | null;
  /** False when the skill exists only in this browser: there is no row to write to. */
  serverBacked: boolean;
}

export type SkillSaveOutcome = 'server' | 'local' | 'failed';

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

const SORT_OPTIONS = [
  { value: 'most-used', label: 'Most used' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'recent', label: 'Recently used' },
];

/**
 * Whether the list pane is actually hidden by CSS at the current width.
 *
 * The Tailwind `hidden lg:flex` classes mean only one pane is in the a11y tree at
 * a time, so the audit note that "both panes are simultaneously present" was not
 * quite the defect: the real one is focus loss, because a control inside a pane
 * that just became `display:none` drops focus to <body>. Whether focus has to be
 * moved therefore depends on the viewport, and jsdom reports `matches: false` for
 * every query, so an unavailable or non-matching `matchMedia` is treated as narrow
 * -- the side where losing focus strands the user.
 */
function isNarrowViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return !window.matchMedia('(min-width: 1024px)').matches;
}

function isBundledSource(item: CapabilityItem): boolean {
  return item.source === 'built-in' || item.source === 'learned';
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

function DetailSkeleton() {
  return (
    <div className="flex-1 p-5 space-y-4" aria-hidden="true">
      <Skeleton rounded="md" className="h-6 w-56" />
      <Skeleton rounded="md" className="h-3 w-full" />
      <Skeleton rounded="md" className="h-3 w-4/5" />
      <Skeleton rounded="lg" className="h-64 w-full" />
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
  const [isEditing, setIsEditing] = useState(false);
  const [editedDoc, setEditedDoc] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [detailPane, setDetailPane] = useState<'doc' | 'schema'>('doc');
  const [confirmDelete, setConfirmDelete] = useState<SkillRow | null>(null);

  // Presentation-only: on a narrow viewport the two panes cannot share the
  // screen, so the list is removed from the a11y tree while the detail is open.
  // The page deliberately does not own this, because nothing about the data
  // depends on it and duplicating it is how the two components drifted apart.
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const selectedRow = useMemo(
    () => rows.find((row) => row.key === selectedKey) ?? rows[0] ?? null,
    [rows, selectedKey],
  );

  const detailRef = useRef<HTMLDivElement>(null);
  const selectedButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedWasDetail = useRef(false);

  const selectedDoc = selectedRow?.item.markdownDoc ?? '';

  // The edit buffer belongs to the selection. Depending on the doc as well means a
  // successful save re-seeds the buffer from what the server now holds.
  useEffect(() => {
    setEditedDoc(selectedDoc);
    setIsEditing(false);
    setSaveError(null);
    setDetailPane('doc');
  }, [selectedRow?.key, selectedDoc]);

  // On a narrow viewport the list is removed from the a11y tree the moment a row
  // is chosen, so focus has to follow the selection or it lands on <body> and
  // strands a keyboard or screen-reader user at the top of the document. At lg and
  // above the list stays visible, so focus is left on the row where arrow-free Tab
  // navigation between rows still works.
  useEffect(() => {
    if (!mobileDetailOpen || !isNarrowViewport()) return;
    detailRef.current?.focus();
  }, [mobileDetailOpen]);

  useEffect(() => {
    if (mobileDetailOpen || !previouslyFocusedWasDetail.current) return;
    selectedButtonRef.current?.focus();
    previouslyFocusedWasDetail.current = false;
  }, [mobileDetailOpen]);

  const closeMobileDetail = useCallback(() => {
    previouslyFocusedWasDetail.current = true;
    setMobileDetailOpen(false);
  }, []);

  const handleSelect = useCallback(
    (key: string) => {
      onSelect(key);
      setMobileDetailOpen(true);
    },
    [onSelect],
  );

  const handleSave = useCallback(async () => {
    if (!selectedRow) return;
    setIsSaving(true);
    setSaveError(null);
    const outcome = await onSaveDoc(selectedRow.key, editedDoc);
    setIsSaving(false);
    if (outcome === 'failed') {
      setSaveError('Nothing was written. The text below is still your edit, not the saved skill.');
      return;
    }
    setIsEditing(false);
  }, [selectedRow, editedDoc, onSaveDoc]);

  const handleCancelEdit = useCallback(() => {
    setEditedDoc(selectedRow?.item.markdownDoc ?? '');
    setSaveError(null);
    setIsEditing(false);
  }, [selectedRow]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
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

  const detailMeta: Array<{ label: string; value: string | null; fallback: string }> = selectedRow
    ? [
        { label: 'Version', value: selectedRow.item.version ?? null, fallback: 'Not declared' },
        { label: 'Author', value: selectedRow.item.author ?? null, fallback: 'Not declared' },
        {
          label: 'Required scope',
          value: selectedRow.item.requiredScope ?? null,
          fallback: 'Not declared by the server',
        },
        {
          label: 'Trust class',
          value: selectedRow.item.trustClass ?? null,
          fallback: 'Not declared by the server',
        },
        {
          label: 'Autonomy',
          value: selectedRow.item.autonomy ?? null,
          fallback: 'Not declared by the server',
        },
        {
          label: 'Last used',
          value: null,
          fallback: formatRelativeTime(selectedRow.item.lastUsedAt),
        },
        {
          label: 'Executions',
          value: null,
          fallback:
            selectedRow.item.usageCount === 0 ? 'Never run' : String(selectedRow.item.usageCount),
        },
      ]
    : [];

  return (
    <div className="flex-1 flex min-h-0 min-w-0 bg-background text-text overflow-hidden">
      {/* No heading here. `capabilities/page.tsx` renders the route's single <h1>
          via <PageHeader>, so this column's own heading is the <h2> on the detail
          side. A second <h1> here would make the route's heading structure
          ambiguous to assistive tech. */}
      <div
        className={`w-full lg:w-[320px] xl:w-[350px] shrink-0 border-r border-border bg-surface flex flex-col min-h-0 ${
          mobileDetailOpen ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="p-3 border-b border-border bg-surface shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Select
              aria-label="Sort skills"
              options={SORT_OPTIONS}
              value={sort}
              onChange={(value) => onSortChange(value as SkillSort)}
              className="text-xs py-1"
            />
            <ButtonGroup attached>
              <Button
                size="sm"
                variant={tab === 'installed' ? 'primary' : 'ghost'}
                aria-pressed={tab === 'installed'}
                onClick={() => onTabChange('installed')}
              >
                {`Installed (${installedCount})`}
              </Button>
              <Button
                size="sm"
                variant={tab === 'browse' ? 'primary' : 'ghost'}
                aria-pressed={tab === 'browse'}
                onClick={() => onTabChange('browse')}
              >
                {`Browse (${browseCount})`}
              </Button>
            </ButtonGroup>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain p-1.5 pb-12">
          {isLoading ? (
            <SkillListSkeleton />
          ) : rows.length === 0 ? (
            <div className="p-4">{listEmpty}</div>
          ) : (
            <ul aria-label="Skills" className="divide-y divide-border-subtle">
              {rows.map((row) => {
                const isSelected = row.key === selectedRow?.key;
                const isPending = pendingKey === row.key;
                return (
                  <li key={row.key}>
                    <div
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                        isSelected
                          ? 'bg-primary/10 border-l-2 border-primary text-primary'
                          : 'hover:bg-surface-hover border-l-2 border-transparent'
                      }`}
                    >
                      <button
                        type="button"
                        ref={isSelected ? selectedButtonRef : undefined}
                        aria-current={isSelected ? 'true' : undefined}
                        aria-label={row.item.name}
                        onClick={() => handleSelect(row.key)}
                        className="flex-1 min-w-0 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface py-1"
                      >
                        <span className="flex items-center gap-1.5">
                          {!row.installed && (
                            <StatusDot status="idle" size="sm" label="Not installed" />
                          )}
                          <span className="text-xs font-medium truncate text-text">
                            {row.item.name}
                          </span>
                        </span>
                        <span className="mt-1 flex items-center gap-1 flex-wrap">
                          {row.installed && !row.item.enabled && (
                            <Badge variant="warning" size="sm">
                              Disabled
                            </Badge>
                          )}
                          {row.bundled && (
                            <Badge variant="default" size="sm">
                              Bundled
                            </Badge>
                          )}
                          {!row.serverBacked && (
                            <Badge variant="info" size="sm">
                              Local only
                            </Badge>
                          )}
                          {row.item.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="default" size="sm">
                              {tag}
                            </Badge>
                          ))}
                          {row.item.tags.length === 0 && (
                            <span className="text-2xs text-text-muted">No tags</span>
                          )}
                        </span>
                      </button>
                      {row.installed ? (
                        <Switch
                          checked={row.item.enabled}
                          onChange={(next) => onToggleEnabled(row.key, next)}
                          label={<span className="sr-only">{`Enable ${row.item.name}`}</span>}
                          disabled={isPending}
                        />
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isPending}
                          onClick={() => onInstall(row.key)}
                        >
                          {isPending ? <Spinner size="sm" /> : 'Install'}
                        </Button>
                      )}
                    </div>
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
        {!selectedRow ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <EmptyState
              title="Select a skill"
              description="Choose a skill from the list to read its operating rules, scope and documentation."
              action={{ label: 'Author a new skill', onClick: onOpenCreate, variant: 'secondary' }}
            />
          </div>
        ) : (
          <div
            ref={detailRef}
            tabIndex={-1}
            className="flex-1 flex flex-col min-h-0 min-w-0 focus:outline-none"
          >
            <div className="p-4 sm:p-5 border-b border-border bg-surface shrink-0 space-y-2">
              <div className="lg:hidden">
                <Button variant="ghost" size="sm" onClick={closeMobileDetail}>
                  Back to list
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-semibold tracking-tight text-text truncate">
                  {selectedRow.item.name}
                </h2>
                {selectedRow.bundled && <Badge variant="default">Bundled</Badge>}
                {selectedRow.installed ? (
                  selectedRow.item.enabled ? (
                    <Badge variant="success">Enabled</Badge>
                  ) : (
                    <Badge variant="warning">Disabled</Badge>
                  )
                ) : (
                  <Badge variant="info">Not installed</Badge>
                )}
                {!selectedRow.serverBacked && <Badge variant="info">Local only</Badge>}
              </div>

              <p className="text-xs text-text-secondary leading-relaxed max-w-2xl font-sans">
                {selectedRow.item.description || 'The server sent no description for this skill.'}
              </p>

              <div className="flex items-center gap-2 flex-wrap pt-1">
                {isEditing ? (
                  <>
                    <Button size="sm" variant="primary" loading={isSaving} onClick={handleSave}>
                      Save changes
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditedDoc(selectedRow.item.markdownDoc);
                        setSaveError(null);
                        setIsEditing(true);
                      }}
                    >
                      Edit instructions
                    </Button>
                    {selectedRow.installed && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onToggleEnabled(selectedRow.key, !selectedRow.item.enabled)}
                      >
                        {selectedRow.item.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                    {!selectedRow.installed && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onInstall(selectedRow.key)}
                      >
                        Install
                      </Button>
                    )}
                    {selectedRow.serverBacked && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(selectedRow)}
                      >
                        Delete
                      </Button>
                    )}
                  </>
                )}
                <Tooltip content="Copy the full markdown instructions">
                  <IconButton
                    aria-label={`Copy full instructions for ${selectedRow.item.name}`}
                    size="sm"
                    onClick={() => onCopyDoc(selectedRow.key)}
                  >
                    Copy
                  </IconButton>
                </Tooltip>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 pt-2 text-2xs">
                {detailMeta.map((entry) => (
                  <div key={entry.label} className="min-w-0">
                    <dt className="text-text-muted">{entry.label}</dt>
                    <dd
                      className={`font-mono truncate ${
                        entry.value === null && entry.fallback.startsWith('Not declared')
                          ? 'text-text-muted italic'
                          : 'text-text-secondary'
                      }`}
                    >
                      {entry.value ?? entry.fallback}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <Tabs
              className="shrink-0 rounded-none border-0 border-b border-border-subtle bg-surface"
              ariaLabel="Skill detail sections"
              size="sm"
              tabs={[
                { id: 'doc', label: 'Instructions' },
                { id: 'schema', label: 'Input schema' },
              ]}
              activeTab={detailPane}
              onTabChange={(id) => setDetailPane(id as 'doc' | 'schema')}
            />

            <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-5 pb-16 bg-background min-h-0">
              {isLoading ? (
                <DetailSkeleton />
              ) : (
                <>
                  <TabPanel id="doc" activeTab={detailPane}>
                    {isEditing ? (
                      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                        <FormField
                          label="Skill instructions (Markdown)"
                          error={saveError ?? undefined}
                          hint="Saved to the workspace capability row when this skill is installed; stored in this browser only when it is not."
                        >
                          {({ id, errorId }) => (
                            <Textarea
                              id={id}
                              aria-describedby={saveError ? errorId : undefined}
                              value={editedDoc}
                              onChange={(event) => setEditedDoc(event.target.value)}
                              onKeyDown={(event) => {
                                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                                  event.preventDefault();
                                  void handleSave();
                                } else if (event.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              rows={20}
                              className="font-mono text-xs leading-relaxed resize-y"
                              placeholder="# Enter skill rules, triggers and instructions in markdown"
                            />
                          )}
                        </FormField>
                        <p className="text-2xs text-text-muted font-mono">
                          {editedDoc.split('\n').length} lines &middot; {editedDoc.length}{' '}
                          characters
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                        {selectedRow.item.markdownDoc ? (
                          <pre className="font-mono text-xs text-text leading-relaxed whitespace-pre-wrap select-text font-normal">
                            {selectedRow.item.markdownDoc}
                          </pre>
                        ) : (
                          <p className="text-xs text-text-muted">
                            The server sent no markdown for this skill.
                          </p>
                        )}
                      </div>
                    )}
                  </TabPanel>

                  <TabPanel id="schema" activeTab={detailPane}>
                    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                      <p className="text-2xs text-text-muted">
                        Read only. The HTTP client camel-cases response keys, so a JSON Schema
                        round-tripped through this page would corrupt its property names. The raw
                        schema stays on the server.
                      </p>
                      {selectedRow.item.inputSchema ? (
                        <pre className="font-mono text-xs text-text leading-relaxed whitespace-pre-wrap select-text font-normal">
                          {JSON.stringify(selectedRow.item.inputSchema, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-xs text-text-muted">
                          This skill declares no input schema.
                        </p>
                      )}
                    </div>
                  </TabPanel>
                </>
              )}
            </div>
          </div>
        )}
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
    </div>
  );
};
