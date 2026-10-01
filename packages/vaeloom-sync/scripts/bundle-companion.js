/**
 * Vaeloom Vault Sync — Companion Bundling Script
 * Prepares standalone binary distribution and portable executables.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const binDir = path.join(rootDir, 'bin');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

console.log('[bundle] Bundling @vaeloom/vault-sync companion...');

// 1. Build TypeScript files
console.log('[bundle] Compiling TypeScript...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

// 2. Generate Windows .cmd wrapper
const cmdContent = `@echo off
node "%~dp0..\\dist\\src\\cli.js" %*
`;
fs.writeFileSync(path.join(binDir, 'vaultsync.cmd'), cmdContent, 'ascii');

// 3. Generate Unix wrapper
const shContent = `#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
node "\${SCRIPT_DIR}/../dist/src/cli.js" "$@"
`;
fs.writeFileSync(path.join(binDir, 'vaultsync'), shContent, { mode: 0o755 });

// 4. Create Single-File Standalone Runner
const standaloneRunner = `#!/usr/bin/env node
/**
 * Standalone Single-File Vaeloom Vault Sync
 */
require('../dist/src/cli.js');
`;
fs.writeFileSync(path.join(binDir, 'vaultsync-runner.js'), standaloneRunner, { mode: 0o755 });

console.log('[bundle] Standalone wrappers generated in bin/ directory.');
console.log('[bundle] Ready for distribution.');
