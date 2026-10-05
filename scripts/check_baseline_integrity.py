#!/usr/bin/env python3
"""Safeguard: prevent accidental overwriting of canonical Linux visual baselines from non-Linux OS.

The -linux baselines are authoritative and cannot be generated from Windows or macOS
due to OS-level font rasterization and antialiasing discrepancies.
CI pins ubuntu-24.04, and changes to -linux.png must only come from the
`visual-baseline-refresh` GitHub Actions workflow.
"""
import subprocess
import sys


def get_changed_files() -> list[str]:
    # Check both staged and unstaged modified files
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return []

    changed = []
    for line in result.stdout.splitlines():
        if len(line) > 3:
            # Porcelain format: XY filename
            filepath = line[3:].strip()
            if " -> " in filepath:
                filepath = filepath.split(" -> ")[1].strip()
            changed.append(filepath.replace("\\", "/"))
    return changed


def main() -> int:
    if "--restore" in sys.argv:
        print("Restoring canonical Linux baselines from origin/master or 00f69159...")
        subprocess.run(
            ["git", "checkout", "00f69159", "--", "apps/web/e2e/**-linux.png"],
            check=False,
        )
        print("Restoration complete.")
        return 0

    if sys.platform == "linux":
        return 0

    changed = get_changed_files()
    linux_snapshots = [
        f for f in changed if f.endswith("-linux.png") and "e2e/" in f
    ]

    divergent = []
    for snap in linux_snapshots:
        # If diff against canonical commit 00f69159 is non-empty, it's an unapproved divergence
        diff = subprocess.run(
            ["git", "diff", "00f69159", "--", snap],
            capture_output=True,
            text=True,
            check=False,
        )
        if diff.stdout.strip():
            divergent.append(snap)

    if divergent:
        print(
            f"ERROR: Cannot modify canonical Linux baselines on {sys.platform}!\n"
            f"Font rasterization differs per OS. The following files diverge from canonical baselines:\n",
            file=sys.stderr,
        )
        for snap in divergent:
            print(f"  - {snap}", file=sys.stderr)
        print(
            "\nTo restore the workflow-generated originals, run:\n"
            "  python scripts/check_baseline_integrity.py --restore\n\n"
            "To refresh Linux baselines legitimately, dispatch the `visual-baseline-refresh`\n"
            "GitHub Actions workflow which runs on pinned ubuntu-24.04 runners.\n",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
