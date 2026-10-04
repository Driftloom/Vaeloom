import * as fs from 'fs';
import * as path from 'path';
import { VaultSyncConfig } from './config.js';
import { GitClient } from './git.js';
import { findOutstandingConflictFiles, loadConflictRecords, getSyncLogPath } from './conflict.js';

export interface VaultStatusReport {
  vaultPath: string;
  isGitRepo: boolean;
  isGitAvailable: boolean;
  branch: string;
  remoteUrl: string | null;
  lastCommit: { hash: string; message: string; date: string } | null;
  uncommittedChanges: boolean;
  lastPushTime: string | null;
  lastPullTime: string | null;
  lastError: string | null;
  outstandingConflicts: string[];
  recentLogs: string[];
}

export async function getVaultStatus(config: VaultSyncConfig): Promise<VaultStatusReport> {
  const git = new GitClient(config.vaultPath);
  const gitAvailable = await git.isGitAvailable();
  const isRepo = await git.isGitRepo();

  if (!isRepo) {
    return {
      vaultPath: config.vaultPath,
      isGitRepo: false,
      isGitAvailable: gitAvailable,
      branch: 'none',
      remoteUrl: null,
      lastCommit: null,
      uncommittedChanges: false,
      lastPushTime: null,
      lastPullTime: null,
      lastError: null,
      outstandingConflicts: [],
      recentLogs: [],
    };
  }

  const branch = await git.getCurrentBranch();
  const remoteUrl = await git.getRemoteUrl(config.remoteName);
  const lastCommit = await git.getLatestCommit();
  const uncommittedChanges = await git.hasUncommittedChanges();
  const outstandingConflicts = findOutstandingConflictFiles(config.vaultPath);
  const rebaseInProgress = await git.isRebaseInProgress();

  // Extract last pull/push times and the newest error from sync.log.
  let lastPushTime: string | null = null;
  let lastPullTime: string | null = null;
  let lastError: string | null = null;
  const recentLogs: string[] = [];

  const logFile = getSyncLogPath(config.vaultPath);
  if (fs.existsSync(logFile)) {
    try {
      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      recentLogs.push(...lines.slice(-10));

      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]!;
        if (!lastPushTime && line.includes('PUSH SUCCESS:')) {
          const match = line.match(/\[(.*?)\]/);
          if (match) lastPushTime = match[1] || null;
        }
        if (!lastPullTime && line.includes('PULL SUCCESS:')) {
          const match = line.match(/\[(.*?)\]/);
          if (match) lastPullTime = match[1] || null;
        }
        // Surface the newest failure so a silent sync break is visible.
        if (
          !lastError &&
          /\b(PULL ERROR|PUSH ERROR|PUSH BLOCKED|PULL EXCEPTION|REBASE WARNING):/.test(line)
        ) {
          lastError = line.replace(/^\[[^\]]*\]\s*/, '');
        }
        if (lastPushTime && lastPullTime && lastError) break;
      }
    } catch {
      // Ignore read errors
    }
  }

  if (rebaseInProgress) {
    lastError =
      'A rebase is in progress and unresolved. Push is blocked to protect history. Run `git rebase --abort` inside the vault to cancel, then retry.';
  }

  return {
    vaultPath: config.vaultPath,
    isGitRepo: true,
    isGitAvailable: gitAvailable,
    branch,
    remoteUrl,
    lastCommit,
    uncommittedChanges,
    lastPushTime,
    lastPullTime,
    lastError,
    outstandingConflicts,
    recentLogs,
  };
}

export function formatStatusReport(report: VaultStatusReport): string {
  const lines: string[] = [];
  lines.push('======================================================');
  lines.push('  VAELOOM VAULT SYNC STATUS');
  lines.push('======================================================');
  lines.push(`Vault Location : ${report.vaultPath}`);
  if (!report.isGitAvailable) {
    lines.push('Git Binary     : NOT FOUND (sync disabled; notes + in-app memory still work)');
  }
  lines.push(
    `Git Repository : ${report.isGitRepo ? 'Initialized (OK)' : 'Not Initialized (run vaultsync init)'}`,
  );
  lines.push(`Active Branch  : ${report.branch}`);
  lines.push(`Remote URL     : ${report.remoteUrl || '(No remote configured)'}`);
  lines.push(
    `Last Commit    : ${report.lastCommit ? `${report.lastCommit.hash.slice(0, 8)} - ${report.lastCommit.message}` : 'None'}`,
  );
  lines.push(
    `Uncommitted    : ${report.uncommittedChanges ? 'YES (pending debounced auto-sync)' : 'Clean (all changes synced)'}`,
  );
  lines.push(
    `Last Pull Time : ${report.lastPullTime ? new Date(report.lastPullTime).toLocaleString() : 'Never'}`,
  );
  lines.push(
    `Last Push Time : ${report.lastPushTime ? new Date(report.lastPushTime).toLocaleString() : 'Never'}`,
  );
  lines.push('------------------------------------------------------');

  if (report.lastError) {
    lines.push(`Last Error     : ${report.lastError}`);
  } else {
    lines.push('Last Error     : None');
  }

  if (report.outstandingConflicts.length === 0) {
    lines.push('Conflicts      : 0 outstanding conflict files (In Sync)');
  } else {
    lines.push(
      `Conflicts      : ${report.outstandingConflicts.length} OUTSTANDING CONFLICT FILE(S) NEED REVIEW:`,
    );
    for (const file of report.outstandingConflicts) {
      lines.push(`  - ${file}`);
    }
    lines.push('\nTo resolve:');
    lines.push('  vaultsync resolve <file> --keep-local');
    lines.push('  vaultsync resolve <file> --accept-incoming');
  }

  lines.push('======================================================');
  return lines.join('\n');
}
