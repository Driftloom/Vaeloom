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
    return JSON.parse(raw);
  } catch {
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
export async function handleRebaseConflicts(
  git: GitClient,
  vaultPath: string,
): Promise<{ resolvedCount: number; records: ConflictRecord[] }> {
  const status = await git.getStatusSummary();
  if (status.conflicted.length === 0) {
    return { resolvedCount: 0, records: [] };
  }

  const existingRecords = loadConflictRecords(vaultPath);
  const newRecords: ConflictRecord[] = [];
  const now = new Date();

  for (const conflictedRelPath of status.conflicted) {
    const fullOriginalPath = path.join(vaultPath, conflictedRelPath);

    // Read incoming version from git index stage 3
    const incomingContent = await git.getIncomingFileContent(conflictedRelPath);
    // Read local version from git index stage 2 or local filesystem
    let localContent = await git.getLocalFileContent(conflictedRelPath);
    if (localContent === null && fs.existsSync(fullOriginalPath)) {
      localContent = fs.readFileSync(fullOriginalPath, 'utf-8');
    }

    let conflictRelPath = formatConflictFilename(conflictedRelPath, now);
    let fullConflictPath = path.join(vaultPath, conflictRelPath);

    // If a conflict file already exists for today, append a counter
    let counter = 1;
    while (fs.existsSync(fullConflictPath)) {
      const ext = path.extname(conflictedRelPath);
      const baseNoExt = conflictRelPath.slice(0, -ext.length);
      conflictRelPath = `${baseNoExt}-${counter}${ext}`;
      fullConflictPath = path.join(vaultPath, conflictRelPath);
      counter++;
    }

    // Write incoming content to conflict file
    if (incomingContent !== null) {
      fs.writeFileSync(fullConflictPath, incomingContent, 'utf-8');
    } else {
      // Fallback: copy what currently exists
      fs.copyFileSync(fullOriginalPath, fullConflictPath);
    }

    // Ensure original file retains our local version
    if (localContent !== null) {
      fs.writeFileSync(fullOriginalPath, localContent, 'utf-8');
    }

    // Mark both files resolved in git
    await git.exec(['add', fullOriginalPath, fullConflictPath]);

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
  const continueRes = await git.continueRebase();
  if (continueRes.code !== 0) {
    logSyncMessage(
      vaultPath,
      `REBASE WARNING: git rebase --continue exited with code ${continueRes.code}: ${continueRes.stderr}`,
    );
  }

  const updatedRecords = [...existingRecords, ...newRecords];
  saveConflictRecords(vaultPath, updatedRecords);

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
  const fullConflictPath = path.resolve(vaultPath, conflictFilePath);
  if (!fs.existsSync(fullConflictPath)) {
    return { success: false, message: `Conflict file not found: ${conflictFilePath}` };
  }

  // Deduce original filename
  const dir = path.dirname(conflictFilePath);
  const ext = path.extname(conflictFilePath);
  const base = path.basename(conflictFilePath, ext);
  const originalBase = base.replace(/\.conflict-\d{4}-\d{2}-\d{2}(-\d+)?$/, '');
  const originalRelPath =
    dir === '.' ? `${originalBase}${ext}` : path.join(dir, `${originalBase}${ext}`);
  const fullOriginalPath = path.resolve(vaultPath, originalRelPath);

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
  const target = records.find(
    (r) => r.conflictFile === conflictFilePath.replace(/\\/g, '/') && !r.resolved,
  );
  if (target) {
    target.resolved = true;
    target.resolutionStrategy = strategy;
    saveConflictRecords(vaultPath, records);
  }

  if (git) {
    await git.stageAll();
    await git.commit(
      `vault(resolve): ${strategy === 'accept-incoming' ? 'accept incoming' : 'keep local'} for ${originalRelPath}`,
    );
  }

  return {
    success: true,
    message: `Conflict resolved using '${strategy}'.`,
  };
}
