"""Generate ``apps/web/src/lib/tool-fallback.generated.ts`` from the tool registry.

Why this script exists
----------------------
The six tool rows in ``apps/web/src/lib/capabilities-data.ts`` were hand-written
copies of ``ToolDefinition`` fields from ``apps/api/src/api/tools/definitions.py``
and they drifted: one row invented a scope the registry does not contain
(``system.tool.execution``), another contradicted the backend prompt text, and
none of them stayed in step with registry mutations. A scoped-down user was
shown tools their role cannot call, and nothing ever compared the two lists.

Generating the fallback rows from ``ALL_TOOLS`` -- the same dictionary the
running backend derives its tool surface from -- makes the UI the same fact as
the registry by construction. This file plus ``--check`` keeps the committed
artefact honest, so the fix cannot rot back into a second source of truth.

Determinism is a hard requirement, not a nicety
-----------------------------------------------
``--check`` is a byte-exact CI-grade gate: it must pass on a freshly generated
file and fail on a stale or hand-edited one. Three things follow:

* No timestamps anywhere: a regeneration that changes nothing produces no diff.
* Output is written as raw bytes with LF endings, never through text-mode
  newline translation. ``core.autocrlf`` is ``true`` on the Windows machines
  this repo is built on; a CRLF write would produce a file that differs from
  its own generator output on the very machine that wrote it.
* ``--check`` compares **bytes**, so the comparison cannot be quietly
  normalised by universal-newline reading into a pass that a real byte diff
  disagrees with. On failure it prints a unified diff naming what to regenerate.

The script deliberately does not import the FastAPI app and never touches a
database: it puts ``apps/api/src`` on ``sys.path`` and reads one module-level
constant (``ALL_TOOLS``). A generator that needed a running API would be useless
as a gate. ``--output`` exists so tests can render into a temp directory without
touching ``apps/web``.
"""

from __future__ import annotations

import argparse
import difflib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
API_SRC = REPO_ROOT / "apps" / "api" / "src"
OUTPUT = REPO_ROOT / "apps" / "web" / "src" / "lib" / "tool-fallback.generated.ts"

PINNED_PYTHON = (3, 12)


def _needs_reexec(version_info: tuple[int, int, ...], module_name: str) -> bool:
    """Whether to re-exec under the pinned interpreter before doing any work.

    Same self-guard ``gen_openapi.py`` and ``gen_memory_type_union.py`` use: the
    registry import needs Pydantic, which lives in the API's environment, so
    running under a bare interpreter should re-exec under ``uv run --project
    apps/api`` rather than fail with an ``ImportError``. Keyed on
    ``module_name`` so importing this module never re-exits -- only *running*
    it needs the API's tree.
    """
    return module_name == "__main__" and version_info[:2] != PINNED_PYTHON


def _reexec_under_pinned_interpreter() -> None:
    """Hand off to the pinned interpreter. Never returns; exits with its status."""
    cmd = [
        "uv", "run", "--project", "apps/api", "python", str(Path(__file__).resolve())
    ] + sys.argv[1:]
    raise SystemExit(subprocess.call(cmd, cwd=str(REPO_ROOT)))


# Baked into every emitted file, with no date and no count: a regeneration that
# changes nothing produces no diff, and a count would only go stale on a reader
# who forgot to regenerate.
_HEADER = """\
/**
 * GENERATED FILE -- DO NOT EDIT BY HAND.
 *
 * Source of truth: `ALL_TOOLS` in `apps/api/src/api/tools/definitions.py`.
 * Every row in `TOOL_FALLBACK` is rendered from a `ToolDefinition` -- the same
 * definitions the running backend serves -- so the workbench fallback cannot
 * drift from what the API actually accepts.
 *
 * Copied verbatim (JSON-escaped): name, description, requiredScope, trustClass,
 * inputSchema, outputSchema. The only derived fields are:
 *   - `id`:          `tool-` + the tool name with underscores dashed
 *   - `tags`:        the backend `category` and `trust_class`, title-cased
 *   - `markdownDoc`: tool name, backend description, required scope
 * Nothing else here is invented from the UI side.
 *
 * Regenerate:  `uv run --project apps/api python scripts/gen_tool_fallback.py`
 * Verify:      `uv run --project apps/api python scripts/gen_tool_fallback.py --check`
 *
 * Rows follow `ALL_TOOLS` insertion order -- the order is part of the diff, as
 * with `memory.generated.ts`.
 */

import type { CapabilityItem } from './capabilities-data';

export const TOOL_FALLBACK: readonly CapabilityItem[] = """


def _title_cased(snake: str) -> str:
    """'memory_read' -> 'Memory Read'; backend vocabulary, presentational case."""
    return " ".join(part.capitalize() for part in snake.split("_"))


def _tags(tool: Any) -> list[str]:
    """Deterministic display tags derived only from registry vocabulary.

    Only the two trust classes the registry actually uses today are title-cased
    into tags; anything unexpected simply contributes no tag rather than a
    mangled one, because tags are labels and must never invent facts.
    """
    tags = [_title_cased(tool.category)]
    if tool.trust_class in ("first_party", "core_trusted"):
        tags.append(_title_cased(tool.trust_class))
    return tags


