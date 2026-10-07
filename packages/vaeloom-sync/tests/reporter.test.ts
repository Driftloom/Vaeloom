import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VaultReporter } from '../src/reporter.js';
import { VaultSyncWatcher } from '../src/watcher.js';
import { GitClient } from '../src/git.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { getConflictsLogPath } from '../src/conflict.js';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: path.join(cwd, '.gitconfig-test'),
      GIT_CONFIG_SYSTEM: path.join(cwd, '.gitconfig-test'),
      GIT_TERMINAL_PROMPT: '0',
    },
  }).trim();
}

function configFor(vaultPath: string) {
  return {
    vaultPath,
    remoteName: 'origin',
    branch: 'main',
    debounceMs: DEFAULT_CONFIG.debounceMs,
    pullIntervalMs: DEFAULT_CONFIG.pullIntervalMs,
    autoPush: true,
    autoPull: true,
    ignoredPatterns: DEFAULT_CONFIG.ignoredPatterns,
  };
}

/** Stand-in for the Vaeloom API so we can assert the exact payload. */
function stubApi(): {
  calls: Array<{ url: string; init: RequestInit }>;
  restore: () => void;
} {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: init as RequestInit });
    return { ok: true, status: 200, json: async () => ({ success: true }) } as unknown as Response;
  }) as unknown as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

