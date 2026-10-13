"""No real cloud credentials may be tracked in git.

Context, because this looks like a duplicate of `.gitignore`:

`.gitignore` already ignores `.env`, and the three local env files on this
machine do hold real Supabase values. That is correct -- they are local config,
they are untracked, and nothing is leaked. What `.gitignore` cannot do is stop
someone running `git add -f`, or pasting a connection string into a tracked
config or a doc, or a tool writing one into a file that is already tracked.

So this scans what git actually tracks, which is the only set that can reach a
reviewer or CI log. It is the check that would have caught a leak; the ignore
rules are the thing it is checking.

Placeholders are explicitly allowed. `infra/.../.env.production.example` and
`.env.example` legitimately contain `postgresql+asyncpg://postgres.your-project-
ref:your-db-password@aws-0-us-east-1.pooler.supabase.com` as documentation.
Those must not fail this test, or the examples become useless.
"""

import re
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]

# Supabase hands out either pooler or direct hosts, and the project ref sits in
# a different position in each:
#   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com
#   postgresql://postgres:<password>@db.<ref>.supabase.co
# so the ref cannot be matched by one fixed pattern. Instead each line is
# checked for a cloud-DB marker, and only then is the ref token extracted. That
# is what keeps ordinary prose mentioning "postgres" from matching.
CLOUD_DB_MARKER = re.compile(r"(?i)(pooler\.supabase\.|db\.[a-z0-9-]+\.supabase\.co)")
PROJECT_REF = re.compile(r"(?i)\b(?:postgres|db)\.(?P<ref>[A-Za-z0-9][A-Za-z0-9_-]{11,})")
SUPABASE_S3_KEY = re.compile(r"(?i)\b(?:s3|access)[_-]?secret[_-]?key\s*=\s*(?P<v>[A-Za-z0-9/+]{20,})")

PLACEHOLDER_MARKERS = (
    "your-",
    "your_",
    "<",
    "changeme",
    "change-me",
    "placeholder",
    "example",
    "xxxx",
    "todo",
    "replace",
)


def real_project_refs(text: str) -> list[str]:
    """Project refs on lines that also look like a managed-database URL."""
    refs = []
    for line in text.splitlines():
        if not CLOUD_DB_MARKER.search(line):
            continue
        for match in PROJECT_REF.finditer(line):
            ref = match.group("ref")
            if not looks_like_placeholder(ref):
                refs.append(ref)
    return refs


def tracked_text_files() -> list[Path]:
    out = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    ).stdout
    return [
        REPO_ROOT / p
        for p in out.split("\0")
        if p and (REPO_ROOT / p).stat().st_size <= 2_000_000
    ]


def looks_like_placeholder(value: str) -> bool:
    lowered = value.lower()
    return any(marker in lowered for marker in PLACEHOLDER_MARKERS)


@pytest.mark.parametrize(
    "relative_path",
    [
        ".env",
        "apps/api/.env",
        "apps/web/.env.local",
        ".env.staging",
    ],
)
def test_local_env_files_are_not_tracked(relative_path: str):
    """The specific files AGENTS.md forbids must stay untracked.

    Named individually rather than pattern-matched, because a generic
    "no .env is tracked" rule would break the committed `.env.example` and
    `.env.production.example` documentation files.
    """
    if not (REPO_ROOT / relative_path).exists():
        pytest.skip(f"{relative_path} not present in this checkout")
    tracked = subprocess.run(
        ["git", "ls-files", "--error-unmatch", relative_path],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert tracked.returncode != 0, f"{relative_path} is tracked; it must never be"


def test_no_tracked_file_contains_a_real_managed_database_credential():
    """The guard that would catch a leak gitignore cannot prevent."""
    offenders: list[str] = []
    for path in tracked_text_files():
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for ref in real_project_refs(text):
            offenders.append(f"{path.relative_to(REPO_ROOT)}: project ref {ref}")
    assert offenders == [], "managed database credentials are tracked:\n" + "\n".join(offenders)


def test_no_tracked_file_contains_a_real_storage_secret_key():
    offenders: list[str] = []
    for path in tracked_text_files():
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for match in SUPABASE_S3_KEY.finditer(text):
            if looks_like_placeholder(match.group("v")):
                continue
            offenders.append(f"{path.relative_to(REPO_ROOT)}: storage secret key")
    assert offenders == [], "storage secret keys are tracked:\n" + "\n".join(offenders)


def test_the_documented_placeholder_example_still_passes():
    """Negative control for the scanner itself.

    Without this, a regex that never matched would make the two tests above
    pass forever while checking nothing. If the committed example template is
    edited to drop its placeholders, or to stop being a cloud-DB example at all,
    this fails and says which.
    """
    example = REPO_ROOT / "apps/api/.env.production.example"
    if not example.exists():
        pytest.skip("example template not present")
    text = example.read_text(encoding="utf-8", errors="replace")
    assert CLOUD_DB_MARKER.search(text), "example template no longer contains a cloud DB URL"
    # Every ref on those lines must be a placeholder.
    refs = [
        m.group("ref")
        for line in text.splitlines()
        if CLOUD_DB_MARKER.search(line)
        for m in PROJECT_REF.finditer(line)
    ]
    assert refs, "expected the example to still document a pooler URL"
    for ref in refs:
        assert looks_like_placeholder(ref), (
            f"example template should use a placeholder project ref, found {ref!r}"
        )
