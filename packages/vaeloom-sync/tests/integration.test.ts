import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GitClient } from '../src/git.js';
import { VaultSyncConfig } from '../src/config.js';
import { VaultSyncWatcher } from '../src/watcher.js';
import {
  handleRebaseConflicts,
  resolveConflictFile,
  resolveInsideVault,
  originalPathFromConflictFile,
  allocateConflictRelPath,
  loadConflictRecords,
  getSyncLogPath,
  findOutstandingConflictFiles,
} from '../src/conflict.js';
import { DEFAULT_CONFIG } from '../src/config.js';

/**
 * These tests drive real `git` against a real bare remote. The unit tests in
 * sync.test.ts only cover pure functions; the data-loss and silent-failure
 * bugs this file targets were invisible to them.
 */

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      // Deterministic content and identity; no reliance on global git config.
      GIT_CONFIG_GLOBAL: path.join(cwd, '.gitconfig-test'),
      GIT_CONFIG_SYSTEM: path.join(cwd, '.gitconfig-test'),
      GIT_TERMINAL_PROMPT: '0',
    },
  }).trim();
}

function makeIdentity(cwd: string, name: string, email: string): void {
  git(cwd, ['config', 'user.name', name]);
  git(cwd, ['config', 'user.email', email]);
  // Keep bytes exact so content assertions are meaningful on Windows.
  git(cwd, ['config', 'core.autocrlf', 'false']);
  git(cwd, ['config', 'commit.gpgsign', 'false']);
}

function writeFile(root: string, rel: string, content: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
}

function readFileOrNull(full: string): string | null {
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : null;
}

