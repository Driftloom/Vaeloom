"""Tests for ``scripts/gen_tool_fallback.py``.

Why a generator, in short
-------------------------
The tool seed rows in ``apps/web/src/lib/capabilities-data.ts`` used to be
hand-written copies of ``ToolDefinition`` fields from
``apps/api/src/api/tools/definitions.py``. They drifted: scopes were invented
(``system.tool.execution`` exists nowhere in the registry), prompts contradicted
the backend text, and a scoped-down user was shown tools their role cannot call.

The generator re-renders those rows straight from ``ALL_TOOLS``, and ``--check``
compares the committed file byte-for-byte so nothing can quietly diverge again.

These tests pin the behaviours that keep that promise honest:

* the rendered manifest covers every registered tool name and carries the
  registry's own ``required_scope`` and description verbatim;
* a tampered copy fails ``--check`` with exit code 1 -- and a pristine copy
  passes, so exit code 1 means "stale or hand-edited", never "script broken";
* ``--check`` writes nothing, so CI can run it against read-only workspaces.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
_scripts_dir = REPO_ROOT / "scripts"
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

_api_src = REPO_ROOT / "apps" / "api" / "src"
if str(_api_src) not in sys.path:
    sys.path.insert(0, str(_api_src))

import gen_tool_fallback  # noqa: E402
from api.tools.definitions import ALL_TOOLS  # noqa: E402

_MANIFEST_EXPORT = "export const TOOL_FALLBACK: readonly CapabilityItem[] = ["


def _rows_from_manifest(text: str) -> list[dict[str, object]]:
    """Parse the generated array back out of the rendered TS source.

    The generator emits the array with ``json.dumps``, so the body between the
    export marker and its terminator is plain JSON and can be re-parsed here to
    assert on the actual rows. This round-trip is test-only scaffolding: the
    app consumes the TS file directly and never parses it back.
    """
    body = text.partition(_MANIFEST_EXPORT)[2]
    # rsplit: if a description ever contained a literal "];", the true array
    # terminator is still the last one in the rendered body.
    json_array = "[" + body.rsplit("];", 1)[0] + "]"
    rows = json.loads(json_array)
    assert isinstance(rows, list)
    return rows


def test_rendered_manifest_covers_every_registry_tool(tmp_path: Path) -> None:
    """Generate to a tmp dir; every ``ALL_TOOLS`` name must appear in the text."""
    out_path = tmp_path / "tool-fallback.generated.ts"
    assert gen_tool_fallback.main(["--output", str(out_path)]) == 0
    text = out_path.read_text(encoding="utf-8")

    missing = [name for name in ALL_TOOLS if f'"{name}"' not in text]
    assert missing == []

    rows = _rows_from_manifest(text)
    by_name = {row["name"]: row for row in rows}
    assert len(by_name) == len(rows)  # registry names stay unique in the manifest

    for name, tool in ALL_TOOLS.items():
        row = by_name.get(name)
        assert row is not None, f"{name} missing from rendered manifest"
        assert row["requiredScope"] == tool.required_scope
        assert row["description"] == tool.description

    for row in rows:
        assert row["category"] == "tools"
        assert row["source"] == "built-in"
        assert row["usageCount"] == 0
        assert row["lastUsedAt"] is None
        assert row["isSeed"] is True


def test_check_fails_on_tampered_copy_and_passes_on_pristine_copy(tmp_path: Path) -> None:
    """``--check`` compares bytes: pristine copy exits 0, one altered name exits 1."""
    fresh_manifest = gen_tool_fallback.render_manifest(
        [gen_tool_fallback.build_row(tool) for tool in ALL_TOOLS.values()]
    )

    # Positive control: an identical copy must pass --check, so the exit code 1
    # asserted below can only mean tampering, never a broken script.
    pristine = tmp_path / "tool-fallback.generated.ts"
    pristine.write_text(fresh_manifest, encoding="utf-8", newline="")
    assert gen_tool_fallback.main(["--check", "--output", str(pristine)]) == 0

    # The drift this task exists to eliminate: one tool name altered by hand.
    first_registered_name = next(iter(ALL_TOOLS))
    quoted = f'"{first_registered_name}"'
    assert quoted in fresh_manifest  # the quoted name field, before any mention

    tampered = tmp_path / "tampered.generated.ts"
    tampered.write_text(
        fresh_manifest.replace(quoted, f'"{first_registered_name}_x"', 1),
        encoding="utf-8",
        newline="",
    )
    assert gen_tool_fallback.main(["--check", "--output", str(tampered)]) == 1


def test_check_writes_nothing_and_fails_on_missing_file(tmp_path: Path) -> None:
    """``--check`` never mutates the repo and refuses a missing artefact."""
    out_path = tmp_path / "tool-fallback.generated.ts"

    assert gen_tool_fallback.main(["--check", "--output", str(out_path)]) == 1
    assert not out_path.exists()
