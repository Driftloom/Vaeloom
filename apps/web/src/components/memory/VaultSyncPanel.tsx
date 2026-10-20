'use client';

import React, { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import {
  Card,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  StatusDot,
  StatCard,
  Modal,
} from '@vaeloom/ui-kit';
import { useToast } from '@/components/shared/Toast';
import {
  vaultSyncApi,
  type VaultSyncStatus,
  type VaultConflict,
  type VaultConflictHistoryItem,
  type VaultConflictHistoryPage,
  type VaultSyncLog,
  type VaultNoteItem,
} from '@/lib/api-client';

/**
 * Responses pass through `transformKeys`, which camelCases every key, while
 * request echoes and test payloads may still carry snake_case. Read both.
 */
function conflictFileOf(conflict: VaultConflict): string | undefined {
  return conflict.conflictFile ?? conflict.conflict_file;
}
function detectedAtOf(conflict: VaultConflict): string | undefined {
  return conflict.detectedAt ?? conflict.detected_at;
}
function localHeadOf(conflict: VaultConflict): string | undefined {
  return conflict.localHead ?? conflict.local_head;
}
function remoteHeadOf(conflict: VaultConflict): string | undefined {
  return conflict.remoteHead ?? conflict.remote_head;
}
function resolvedAtOf(entry: VaultConflictHistoryItem): string | undefined {
  return entry.resolvedAt ?? entry.resolved_at;
}

/** Local copy of the app's timestamp-age idiom (see memory/page.tsx). */
function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'unknown';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface VaultSyncPanelProps {
  workspaceId: string;
}

export function VaultSyncPanel({ workspaceId }: VaultSyncPanelProps) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [ingestModalOpen, setIngestModalOpen] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<VaultConflict | null>(null);

  // Live SWR queries. All share one cadence. The status key is the exact
  // literal the memory-page tile uses, so SWR dedupes them to a single poll.
  const {
    data: statusData,
    isLoading: statusLoading,
    error: statusError,
    mutate: mutateStatus,
  } = useSWR<VaultSyncStatus>(
    workspaceId ? ['vault-sync-status', workspaceId] : null,
    () => vaultSyncApi.getStatus(workspaceId),
    { refreshInterval: 15000 },
  );

  const {
    data: conflictsData,
    error: conflictsError,
    mutate: mutateConflicts,
  } = useSWR<VaultConflict[]>(
    workspaceId ? ['vault-sync-conflicts', workspaceId] : null,
    () => vaultSyncApi.getConflicts(workspaceId),
    { refreshInterval: 15000 },
  );

  const {
    data: logsData,
    error: logsError,
    mutate: mutateLogs,
  } = useSWR<VaultSyncLog[]>(
    workspaceId ? ['vault-sync-logs', workspaceId] : null,
    () => vaultSyncApi.getLogs(workspaceId),
    { refreshInterval: 15000 },
  );

  const [historyLimit, setHistoryLimit] = useState(50);
  const {
    data: historyData,
    isLoading: historyLoading,
    error: historyError,
    mutate: mutateHistory,
  } = useSWR<VaultConflictHistoryPage>(
    workspaceId ? ['vault-sync-conflict-history', workspaceId, historyLimit] : null,
    () => vaultSyncApi.getConflictHistory(workspaceId, { limit: historyLimit }),
    { refreshInterval: 15000 },
  );

  // Configuration Form State - always seeded from the server's real values.
  const [formVaultPath, setFormVaultPath] = useState(statusData?.vaultPath || '');
  const [formRemoteUrl, setFormRemoteUrl] = useState(statusData?.remoteUrl || '');
  const [formBranch, setFormBranch] = useState(statusData?.branch || 'main');
  const [formAutoIngest, setFormAutoIngest] = useState(statusData?.autoIngest ?? true);
  const [debounceSeconds, setDebounceSeconds] = useState(statusData?.debounceSeconds ?? 30);
  const [rebaseIntervalMinutes, setRebounceIntervalMinutes] = useState(
    statusData?.rebaseIntervalMinutes ?? 5,
  );
  const [savingConfig, setSavingConfig] = useState(false);

  // Ingest form notes state
  const [customNoteTitle, setCustomNoteTitle] = useState('');
  const [customNoteContent, setCustomNoteContent] = useState('');
  const [customNoteTags, setCustomNoteTags] = useState('memory, vault');

  // Handle open config modal with current values
  const handleOpenConfig = () => {
    if (statusData) {
      setFormVaultPath(statusData.vaultPath || '');
      setFormRemoteUrl(statusData.remoteUrl || '');
      setFormBranch(statusData.branch || 'main');
      setFormAutoIngest(statusData.autoIngest ?? true);
      // Previously pinned at 30/5 regardless of what the server actually held.
      setDebounceSeconds(statusData.debounceSeconds ?? 30);
      setRebounceIntervalMinutes(statusData.rebaseIntervalMinutes ?? 5);
    }
    setConfigModalOpen(true);
  };

  // Save Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await vaultSyncApi.updateConfig({
        workspace_id: workspaceId,
        vault_path: formVaultPath || undefined,
        remote_url: formRemoteUrl || undefined,
        branch: formBranch,
        auto_ingest: formAutoIngest,
        // Previously omitted, so the debounce/rebase number inputs were
        // write-only UI state that could never be persisted.
        debounce_seconds: debounceSeconds,
        rebase_interval_minutes: rebaseIntervalMinutes,
      });
      await mutateStatus();
      await mutateLogs();
      setConfigModalOpen(false);
      toast({
        tone: 'success',
        title: 'Vault settings saved',
        detail: `Debounce ${debounceSeconds}s, rebase every ${rebaseIntervalMinutes}m. Your local client reads these on its next config load.`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Failed to update settings',
        detail: err instanceof Error ? err.message : 'Could not write vault configuration.',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  // NOTE: the previous "toggle daemon" button wrote `daemon_status` into the
  // workspace connector config. There is no server-side watcher process, so that
  // write controlled nothing while reporting "Watcher daemon resumed". Sync runs
  // in the local vaultsync client; its liveness now comes from /status instead.

  // Trigger Sync Now
  const handleManualSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await vaultSyncApi.triggerSync(workspaceId);
      await Promise.all([mutateStatus(), mutateConflicts(), mutateLogs(), mutateHistory()]);
      // A 200 does not mean a sync happened: the server has no git engine.
      // Report what actually occurred instead of always claiming success.
      if (res.executed) {
        toast({ tone: 'success', title: 'Vault synced', detail: res.message });
      } else {
        toast({ tone: 'info', title: 'Sync request recorded', detail: res.message });
      }
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Sync cycle failed',
        detail: err instanceof Error ? err.message : 'Could not sync vault with remote repository.',
      });
    } finally {
      setSyncing(false);
    }
  }, [workspaceId, mutateStatus, mutateConflicts, mutateLogs, mutateHistory, toast]);

  // Ingest to Documents & Graph
  const handleExecuteIngest = async (notesToIngest?: VaultNoteItem[]) => {
    // Build the payload from real user input only. This previously fell back to
    // two hardcoded notes ("Vault-Index.md", "Cognitive-Architecture.md") that
    // were silently written into the workspace's documents and memory on every
    // ingest, so the vault always contained notes the user never wrote. With no
    // real notes the payload stays empty and the guard below refuses the request.
    const payload: VaultNoteItem[] = notesToIngest ? [...notesToIngest] : [];

    if (customNoteTitle.trim() && customNoteContent.trim()) {
      const cleanName = customNoteTitle.endsWith('.md') ? customNoteTitle : `${customNoteTitle}.md`;
      payload.push({
        filename: cleanName,
        content: customNoteContent.trim(),
        relative_path: cleanName,
        tags: customNoteTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
    }

    if (payload.length === 0) {
      toast({
        tone: 'warning',
        title: 'Nothing to ingest',
        detail: 'Write a note title and body first - no placeholder notes are created for you.',
      });
      return;
    }

    setIngesting(true);
    try {
      const res = await vaultSyncApi.ingest({
        workspace_id: workspaceId,
        notes: payload,
      });

      await mutateStatus();
      setIngestModalOpen(false);
      setCustomNoteTitle('');
      setCustomNoteContent('');
      const ingestedDocs = res.ingestedDocuments ?? res.ingested_documents ?? 0;
      const memoryNodes = res.createdOrUpdatedMemories ?? res.created_or_updated_memories ?? 0;
      toast({
        tone: 'success',
        title: 'Vault Ingest Complete',
        detail: `Indexed ${ingestedDocs} document(s) and synced ${memoryNodes} memory node(s).`,
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Ingestion failed',
        detail:
          err instanceof Error ? err.message : 'Could not import notes into workspace documents.',
      });
    } finally {
      setIngesting(false);
    }
  };

  // Resolve conflict with loading indicator
  const handleResolveConflict = async (
    conflictId: string,
    strategy: 'keep-local' | 'accept-incoming',
  ) => {
    setResolvingId(conflictId);
    try {
      await vaultSyncApi.resolveConflict(conflictId, strategy, workspaceId);
      await Promise.all([mutateConflicts(), mutateStatus(), mutateLogs(), mutateHistory()]);
      setDiffModalOpen(false);
      setSelectedConflict(null);
      toast({
        tone: 'success',
        title: 'Resolution recorded',
        detail: 'The vaultsync client applies it on the next sync.',
      });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Resolution failed',
        detail: err instanceof Error ? err.message : 'Could not write conflict resolution to disk.',
      });
    } finally {
      setResolvingId(null);
    }
  };

  const conflicts = conflictsData || [];
  const logs = logsData || [];
  const historyItems = historyData?.items ?? [];
  const historyTotal = historyData?.total ?? 0;
  const devices = statusData?.devices ?? [];
  // Liveness comes from the server, derived from the client's heartbeat. The old
  // `!== 'paused'` check meant an absent field read as "running", so a workspace
  // with no client at all displayed "In Sync / Active".
  const daemonStatus = statusData?.daemonStatus ?? 'not_connected';
  const clientConnected = daemonStatus === 'running';

  const engineLabel = useMemo(() => {
    switch (daemonStatus) {
      case 'running':
        return 'Client Connected';
      case 'stale':
        return 'Client Unresponsive';
      case 'paused':
        return 'Client Paused';
      case 'unknown':
        return 'Client Status Unknown';
      default:
        return 'No Client Connected';
    }
  }, [daemonStatus]);

  const statusBadge = useMemo(() => {
    if (statusData?.lastError) {
      // A client-reported failure outranks every other signal.
      return { variant: 'warning' as const, label: 'Sync Error', dot: 'warning' as const };
    }
    if (statusData?.status === 'syncing' || syncing) {
      return { variant: 'primary' as const, label: 'Syncing Changes...', dot: 'warning' as const };
    }
    if (conflicts.length > 0) {
      return {
        variant: 'warning' as const,
        label: `${conflicts.length} Conflict(s)`,
        dot: 'warning' as const,
      };
    }
    if (!clientConnected) {
      // Never claim health we cannot evidence.
      return {
        variant: 'default' as const,
        label: daemonStatus === 'stale' ? 'Client Unresponsive' : 'Not Connected',
        dot: 'disabled' as const,
      };
    }
    return { variant: 'success' as const, label: 'Client Connected', dot: 'active' as const };
  }, [
    statusData?.status,
    statusData?.lastError,
    syncing,
    conflicts.length,
    clientConnected,
    daemonStatus,
  ]);

  if (statusLoading && !statusData) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading vault sync status">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-surface-100 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-surface-100 animate-pulse" />
      </div>
    );
  }

  if (statusError && !statusData) {
    // No last-good status to fall back on: one honest failure surface with a
    // recovery action, instead of a panel full of invented zeros.
    return (
      <div className="space-y-6">
        <ErrorState
          title="Vault status unavailable"
          message="The vault sync status request failed. Check the API connection and retry."
          onRetry={() => void handleManualSync()}
          actionText="Request sync"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top 4 Metric StatCards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Sync Engine"
          value={engineLabel}
          caption="Runs on your machine (vaultsync client)"
        />
        <StatCard
          label="Last Pull (Rebase)"
          value={
            statusData?.lastPullTime
              ? new Date(statusData.lastPullTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Never'
          }
          caption={`${rebaseIntervalMinutes}m scheduled pull`}
        />
        <StatCard
          label="Last Push"
          value={
            statusData?.lastPushTime
              ? new Date(statusData.lastPushTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Never'
          }
          caption={`${debounceSeconds}s debounced commit`}
        />
        <StatCard
          label="Active Conflicts"
          value={String(conflicts.length)}
          caption={conflicts.length > 0 ? 'Action Required' : 'None outstanding'}
        />
      </div>

      {/* Main Vault Control Card */}
      <Card padding="md" className="space-y-5 border border-border bg-surface rounded-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusDot status={statusBadge.dot} />
              <h2 className="text-lg font-display font-medium text-text">Vaeloom Vault Git Sync</h2>
              <Badge variant={statusBadge.variant} size="sm">
                {statusBadge.label}
              </Badge>
            </div>
            <p className="text-xs text-text-secondary font-mono">
              {statusData?.remoteUrl ? (
                <>
                  Remote: <span className="text-text font-medium">{statusData.remoteUrl}</span>
                </>
              ) : (
                <span className="text-text-muted italic">
                  No remote configured (local-only vault watcher)
                </span>
              )}{' '}
              - Branch:{' '}
              <span className="text-text font-medium">{statusData?.branch || 'main'}</span>
              {statusError && <span className="text-warning"> - status not refreshed</span>}
            </p>
            {statusData?.lastError && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-text-secondary"
              >
                <strong className="text-warning">Vault client reported an error: </strong>
                {statusData.lastError}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={syncing}
              onClick={() => void handleManualSync()}
            >
              Request Sync
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={ingesting}
              onClick={() => setIngestModalOpen(true)}
            >
              Ingest to Documents & Graph
            </Button>
            <Button variant="primary" size="sm" onClick={handleOpenConfig}>
              Configure Vault
            </Button>
          </div>
        </div>

        {/* Operational Specs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg border border-border bg-surface-100 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-text uppercase tracking-wider text-[11px]">
                Local Vault Storage
              </h4>
              <Badge variant={clientConnected ? 'success' : 'default'} size="sm">
                {clientConnected ? 'Client Connected' : 'No Client'}
              </Badge>
            </div>
            <div className="space-y-1.5 text-text-secondary">
              <p>
                <strong className="text-text">Local Path:</strong>{' '}
                <code className="font-mono text-accent font-medium break-all">
                  {statusData?.vaultPath || 'Not configured'}
                </code>
              </p>
              <p>
                <strong className="text-text">Vault Client:</strong> {engineLabel}
                {statusData?.lastClientHeartbeat ? (
                  <span className="text-text-muted">
                    {' '}
                    / last heartbeat {formatRelative(statusData.lastClientHeartbeat)}
                  </span>
                ) : (
                  <span className="text-text-muted"> / no heartbeat reported</span>
                )}
              </p>
              <p>
                <strong className="text-text">Debounce Window:</strong> {debounceSeconds}s after
                edits cease
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-100 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-text uppercase tracking-wider text-[11px]">
                Conflict File Preservation
              </h4>
              <Badge variant="mono" size="sm">
                CONT-P12-R05
              </Badge>
            </div>
            <div className="space-y-1.5 text-text-secondary">
              <p>
                Remote conflict versions preserved as{' '}
                <code className="font-mono text-text">*.conflict-YYYY-MM-DD.md</code>.
              </p>
              <p>Local revisions are never silently overwritten during auto-rebase.</p>
              <p>
                Transient workspace files (<code className="font-mono">.obsidian/workspace*</code>)
                are ignored.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-100 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-text uppercase tracking-wider text-[11px]">
                Memory Integration
              </h4>
              <Badge variant={statusData?.autoIngest ? 'success' : 'default'} size="sm">
                {statusData?.autoIngest ? 'Auto-Indexing ON' : 'Manual Ingest'}
              </Badge>
            </div>
            <div className="space-y-1.5 text-text-secondary">
              <p>
                <strong className="text-text">Indexed Notes:</strong> {statusData?.totalNotes ?? 0}{' '}
                files in Documents/Vault Notes
              </p>
              <p>
                <strong className="text-text">Cognitive Memories:</strong>{' '}
                {statusData?.vaultMemories ?? 0} graph nodes linked
              </p>
              <p>Indexed notes participate in memory search like any other document.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Client-reported sync activity */}
      <Card padding="md" className="space-y-3 border border-border bg-surface rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                clientConnected ? 'bg-success animate-pulse' : 'bg-text-muted'
              }`}
            />
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
              Sync Activity Log
            </h3>
          </div>
          <span className="text-[11px] text-text-muted font-mono">
            {logsError ? 'refresh failed - showing last known events' : 'Auto-refreshing every 15s'}
          </span>
        </div>

        {logsError && !logsData ? (
          <ErrorState
            title="Could not load sync activity"
            message="The activity log request failed."
            onRetry={() => void mutateLogs()}
          />
        ) : (
          <div className="rounded-lg bg-surface-100 p-3 font-mono text-xs text-text border border-border space-y-1.5 max-h-56 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-text-muted py-2">
                No recent sync events have been reported by a vault client.
              </p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-text-muted shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={
                      log.level === 'error'
                        ? 'text-error font-semibold'
                        : log.level === 'warn'
                          ? 'text-warning font-semibold'
                          : 'text-success font-semibold'
                    }
                  >
                    [{log.event || log.level.toUpperCase()}]
                  </span>
                  <span className="text-text-secondary truncate">{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {/* Outstanding Conflicts Section */}
      <Card padding="md" className="space-y-4 border border-border bg-surface rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
              Rebase Conflict Files ({conflicts.length})
            </h3>
            {conflicts.length > 0 && (
              <Badge variant="warning" size="sm">
                Needs resolution
              </Badge>
            )}
          </div>
          <span className="text-xs text-text-muted font-mono">
            {conflictsError
              ? 'refresh failed - showing last known conflicts'
              : conflicts.length === 0
                ? 'None reported by the client'
                : 'Requires user resolution'}
          </span>
        </div>

        {conflictsError && !conflictsData ? (
          <ErrorState
            title="Could not load conflicts"
            message="The conflict list request failed."
            onRetry={() => void mutateConflicts()}
          />
        ) : conflicts.length === 0 ? (
          <EmptyState
            title="No outstanding conflicts"
            description="No conflict files have been reported by a vault client."
          />
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {conflicts.map((conflict) => {
              const isResolving = resolvingId === conflict.id;
              const conflictFileName = conflictFileOf(conflict);
              const detectedAt = detectedAtOf(conflict);

              return (
                <div
                  key={conflict.id}
                  className="p-3.5 bg-surface hover:bg-surface-hover transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => {
                      setSelectedConflict(conflict);
                      setDiffModalOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
                      <p className="font-mono text-xs text-text font-medium truncate hover:underline">
                        {conflictFileName ?? conflict.file}
                      </p>
                    </div>
                    <p className="text-[11px] text-text-muted mt-1 font-mono">
                      Base Note:{' '}
                      <span className="text-text-secondary font-semibold">{conflict.file}</span>
                      {detectedAt
                        ? ` - Detected at: ${new Date(detectedAt).toLocaleString()}`
                        : ' - detection time not reported'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedConflict(conflict);
                        setDiffModalOpen(true);
                      }}
                    >
                      Review &amp; Resolve
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={isResolving}
                      onClick={() => void handleResolveConflict(conflict.id, 'keep-local')}
                    >
                      Keep Local
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={isResolving}
                      onClick={() => void handleResolveConflict(conflict.id, 'accept-incoming')}
                    >
                      Accept Incoming
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Conflict Resolution History */}
      <Card padding="md" className="space-y-3 border border-border bg-surface rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
              Conflict Resolution History
            </h3>
            {historyError && (
              <span className="text-[11px] text-warning">history not refreshed</span>
            )}
          </div>
          <span className="text-xs text-text-muted font-mono">
            {historyData ? `Showing ${historyItems.length} of ${historyTotal}` : ''}
          </span>
        </div>

        {historyLoading && !historyData ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-10 rounded-lg bg-surface-100 animate-pulse" />
            <div className="h-10 rounded-lg bg-surface-100 animate-pulse" />
          </div>
        ) : historyError && !historyData ? (
          <ErrorState
            title="Could not load conflict history"
            message="The conflict history request failed."
            onRetry={() => void mutateHistory()}
          />
        ) : historyItems.length === 0 ? (
          <EmptyState
            title="No resolved conflicts yet"
            description="Resolutions recorded here keep their timestamps so you can audit them later."
          />
        ) : (
          <>
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {historyItems.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-text truncate">{entry.file}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      resolved {formatRelative(resolvedAtOf(entry))}
                    </p>
                  </div>
                  <Badge variant="mono" size="sm">
                    {entry.resolution}
                  </Badge>
                </div>
              ))}
            </div>
            {historyItems.length < historyTotal && (
              <div className="flex justify-center pt-1">
                <Button variant="outline" size="sm" onClick={() => setHistoryLimit((n) => n + 50)}>
                  Load more ({historyTotal - historyItems.length} remaining)
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Reporting Devices */}
      <Card padding="md" className="space-y-3 border border-border bg-surface rounded-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text uppercase tracking-wider">
            Reporting Devices ({devices.length})
          </h3>
          <span className="text-xs text-text-muted font-mono">Latest heartbeat first</span>
        </div>

        {devices.length === 0 ? (
          <EmptyState
            title="No devices have reported yet"
            description="A vaultsync client appears here after its first heartbeat."
          />
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {devices.map((device) => {
              const isLatestReporter =
                statusData?.machine != null && device.machine === statusData.machine;
              return (
                <div
                  key={device.machine}
                  className="p-3.5 bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusDot
                        status={
                          device.status === 'error' || device.status === 'conflict'
                            ? 'warning'
                            : device.status === 'in_sync'
                              ? 'active'
                              : 'disabled'
                        }
                      />
                      <p className="font-mono text-xs text-text font-medium truncate">
                        {device.machine}
                      </p>
                      {isLatestReporter && (
                        <Badge variant="mono" size="sm">
                          Last reported
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted mt-1 font-mono">
                      {device.clientVersion ? `v${device.clientVersion} - ` : ''}
                      heartbeat {formatRelative(device.lastHeartbeat)}
                      {device.status ? ` - ${device.status.replace(/_/g, ' ')}` : ''}
                      {device.lastError ? ` - last error: ${device.lastError}` : ''}
                    </p>
                  </div>
                  <div className="text-[11px] text-text-secondary font-mono shrink-0 sm:text-right">
                    <p>pull {formatRelative(device.lastPullTime)}</p>
                    <p>push {formatRelative(device.lastPushTime)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Direct Configuration Modal */}
      <Modal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        title="Configure Built-in Vault Sync"
        size="md"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div>
            <label
              htmlFor="vault-sync-path"
              className="block text-xs font-semibold text-text uppercase tracking-wider mb-1"
            >
              Local Vault Folder Path
            </label>
            <input
              id="vault-sync-path"
              type="text"
              value={formVaultPath}
              onChange={(e) => setFormVaultPath(e.target.value)}
              placeholder="e.g. ~/Documents/VaeloomVault or C:\Notes\Vault"
              className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface-100 text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Optional, and informational only. The vaultsync client owns its real local path; this
              is just a note for your team.
            </p>
          </div>

          <div>
            <label
              htmlFor="vault-sync-remote"
              className="block text-xs font-semibold text-text uppercase tracking-wider mb-1"
            >
              Private Git Remote Repository URL
            </label>
            <input
              id="vault-sync-remote"
              type="text"
              value={formRemoteUrl}
              onChange={(e) => setFormRemoteUrl(e.target.value)}
              placeholder="e.g. git@github.com:username/private-notes.git or https://github.com/..."
              className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface-100 text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Optional private Git repository for cross-device synchronization.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="vault-sync-branch"
                className="block text-xs font-semibold text-text uppercase tracking-wider mb-1"
              >
                Sync Branch
              </label>
              <input
                id="vault-sync-branch"
                type="text"
                value={formBranch}
                onChange={(e) => setFormBranch(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface-100 text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1">
                Client Status (read-only)
              </label>
              <p className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface-100 text-text-secondary">
                {engineLabel}
              </p>
              <p className="mt-1 text-[11px] text-text-muted">
                Sync runs in the vaultsync client on your machine, so this cannot be changed from
                the web app. Start or stop it locally with <code>vaultsync start</code>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="vault-sync-debounce"
                className="block text-xs font-semibold text-text uppercase tracking-wider mb-1"
              >
                Debounce Commit (seconds)
              </label>
              <input
                id="vault-sync-debounce"
                type="number"
                min={5}
                max={300}
                value={debounceSeconds}
                onChange={(e) => setDebounceSeconds(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface-100 text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label
                htmlFor="vault-sync-rebase"
                className="block text-xs font-semibold text-text uppercase tracking-wider mb-1"
              >
                Rebase Pull Interval (mins)
              </label>
              <input
                id="vault-sync-rebase"
                type="number"
                min={1}
                max={60}
                value={rebaseIntervalMinutes}
                onChange={(e) => setRebounceIntervalMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface-100 text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="auto-ingest-toggle"
              checked={formAutoIngest}
              onChange={(e) => setFormAutoIngest(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <label
              htmlFor="auto-ingest-toggle"
              className="text-xs text-text cursor-pointer select-none font-medium"
            >
              Automatically ingest notes into Vaeloom Documents & Memory Graph
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="ghost" type="button" onClick={() => setConfigModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={savingConfig}>
              Save Configuration
            </Button>
          </div>
        </form>
      </Modal>

      {/* Ingest to Documents & Graph Modal */}
      <Modal
        isOpen={ingestModalOpen}
        onClose={() => setIngestModalOpen(false)}
        title="Ingest Notes to Documents & Memory Graph"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            Ingesting indexes the notes you submit below into workspace Documents under{' '}
            <strong className="text-text">Vault Notes</strong> and extracts concepts into cognitive
            memory for retrieval by your agents. Only the notes you enter here are ingested -
            nothing is read from disk on your behalf.
          </p>

          <div className="rounded-lg border border-border bg-surface-100 p-3 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-text">Active Vault Ingestion Target:</span>
            </div>
            <p className="text-text-muted">
              Destination Folder: <code className="font-mono">Documents &gt; Vault Notes</code>
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
              Add Note for Immediate Indexing (Optional)
            </h4>
            <div>
              <label
                htmlFor="vault-note-filename"
                className="block text-[11px] font-medium text-text-secondary mb-1"
              >
                Note Filename
              </label>
              <input
                id="vault-note-filename"
                type="text"
                placeholder="e.g. Distributed-Consensus.md"
                value={customNoteTitle}
                onChange={(e) => setCustomNoteTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface-100 text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label
                htmlFor="vault-note-content"
                className="block text-[11px] font-medium text-text-secondary mb-1"
              >
                Note Content (Markdown)
              </label>
              <textarea
                id="vault-note-content"
                rows={4}
                placeholder="# Distributed Consensus..."
                value={customNoteContent}
                onChange={(e) => setCustomNoteContent(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface-100 text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label
                htmlFor="vault-note-tags"
                className="block text-[11px] font-medium text-text-secondary mb-1"
              >
                Tags (comma separated)
              </label>
              <input
                id="vault-note-tags"
                type="text"
                value={customNoteTags}
                onChange={(e) => setCustomNoteTags(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface-100 text-text font-mono focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setIngestModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={ingesting}
              onClick={() => void handleExecuteIngest()}
            >
              Start Ingestion
            </Button>
          </div>
        </div>
      </Modal>

      {/* Conflict Diff Modal */}
      {selectedConflict && (
        <Modal
          isOpen={diffModalOpen}
          onClose={() => setDiffModalOpen(false)}
          title={`Resolve Conflict: ${selectedConflict.file}`}
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-xs text-text-secondary">
              Choose which version to preserve. The incoming remote conflict file is{' '}
              <code className="font-mono text-text font-semibold">
                {conflictFileOf(selectedConflict) ?? '(not reported)'}
              </code>
              .
            </p>

            {/* The conflicts API returns file paths and heads, never note bodies.
                The old code rendered two invented strings here, so every conflict
                looked like a real content diff regardless of what differed. Show
                the facts we actually have and point at the files on disk. */}
            <div className="rounded-lg border border-border bg-surface-100 p-3 space-y-2 text-xs">
              <p className="font-semibold text-text">
                Note contents are not available over the API
              </p>
              <p className="text-text-secondary">
                Vaeloom stores the conflict on disk, not in the database. Open{' '}
                <code className="font-mono">{selectedConflict.file}</code> and{' '}
                <code className="font-mono">
                  {conflictFileOf(selectedConflict) ?? 'the conflict file'}
                </code>{' '}
                side by side in your editor or Obsidian to compare them. Resolving below tells the
                vaultsync client which file to keep.
              </p>
              {localHeadOf(selectedConflict)?.slice(0, 8) && (
                <p className="font-mono text-[11px] text-text-muted">
                  local {localHeadOf(selectedConflict)?.slice(0, 8)} / remote{' '}
                  {remoteHeadOf(selectedConflict)?.slice(0, 8) ?? 'unknown'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono pt-2">
              <div className="rounded-lg border border-border p-3 bg-surface-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-success">Local Version</span>
                  <Badge variant="success" size="sm">
                    Current Disk
                  </Badge>
                </div>
                <p className="text-[11px] text-text-secondary font-sans">
                  Retains the current working file on this computer. The incoming remote version is
                  archived.
                </p>
              </div>

              <div className="rounded-lg border border-warning/40 p-3 bg-warning/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-warning">Incoming Version</span>
                  <Badge variant="warning" size="sm">
                    Remote Git
                  </Badge>
                </div>
                <p className="text-[11px] text-text-secondary font-sans">
                  Overwrites the working file with the remote branch contents.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="ghost" onClick={() => setDiffModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                loading={resolvingId === selectedConflict.id}
                onClick={() => void handleResolveConflict(selectedConflict.id, 'keep-local')}
              >
                Keep Local Version
              </Button>
              <Button
                variant="primary"
                loading={resolvingId === selectedConflict.id}
                onClick={() => void handleResolveConflict(selectedConflict.id, 'accept-incoming')}
              >
                Accept Incoming Version
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
