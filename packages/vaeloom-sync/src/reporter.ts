import * as fs from 'fs';
import * as os from 'os';

import { GitClient } from './git.js';
import { VaultSyncConfig } from './config.js';
import { findOutstandingConflictFiles, loadConflictRecords, getSyncLogPath } from './conflict.js';

const CLIENT_VERSION = '0.1.0';
const DEFAULT_REPORT_INTERVAL_MS = 60000;

/**
 * Pushes this machine's real sync state to the Vaeloom API.
 *
 * The server has no git engine, so this is what makes the web UI truthful:
 * without it the API can only ever report "no client connected". Reporting is
 * best-effort — a vault must keep working when the API is unreachable or no
 * token is configured, so every failure here is swallowed and logged, never
 * thrown into the sync loop.
 */
export interface VaultReporterOptions {
  apiBaseUrl?: string;
  token?: string;
  workspaceId?: string;
  intervalMs?: number;
}

export interface ReportResult {
  attempted: number;
  succeeded: number;
  skipped: number;
  lastError: string | null;
}

export class VaultReporter {
  private timer: NodeJS.Timeout | null = null;
  private lastState: ReportResult = {
    attempted: 0,
    succeeded: 0,
    skipped: 0,
    lastError: null,
  };

  constructor(
    private readonly config: VaultSyncConfig,
    private readonly options: VaultReporterOptions = {},
  ) {}

  public isConfigured(): boolean {
    return Boolean(this.options.apiBaseUrl && this.options.token && this.options.workspaceId);
  }

  public getState(): ReportResult {
    return { ...this.lastState };
  }

  /** Collect real state from this machine. Never throws. */
  private async collectState(): Promise<Record<string, unknown>> {
    const git = new GitClient(this.config.vaultPath);

    const [branch, remoteUrl, status, latest, conflicts, outstanding] = await Promise.all([
      git.getCurrentBranch(),
      git.getRemoteUrl(this.config.remoteName),
      git.getStatusSummary(),
      git.getLatestCommit(),
      Promise.resolve(loadConflictRecords(this.config.vaultPath)),
      Promise.resolve(findOutstandingConflictFiles(this.config.vaultPath)),
    ]);

    const unresolved = conflicts.filter((c) => !c.resolved);
    const recentLogs = this.readRecentLogs();

    // A conflict is only reported while its .conflict-*.md file still exists on
    // disk, so a resolved conflict disappears without the server guessing.
    const conflictPayload = unresolved
      .filter((c) => outstanding.includes(c.conflictFile))
      .map((c) => ({
        id: c.id,
        file: c.originalFile,
        conflict_file: c.conflictFile,
        detected_at: c.timestamp,
        resolved: false,
      }));

    let lastError: string | null = null;
    if (status.conflicted.length > 0) {
      lastError = `PULL ERROR: ${status.conflicted.length} unresolved conflict(s) need review`;
    }

    return {
      workspace_id: this.options.workspaceId,
      client_version: CLIENT_VERSION,
      machine: `${os.platform()}-${os.hostname()}`,
      branch,
      remote_url: remoteUrl ?? undefined,
      sync_state: status.conflicted.length > 0 ? 'error' : 'idle',
      last_pull_time: latest?.date ?? null,
      last_push_time: latest?.date ?? null,
      last_error: lastError,
      conflicts: conflictPayload,
      logs: recentLogs,
    };
  }

  private readRecentLogs(): Array<Record<string, unknown>> {
    const logPath = getSyncLogPath(this.config.vaultPath);
    if (!fs.existsSync(logPath)) return [];
    try {
      const lines = fs
        .readFileSync(logPath, 'utf-8')
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
        .slice(-20);
      return lines.map((line) => {
        const m = line.match(/^\[([^\]]+)\]\s*(.*)$/);
        const message = m?.[2] ?? line;
        const level = /\b(ERROR|BLOCKED|EXCEPTION|WARNING)\b/.test(message) ? 'warning' : 'info';
        return {
          timestamp: m?.[1] ?? null,
          level,
          message,
          event: 'client_sync',
        };
      });
    } catch {
      return [];
    }
  }

  /** Send one report. Returns the outcome; never throws. */
  public async reportOnce(): Promise<ReportResult> {
    if (!this.isConfigured()) {
      this.lastState = {
        attempted: 0,
        succeeded: 0,
        skipped: 1,
        lastError: null,
      };
      return this.getState();
    }

    this.lastState.attempted += 1;
    try {
      const payload = await this.collectState();
      const res = await fetch(
        `${this.options.apiBaseUrl!.replace(/\/$/, '')}/api/v1/vault-sync/report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.options.token}`,
          },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      this.lastState.succeeded += 1;
      this.lastState.lastError = null;
    } catch (err) {
      this.lastState.lastError = err instanceof Error ? err.message : String(err);
    }
    return this.getState();
  }

  public start(): void {
    if (this.timer) return;
    const interval = this.options.intervalMs ?? DEFAULT_REPORT_INTERVAL_MS;
    void this.reportOnce();
    this.timer = setInterval(() => {
      void this.reportOnce();
    }, interval);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