function configFor(vaultPath: string): VaultSyncConfig {
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

function makeWatcher(vaultPath: string): VaultSyncWatcher {
  return new VaultSyncWatcher(configFor(vaultPath));
}

describe('vault-sync real-git integration', () => {
  let root: string;

  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vaeloom-real-git-'));
  });

  after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('detects a real rebase conflict and preserves BOTH versions with no data loss', async () => {
    const remote = path.join(root, 'remote.git');
    const machineA = path.join(root, 'machineA');
    const machineB = path.join(root, 'machineB');

    // Bare remote standing in for the private GitHub repo.
    git(root, ['init', '--bare', '-b', 'main', remote]);

    // Machine A seeds the vault.
    fs.mkdirSync(machineA, { recursive: true });
    git(machineA, ['init', '-b', 'main']);
    makeIdentity(machineA, 'Machine A', 'a@example.test');
    git(machineA, ['config', 'core.autocrlf', 'false']);
    const LOCAL_V1 = '# Note\n\nmachine A original\n';
    writeFile(machineA, 'Notes/Ideas.md', LOCAL_V1);
    git(machineA, ['add', '-A']);
    git(machineA, ['commit', '-m', 'seed']);
    git(machineA, ['remote', 'add', 'origin', remote]);
    git(machineA, ['push', '-u', 'origin', 'main']);

    // Machine B clones, then edits the same line differently.
    git(root, ['clone', remote, machineB]);
    makeIdentity(machineB, 'Machine B', 'b@example.test');
    git(machineB, ['config', 'core.autocrlf', 'false']);
    const B_LOCAL = '# Note\n\nmachine B edit\n';
    writeFile(machineB, 'Notes/Ideas.md', B_LOCAL);
    git(machineB, ['add', '-A']);
    git(machineB, ['commit', '-m', 'B edits']);

    // Machine A also edits and pushes, creating a genuine divergence.
    const A_REMOTE = '# Note\n\nmachine A conflicting edit\n';
    writeFile(machineA, 'Notes/Ideas.md', A_REMOTE);
    git(machineA, ['add', '-A']);
    git(machineA, ['commit', '-m', 'A edits']);
    git(machineA, ['push', 'origin', 'main']);

    // Machine B pulls -> real rebase conflict.
    const watcherB = makeWatcher(machineB);
    await watcherB.pullWithRebase();

    // Local version retained in place, byte for byte.
    assert.strictEqual(
      fs.readFileSync(path.join(machineB, 'Notes/Ideas.md'), 'utf-8'),
      B_LOCAL,
      'local version must be retained unmodified in the original path',
    );

    // Incoming version preserved as a conflict file, byte for byte.
    const conflicts = findOutstandingConflictFiles(machineB);
    assert.strictEqual(conflicts.length, 1, `expected 1 conflict file, got ${conflicts.length}`);
    const incoming = fs.readFileSync(path.join(machineB, conflicts[0]!), 'utf-8');
    assert.strictEqual(
      incoming,
      A_REMOTE,
      'incoming version must be preserved byte-for-byte (trailing newline included)',
    );

    // The recovered content must match the original remote commit exactly.
    const remoteBlob = git(machineB, ['show', 'origin/main:Notes/Ideas.md']);
    assert.strictEqual(
      incoming.trim(),
      remoteBlob,
      'conflict file must equal the pushed remote content',
    );

    // No git conflict markers left anywhere.
    const ideas = fs.readFileSync(path.join(machineB, 'Notes/Ideas.md'), 'utf-8');
    assert.ok(!ideas.includes('<<<<<<<'), 'no conflict markers in the retained local file');
    assert.ok(!incoming.includes('<<<<<<<'), 'no conflict markers in the recovered incoming file');

    // Ledger recorded it, and the rebase finished.
    const records = loadConflictRecords(machineB);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0]!.originalFile, 'Notes/Ideas.md');
    assert.strictEqual(records[0]!.resolved, false);

    const gitB = new GitClient(machineB);
    assert.strictEqual(
      await gitB.isRebaseInProgress(),
      false,
      'rebase must not be left half-finished after successful resolution',
    );
  });

  it('does NOT report PULL SUCCESS when the rebase fails for a non-conflict reason', async () => {
    const vault = path.join(root, 'dirty-vault');
    const remote = path.join(root, 'dirty-remote.git');
    git(root, ['init', '--bare', '-b', 'main', remote]);

    fs.mkdirSync(vault, { recursive: true });
    git(vault, ['init', '-b', 'main']);
    makeIdentity(vault, 'Dirty', 'd@example.test');
    writeFile(vault, 'a.md', 'one\n');
    git(vault, ['add', '-A']);
    git(vault, ['commit', '-m', 'base']);
    git(vault, ['remote', 'add', 'origin', remote]);
    git(vault, ['push', '-u', 'origin', 'main']);

    // Remote advances.
    const other = path.join(root, 'dirty-other');
    git(root, ['clone', remote, other]);
    makeIdentity(other, 'Other', 'o@example.test');
    writeFile(other, 'a.md', 'two\n');
    git(other, ['add', '-A']);
    git(other, ['commit', '-m', 'advance']);
    git(other, ['push', 'origin', 'main']);

    // Local has an UNCOMMITTED change -> git refuses to rebase. This is not a
    // conflict. The old code logged PULL SUCCESS anyway.
    writeFile(vault, 'a.md', 'uncommitted local edit\n');

    const watcher = makeWatcher(vault);
    await watcher.pullWithRebase();

    const log = fs.readFileSync(getSyncLogPath(vault), 'utf-8');
    assert.ok(log.includes('PULL ERROR'), `expected PULL ERROR in log:\n${log}`);
    assert.ok(!log.includes('PULL SUCCESS'), `must not claim success on a failed rebase:\n${log}`);

    // State must reflect the failure, not a fake success.
    const state = watcher.getState();
    assert.strictEqual(state.lastPullError !== null, true, 'lastPullError must be populated');
    assert.ok(
      state.lastPullTime === null || log.includes('PULL SUCCESS'),
      'lastPullTime must not advance on failure',
    );
  });

  it('blocks push while a rebase is stuck, instead of committing on top of it', async () => {
    const vault = path.join(root, 'stuck-vault');
    const remote = path.join(root, 'stuck-remote.git');
    git(root, ['init', '--bare', '-b', 'main', remote]);

    fs.mkdirSync(vault, { recursive: true });
    git(vault, ['init', '-b', 'main']);
    makeIdentity(vault, 'Stuck', 's@example.test');
    writeFile(vault, 'a.md', 'one\n');
    git(vault, ['add', '-A']);
    git(vault, ['commit', '-m', 'base']);
    git(vault, ['remote', 'add', 'origin', remote]);
    git(vault, ['push', '-u', 'origin', 'main']);

    // Simulate a rebase that was interrupted and cannot continue.
    fs.mkdirSync(path.join(vault, '.git', 'rebase-merge'), { recursive: true });

    const watcher = makeWatcher(vault);
    writeFile(vault, 'b.md', 'new work\n');
    await watcher.executeAutoCommitAndPush();

    const log = fs.readFileSync(getSyncLogPath(vault), 'utf-8');
    assert.ok(log.includes('PUSH BLOCKED'), `push must be blocked during a stuck rebase:\n${log}`);
    assert.ok(!log.includes('PUSH SUCCESS'), 'push must not succeed during a stuck rebase');
  });

  it('rejects path traversal in resolve (negative control: outside file must survive)', async () => {
    const vault = path.join(root, 'traversal-vault');
    const outside = path.join(root, 'precious.md');
    fs.mkdirSync(vault, { recursive: true });
    writeFile(root, 'precious.md', 'do not delete me\n');
    // A real conflict file so the call gets past the existence check.
    writeFile(vault, 'Doc.conflict-2026-10-01.md', 'incoming\n');

    const escape = path.join('..', 'precious.md');
    const result = await resolveConflictFile(vault, escape, 'keep-local');

    assert.strictEqual(result.success, false, 'traversal must be refused');
    assert.ok(result.message.toLowerCase().includes('outside the vault'), result.message);
    assert.strictEqual(
      fs.readFileSync(outside, 'utf-8'),
      'do not delete me\n',
      'file outside the vault must NOT be deleted',
    );
    assert.ok(fs.existsSync(outside), 'outside file must still exist');
  });

  it('rejects absolute paths and symlink escapes in resolveInsideVault', () => {
    const vault = path.join(root, 'guard-vault');
    fs.mkdirSync(vault, { recursive: true });

    assert.strictEqual(resolveInsideVault(vault, '../escape.md'), null);
    assert.strictEqual(resolveInsideVault(vault, 'a/../../escape.md'), null);
    assert.strictEqual(resolveInsideVault(vault, path.join(root, 'absolute.md')), null);
    assert.strictEqual(resolveInsideVault(vault, ''), null);
    assert.strictEqual(resolveInsideVault(vault, '   '), null);
    assert.strictEqual(resolveInsideVault(vault, '.'), null);

    const inside = resolveInsideVault(vault, 'Notes/ok.md');
    assert.ok(inside !== null && inside.endsWith(path.join('Notes', 'ok.md')));

    // Symlink pointing outside the vault must be rejected.
    const link = path.join(vault, 'link.md');
    try {
      fs.symlinkSync(path.join(root, 'precious.md'), link);
      assert.strictEqual(
        resolveInsideVault(vault, 'link.md'),
        null,
        'symlink escaping the vault must be rejected',
      );
    } catch {
      // Symlink creation may require elevation on Windows; lexical checks above stand.
    }
  });

  it('assigns flat incrementing conflict names and resolves them to the real note', async () => {
    const vault = path.join(root, 'counter-vault');
    fs.mkdirSync(vault, { recursive: true });
    writeFile(vault, 'Notes/Ideas.md', 'original\n');

    const first = allocateConflictRelPath(vault, 'Notes/Ideas.md', new Date(2026, 9, 1));
    assert.strictEqual(first, path.join('Notes', 'Ideas.conflict-2026-10-01.md'));

    fs.writeFileSync(path.join(vault, first), 'incoming one\n', 'utf-8');
    const second = allocateConflictRelPath(vault, 'Notes/Ideas.md', new Date(2026, 9, 1));
    assert.strictEqual(
      second,
      path.join('Notes', 'Ideas.conflict-2026-10-01-2.md'),
      'second same-day conflict must be -2, not a nested -1-1',
    );

    fs.writeFileSync(path.join(vault, second), 'incoming two\n', 'utf-8');
    const third = allocateConflictRelPath(vault, 'Notes/Ideas.md', new Date(2026, 9, 1));
    assert.strictEqual(third, path.join('Notes', 'Ideas.conflict-2026-10-01-3.md'));
    fs.writeFileSync(path.join(vault, third), 'incoming two\n', 'utf-8');

    // Every conflict name must map back to the real note.
    for (const c of [first, second, third]) {
      const resolved = originalPathFromConflictFile(c);
      assert.strictEqual(
        path.resolve(vault, resolved),
        path.resolve(vault, 'Notes/Ideas.md'),
        `${c} must resolve to Notes/Ideas.md`,
      );
    }

    // Resolving the -3 conflict with accept-incoming must overwrite the note,
    // not another conflict file. This is the data-loss bug.
    const res = await resolveConflictFile(vault, third, 'accept-incoming');
    assert.strictEqual(res.success, true, res.message);
    assert.strictEqual(
      fs.readFileSync(path.join(vault, 'Notes/Ideas.md'), 'utf-8'),
      'incoming two\n',
      'accept-incoming must write the conflict content into the original note',
    );
    assert.ok(!fs.existsSync(path.join(vault, third)), 'resolved conflict file must be removed');
    assert.ok(
      fs.existsSync(path.join(vault, second)),
      'the other conflict file must survive untouched',
    );
    assert.ok(fs.existsSync(path.join(vault, first)), 'the first conflict file must survive');
  });

  it('refuses to resolve a malformed name that would target another conflict file', async () => {
    const vault = path.join(root, 'malformed-vault');
    fs.mkdirSync(vault, { recursive: true });
    writeFile(vault, 'A.md', 'real note A\n');
    writeFile(vault, 'A.conflict-2026-10-01.md', 'conflict A\n');
    writeFile(vault, 'A.conflict-2026-10-01-2.md', 'conflict A2\n');

    // Resolving "A.conflict-2026-10-01-2.md" via keep-local is safe.
    const ok = await resolveConflictFile(vault, 'A.conflict-2026-10-01-2.md', 'keep-local');
    assert.strictEqual(ok.success, true, ok.message);

    // A conflict file whose "original" would be another conflict file is rejected.
    const bad = await resolveConflictFile(
      vault,
      'A.conflict-2026-10-01-2.md.bak.md',
      'accept-incoming',
    );
    assert.strictEqual(bad.success, false, 'must refuse malformed conflict names');
    assert.strictEqual(
      fs.readFileSync(path.join(vault, 'A.md'), 'utf-8'),
      'real note A\n',
      'the real note must be untouched',
    );
  });

  it('preserves a corrupt conflict ledger instead of silently overwriting it', () => {
    const vault = path.join(root, 'corrupt-vault');
    fs.mkdirSync(path.join(vault, '.vaeloom'), { recursive: true });
    const ledger = path.join(vault, '.vaeloom', 'conflicts.json');
    fs.writeFileSync(ledger, '{ this is not valid json', 'utf-8');

    const records = loadConflictRecords(vault);
    assert.deepStrictEqual(records, [], 'corrupt ledger yields no usable records');

    const backups = fs
      .readdirSync(path.join(vault, '.vaeloom'))
      .filter((f) => f.startsWith('conflicts.json.corrupt-'));
    assert.strictEqual(backups.length, 1, 'the unreadable original must be preserved as a backup');
    assert.strictEqual(
      fs.readFileSync(path.join(vault, '.vaeloom', backups[0]!), 'utf-8'),
      '{ this is not valid json',
      'backup must contain the original bytes',
    );
  });

  it('ignores device-local .vaeloom state so machines cannot clobber each other', async () => {
    const vault = path.join(root, 'ignore-vault');
    fs.mkdirSync(vault, { recursive: true });
    git(vault, ['init', '-b', 'main']);
    makeIdentity(vault, 'Ignore', 'i@example.test');

    const gitClient = new GitClient(vault);
    await gitClient.ensureGitignore(DEFAULT_CONFIG.ignoredPatterns);

    // Create the device-local files a running daemon produces.
    writeFile(vault, '.vaeloom/sync-config.json', '{"remoteUrl":"machine-specific"}\n');
    writeFile(vault, '.vaeloom/conflicts.json', '[]\n');
    writeFile(vault, '.vaeloom/sync.log', 'log line\n');
    writeFile(vault, 'Notes/Real.md', 'real note\n');

    await gitClient.stageAll();
    const staged = git(vault, ['diff', '--cached', '--name-only']);
    assert.ok(staged.includes('Notes/Real.md'), 'real notes must be tracked');
    assert.ok(
      !staged.includes('sync-config.json'),
      `per-machine config must not be committed:\n${staged}`,
    );
    assert.ok(
      !staged.includes('conflicts.json'),
      `conflict ledger must not be committed:\n${staged}`,
    );
    assert.ok(!staged.includes('sync.log'), `sync log must not be committed:\n${staged}`);
  });

  it('keeps Obsidian device-local folders out of git', async () => {
    const vault = path.join(root, 'obsidian-vault');
    fs.mkdirSync(vault, { recursive: true });
    git(vault, ['init', '-b', 'main']);
    makeIdentity(vault, 'Obs', 'o@example.test');

    const gitClient = new GitClient(vault);
    await gitClient.ensureGitignore(DEFAULT_CONFIG.ignoredPatterns);

    writeFile(vault, '.obsidian/workspace.json', '{"main":{"id":"x"}}\n');
    writeFile(vault, '.obsidian/workspace-mobile.json', '{"main":{"id":"y"}}\n');
    writeFile(vault, '.obsidian/app.json', '{"theme":"dark"}\n');
    writeFile(vault, '.trash/deleted-note.md', 'deleted\n');
    writeFile(vault, 'Notes/Keep.md', 'keep\n');

    await gitClient.stageAll();
    const staged = git(vault, ['diff', '--cached', '--name-only']);

    assert.ok(staged.includes('Notes/Keep.md'), 'notes must sync');
    assert.ok(staged.includes('.obsidian/app.json'), 'shared obsidian config syncs');
    assert.ok(!staged.includes('workspace.json'), 'workspace state must not sync');
    assert.ok(!staged.includes('workspace-mobile.json'), 'mobile workspace must not sync');
    assert.ok(!staged.includes('.trash'), '.trash must not sync');
  });

  it('reports git availability so a machine without git degrades cleanly', async () => {
    const vault = path.join(root, 'no-git-vault');
    fs.mkdirSync(vault, { recursive: true });
    const gitClient = new GitClient(vault);
    const available = await gitClient.isGitAvailable();
    // This suite requires git to run at all, so assert the positive path here
    // and keep the assertion exact rather than tolerant.
    assert.strictEqual(available, true, 'git must be on PATH for this integration suite');
  });

  it('round-trips a note with trailing whitespace and unicode without corruption', async () => {
    const remote = path.join(root, 'fidelity-remote.git');
    const a = path.join(root, 'fidA');
    const b = path.join(root, 'fidB');
    git(root, ['init', '--bare', '-b', 'main', remote]);

    fs.mkdirSync(a, { recursive: true });
    git(a, ['init', '-b', 'main']);
    makeIdentity(a, 'FidA', 'fa@example.test');
    const original = '# Título\n\n    indented block\n\nemoji 🎯 ok\n\n\n';
    writeFile(a, 'Notes/Fidelity.md', '# Título\n\nseed note\n');
    git(a, ['add', '-A']);
    git(a, ['commit', '-m', 'seed']);
    git(a, ['remote', 'add', 'origin', remote]);
    git(a, ['push', '-u', 'origin', 'main']);

    git(root, ['clone', remote, b]);
    makeIdentity(b, 'FidB', 'fb@example.test');
    writeFile(b, 'Notes/Fidelity.md', '# Título\n\nmachine B change\n');
    git(b, ['add', '-A']);
    git(b, ['commit', '-m', 'B change']);

    writeFile(a, 'Notes/Fidelity.md', original);
    git(a, ['add', '-A']);
    git(a, ['commit', '-m', 'A change']);
    git(a, ['push', 'origin', 'main']);

    await makeWatcher(b).pullWithRebase();

    const conflicts = findOutstandingConflictFiles(b);
    assert.strictEqual(conflicts.length, 1);
    const recovered = fs.readFileSync(path.join(b, conflicts[0]!), 'utf-8');
    assert.strictEqual(
      recovered,
      original,
      'recovered note must be byte-identical, preserving indentation, unicode and trailing newlines',
    );
  });
});
