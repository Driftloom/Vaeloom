"""Generate the frontend memory-type union from the backend domain packs.

Why this script exists
----------------------
The TypeScript ``MemoryType`` union was a hand-maintained copy of the backend
taxonomy, and it drifted. The copy was a *source format* list (``document |
email | code | note | conversation | webpage | structured``) rather than the
taxonomy the API accepts, so only ``document`` and ``note`` existed on both
sides: five of the seven type filters in the memory UI matched no memory at all,
and the backend rejected everything the other filters could send. Nothing failed
loudly, because nothing ever compared the two lists.

Generating the union from ``CAREER_TYPES`` -- the one constant every backend
write is validated against -- makes the two the same fact by construction. This
file plus ``--check`` makes the committed artefact honest as well, so the fix
cannot rot back into a second source of truth.

Determinism is a hard requirement, not a nicety
-----------------------------------------------
``--check`` is a CI gate: it must pass on a freshly generated file and fail on a
stale one. Three things follow, and each of them is a way that gate can go
quietly useless otherwise:

* Members are emitted in the pack's **declaration** order, never sorted. That
  order is itself a contract -- migration 0068 seeds the database from it -- so a
  reordering has to show up as a diff rather than be absorbed into a set.
* Output is written as raw bytes with LF endings, never through text-mode
  newline translation. ``core.autocrlf`` is ``true`` on the Windows machines this
  repo is built on; a CRLF write would produce a file that differs from its own
  generator output on the very machine that wrote it.
* ``--check`` compares **bytes**, so the comparison cannot be quietly normalised
  by Python's universal-newline reading into a pass that a real byte diff
  disagrees with.

The script deliberately does not import the FastAPI app and never touches a
database: it puts ``apps/api/src`` on ``sys.path`` and reads a module-level
constant. A generator that needed a running API would be useless as a CI gate.
"""

from __future__ import annotations

import argparse
import difflib
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
API_SRC = REPO_ROOT / "apps" / "api" / "src"
OUTPUT = REPO_ROOT / "packages" / "shared-types" / "src" / "types" / "memory.generated.ts"

PINNED_PYTHON = (3, 12)


def _needs_reexec(version_info: tuple[int, int, ...], module_name: str) -> bool:
    """Whether to re-exec under the pinned interpreter before doing any work.

    Same self-guard ``gen_openapi.py`` uses: the API's package tree has to be
    importable to read the registry, so running under a bare interpreter should
    re-exec under ``uv run --project apps/api`` rather than fail with an
    ``ImportError`` the reader cannot act on.

    Deliberately keyed on ``module_name``. The guard exists to make *running* this
    file work; at import time it must not fire at all. It used to sit at module
    scope, where it raised ``SystemExit`` on import under any interpreter but the
    pinned one -- which contradicted this module's own promise that ``render`` is
    importable without the API's dependency tree, and made that promise hold only
    by accident of the repo pinning 3.12. A test pins the split now
    (``test_version_guard_fires_only_when_run_as_a_script``).
    """
    return module_name == "__main__" and version_info[:2] != PINNED_PYTHON


def _reexec_under_pinned_interpreter() -> None:
    """Hand off to the pinned interpreter. Never returns; exits with its status."""
    cmd = [
        "uv", "run", "--project", "apps/api", "python", str(Path(__file__).resolve())
    ] + sys.argv[1:]
    raise SystemExit(subprocess.call(cmd, cwd=str(REPO_ROOT)))

# Baked into every emitted file rather than templated from a date, so a
# regeneration that changes nothing produces no diff at all. No single-quoted
# lowercase words appear anywhere in this header: the drift guard parses union
# members, and an unquoted literal in a comment would be a trap for the next
# reader who greps instead.
_HEADER = """\
/**
 * GENERATED FILE -- DO NOT EDIT BY HAND.
 *
 * Source of truth: `CAREER_TYPES` in
 * `apps/api/src/api/services/memory_type_packs.py`.
 * Regenerate:      `python scripts/gen_memory_type_union.py`
 * Verify (CI):     `python scripts/gen_memory_type_union.py --check`
 *
 * This union is generated rather than hand-maintained because a hand-maintained
 * copy silently diverged from the backend taxonomy once already: the list used
 * to be a source-format list (document, email, code, ...), so five of the seven
 * type filters in the memory UI matched nothing. The guard that keeps this
 * honest is `test_generated_union_matches_career_pack` in
 * `apps/api/tests/test_memory_type_packs.py`.
 *
 * Member order is the pack's declaration order, not sorted -- migration 0068
 * seeds the database from it, so order is part of the contract.
 */
"""

