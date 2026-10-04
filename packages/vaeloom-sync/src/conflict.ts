import * as fs from 'fs';
import * as path from 'path';
import { GitClient } from './git.js';

export interface ConflictRecord {
  id: string;
  originalFile: string;
  conflictFile: string;
  timestamp: string;
  date: string;
  resolved: boolean;
  resolutionStrategy?: 'keep-local' | 'accept-incoming' | 'merged';
}

export function formatConflictFilename(
  originalRelativePath: string,
  date: Date = new Date(),
): string {
  const dir = path.dirname(originalRelativePath);
  const ext = path.extname(originalRelativePath);
  const baseName = path.basename(originalRelativePath, ext);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const conflictBase = `${baseName}.conflict-${dateStr}${ext}`;
  return dir === '.' ? conflictBase : path.join(dir, conflictBase);
}

export function getConflictsLogPath(vaultPath: string): string {
  return path.join(vaultPath, '.vaeloom', 'conflicts.json');
}

export function getSyncLogPath(vaultPath: string): string {
  return path.join(vaultPath, '.vaeloom', 'sync.log');
}

/**
 * Resolve `relativePath` and guarantee the result stays inside the vault.
 *
 * `resolveConflictFile` unlinks and overwrites paths derived from CLI/API
 * input. Without this guard `vaultsync resolve ../../../notes.md` resolves
 * outside the vault and deletes an arbitrary file. Absolute inputs and `..`
 * escapes are rejected; existing paths are additionally checked through
 * realpath so a symlink cannot launder an escape.
 *
 * Returns null when the path escapes the vault.
 */
