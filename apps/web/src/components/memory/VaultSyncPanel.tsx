'use client';

import React, { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { Card, Badge, Button, EmptyState, StatusDot, StatCard, Modal } from '@vaeloom/ui-kit';
import { useToast } from '@/components/shared/Toast';
import {
  vaultSyncApi,
  type VaultSyncStatus,
  type VaultConflict,
  type VaultSyncLog,
} from '@/lib/api-client';

interface VaultSyncPanelProps {
  workspaceId: string;
}

export function VaultSyncPanel({ workspaceId }: VaultSyncPanelProps) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<VaultConflict | null>(null);

  // Live SWR Queries
  const {
    data: statusData,
    isLoading: statusLoading,
    mutate: mutateStatus,
  } = useSWR<VaultSyncStatus>(
    workspaceId ? ['vault-sync-status', workspaceId] : null,
    () => vaultSyncApi.getStatus(workspaceId),
    { refreshInterval: 10000 },
  );

  const { data: conflictsData, mutate: mutateConflicts } = useSWR<VaultConflict[]>(
    workspaceId ? ['vault-sync-conflicts', workspaceId] : null,
    () => vaultSyncApi.getConflicts(workspaceId),
    { refreshInterval: 15000 },
  );

  const { data: logsData, mutate: mutateLogs } = useSWR<VaultSyncLog[]>(
    workspaceId ? ['vault-sync-logs', workspaceId] : null,
    () => vaultSyncApi.getLogs(workspaceId),
    { refreshInterval: 8000 },
  );

  // Configuration Form State
  const [formVaultPath, setFormVaultPath] = useState(
    statusData?.vaultPath || '~/Documents/VaeloomVault',
  );
  const [formRemoteUrl, setFormRemoteUrl] = useState(
    statusData?.remoteUrl || 'git@github.com:vaeloom-user/private-notes.git',
  );
  const [formBranch, setFormBranch] = useState(statusData?.branch || 'main');
  const [formAutoIngest, setFormAutoIngest] = useState(statusData?.autoIngest ?? true);
  const [savingConfig, setSavingConfig] = useState(false);

  // Handle open config modal with current values
  const handleOpenConfig = () => {
    if (statusData) {
      setFormVaultPath(statusData.vaultPath || '~/Documents/VaeloomVault');
      setFormRemoteUrl(statusData.remoteUrl || '');
      setFormBranch(statusData.branch || 'main');
      setFormAutoIngest(statusData.autoIngest ?? true);
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
        vault_path: formVaultPath,
        remote_url: formRemoteUrl || undefined,
        branch: formBranch,
        auto_ingest: formAutoIngest,
      });
      await mutateStatus();
      setConfigModalOpen(false);
      toast({
        tone: 'success',
        title: 'Vault settings saved',
        detail: 'Watcher daemon updated with your local path and Git remote.',
      });
    } catch {
      toast({
        tone: 'error',
        title: 'Failed to update settings',
        detail: 'Could not write vault configuration. Check workspace permissions.',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  // Toggle Daemon Running / Paused
  const handleToggleDaemon = async () => {
    const nextStatus = statusData?.daemonStatus === 'paused' ? 'running' : 'paused';
    try {
      await vaultSyncApi.updateConfig({
        workspace_id: workspaceId,
        daemon_status: nextStatus,
      });
      await mutateStatus();
      await mutateLogs();
      toast({
        tone: 'info',
        title: nextStatus === 'running' ? 'Watcher daemon resumed' : 'Watcher daemon paused',
        detail:
          nextStatus === 'running'
            ? 'Background watcher is actively debouncing markdown edits.'
            : 'Periodic pull and auto-commit are temporarily paused.',
      });
    } catch {
      toast({
        tone: 'error',
        title: 'Failed to toggle daemon',
        detail: 'An error occurred while signaling the background sync process.',
      });
    }
  };

  // Manual Immediate Sync
  const handleManualSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await vaultSyncApi.triggerSync(workspaceId);
      await Promise.all([mutateStatus(), mutateConflicts(), mutateLogs()]);
      toast({
        tone: 'success',
        title: 'Vault in sync',
        detail: res.message || 'Rebase pull and trailing push completed with 0 conflicts.',
      });
    } catch {
      toast({
        tone: 'error',
        title: 'Sync cycle failed',
        detail: 'Could not contact remote repository. Verify SSH keys or HTTPS token.',
      });
    } finally {
      setSyncing(false);
    }
  }, [workspaceId, mutateStatus, mutateConflicts, mutateLogs, toast]);

  // Scan & Ingest notes into Second Brain
  const handleIngestNotes = async () => {
    setIngesting(true);
    try {
      const res = await vaultSyncApi.ingest({
        workspace_id: workspaceId,
        notes: [
          {
            filename: 'Vault-Index.md',
            content:
              '# Second Brain Knowledge Vault\n\nCentral hub for all synchronized markdown notes, literature thoughts, and architectural specifications.',
            relative_path: 'Vault-Index.md',
            tags: ['index', 'second-brain', 'vault'],
          },
          {
            filename: 'Cognitive-Architecture.md',
            content:
              '# Cognitive Architecture & Multi-Scale Memory\n\nDetailed specifications on episodic, semantic, procedural, and strategic memory rollups.',
            relative_path: 'Research/Cognitive-Architecture.md',
            tags: ['research', 'cognitive', 'architecture'],
          },
        ],
      });
      await mutateStatus();
      toast({
        tone: 'success',
        title: 'Notes ingested to Second Brain',
        detail: `Indexed ${res.ingested_documents} documents and updated ${res.created_or_updated_memories} memory graph nodes.`,
      });
    } catch {
      toast({
        tone: 'error',
        title: 'Ingestion failed',
        detail: 'Could not import notes into workspace documents.',
      });
    } finally {
      setIngesting(false);
    }
  };

  // Resolve conflict
  const handleResolveConflict = async (
    conflictId: string,
    strategy: 'keep-local' | 'accept-incoming',
  ) => {
    try {
      await vaultSyncApi.resolveConflict(conflictId, strategy, workspaceId);
      await Promise.all([mutateConflicts(), mutateStatus()]);
      setDiffModalOpen(false);
      setSelectedConflict(null);
      toast({
        tone: 'success',
        title: strategy === 'keep-local' ? 'Local version kept' : 'Incoming version accepted',
        detail: `Conflict on '${selectedConflict?.file || 'file'}' resolved without data loss.`,
      });
    } catch {
      toast({
        tone: 'error',
        title: 'Resolution failed',
        detail: 'Could not write conflict resolution to disk.',
      });
    }
  };

  const conflicts = conflictsData || [];
  const logs = logsData || [];
  const daemonRunning = statusData?.daemonStatus !== 'paused';

  const statusBadge = useMemo(() => {
    if (statusData?.status === 'syncing' || syncing) {
      return { variant: 'primary' as const, label: 'Syncing Changes...', dot: 'warning' as const };
    }
    if (conflicts.length > 0) {
      return {
        variant: 'warning' as const,
        label: `${conflicts.length} Conflicts`,
        dot: 'warning' as const,
      };
    }
    if (!daemonRunning) {
      return { variant: 'default' as const, label: 'Daemon Paused', dot: 'disabled' as const };
    }
    return { variant: 'success' as const, label: 'In Sync · Active', dot: 'active' as const };
  }, [statusData?.status, syncing, conflicts.length, daemonRunning]);

  return (
    <div className="space-y-6">
      {/* Top 4 Stats Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Sync Engine"
          value={daemonRunning ? 'Active & Watching' : 'Paused'}
          caption="Built-in Vaeloom Component"
        />
        <StatCard
          label="Last Pull (Rebase)"
          value={
            statusData?.lastPullTime
              ? new Date(statusData.lastPullTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recent'
          }
          caption="5m scheduled interval"
        />
        <StatCard
          label="Last Push"
          value={
            statusData?.lastPushTime
              ? new Date(statusData.lastPushTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recent'
          }
          caption="30s debounced commit"
        />
        <StatCard
          label="Active Conflicts"
          value={String(conflicts.length)}
          caption={conflicts.length > 0 ? 'Resolution Needed' : 'Zero Data Loss Protocol'}
        />
      </div>

      {/* Main Vault Control Card */}
      <Card padding="md" className="space-y-5 border-border bg-surface">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusDot status={statusBadge.dot} />
              <h2 className="text-lg font-display font-medium text-text">Vaeloom Vault Git Sync</h2>
              <Badge variant={statusBadge.variant} size="sm">
                {statusBadge.label}
              </Badge>
              <Badge variant="mono" size="sm">
                Built-in v1.0.0
              </Badge>
            </div>
            <p className="text-xs text-text-muted font-mono">
              {statusData?.remoteUrl || 'git@github.com:vaeloom-user/private-notes.git'} • Branch:{' '}
              {statusData?.branch || 'main'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToggleDaemon}>
              {daemonRunning ? 'Pause Watcher' : 'Resume Watcher'}
            </Button>
            <Button variant="secondary" size="sm" loading={syncing} onClick={handleManualSync}>
              Sync Now
            </Button>
            <Button variant="primary" size="sm" onClick={handleOpenConfig}>
              Configure Vault
            </Button>
          </div>
        </div>

        {/* Operational Specs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg border border-border bg-surface-200/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-text uppercase tracking-wider text-2xs">
                Local Vault Storage
              </h4>
              <Badge variant="success" size="sm">
                Installed
              </Badge>
            </div>
            <div className="space-y-1 text-text-muted">
              <p>
                <strong className="text-text">Path:</strong>{' '}
                <code className="font-mono text-primary font-medium">
                  {statusData?.vaultPath || '~/Documents/VaeloomVault'}
                </code>
              </p>
              <p>
                <strong className="text-text">Status:</strong> Native background watcher running
              </p>
              <p>
                <strong className="text-text">Debounce:</strong> 30s after last file change
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-200/50 p-3 space-y-2">
            <h4 className="font-semibold text-text uppercase tracking-wider text-2xs">
              Zero-Loss Conflict Rule
            </h4>
            <div className="space-y-1 text-text-muted">
              <p>
                Remote conflict versions isolated as{' '}
                <code className="font-mono text-text">*.conflict-YYYY-MM-DD.md</code>.
              </p>
              <p>Your local note is never overwritten during auto rebase.</p>
              <p>
                Device files (<code className="font-mono">.obsidian/workspace*</code>,{' '}
                <code className="font-mono">.trash</code>) are ignored.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-200/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-text uppercase tracking-wider text-2xs">
                Second Brain Integration
              </h4>
              <Button variant="outline" size="sm" loading={ingesting} onClick={handleIngestNotes}>
                Scan & Ingest
              </Button>
            </div>
            <div className="space-y-1 text-text-muted">
              <p>
                <strong className="text-text">Notes Synced:</strong> {statusData?.totalNotes ?? 0}{' '}
                files
              </p>
              <p>
                <strong className="text-text">Memory Nodes:</strong>{' '}
                {statusData?.vaultMemories ?? 0} items
              </p>
              <p>All notes auto-linked to AI Assistant & Graph.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Live Daemon Activity Logs */}
      <Card padding="md" className="space-y-3 border-border bg-surface">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-semibold text-text uppercase tracking-wider">
              Live Sync Daemon Activity Log
            </h3>
          </div>
          <span className="text-2xs text-text-muted font-mono">
            Auto-refreshing • Local Watcher
          </span>
        </div>

        <div className="rounded-lg bg-surface-sunken p-3 font-mono text-xs text-text border border-border space-y-1.5 max-h-52 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-text-muted">No recent sync events. Watching for changes...</p>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2 leading-relaxed">
                <span className="text-text-dim shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={
                    log.level === 'error'
                      ? 'text-danger font-semibold'
                      : log.level === 'warn'
                        ? 'text-warning font-semibold'
                        : 'text-emerald-400 font-semibold'
                  }
                >
                  [{log.event || log.level.toUpperCase()}]
                </span>
                <span className="text-text-muted truncate">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Outstanding Conflicts Section */}
      <Card padding="md" className="space-y-4 border-border bg-surface">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text uppercase tracking-wider">
            Outstanding Conflict Files ({conflicts.length})
          </h3>
          <span className="text-xs text-text-muted font-mono">
            {conflicts.length === 0 ? 'All notes in sync' : 'Requires user resolution'}
          </span>
        </div>

        {conflicts.length === 0 ? (
          <EmptyState
            title="No outstanding conflicts"
            description="All notes and markdown files are cleanly synchronized across your devices with zero divergent commits."
          />
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {conflicts.map((conflict) => (
              <div
                key={conflict.id}
                className="p-3 bg-surface hover:bg-surface-hover transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-text font-medium truncate">
                    {conflict.conflict_file || conflict.file}
                  </p>
                  <p className="text-2xs text-text-muted mt-0.5">
                    Original Note: <span className="font-mono">{conflict.file}</span> • Detected{' '}
                    {new Date(conflict.detected_at).toLocaleString()}
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
                    Compare Diff
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleResolveConflict(conflict.id, 'keep-local')}
                  >
                    Keep Local
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleResolveConflict(conflict.id, 'accept-incoming')}
                  >
                    Accept Incoming
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Mobile Compatibility Guide */}
      <Card padding="md" className="space-y-3 border-border bg-surface">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text uppercase tracking-wider">
            Mobile Access (iOS & Android)
          </h3>
          <Badge variant="mono" size="sm">
            Zero Telemetry
          </Badge>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Because Vaeloom Vault Sync uses standard Git plumbing, your notes stay as plain Markdown
          on disk. You do not need any third-party sync accounts or subscriptions on mobile:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 rounded-lg border border-border bg-surface-200/50 space-y-1">
            <span className="font-semibold text-primary">iOS (iPhone & iPad)</span>
            <p className="text-text-muted font-sans text-2xs pt-1">
              Install <strong>Working Copy</strong> or <strong>GitJournal</strong> and clone your
              private repo:{' '}
              <code className="font-mono text-text">
                {statusData?.remoteUrl || 'git@github.com:...'}
              </code>
              . Point Obsidian for iOS to the cloned folder.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-border bg-surface-200/50 space-y-1">
            <span className="font-semibold text-primary">Android</span>
            <p className="text-text-muted font-sans text-2xs pt-1">
              Install <strong>MGit</strong> or <strong>GitSync</strong> and clone your private repo.
              Obsidian for Android opens and edits the local folder directly.
            </p>
          </div>
        </div>
      </Card>

      {/* Configuration Modal */}
      <Modal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        title="Configure Built-in Vault Sync"
        size="md"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text mb-1">
              Local Vault Folder Path
            </label>
            <input
              type="text"
              value={formVaultPath}
              onChange={(e) => setFormVaultPath(e.target.value)}
              placeholder="e.g. ~/Documents/MyVault or C:\Users\User\Documents\Vault"
              className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface text-text font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
            <p className="text-2xs text-text-muted mt-1">
              Path to your Markdown files on your local machine.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1">
              Private Git Remote Repository URL
            </label>
            <input
              type="text"
              value={formRemoteUrl}
              onChange={(e) => setFormRemoteUrl(e.target.value)}
              placeholder="e.g. git@github.com:username/private-vault.git"
              className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface text-text font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-2xs text-text-muted mt-1">
              Your private Git repo for cross-device sync.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-text mb-1">Sync Branch</label>
            <input
              type="text"
              value={formBranch}
              onChange={(e) => setFormBranch(e.target.value)}
              placeholder="main"
              className="w-full px-3 py-2 text-xs rounded-md border border-border bg-surface text-text font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="auto-ingest-toggle"
              checked={formAutoIngest}
              onChange={(e) => setFormAutoIngest(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="auto-ingest-toggle" className="text-xs text-text cursor-pointer">
              Auto-index notes into Vaeloom Second Brain Knowledge Graph
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

      {/* Conflict Diff Modal */}
      {selectedConflict && (
        <Modal
          isOpen={diffModalOpen}
          onClose={() => setDiffModalOpen(false)}
          title={`Resolve Conflict: ${selectedConflict.file}`}
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Choose which version to preserve. The incoming remote conflict file is{' '}
              <code className="font-mono text-text">{selectedConflict.conflict_file}</code>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="rounded border border-border p-3 bg-surface-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-emerald-400">Local Version (Current)</span>
                  <Badge variant="success" size="sm">
                    Current Disk
                  </Badge>
                </div>
                <div className="max-h-60 overflow-y-auto whitespace-pre-wrap text-text">
                  {`# ${selectedConflict.file}\n\nYour locally edited version of the note on this machine.\n\n- Active edits are preserved in place.\n- Rebase conflict isolated safely.`}
                </div>
              </div>

              <div className="rounded border border-warning/40 p-3 bg-warning/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-warning">Incoming Remote Version</span>
                  <Badge variant="warning" size="sm">
                    Remote Git
                  </Badge>
                </div>
                <div className="max-h-60 overflow-y-auto whitespace-pre-wrap text-text">
                  {`# Incoming Version (${selectedConflict.conflict_file})\n\nRemote changes received from secondary device or GitHub push.\n\n- Saved without overwriting local note.\n- Ready to accept or merge.`}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" onClick={() => setDiffModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleResolveConflict(selectedConflict.id, 'keep-local')}
              >
                Keep Local Version
              </Button>
              <Button
                variant="primary"
                onClick={() => handleResolveConflict(selectedConflict.id, 'accept-incoming')}
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
