import chokidar from 'chokidar';
import * as path from 'path';
import { VaultSyncConfig } from './config.js';
import { GitClient } from './git.js';
import { handleRebaseConflicts, logSyncMessage } from './conflict.js';

export interface WatcherState {
  isWatching: boolean;
  lastPushTime: string | null;
  lastPullTime: string | null;
  lastCommitHash: string | null;
  pendingChangesCount: number;
  syncInProgress: boolean;
}

export class VaultSyncWatcher {
  private git: GitClient;
  private watcher: chokidar.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pullIntervalTimer: NodeJS.Timeout | null = null;
  private state: WatcherState = {
    isWatching: false,
    lastPushTime: null,
    lastPullTime: null,
    lastCommitHash: null,
    pendingChangesCount: 0,
    syncInProgress: false,
  };
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(public readonly config: VaultSyncConfig) {
    this.git = new GitClient(config.vaultPath);
  }

  public getState(): WatcherState {
    return { ...this.state };
  }

  /**
   * Serializes git operations through a single queue to prevent git index collisions.
   */
  private queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.operationQueue = this.operationQueue.then(async () => {
        try {
          const res = await operation();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
   * Start the watcher and periodic pull timer.
   */
  public async start(): Promise<void> {
    if (this.state.isWatching) {
      console.log(`[vaeloom-sync] Already watching ${this.config.vaultPath}`);
      return;
    }

    await this.git.initRepo(this.config.branch);
    await this.git.ensureGitignore(this.config.ignoredPatterns);

    console.log(`[vaeloom-sync] Initializing watcher for vault: ${this.config.vaultPath}`);
    console.log(`[vaeloom-sync] Debounce window: ${this.config.debounceMs / 1000}s`);
    console.log(`[vaeloom-sync] Pull interval: ${this.config.pullIntervalMs / 1000 / 60}m`);

    // Run initial pull on start
    await this.pullWithRebase();

    // Setup periodic pull timer (every 5 minutes by default)
    this.pullIntervalTimer = setInterval(() => {
      void this.pullWithRebase();
    }, this.config.pullIntervalMs);

    // Setup chokidar watcher
    const ignored = [
      '**/.git/**',
      '**/node_modules/**',
      '**/.obsidian/workspace*',
      '**/.obsidian/cache*',
      '**/.trash/**',
      '**/.vaeloom/cache/**',
      '**/.vaeloom/sync.log',
      '**/.DS_Store',
      '**/Thumbs.db',
    ];

    this.watcher = chokidar.watch(this.config.vaultPath, {
      ignored,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100,
      },
    });

    this.watcher.on('all', (event, filePath) => {
      // Do not trigger sync for conflict files created by our own resolver
      if (/\.conflict-\d{4}-\d{2}-\d{2}/.test(filePath)) {
        return;
      }

      this.state.pendingChangesCount++;
      this.scheduleDebouncedPush();
    });

    this.state.isWatching = true;
    logSyncMessage(this.config.vaultPath, `Sync daemon started. Watching ${this.config.vaultPath}`);
  }

  /**
   * Stop the watcher and timers.
   */
  public async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pullIntervalTimer) {
      clearInterval(this.pullIntervalTimer);
      this.pullIntervalTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.state.isWatching = false;
    logSyncMessage(this.config.vaultPath, 'Sync daemon stopped.');
  }

  /**
   * Resets the trailing debounce timer (30 seconds).
   */
  private scheduleDebouncedPush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      void this.executeAutoCommitAndPush();
    }, this.config.debounceMs);
  }

  /**
   * Pulls upstream with rebase, resolving any conflicts without data loss.
   */
  public async pullWithRebase(): Promise<void> {
    return this.queueOperation(async () => {
      const remoteUrl = await this.git.getRemoteUrl(this.config.remoteName);
      if (!remoteUrl) {
        return;
      }

      try {
        this.state.syncInProgress = true;
        logSyncMessage(
          this.config.vaultPath,
          `PULL: Fetching ${this.config.remoteName}/${this.config.branch}...`,
        );

        const fetchRes = await this.git.fetch(this.config.remoteName);
        if (fetchRes.code !== 0) {
          logSyncMessage(this.config.vaultPath, `PULL ERROR: fetch failed: ${fetchRes.stderr}`);
          return;
        }

        const upstream = `${this.config.remoteName}/${this.config.branch}`;
        const rebaseRes = await this.git.rebase(upstream);

        if (rebaseRes.code !== 0) {
          logSyncMessage(
            this.config.vaultPath,
            `REBASE CONFLICT: Rebase on ${upstream} encountered conflicts. Resolving...`,
          );
          await handleRebaseConflicts(this.git, this.config.vaultPath);
        }

        this.state.lastPullTime = new Date().toISOString();
        const latest = await this.git.getLatestCommit();
        if (latest) {
          this.state.lastCommitHash = latest.hash;
        }
        logSyncMessage(
          this.config.vaultPath,
          `PULL SUCCESS: Rebase complete at ${this.state.lastPullTime}`,
        );
      } catch (err) {
        logSyncMessage(
          this.config.vaultPath,
          `PULL EXCEPTION: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        this.state.syncInProgress = false;
      }
    });
  }

  /**
   * Auto-commits pending changes and pushes to the remote repo.
   */
  public async executeAutoCommitAndPush(): Promise<void> {
    return this.queueOperation(async () => {
      try {
        this.state.syncInProgress = true;
        const hasChanges = await this.git.hasUncommittedChanges();
        if (!hasChanges) {
          this.state.pendingChangesCount = 0;
          return;
        }

        const summary = await this.git.getStatusSummary();
        const total = summary.modified.length + summary.untracked.length;
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const commitMsg = `vault(sync): auto-sync ${total} file${total === 1 ? '' : 's'} [${timestamp} UTC]`;

        await this.git.stageAll();
        const commitRes = await this.git.commit(commitMsg);
        if (commitRes.code !== 0) {
          logSyncMessage(this.config.vaultPath, `COMMIT ERROR: ${commitRes.stderr}`);
          return;
        }

        const latest = await this.git.getLatestCommit();
        if (latest) {
          this.state.lastCommitHash = latest.hash;
        }

        // Push if remote configured
        const remoteUrl = await this.git.getRemoteUrl(this.config.remoteName);
        if (remoteUrl && this.config.autoPush) {
          logSyncMessage(
            this.config.vaultPath,
            `PUSH: Pushing to ${this.config.remoteName}/${this.config.branch}...`,
          );
          const pushRes = await this.git.push(this.config.remoteName, this.config.branch);
          if (pushRes.code === 0) {
            this.state.lastPushTime = new Date().toISOString();
            logSyncMessage(this.config.vaultPath, `PUSH SUCCESS: ${this.state.lastPushTime}`);
          } else {
            logSyncMessage(this.config.vaultPath, `PUSH ERROR: ${pushRes.stderr}`);
          }
        }

        this.state.pendingChangesCount = 0;
      } catch (err) {
        logSyncMessage(
          this.config.vaultPath,
          `SYNC EXCEPTION: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        this.state.syncInProgress = false;
      }
    });
  }

  /**
   * Executes a one-shot full sync: pull rebase, commit, and push.
   */
  public async syncNow(): Promise<void> {
    await this.pullWithRebase();
    await this.executeAutoCommitAndPush();
  }
}
