import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  formatConflictFilename,
  findOutstandingConflictFiles,
  resolveConflictFile,
  loadConflictRecords,
  saveConflictRecords,
} from '../src/conflict.js';
import { DEFAULT_CONFIG, loadConfig, resolveVaultPath } from '../src/config.js';

describe('Vaeloom Vault Sync - Conflict & Configuration Tests', () => {
  it('should format conflict filename correctly with YYYY-MM-DD pattern', () => {
    const fixedDate = new Date(2026, 9, 1); // Oct 1, 2026
    const conflictName = formatConflictFilename('Notes/Ideas.md', fixedDate);
    assert.strictEqual(conflictName, path.join('Notes', 'Ideas.conflict-2026-10-01.md'));
  });

  it('should format root level markdown conflict files correctly', () => {
    const fixedDate = new Date(2026, 0, 15); // Jan 15, 2026
    const conflictName = formatConflictFilename('Inbox.md', fixedDate);
    assert.strictEqual(conflictName, 'Inbox.conflict-2026-01-15.md');
  });

  it('should enforce 30s debounce and 5m pull interval in default config', () => {
    assert.strictEqual(DEFAULT_CONFIG.debounceMs, 30000, 'Debounce must be 30 seconds');
    assert.strictEqual(
      DEFAULT_CONFIG.pullIntervalMs,
      300000,
      'Pull interval must be 5 minutes (300,000 ms)',
    );
    assert.strictEqual(DEFAULT_CONFIG.branch, 'main');
    assert.ok(DEFAULT_CONFIG.ignoredPatterns.includes('.obsidian/workspace*'));
    assert.ok(DEFAULT_CONFIG.ignoredPatterns.includes('.trash/**'));
  });

  it('should scan and detect outstanding conflict files on disk', () => {
    const tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'vaeloom-vault-test-'));
    try {
      fs.writeFileSync(path.join(tmpVault, 'Normal.md'), '# Normal note');
      fs.writeFileSync(path.join(tmpVault, 'Note1.conflict-2026-10-01.md'), '# Conflict 1');
      const subDir = path.join(tmpVault, 'SubFolder');
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(subDir, 'Note2.conflict-2026-09-30.md'), '# Conflict 2');

      const detected = findOutstandingConflictFiles(tmpVault);
      assert.strictEqual(detected.length, 2);
      assert.ok(detected.some((f) => f.includes('Note1.conflict-2026-10-01.md')));
      assert.ok(
        detected.some(
          (f) =>
            f.includes('SubFolder/Note2.conflict-2026-09-30.md') ||
            f.includes('SubFolder\\Note2.conflict-2026-09-30.md'),
        ),
      );
    } finally {
      fs.rmSync(tmpVault, { recursive: true, force: true });
    }
  });

  it('should resolve conflict with keep-local by removing conflict file', async () => {
    const tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'vaeloom-vault-res-test-'));
    try {
      const origPath = path.join(tmpVault, 'Doc.md');
      const confPath = path.join(tmpVault, 'Doc.conflict-2026-10-01.md');
      fs.writeFileSync(origPath, 'Local version content');
      fs.writeFileSync(confPath, 'Remote version content');

      const res = await resolveConflictFile(tmpVault, 'Doc.conflict-2026-10-01.md', 'keep-local');
      assert.strictEqual(res.success, true);
      assert.ok(fs.existsSync(origPath), 'Original file must remain');
      assert.strictEqual(fs.readFileSync(origPath, 'utf-8'), 'Local version content');
      assert.ok(!fs.existsSync(confPath), 'Conflict file must be removed');
    } finally {
      fs.rmSync(tmpVault, { recursive: true, force: true });
    }
  });

  it('should resolve conflict with accept-incoming by overwriting original', async () => {
    const tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), 'vaeloom-vault-res-test2-'));
    try {
      const origPath = path.join(tmpVault, 'Doc.md');
      const confPath = path.join(tmpVault, 'Doc.conflict-2026-10-01.md');
      fs.writeFileSync(origPath, 'Local version content');
      fs.writeFileSync(confPath, 'Remote incoming version content');

      const res = await resolveConflictFile(
        tmpVault,
        'Doc.conflict-2026-10-01.md',
        'accept-incoming',
      );
      assert.strictEqual(res.success, true);
      assert.ok(fs.existsSync(origPath), 'Original file must remain');
      assert.strictEqual(fs.readFileSync(origPath, 'utf-8'), 'Remote incoming version content');
      assert.ok(!fs.existsSync(confPath), 'Conflict file must be removed');
    } finally {
      fs.rmSync(tmpVault, { recursive: true, force: true });
    }
  });
});
