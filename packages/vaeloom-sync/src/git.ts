import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { VaultSyncConfig } from './config.js';

const execFileAsync = promisify(execFile);

export interface GitExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

export class GitClient {
  constructor(public readonly cwd: string) {}

  /**
   * `trim: false` returns stdout byte-for-byte. Required when reading file
   * content out of the git index: trimming strips trailing newlines, which
   * would make every recovered conflict file differ from the original and
   * churn the watcher forever.
   */
  public async exec(args: string[], opts: { trim?: boolean } = {}): Promise<GitExecResult> {
    const trim = opts.trim !== false;
    const normalize = (value: string | undefined, fallback: string): string => {
      const raw = value ?? fallback;
      return trim ? raw.trim() : raw;
    };
    try {
      const { stdout, stderr } = await execFileAsync('git', args, {
        cwd: this.cwd,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_EDITOR: 'true',
          GIT_SEQUENCE_EDITOR: 'true',
        },
      });
      return { stdout: normalize(stdout, ''), stderr: normalize(stderr, ''), code: 0 };
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        stdout: normalize(error.stdout, ''),
        stderr: normalize(error.stderr, error.message || 'Unknown git error'),
        code: typeof error.code === 'number' ? error.code : 1,
      };
    }
  }

  public async isGitRepo(): Promise<boolean> {
    const res = await this.exec(['rev-parse', '--is-inside-work-tree']);
    return res.code === 0 && res.stdout === 'true';
  }

  /**
   * True when a usable `git` binary is on PATH. Callers must degrade to
   * in-app-only memory rather than looping on failures when this is false.
   */
  public async isGitAvailable(): Promise<boolean> {
    const res = await this.exec(['--version']);
    return res.code === 0 && res.stdout.toLowerCase().startsWith('git version');
  }

  public async initRepo(defaultBranch = 'main'): Promise<void> {
    const isRepo = await this.isGitRepo();
    if (!isRepo) {
      await this.exec(['init', '-b', defaultBranch]);
    }
  }

  public async ensureGitignore(patterns: string[]): Promise<void> {
    const gitignorePath = path.join(this.cwd, '.gitignore');
    let existingContent = '';
    if (fs.existsSync(gitignorePath)) {
      existingContent = fs.readFileSync(gitignorePath, 'utf-8');
    }

    const lines = new Set(
      existingContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    );

    let modified = false;
    for (const pattern of patterns) {
      if (!lines.has(pattern)) {
        lines.add(pattern);
        modified = true;
      }
    }

    if (modified || !fs.existsSync(gitignorePath)) {
      const header = '# Vaeloom Vault Sync — device-local and cache ignores\n';
      const body = Array.from(lines).join('\n') + '\n';
      fs.writeFileSync(gitignorePath, header + body, 'utf-8');
    }
  }

  public async getCurrentBranch(): Promise<string> {
    const res = await this.exec(['rev-parse', '--abbrev-ref', 'HEAD']);
    return res.code === 0 ? res.stdout : 'main';
  }

  public async getLatestCommit(): Promise<{ hash: string; message: string; date: string } | null> {
    const res = await this.exec(['log', '-1', '--format=%H%x1f%s%x1f%aI']);
    if (res.code !== 0 || !res.stdout) return null;
    const [hash, message, date] = res.stdout.split('\x1f');
    return { hash: hash || '', message: message || '', date: date || '' };
  }

  public async hasUncommittedChanges(): Promise<boolean> {
    const res = await this.exec(['status', '--porcelain']);
    return res.code === 0 && res.stdout.length > 0;
  }

  public async getStatusSummary(): Promise<{
    modified: string[];
    untracked: string[];
    conflicted: string[];
  }> {
    const res = await this.exec(['status', '--porcelain']);
    const modified: string[] = [];
    const untracked: string[] = [];
    const conflicted: string[] = [];

    if (res.code !== 0) return { modified, untracked, conflicted };

    const lines = res.stdout.split(/\r?\n/).filter((l) => l.length > 0);
    for (const line of lines) {
      const indexStatus = line.substring(0, 1);
      const workStatus = line.substring(1, 2);
      const filePath = line.substring(3).trim();

      if (
        indexStatus === 'U' ||
        workStatus === 'U' ||
        (indexStatus === 'A' && workStatus === 'A')
      ) {
        conflicted.push(filePath);
      } else if (indexStatus === '?' && workStatus === '?') {
        untracked.push(filePath);
      } else {
        modified.push(filePath);
      }
    }

    return { modified, untracked, conflicted };
  }

  public async stageAll(): Promise<void> {
    await this.exec(['add', '-A']);
  }

  public async commit(message: string): Promise<GitExecResult> {
    return this.exec(['commit', '-m', message]);
  }

  public async getRemoteUrl(remote = 'origin'): Promise<string | null> {
    const res = await this.exec(['remote', 'get-url', remote]);
    return res.code === 0 && res.stdout ? res.stdout : null;
  }

  public async setRemoteUrl(url: string, remote = 'origin'): Promise<void> {
    const existing = await this.getRemoteUrl(remote);
    if (existing) {
      await this.exec(['remote', 'set-url', remote, url]);
    } else {
      await this.exec(['remote', 'add', remote, url]);
    }
  }

  public async fetch(remote = 'origin'): Promise<GitExecResult> {
    return this.exec(['fetch', remote]);
  }

  public async rebase(upstream: string): Promise<GitExecResult> {
    return this.exec(['rebase', upstream]);
  }

  public async isRebaseInProgress(): Promise<boolean> {
    const gitDirRes = await this.exec(['rev-parse', '--git-dir']);
    if (gitDirRes.code !== 0) return false;
    const gitDir = path.resolve(this.cwd, gitDirRes.stdout);
    return (
      fs.existsSync(path.join(gitDir, 'rebase-merge')) ||
      fs.existsSync(path.join(gitDir, 'rebase-apply'))
    );
  }

  public async abortRebase(): Promise<GitExecResult> {
    return this.exec(['rebase', '--abort']);
  }

  public async continueRebase(): Promise<GitExecResult> {
    return this.exec(['rebase', '--continue']);
  }

  public async push(remote = 'origin', branch = 'main'): Promise<GitExecResult> {
    return this.exec(['push', '-u', remote, branch]);
  }

  public async getIncomingFileContent(relativeFilePath: string): Promise<string | null> {
    // In git rebase: stage 2 is upstream/remote (incoming), stage 3 is the local commit being applied.
    // In git merge: stage 3 is MERGE_HEAD (incoming), stage 2 is HEAD (local).
    const isRebase = await this.isRebaseInProgress();
    const stage = isRebase ? ':2:' : ':3:';
    const res = await this.exec(['show', `${stage}${relativeFilePath}`], { trim: false });
    if (res.code === 0) {
      return res.stdout;
    }
    return null;
  }

  public async getLocalFileContent(relativeFilePath: string): Promise<string | null> {
    // In git rebase: stage 3 is the local commit being applied.
    // In git merge: stage 2 is HEAD (local).
    const isRebase = await this.isRebaseInProgress();
    const stage = isRebase ? ':3:' : ':2:';
    const res = await this.exec(['show', `${stage}${relativeFilePath}`], { trim: false });
    if (res.code === 0) {
      return res.stdout;
    }
    return null;
  }

  /**
   * True when the failure left a rebase/merge half-finished on disk.
   * Distinguishes "there are conflicts to resolve" from every other rebase
   * failure (dirty tree, bad upstream, auth) which needs different handling.
   */
  public async isRepoInConflictState(): Promise<boolean> {
    const res = await this.exec(['ls-files', '--unmerged']);
    if (res.code !== 0) return false;
    return res.stdout.split(/\r?\n/).filter((l) => l.length > 0).length > 0;
  }

  /** Files with unmerged index entries, forward-slash normalized. */
  public async getUnmergedFiles(): Promise<string[]> {
    const res = await this.exec(['ls-files', '--unmerged']);
    if (res.code !== 0) return [];
    const files = new Set<string>();
    for (const line of res.stdout.split(/\r?\n/)) {
      if (line.length === 0) continue;
      // Format: "<mode> <sha> <stage>\t<path>"
      const tabIdx = line.indexOf('\t');
      const pathPart = tabIdx === -1 ? line : line.slice(tabIdx + 1);
      const normalized = pathPart.trim().replace(/\\/g, '/');
      if (normalized.length > 0) files.add(normalized);
    }
    return Array.from(files);
  }

  /** Paths that would collide with a rebase (local commits not yet pushed). */
  public async getUnpushedCommitCount(upstream: string): Promise<number> {
    const res = await this.exec(['rev-list', '--count', `${upstream}..HEAD`]);
    if (res.code !== 0) return 0;
    const n = parseInt(res.stdout.trim(), 10);
    return Number.isFinite(n) ? n : 0;
  }
}