describe('VaultReporter', () => {
  let root: string;

  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vaeloom-reporter-'));
  });

  after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function makeVault(name: string): string {
    const vault = path.join(root, name);
    fs.mkdirSync(vault, { recursive: true });
    git(vault, ['init', '-b', 'main']);
    git(vault, ['config', 'user.name', 'Rep']);
    git(vault, ['config', 'user.email', 'rep@test.example']);
    git(vault, ['config', 'core.autocrlf', 'false']);
    fs.writeFileSync(path.join(vault, 'Note.md'), '# Note\n\nbody\n', 'utf-8');
    git(vault, ['add', '-A']);
    git(vault, ['commit', '-m', 'seed']);
    return vault;
  }

  it('does nothing when credentials are absent, and never throws', async () => {
    const vault = makeVault('no-creds');
    const reporter = new VaultReporter(configFor(vault), {});
    assert.strictEqual(reporter.isConfigured(), false);
    // No fetch must be attempted, and no exception must escape.
    const state = await reporter.reportOnce();
    assert.strictEqual(state.attempted, 0);
    assert.strictEqual(state.skipped, 1);
    assert.strictEqual(state.lastError, null);
  });

  it('reports real branch, machine, and zero conflicts to the API', async () => {
    const vault = makeVault('basic');
    const api = stubApi();
    try {
      const reporter = new VaultReporter(configFor(vault), {
        apiBaseUrl: 'http://api.test',
        token: 'tok-123',
        workspaceId: 'ws-1',
      });
      assert.strictEqual(reporter.isConfigured(), true);
      await reporter.reportOnce();

      assert.strictEqual(api.calls.length, 1, 'exactly one report per call');
      const call = api.calls[0]!;
      assert.match(call.url, /\/api\/v1\/vault-sync\/report$/);
      const headers = call.init.headers as Record<string, string>;
      assert.strictEqual(headers['Authorization'], 'Bearer tok-123');

      const body = JSON.parse(String(call.init.body));
      assert.strictEqual(body.workspace_id, 'ws-1');
      assert.strictEqual(body.branch, 'main');
      assert.strictEqual(body.sync_state, 'idle');
      assert.deepStrictEqual(body.conflicts, []);
      assert.ok(body.client_version, 'client version must be reported');
      assert.ok(body.machine && body.machine.length > 0, 'machine must be reported');
    } finally {
      api.restore();
    }
  });

  it('reports an unresolved conflict that still exists on disk', async () => {
    const vault = makeVault('conflicted');
    const conflictsDir = path.join(vault, '.vaeloom');
    fs.mkdirSync(conflictsDir, { recursive: true });
    // The conflict file exists on disk, so it is genuinely outstanding.
    fs.writeFileSync(path.join(vault, 'Note.conflict-2026-10-04.md'), 'incoming\n', 'utf-8');
    fs.writeFileSync(
      getConflictsLogPath(vault),
      JSON.stringify([
        {
          id: 'c-1',
          originalFile: 'Note.md',
          conflictFile: 'Note.conflict-2026-10-04.md',
          timestamp: '2026-10-04T00:00:00.000Z',
          date: '2026-10-04',
          resolved: false,
        },
      ]),
      'utf-8',
    );

    const api = stubApi();
    try {
      const reporter = new VaultReporter(configFor(vault), {
        apiBaseUrl: 'http://api.test',
        token: 'tok',
        workspaceId: 'ws-1',
      });
      await reporter.reportOnce();
      const body = JSON.parse(String(api.calls[0]!.init.body));
      assert.strictEqual(body.conflicts.length, 1);
      assert.strictEqual(body.conflicts[0].conflict_file, 'Note.conflict-2026-10-04.md');
      assert.strictEqual(body.conflicts[0].file, 'Note.md');
    } finally {
      api.restore();
    }
  });

  it('stops reporting a conflict once the conflict file is gone', async () => {
    const vault = makeVault('resolved');
    fs.mkdirSync(path.join(vault, '.vaeloom'), { recursive: true });
    // Ledger still lists it, but the file is resolved and deleted.
    fs.writeFileSync(
      getConflictsLogPath(vault),
      JSON.stringify([
        {
          id: 'c-1',
          originalFile: 'Note.md',
          conflictFile: 'Note.conflict-2026-10-04.md',
          timestamp: '2026-10-04T00:00:00.000Z',
          date: '2026-10-04',
          resolved: true,
        },
      ]),
      'utf-8',
    );

    const api = stubApi();
    try {
      const reporter = new VaultReporter(configFor(vault), {
        apiBaseUrl: 'http://api.test',
        token: 'tok',
        workspaceId: 'ws-1',
      });
      await reporter.reportOnce();
      const body = JSON.parse(String(api.calls[0]!.init.body));
      assert.deepStrictEqual(body.conflicts, [], 'resolved conflicts must not linger');
    } finally {
      api.restore();
    }
  });

  it('records an API failure without throwing', async () => {
    const vault = makeVault('failing-api');
    const original = globalThis.fetch;
    globalThis.fetch = (async () => ({ ok: false, status: 503 }) as any) as any;
    try {
      const reporter = new VaultReporter(configFor(vault), {
        apiBaseUrl: 'http://api.test',
        token: 'tok',
        workspaceId: 'ws-1',
      });
      const state = await reporter.reportOnce();
      // The failure is recorded, not thrown — syncing must not break.
      assert.strictEqual(state.succeeded, 0);
      assert.ok(state.lastError && state.lastError.includes('503'), String(state.lastError));
    } finally {
      globalThis.fetch = original;
    }
  });

  it('sync operations still work when the API is unreachable', async () => {
    // The reporter must never be able to break the vault.
    const vault = makeVault('unreachable');
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as any;
    try {
      const reporter = new VaultReporter(configFor(vault), {
        apiBaseUrl: 'http://127.0.0.1:1',
        token: 'tok',
        workspaceId: 'ws-1',
      });
      const state = await reporter.reportOnce();
      assert.ok(state.lastError, 'failure recorded');

      // Git still functions on the same vault.
      const gitClient = new GitClient(vault);
      assert.strictEqual(await gitClient.isGitRepo(), true);
      const commit = await gitClient.getLatestCommit();
      assert.ok(commit, 'vault history intact despite reporting failure');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('watcher starts and stops the reporter alongside itself', async () => {
    const vault = makeVault('watcher-reporter');
    const api = stubApi();
    try {
      const watcher = new VaultSyncWatcher(configFor(vault), {
        apiBaseUrl: 'http://api.test',
        token: 'tok',
        workspaceId: 'ws-1',
      });
      await watcher.start();
      // start() triggers an immediate report.
      await new Promise((r) => setTimeout(r, 250));
      assert.ok(api.calls.length >= 1, 'watcher start should report once');
      await watcher.stop();
    } finally {
      api.restore();
    }
  });
});
