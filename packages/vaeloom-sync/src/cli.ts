#!/usr/bin/env node
import * as path from 'path';
import { loadConfig, resolveVaultPath, saveConfig, DEFAULT_CONFIG } from './config.js';
import { GitClient } from './git.js';
import { VaultSyncWatcher } from './watcher.js';
import { getVaultStatus, formatStatusReport } from './status.js';
import { findOutstandingConflictFiles, resolveConflictFile } from './conflict.js';

function printHelp(): void {
  console.log(`
Vaeloom Vault Sync (vaultsync / vaeloom-sync)
Git-backed local Markdown vault sync engine for Second Brain notes.

Usage:
  vaultsync <command> [options]

Commands:
  status [vaultPath]       Show current sync status, last push/pull, and conflicts
                           Options: --json (output as machine-readable JSON)
  start [vaultPath]        Start background sync watcher with 30s debounce & 5m rebase
  sync [vaultPath]         Perform immediate one-shot pull, commit, and push
  init [vaultPath]         Initialize git repository, install .gitignore, and config
                           Options: --remote <url>  Set remote repository URL
                                    --branch <name> Set default branch (default: main)
  conflicts [vaultPath]    List all outstanding .conflict-*.md files
  resolve <file>           Resolve a conflict file
                           Options: --keep-local (keep your version, discard incoming)
                                    --accept-incoming (overwrite with incoming version)
  help, -h, --help         Show this help message

Environment Variables:
  VAELOOM_VAULT_PATH       Default path to your local markdown vault folder
  VAELOOM_REMOTE_URL       Default remote git URL (e.g. git@github.com:user/notes.git)
  VAELOOM_BRANCH           Git branch to sync with (default: main)
  VAELOOM_DEBOUNCE_MS      Debounce delay after edits (default: 30000 ms)
  VAELOOM_PULL_INTERVAL_MS Periodic pull interval (default: 300000 ms = 5 min)

Optional Vaeloom API reporting (lets the web app show real sync status):
  VAELOOM_API_URL          API base, e.g. http://localhost:8000
  VAELOOM_API_TOKEN        Bearer token for the API
  VAELOOM_WORKSPACE_ID     Workspace to report status for
  Without all three the vault still syncs locally; the web app shows
  "No client connected". Reporting is best-effort and never blocks syncing.
`);
}

// Optional API reporting. All three must be present or reporting is skipped,
// which keeps the vault fully functional without any Vaeloom account.
function reporterOptionsFromEnv(): {
  apiBaseUrl?: string;
  token?: string;
  workspaceId?: string;
} {
  const apiBaseUrl = process.env['VAELOOM_API_URL'];
  const token = process.env['VAELOOM_API_TOKEN'];
  const workspaceId = process.env['VAELOOM_WORKSPACE_ID'];
  if (!apiBaseUrl || !token || !workspaceId) {
    return {};
  }
  return { apiBaseUrl, token, workspaceId };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  // Parse options
  const isJson = args.includes('--json');
  const keepLocal = args.includes('--keep-local');
  const acceptIncoming = args.includes('--accept-incoming');
  const remoteIdx = args.indexOf('--remote');
  const remoteArg = remoteIdx !== -1 ? args[remoteIdx + 1] : undefined;
  const branchIdx = args.indexOf('--branch');
  const branchArg = branchIdx !== -1 ? args[branchIdx + 1] : undefined;

  // First non-flag argument after command is vaultPath or target file
  const positional = args
    .slice(1)
    .filter((a) => !a.startsWith('--') && a !== remoteArg && a !== branchArg);
  const targetPath = positional[0];

  switch (command) {
    case 'status': {
      const vaultPath = resolveVaultPath(targetPath);
      const config = loadConfig(vaultPath);
      const report = await getVaultStatus(config);
      if (isJson) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatStatusReport(report));
      }
      break;
    }

    case 'init': {
      const vaultPath = resolveVaultPath(targetPath);
      console.log(`[vaultsync] Initializing vault at ${vaultPath}...`);
      const git = new GitClient(vaultPath);
      const branch = branchArg || DEFAULT_CONFIG.branch;
      await git.initRepo(branch);
      await git.ensureGitignore(DEFAULT_CONFIG.ignoredPatterns);

      const config = loadConfig(vaultPath);
      if (remoteArg) {
        await git.setRemoteUrl(remoteArg, config.remoteName);
        config.remoteUrl = remoteArg;
      }
      if (branchArg) {
        config.branch = branchArg;
      }
      saveConfig(config);

      console.log(`[vaultsync] Vault successfully initialized.`);
      console.log(`  - Git repository: OK`);
      console.log(`  - Standard .gitignore installed (.obsidian/workspace*, .trash, cache)`);
      console.log(`  - Config saved: ${vaultPath}/.vaeloom/sync-config.json`);
      if (remoteArg) {
        console.log(`  - Remote origin set to: ${remoteArg}`);
      }
      break;
    }

    case 'start': {
      const vaultPath = resolveVaultPath(targetPath);
      const config = loadConfig(vaultPath);
      const watcher = new VaultSyncWatcher(config, reporterOptionsFromEnv());

      process.on('SIGINT', async () => {
        console.log('\n[vaultsync] Shutting down watcher...');
        await watcher.stop();
        process.exit(0);
      });
      process.on('SIGTERM', async () => {
        await watcher.stop();
        process.exit(0);
      });

      await watcher.start();
      console.log('[vaultsync] Sync daemon running. Press Ctrl+C to stop.');
      break;
    }

    case 'sync': {
      const vaultPath = resolveVaultPath(targetPath);
      const config = loadConfig(vaultPath);
      const watcher = new VaultSyncWatcher(config);
      console.log(`[vaultsync] Executing one-shot sync for ${vaultPath}...`);
      await watcher.syncNow();
      console.log(`[vaultsync] Sync complete.`);
      const report = await getVaultStatus(config);
      console.log(formatStatusReport(report));
      break;
    }

    case 'conflicts': {
      const vaultPath = resolveVaultPath(targetPath);
      const conflicts = findOutstandingConflictFiles(vaultPath);
      if (isJson) {
        console.log(JSON.stringify({ vaultPath, conflicts }, null, 2));
      } else {
        console.log(`\nOutstanding Conflict Files in: ${vaultPath}`);
        if (conflicts.length === 0) {
          console.log('  No conflicts found. All notes are in sync.');
        } else {
          for (const c of conflicts) {
            console.log(`  - ${c}`);
          }
          console.log('\nResolve with:');
          console.log('  vaultsync resolve <conflictFile> --keep-local');
          console.log('  vaultsync resolve <conflictFile> --accept-incoming');
        }
      }
      break;
    }

    case 'resolve': {
      if (!targetPath) {
        console.error('Error: specify the conflict file to resolve.');
        process.exit(1);
      }
      const vaultPath = resolveVaultPath();
      const strategy = acceptIncoming ? 'accept-incoming' : 'keep-local';
      const git = new GitClient(vaultPath);
      const result = await resolveConflictFile(vaultPath, targetPath, strategy, git);
      if (result.success) {
        console.log(`[vaultsync] ${result.message}`);
      } else {
        console.error(`[vaultsync] Error: ${result.message}`);
        process.exit(1);
      }
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

void main();