export function resolveInsideVault(vaultPath: string, relativePath: string): string | null {
  if (typeof relativePath !== 'string' || relativePath.trim().length === 0) {
    return null;
  }
  const root = path.resolve(vaultPath);
  const target = path.resolve(root, relativePath);
  const rel = path.relative(root, target);
  // Empty means target === root (the vault dir itself, never a note).
  if (rel.length === 0 || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  if (fs.existsSync(target)) {
    try {
      const realRoot = fs.realpathSync(root);
      const realTarget = fs.realpathSync(target);
      const realRel = path.relative(realRoot, realTarget);
      if (realRel.length === 0 || realRel.startsWith('..') || path.isAbsolute(realRel)) {
        return null;
      }
    } catch {
      // realpath can fail on a broken symlink; the lexical check above stands.
    }
  }
  return target;
}

export function logSyncMessage(vaultPath: string, message: string): void {
  const logPath = getSyncLogPath(vaultPath);
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`, 'utf-8');
}

export function loadConflictRecords(vaultPath: string): ConflictRecord[] {
  const file = getConflictsLogPath(vaultPath);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ConflictRecord[]) : [];
  } catch (err) {
    // Never silently return [] here: the caller may save over the file and
    // destroy the ledger. Preserve the unreadable bytes first.
    try {
      const backup = `${file}.corrupt-${Date.now()}`;
      fs.copyFileSync(file, backup);
      logSyncMessage(
        vaultPath,
        `CORRUPT LEDGER: ${file} could not be parsed (${err instanceof Error ? err.message : String(err)}). Original preserved at ${path.basename(backup)}. Starting a fresh ledger.`,
      );
    } catch {
      // Backup itself failed; still do not overwrite silently.
    }
    return [];
  }
}

export function saveConflictRecords(vaultPath: string, records: ConflictRecord[]): void {
  const file = getConflictsLogPath(vaultPath);
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(file, JSON.stringify(records, null, 2), 'utf-8');
}

/**
 * Handle rebase conflicts automatically without data loss.
 * Incoming versions are written to <name>.conflict-YYYY-MM-DD.md,
 * while local copies are kept in place.
 */
/**
 * Strip the conflict suffix to recover the original note path.
 * Handles repeated counters (`note.conflict-2026-10-04-2-2.md`) so a
 * same-day repeat conflict never resolves onto another conflict file.
 */
export function originalPathFromConflictFile(conflictFilePath: string): string {
  const dir = path.dirname(conflictFilePath);
  const ext = path.extname(conflictFilePath);
  const base = path.basename(conflictFilePath, ext);
  const originalBase = base.replace(/\.conflict-\d{4}-\d{2}-\d{2}(?:-\d+)*$/, '');
  const rel = dir === '.' ? `${originalBase}${ext}` : path.join(dir, `${originalBase}${ext}`);
  return rel;
}

/**
 * Pick a conflict filename that does not exist yet.
 *
 * The first conflict of the day is `note.conflict-YYYY-MM-DD.md`; subsequent
 * ones become `-2`, `-3`, ... Incrementing a single counter (rather than
 * appending to the previous name) keeps names flat and, critically, keeps
 * `originalPathFromConflictFile` able to recover the real note.
 */
export function allocateConflictRelPath(
  vaultPath: string,
  conflictedRelPath: string,
  date: Date = new Date(),
): string {
  const candidate = formatConflictFilename(conflictedRelPath, date);
  if (!fs.existsSync(path.join(vaultPath, candidate))) {
    return candidate;
  }
  const dir = path.dirname(candidate);
  const ext = path.extname(candidate);
  const baseNoExt = path.basename(candidate, ext);
  const join = (name: string): string => (dir === '.' ? name : path.join(dir, name));

  for (let n = 2; n < 1000; n++) {
    const next = join(`${baseNoExt}-${n}${ext}`);
    if (!fs.existsSync(path.join(vaultPath, next))) {
      return next;
    }
  }
  // Pathological case: fall back to a unique suffix rather than looping forever.
  return join(`${baseNoExt}-${Date.now()}${ext}`);
}

export async function handleRebaseConflicts(
  git: GitClient,
  vaultPath: string,
): Promise<{ resolvedCount: number; records: ConflictRecord[] }> {
  // Prefer git's own unmerged index over parsing porcelain status: this is the
  // authoritative conflict list and cannot misclassify add/add as content.
  let conflicted = await git.getUnmergedFiles();
  if (conflicted.length === 0) {
    const status = await git.getStatusSummary();
    conflicted = status.conflicted;
  }
  if (conflicted.length === 0) {
    return { resolvedCount: 0, records: [] };
  }

  const existingRecords = loadConflictRecords(vaultPath);
  const newRecords: ConflictRecord[] = [];
  const now = new Date();

  for (const conflictedRelPath of conflicted) {
    const fullOriginalPath = resolveInsideVault(vaultPath, conflictedRelPath);
    if (fullOriginalPath === null) {
      logSyncMessage(
        vaultPath,
        `CONFLICT SKIPPED: '${conflictedRelPath}' resolves outside the vault. Left untouched for manual recovery.`,
      );
      continue;
    }

    // Read incoming version from git index stage 3
    const incomingContent = await git.getIncomingFileContent(conflictedRelPath);
    // Read local version from git index stage 2 or local filesystem
    let localContent = await git.getLocalFileContent(conflictedRelPath);
    if (localContent === null && fs.existsSync(fullOriginalPath)) {
      localContent = fs.readFileSync(fullOriginalPath, 'utf-8');
    }

    const conflictRelPath = allocateConflictRelPath(vaultPath, conflictedRelPath, now);
    const fullConflictPath = path.join(vaultPath, conflictRelPath);

    // Write incoming content to conflict file
    if (incomingContent !== null) {
      fs.writeFileSync(fullConflictPath, incomingContent, 'utf-8');
    } else if (fs.existsSync(fullOriginalPath)) {
      // Fallback: the working-tree file still carries <<<<<<< markers, but it
      // is strictly better than discarding the only remaining copy.
      fs.copyFileSync(fullOriginalPath, fullConflictPath);
    } else {
      logSyncMessage(
        vaultPath,
        `CONFLICT UNRECOVERABLE: no incoming or local content for '${conflictedRelPath}'. Nothing was written.`,
      );
      continue;
    }

    // Ensure original file retains our local version
    if (localContent !== null) {
      fs.writeFileSync(fullOriginalPath, localContent, 'utf-8');
    }

    // Mark both files resolved in git
    await git.exec(['add', '--', fullOriginalPath, fullConflictPath]);

    const record: ConflictRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      originalFile: conflictedRelPath.replace(/\\/g, '/'),
      conflictFile: conflictRelPath.replace(/\\/g, '/'),
      timestamp: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      resolved: false,
    };

    newRecords.push(record);
    logSyncMessage(
      vaultPath,
      `CONFLICT DETECTED: Incoming remote version saved as '${conflictRelPath}'. Local version retained in '${conflictedRelPath}'.`,
    );
  }

  // Continue the rebase now that all conflicted files are resolved
  if (newRecords.length > 0) {
    const continueRes = await git.continueRebase();
    if (continueRes.code !== 0) {
      logSyncMessage(
        vaultPath,
        `REBASE WARNING: git rebase --continue exited with code ${continueRes.code}: ${continueRes.stderr}. The rebase is still in progress; no data was lost. Run 'vaultsync sync' after resolving remaining files.`,
      );
      return { resolvedCount: newRecords.length, records: newRecords };
    }
  }

  const updatedRecords = [...existingRecords, ...newRecords];
  if (newRecords.length > 0) {
    saveConflictRecords(vaultPath, updatedRecords);
  }

  return { resolvedCount: newRecords.length, records: newRecords };
}

/**
 * Scan vault directory for all existing .conflict-*.md files.
 */
export function findOutstandingConflictFiles(vaultPath: string): string[] {
  const results: string[] = [];
  const conflictRegex = /\.conflict-\d{4}-\d{2}-\d{2}/;

  function scan(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name.startsWith('.git') ||
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === '.venv' ||
        entry.name === 'dist' ||
        entry.name === '.nx'
      ) {
        continue;
      }
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        scan(full);
      } else if (entry.isFile() && conflictRegex.test(entry.name)) {
        const rel = path.relative(vaultPath, full).replace(/\\/g, '/');
        results.push(rel);
      }
    }
  }

  if (fs.existsSync(vaultPath)) {
    scan(vaultPath);
  }
  return results;
}

/**
 * Resolve a conflict file by choosing strategy:
 * 'keep-local': remove the conflict file
 * 'accept-incoming': overwrite original with conflict file, then remove conflict file
 */
export async function resolveConflictFile(
  vaultPath: string,
  conflictFilePath: string,
  strategy: 'keep-local' | 'accept-incoming',
  git?: GitClient,
): Promise<{ success: boolean; message: string }> {
  const fullConflictPath = resolveInsideVault(vaultPath, conflictFilePath);
  if (fullConflictPath === null) {
    return {
      success: false,
      message: `Refusing to resolve '${conflictFilePath}': path resolves outside the vault.`,
    };
  }
  if (!fs.existsSync(fullConflictPath)) {
    return { success: false, message: `Conflict file not found: ${conflictFilePath}` };
  }

  const originalRelPath = originalPathFromConflictFile(conflictFilePath);
  const fullOriginalPath = resolveInsideVault(vaultPath, originalRelPath);
  if (fullOriginalPath === null) {
    return {
      success: false,
      message: `Refusing to resolve '${conflictFilePath}': original path escapes the vault.`,
    };
  }

  // Guard the data-loss case: if the recovered "original" is itself still a
  // conflict file, the caller passed a malformed name and accept-incoming
  // would overwrite one conflict file with another.
  if (/\.conflict-\d{4}-\d{2}-\d{2}(?:-\d+)*\.[^.]+$/.test(originalRelPath)) {
    return {
      success: false,
      message: `'${conflictFilePath}' does not match the conflict naming convention; refusing to touch '${originalRelPath}'.`,
    };
  }

  if (strategy === 'accept-incoming') {
    fs.copyFileSync(fullConflictPath, fullOriginalPath);
    fs.unlinkSync(fullConflictPath);
    logSyncMessage(
      vaultPath,
      `RESOLVED CONFLICT: Accepted incoming version '${conflictFilePath}' for '${originalRelPath}'.`,
    );
  } else {
    fs.unlinkSync(fullConflictPath);
    logSyncMessage(
      vaultPath,
      `RESOLVED CONFLICT: Retained local version '${originalRelPath}' and removed '${conflictFilePath}'.`,
    );
  }

  // Update records
  const records = loadConflictRecords(vaultPath);
  const normalizedTarget = conflictFilePath.replace(/\\/g, '/');
  const target = records.find((r) => r.conflictFile === normalizedTarget && !r.resolved);
  if (target) {
    target.resolved = true;
    target.resolutionStrategy = strategy;
    saveConflictRecords(vaultPath, records);
  }

  if (git) {
    await git.stageAll();
    await git.commit(
      `vault(resolve): ${strategy === 'accept-incoming' ? 'accept incoming' : 'keep local'} for ${originalRelPath.replace(/\\/g, '/')}`,
    );
  }

  return {
    success: true,
    message: `Conflict resolved using '${strategy}'.`,
  };
}