def _markdown_doc(tool: Any) -> str:
    """The workbench 'How it behaves' doc, assembled only from backend fields."""
    return (
        f"# {tool.name}\n\n"
        f"{tool.description.strip()}\n\n"
        "### Permissions\n\n"
        f"Requires `{tool.required_scope}`.\n"
    )


def build_row(tool: Any) -> dict[str, object]:
    """One ``CapabilityItem``-shaped row from one ``ToolDefinition``.

    ``tool`` is a Pydantic ``ToolDefinition`` (untyped here on purpose: it keeps
    ``render`` importable without the API's dependency tree). Field coverage
    matches the seed rows the web app renders; telemetry fields are fixed to
    the seed truth -- a never-run tool must not claim usage.
    """
    return {
        "id": f"tool-{tool.name.replace('_', '-')}",
        "name": tool.name,
        "category": "tools",
        "tags": _tags(tool),
        "description": tool.description,
        "enabled": True,
        "source": "built-in",
        "usageCount": 0,
        "lastUsedAt": None,
        "isSeed": True,
        "requiredScope": tool.required_scope,
        "trustClass": tool.trust_class,
        "inputSchema": tool.input_schema,
        "outputSchema": tool.output_schema,
        "markdownDoc": _markdown_doc(tool),
    }


def _registry() -> list[Any]:
    """Read the tool objects out of ``ALL_TOOLS`` in order, definition order.

    Imported lazily rather than at module scope so ``render`` stays importable
    without the API's dependency tree; the version guard fires only for direct
    script runs, never for imports. This mirrors ``gen_memory_type_union.py``.
    """
    if str(API_SRC) not in sys.path:
        sys.path.insert(0, str(API_SRC))
    from api.tools.definitions import ALL_TOOLS

    return list(ALL_TOOLS.values())


def render_manifest(rows: list[dict[str, object]]) -> str:
    """Emit the TypeScript manifest as a pure function of ``rows``.

    Same list in, byte-identical string out -- that is what makes ``--check``
    a real gate. Rows are rendered with ``json.dumps`` (double quotes,
    ``ensure_ascii=True``), which is valid TypeScript object syntax: every
    JSON escape is a valid TS escape.
    """
    if not rows:
        # An empty manifest compiles fine and is silently useless: the workbench
        # would render zero tool rows and nothing would point at the registry.
        raise ValueError(
            "refusing to emit an empty tool fallback manifest: "
            "ALL_TOOLS returned no tools"
        )
    return _HEADER + json.dumps(rows, indent=2, ensure_ascii=True) + ";\n"


def _report_drift(path: Path, on_disk: bytes, rendered: bytes) -> None:
    """Print a unified diff so the reader sees what to regenerate, not just a flag."""
    before = on_disk.decode("utf-8", errors="replace").splitlines(keepends=True)
    after = rendered.decode("utf-8", errors="replace").splitlines(keepends=True)
    sys.stderr.writelines(
        difflib.unified_diff(
            before, after, fromfile=f"{path.name} (on disk)", tofile="rendered"
        )
    )


def main(argv: list[str] | None = None) -> int:
    """Render the manifest -- or, with ``--check``, verify it byte-exactly.

    ``--output`` routes all modes at a non-default path (tests render into a
    temp directory; the default is the committed file under ``apps/web``).
    """
    parser = argparse.ArgumentParser(
        description=(
            "Generate apps/web/src/lib/tool-fallback.generated.ts from the "
            "backend tool registry (apps/api/src/api/tools/definitions.py)."
        )
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help=(
            "verify the file is byte-identical to a fresh render and exit "
            "non-zero if it is not; writes nothing"
        ),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT,
        help="target path (defaults to the committed file under apps/web)",
    )
    args = parser.parse_args(argv)

    rows = [build_row(tool) for tool in _registry()]
    rendered = render_manifest(rows).encode("utf-8")
    output = args.output

    if args.check:
        if not output.exists():
            print(
                f"--check failed: {output} does not exist; run "
                "`uv run --project apps/api python scripts/gen_tool_fallback.py`",
                file=sys.stderr,
            )
            return 1
        on_disk = output.read_bytes()
        if on_disk == rendered:
            print(f"--check ok: {output.name} is up to date ({len(rows)} tools)")
            return 0
        print(
            f"--check failed: {output.name} is stale against ALL_TOOLS "
            f"({len(rows)} tools); run "
            "`uv run --project apps/api python scripts/gen_tool_fallback.py`",
            file=sys.stderr,
        )
        _report_drift(output, on_disk, rendered)
        return 1

    output.parent.mkdir(parents=True, exist_ok=True)
    # Binary mode on purpose: text mode would apply newline translation, and
    # the whole point of the byte comparison above is that the file on disk is
    # exactly what this function produced.
    with output.open("wb") as handle:
        handle.write(rendered)
    print(f"wrote {output} ({len(rows)} tools, {len(rendered)} bytes)")
    return 0


if __name__ == "__main__":
    if _needs_reexec(sys.version_info, __name__):
        _reexec_under_pinned_interpreter()
    raise SystemExit(main())
