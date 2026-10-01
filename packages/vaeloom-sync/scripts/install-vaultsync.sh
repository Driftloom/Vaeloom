#!/usr/bin/env bash
# Vaeloom Vault Sync — Linux/macOS Automated Installer
set -e

INSTALL_DIR="${HOME}/.local/bin"
VAELOOM_DIR="${HOME}/.vaeloom/sync"

echo "=========================================================="
echo "          Vaeloom Vault Git Sync Companion Installer      "
echo "=========================================================="

# 1. Check Git prerequisite
if ! command -v git &> /dev/null; then
    echo "Error: git is required for vault synchronization. Please install git first."
    exit 1
fi
echo "[OK] Git detected: $(git --version)"

# 2. Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js 18+ is required. Please install Node.js first."
    exit 1
fi
echo "[OK] Node.js detected: $(node --version)"

# 3. Create target directory
mkdir -p "${INSTALL_DIR}"
mkdir -p "${VAELOOM_DIR}"

# 4. Copy/install companion files
echo "Installing @vaeloom/vault-sync companion..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(dirname "${SCRIPT_DIR}")"

if [ -f "${PACKAGE_ROOT}/dist/src/cli.js" ]; then
    cp -r "${PACKAGE_ROOT}/dist" "${VAELOOM_DIR}/"
    cp "${PACKAGE_ROOT}/package.json" "${VAELOOM_DIR}/"
else
    npm install -g @vaeloom/vault-sync
fi

# 5. Create vaultsync executable wrapper
cat << 'EOF' > "${INSTALL_DIR}/vaultsync"
#!/usr/bin/env bash
node "${HOME}/.vaeloom/sync/dist/src/cli.js" "$@"
EOF
chmod +x "${INSTALL_DIR}/vaultsync"

# 6. Ensure ~/.local/bin is on PATH
if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
    echo "Notice: Please add ${INSTALL_DIR} to your PATH by adding:"
    echo '  export PATH="$HOME/.local/bin:$PATH"'
    echo "to your ~/.bashrc or ~/.zshrc file."
fi

echo ""
echo "Vaeloom Vault Sync (vaultsync) installed successfully!"
echo "Run 'vaultsync status' to verify."
echo "To initialize a vault: 'vaultsync init <path-to-markdown-vault>'"