_DOC_COMMENT = (
    "/** GENERATED from the backend memory-type domain packs. Do not hand-edit. */\n"
)


def render(types: list[str]) -> str:
    """Emit the TypeScript union for ``types``, verbatim and in order.

    A pure function of its argument: same list in, byte-identical string out.
    That is what lets ``--check`` be a CI gate instead of a suggestion, so
    nothing here may depend on the clock, the environment, a set's iteration
    order, or the platform's newline convention.
    """
    if not types:
        # An empty union compiles fine and is silently unusable: every call site
        # assigning a memory type would fail to build, and the message would
        # point at the call site rather than at the empty registry that caused it.
        raise ValueError(
            "refusing to emit an empty memory-type union: the pack registry "
            "returned no types"
        )
    members = "\n".join(f"  | '{t}'" for t in types)
    return (
        f"{_HEADER}\n{_DOC_COMMENT}export type GeneratedMemoryType =\n{members};\n"
    )


def _career_types() -> list[str]:
    """Read ``CAREER_TYPES`` out of the backend registry, in source order.

    Imported lazily and by path rather than at module scope so that ``render``
    stays importable without the API's dependency tree -- the drift guard imports
    this module and should not have to pay for SQLAlchemy to check a string. The
    interpreter self-guard is gated on ``__name__`` for the same reason: importing
    this module must never re-exec or exit, on any interpreter. Only *running* it
    needs the API's tree, and therefore only *running* it re-execs under the
    pinned interpreter.
    """
    if str(API_SRC) not in sys.path:
        sys.path.insert(0, str(API_SRC))
    from api.services.memory_type_packs import CAREER_TYPES

    return list(CAREER_TYPES)


def _report_drift(on_disk: bytes, rendered: bytes) -> None:
    """Print a unified diff so CI shows what to regenerate, not just that it is stale."""
    before = on_disk.decode("utf-8", errors="replace").splitlines(keepends=True)
    after = rendered.decode("utf-8", errors="replace").splitlines(keepends=True)
    sys.stderr.writelines(
        difflib.unified_diff(before, after, fromfile=f"{OUTPUT.name} (on disk)", tofile="rendered")
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate the frontend memory-type union from the backend domain packs."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help=(
            "verify the committed file is fresh and exit non-zero if it is not; "
            "writes nothing. This is the CI gate."
        ),
    )
    args = parser.parse_args(argv)

    types = _career_types()
    rendered = render(types).encode("utf-8")
    count = len(types)

    if args.check:
        if not OUTPUT.exists():
            print(
                f"--check failed: {OUTPUT} does not exist; run "
                "`python scripts/gen_memory_type_union.py`",
                file=sys.stderr,
            )
            return 1
        on_disk = OUTPUT.read_bytes()
        if on_disk == rendered:
            print(f"--check ok: {OUTPUT.name} is up to date ({count} members)")
            return 0
        print(
            f"--check failed: {OUTPUT.name} is stale against CAREER_TYPES "
            f"({count} members); run `python scripts/gen_memory_type_union.py`",
            file=sys.stderr,
        )
        _report_drift(on_disk, rendered)
        return 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    # Binary mode on purpose: text mode would apply newline translation, and the
    # whole point of the byte comparison above is that the file on disk is
    # exactly what this function returns.
    with OUTPUT.open("wb") as handle:
        handle.write(rendered)
    print(f"wrote {OUTPUT} ({count} members, {len(rendered)} bytes)")
    return 0


if __name__ == "__main__":
    if _needs_reexec(sys.version_info, __name__):
        _reexec_under_pinned_interpreter()
    raise SystemExit(main())
