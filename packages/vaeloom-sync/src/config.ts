import * as fs from 'fs';
import * as path from 'path';

export interface VaultSyncConfig {
  vaultPath: string;
  remoteUrl?: string;
  remoteName?: string;
  branch: string;
  debounceMs: number;
  pullIntervalMs: number;
  autoPush: boolean;
  autoPull: boolean;
  ignoredPatterns: string[];
}

export const DEFAULT_CONFIG: Omit<VaultSyncConfig, 'vaultPath'> = {
  remoteName: 'origin',
  branch: 'main',
  debounceMs: 30000, // 30s debounce after last change
  pullIntervalMs: 300000, // 5 minutes pull with rebase
  autoPush: true,
  autoPull: true,
  ignoredPatterns: [
    '.obsidian/workspace*',
    '.obsidian/cache*',
    '.obsidian/plugins/obsidian-git/',
    '.trash/**',
    '.vaeloom/cache/**',
    '.vaeloom/sync.log',
    '.DS_Store',
    'Thumbs.db',
    'desktop.ini',
    '*.tmp',
  ],
};

export function resolveVaultPath(inputPath?: string): string {
  if (inputPath && inputPath.trim().length > 0) {
    return path.resolve(process.cwd(), inputPath);
  }
  if (process.env['VAELOOM_VAULT_PATH']) {
    return path.resolve(process.env['VAELOOM_VAULT_PATH']);
  }
  return process.cwd();
}

export function getConfigPath(vaultPath: string): string {
  return path.join(vaultPath, '.vaeloom', 'sync-config.json');
}

export function loadConfig(vaultPath: string): VaultSyncConfig {
  const cfgFile = getConfigPath(vaultPath);
  let diskConfig: Partial<VaultSyncConfig> = {};

  if (fs.existsSync(cfgFile)) {
    try {
      const raw = fs.readFileSync(cfgFile, 'utf-8');
      diskConfig = JSON.parse(raw);
    } catch (err) {
      console.warn(`[vaeloom-sync] Failed to parse ${cfgFile}, using defaults.`, err);
    }
  }

  return {
    vaultPath,
    remoteUrl: process.env['VAELOOM_REMOTE_URL'] || diskConfig.remoteUrl,
    remoteName: diskConfig.remoteName || DEFAULT_CONFIG.remoteName,
    branch: process.env['VAELOOM_BRANCH'] || diskConfig.branch || DEFAULT_CONFIG.branch,
    debounceMs: diskConfig.debounceMs || DEFAULT_CONFIG.debounceMs,
    pullIntervalMs: diskConfig.pullIntervalMs || DEFAULT_CONFIG.pullIntervalMs,
    autoPush: diskConfig.autoPush ?? DEFAULT_CONFIG.autoPush,
    autoPull: diskConfig.autoPull ?? DEFAULT_CONFIG.autoPull,
    ignoredPatterns: diskConfig.ignoredPatterns || DEFAULT_CONFIG.ignoredPatterns,
  };
}

export function saveConfig(config: VaultSyncConfig): void {
  const dir = path.join(config.vaultPath, '.vaeloom');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const cfgFile = getConfigPath(config.vaultPath);
  fs.writeFileSync(cfgFile, JSON.stringify(config, null, 2), 'utf-8');
}
