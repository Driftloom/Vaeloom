'use client';

import React, { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  IconButton,
  Skeleton,
  Tabs,
  TabPanel,
  Textarea,
  Tooltip,
} from '@vaeloom/ui-kit';
import { formatRelativeTime } from '@/lib/capabilities-data';
import type { SkillRow, SkillSaveOutcome } from './SkillCard';
import { SkillMarkdownViewer } from './SkillMarkdownViewer';
import { SkillTelemetryCard } from './SkillTelemetryCard';

export interface SkillDetailPaneProps {
  selectedRow: SkillRow | null;
  isLoading: boolean;
  onCloseMobileDetail: () => void;
  onOpenCreate: () => void;
  onToggleEnabled: (key: string, next: boolean) => void;
  onInstall: (key: string) => void;
  onDeleteRequest: (row: SkillRow) => void;
  onCopyDoc: (key: string) => void;
  onSaveDoc: (key: string, doc: string) => Promise<SkillSaveOutcome>;
  onOpenPlayground: (row: SkillRow) => void;
  detailRef?: React.Ref<HTMLDivElement>;
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

export const SkillDetailPane: React.FC<SkillDetailPaneProps> = ({
  selectedRow,
  isLoading,
  onCloseMobileDetail,
  onOpenCreate,
  onToggleEnabled,
  onInstall,
  onDeleteRequest,
  onCopyDoc,
  onSaveDoc,
  onOpenPlayground,
  detailRef,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDoc, setEditedDoc] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [detailPane, setDetailPane] = useState<'doc' | 'schema'>('doc');

  const selectedDoc = selectedRow?.item.markdownDoc ?? '';

  useEffect(() => {
    setEditedDoc(selectedDoc);
    setIsEditing(false);
    setSaveError(null);
    setDetailPane('doc');
  }, [selectedRow?.key, selectedDoc]);

  const handleSave = async () => {
    if (!selectedRow) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const outcome = await onSaveDoc(selectedRow.key, editedDoc);
      if (outcome === 'failed') {
        setSaveError(
          'Nothing was written. The text below is still your edit, not the saved skill.',
        );
      } else {
        setIsEditing(false);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedDoc(selectedDoc);
    setIsEditing(false);
    setSaveError(null);
  };

  if (!selectedRow) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <EmptyState
          title="Select a skill"
          description="Choose a skill from the list to read its operating rules, scope and documentation."
          action={{ label: 'Author a new skill', onClick: onOpenCreate, variant: 'secondary' }}
        />
      </div>
    );
  }

  const detailMeta: Array<{ label: string; value: string | null; fallback: string }> = [
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
  ];

  return (
    <div
      ref={detailRef}
      tabIndex={-1}
      className="flex-1 flex flex-col min-h-0 min-w-0 focus:outline-none"
    >
      <div className="p-4 sm:p-5 border-b border-border bg-surface shrink-0 space-y-2">
        <div className="lg:hidden">
          <Button variant="ghost" size="sm" onClick={onCloseMobileDetail}>
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
                <Button size="sm" variant="secondary" onClick={() => onInstall(selectedRow.key)}>
                  Install
                </Button>
              )}
              {selectedRow.serverBacked && (
                <Button size="sm" variant="ghost" onClick={() => onDeleteRequest(selectedRow)}>
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

      <div className="p-4 sm:p-5 pb-0 bg-background shrink-0">
        <SkillTelemetryCard
          row={selectedRow}
          onOpenPlayground={onOpenPlayground}
          onCopyDoc={onCopyDoc}
        />
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
        onTabChange={(id: string) => setDetailPane(id as 'doc' | 'schema')}
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
                    {({ id, errorId }: { id: string; errorId?: string }) => (
                      <Textarea
                        id={id}
                        aria-describedby={saveError ? errorId : undefined}
                        value={editedDoc}
                        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setEditedDoc(event.target.value)
                        }
                        onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
                    {editedDoc.split('\n').length} lines &middot; {editedDoc.length} characters
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                  {selectedRow.item.markdownDoc ? (
                    <SkillMarkdownViewer content={selectedRow.item.markdownDoc} />
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
                  round-tripped through this page would corrupt its property names. The raw schema
                  stays on the server.
                </p>
                {selectedRow.item.inputSchema ? (
                  <pre className="font-mono text-xs text-text leading-relaxed whitespace-pre-wrap select-text font-normal">
                    {JSON.stringify(selectedRow.item.inputSchema, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-text-muted">This skill declares no input schema.</p>
                )}
              </div>
            </TabPanel>
          </>
        )}
      </div>
    </div>
  );
};
