# Vaeloom Vault Sync (`vaultsync` / `vaeloom-sync`)

A small, zero-telemetry, Git-backed synchronization daemon and CLI for your
local Markdown vault (Obsidian, Logseq, or plain notes) to replace Obsidian
Sync.

---

## 1. Why Git Plumbing?

- **Plumbing, not an app**: Your vault is simply a folder of plain Markdown
  files on your disk.
- **True history**: Unlike Syncthing, Git stores complete, verifiable, immutable
  commit history.
- **Private & zero telemetry**: Keep your notes in a private GitHub or GitLab
  repository using your system git credential helper or SSH keys. No accounts
  beyond GitHub, no telemetry, no tracking.
- **Zero proprietary lock-in**: Your notes stay plain Markdown files on disk
  forever.

---

## 2. Quick Start

### Installation & Symlink

From this monorepo:

```bash
# Build the package
cd packages/vaeloom-sync
pnpm run build

# Link globally or run via npx / pnpm
npm link
```

### Initializing a Vault

Point `vaultsync` at your local Markdown notes folder:

```bash
vaultsync init /path/to/my-vault --remote git@github.com:yourusername/private-vault.git
```

This will:

1. Initialize a git repository in `/path/to/my-vault` (if not already
   initialized).
2. Install a safe `.gitignore` preventing device-local and cache state from
   colliding.
3. Save configuration in `/path/to/my-vault/.vaeloom/sync-config.json`.
4. Configure the remote Git repository.

### Starting the Sync Daemon

```bash
vaultsync start /path/to/my-vault
```

**What the daemon does:**

1. **Pulls on start**: Immediately performs `git fetch` and
   `git rebase origin/main`.
2. **Periodic pull**: Runs a pull with rebase every **5 minutes** in the
   background.
3. **Trailing debounce auto-push**: Watches for file modifications, waits **30
   seconds** after your last edit, automatically commits with
   `vault(sync): auto-sync [date]`, and pushes to your private repository.
4. **Zero-data-loss conflict handling**: If a remote change conflicts with a
   local note, it never loses data. See the Conflict Convention below.

---

## 3. CLI Commands

| Command                                      | Description                                                           |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `vaultsync status [vaultPath]`               | Shows last push/pull time, commit hash, and pending conflict files.   |
| `vaultsync status [vaultPath] --json`        | Outputs status as structured JSON.                                    |
| `vaultsync start [vaultPath]`                | Starts the continuous background sync watcher.                        |
| `vaultsync sync [vaultPath]`                 | Executes an immediate one-shot commit, pull with rebase, and push.    |
| `vaultsync init [vaultPath]`                 | Sets up git, installs `.gitignore`, and configures remote repository. |
| `vaultsync conflicts [vaultPath]`            | Lists all unreviewed `.conflict-*.md` files.                          |
| `vaultsync resolve <file> --keep-local`      | Discards the incoming conflict file, keeping your local version.      |
| `vaultsync resolve <file> --accept-incoming` | Replaces your local version with the incoming version.                |

---

## 4. Conflict Resolution Convention

When a rebase conflict occurs on any Markdown file:

1. **Incoming version saved**: The incoming version from the remote repository
   is written to:
   ```
   <filename>.conflict-YYYY-MM-DD.md
   ```
   (e.g., `MeetingNotes.conflict-2026-10-01.md`).
2. **Local copy retained**: Your local version is kept untouched in
   `<filename>.md`.
3. **Automatic rebase continue**: Both files are staged, and git rebase finishes
   cleanly without aborting.
4. **Logged & tracked**: The event is recorded in `.vaeloom/sync.log` and
   `.vaeloom/conflicts.json`.
5. **Resolution**: You can review the side-by-side diff in Obsidian, in the
   Vaeloom Memory web interface under the **Vault Sync** tab, or resolve via
   CLI:
   ```bash
   # Keep your local note and discard the conflict file:
   vaultsync resolve MeetingNotes.conflict-2026-10-01.md --keep-local

   # Overwrite your local note with the incoming version:
   vaultsync resolve MeetingNotes.conflict-2026-10-01.md --accept-incoming
   ```

---

## 5. Device-Local State & `.gitignore`

The following patterns are automatically ignored so device-local state does not
ping-pong between machines:

```gitignore
# Obsidian local workspace & cache
.obsidian/workspace*
.obsidian/cache*
.obsidian/plugins/obsidian-git/

# Trash folders
.trash/
.trash/**

# Vaeloom sync cache and logs
.vaeloom/cache/**
.vaeloom/sync.log

# System files
.DS_Store
Thumbs.db
desktop.ini
*.tmp
```

---

## 6. Second-Machine Setup Steps

To set up your vault on a second machine (e.g. laptop):

1. **Clone the private repository**:
   ```bash
   git clone git@github.com:yourusername/private-vault.git ~/Documents/MyVault
   ```
2. **Run `vaultsync init`** in the cloned folder:
   ```bash
   vaultsync init ~/Documents/MyVault
   ```
3. **Start the watcher**:
   ```bash
   vaultsync start ~/Documents/MyVault
   ```
   _(Optionally run it as a background service via systemd on Linux, launchd on
   macOS, or Task Scheduler on Windows)._

---

## 7. Mobile Clients (iOS & Android)

You do **not** need any custom mobile app. Simply point a standard Git client at
your private GitHub repo:

### iOS Setup with Working Copy

1. Install **Working Copy** from the App Store.
2. Link your private GitHub account or add an SSH key.
3. Clone your private vault repository into Working Copy.
4. Open the **Obsidian** mobile app -> choose "Open folder as vault" -> select
   the cloned folder inside Working Copy.
5. In Working Copy, enable auto-fetch or use iOS Shortcuts to sync on
   open/close.

### Android Setup with MGit or GitJournal

1. Install **MGit** (F-Droid / Play Store) or **GitJournal**.
2. Add your SSH private key or GitHub personal access token (PAT).
3. Clone your private repository to `/storage/emulated/0/Documents/Vault`.
4. Open Obsidian for Android and choose "Open folder as vault" pointing to that
   path.

---

## 8. Out of Scope

- An encrypted-vault workflow.
- A proprietary version-history UI. `git log` is the history.
