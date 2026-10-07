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

| Command                                      | Description                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| `vaultsync status [vaultPath]`               | Shows last push/pull time, commit hash, the newest error, and pending conflict files. |
| `vaultsync status [vaultPath] --json`        | Outputs status as structured JSON.                                                    |
| `vaultsync start [vaultPath]`                | Starts the continuous background sync watcher.                                        |
| `vaultsync sync [vaultPath]`                 | Executes an immediate one-shot commit, pull with rebase, and push.                    |
| `vaultsync init [vaultPath]`                 | Sets up git, installs `.gitignore`, and configures remote repository.                 |
| `vaultsync conflicts [vaultPath]`            | Lists all unreviewed `.conflict-*.md` files.                                          |
| `vaultsync resolve <file> --keep-local`      | Discards the incoming conflict file, keeping your local version.                      |
| `vaultsync resolve <file> --accept-incoming` | Replaces your local version with the incoming version.                                |

`resolve` refuses any path that resolves outside the vault, so a malformed or
injected filename cannot read, overwrite, or delete a file elsewhere on disk.

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
   `<filename>.md`, byte for byte.
3. **Repeated conflicts the same day** get a flat counter so nothing collides
   and every name maps back to the same note:
   ```
   MeetingNotes.conflict-2026-10-01.md
   MeetingNotes.conflict-2026-10-01-2.md
   MeetingNotes.conflict-2026-10-01-3.md
   ```
4. **Automatic rebase continue**: Both files are staged, and git rebase finishes
   cleanly without aborting. If the rebase still cannot continue, the failure is
   logged and **push is blocked** rather than building on a broken history.
5. **Logged & tracked**: The event is recorded in `.vaeloom/sync.log` and
   `.vaeloom/conflicts.json` (both device-local).
6. **Resolution**: Review the side-by-side diff in Obsidian, or resolve via CLI:
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

# Vaeloom device-local runtime state
.vaeloom/cache/**
.vaeloom/sync.log
.vaeloom/sync-config.json
.vaeloom/conflicts.json

# System files
.DS_Store
Thumbs.db
desktop.ini
*.tmp
```

> **Why `.vaeloom/sync-config.json` and `.vaeloom/conflicts.json` are ignored:**
> both are per-device state. `sync-config.json` holds your machine's remote and
> branch, and `conflicts.json` is rewritten by a read-modify-write that has no
> merge — syncing it would let two machines overwrite each other's conflict
> ledger, which is the exact failure this tool exists to prevent. Your **notes**
> are what sync; the daemon's bookkeeping stays local.

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

---

## 9. When Sync Cannot Proceed

`vaultsync` never reports success it did not achieve. If a step fails, the
reason is written to `.vaeloom/sync.log`, surfaced by `vaultsync status`, and
the operation stops rather than pushing on top of a broken history.

| Symptom in `status`                                    | Meaning                                                                  | Fix                                                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `Last Error: ...rebase... reason other than conflicts` | Git refused the rebase (uncommitted local edits, missing upstream, auth) | Commit or stash local edits, then `vaultsync sync`                                                                     |
| `Last Error: a rebase is already in progress...`       | A previous rebase could not finish                                       | `git rebase --abort` inside the vault, then `vaultsync sync`. **Push is blocked** until you do — this protects history |
| `PUSH BLOCKED` in the log                              | Local commits were made, but pushing would entangle an unresolved rebase | Resolve or abort the rebase, then `vaultsync sync`                                                                     |
| `GIT UNAVAILABLE` in the log                           | No `git` binary on PATH                                                  | None needed. Sync is off; notes and in-app memory work normally. Install Git to enable sync                            |
| `PULL SKIPPED: no git remote configured`               | `--remote` was never set                                                 | `vaultsync init <path> --remote <url>`. Running local-only is intentional and logged once, not silently                |

**No `git` installed is a supported state, not a failure.** The vault stays a
plain folder of Markdown, in-app memory is unaffected, and `vaultsync start`
logs one clear line and exits without touching anything.

---

## 11. Reporting Status to Vaeloom (optional)

Vaeloom's server does **not** run a git engine. It has no access to your vault.
The web app shows real sync state only when your local client reports it.

Without reporting, the web UI correctly displays **"No client connected"** — it
never invents a healthy daemon.

To enable reporting, set three environment variables before `vaultsync start`:

```bash
export VAELOOM_API_URL="http://localhost:8000"     # your API base
export VAELOOM_API_TOKEN="<your bearer token>"     # API token
export VAELOOM_WORKSPACE_ID="<workspace uuid>"
vaultsync start ~/Documents/MyVault
```

What gets reported, every 60 seconds and once at startup:

| Field                               | Source                                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `daemon_status`                     | Derived server-side from heartbeat freshness — `running`, `stale`, or `not_connected`          |
| `last_pull_time` / `last_push_time` | Latest commit timestamp on this machine                                                        |
| `conflicts`                         | Unresolved entries from `.vaeloom/conflicts.json` **whose `.conflict-*.md` file still exists** |
| `logs`                              | Last 20 lines of `.vaeloom/sync.log`                                                           |
| `branch`, `remote_url`, `machine`   | Live from this machine                                                                         |

**Reporting is best-effort and can never break syncing.** If the API is down,
unreachable, or the token is wrong, the failure is recorded internally and git
sync carries on unaffected. A vault does not require a Vaeloom account.

### Recovering a stuck rebase

```bash
cd /path/to/my-vault
git rebase --abort        # returns you to your last commit; nothing is lost
vaultsync sync            # retry cleanly
```

Aborting is always safe: your local commits stay on your branch, and the remote
version is still on the remote. Nothing is discarded.

---

## 10. Tests

```bash
cd packages/vaeloom-sync
npm test
```

`tests/integration.test.ts` drives **real `git`** against a real bare remote
across simulated machines. It asserts exact file bytes, exact log lines, and
that negative cases are refused — including a path-traversal attempt on
`resolve` that must leave the file outside the vault untouched.
