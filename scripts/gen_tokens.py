#!/usr/bin/env python3
"""
Generate the ui-kit token JSON from `apps/web/src/styles/globals.css`.

WHY THIS EXISTS
---------------
`globals.css` is the only thing Tailwind and the browser actually see. The
`packages/ui-kit/src/tokens/*.json` tree was hand-authored alongside it and
silently drifted: 30+ colour values disagreed, and the JSON light palette would
have failed the very axe contrast checks `globals.css` was explicitly tuned to
pass. Because nothing consumed the JSON, editing it changed no pixels, so the
drift was invisible.

This script makes the relationship mechanical and one-directional:

    apps/web/src/styles/globals.css   <-- SOURCE (hand-edited)
              |
              +--(this script)-->  packages/ui-kit/src/tokens/themes/*.json
                                        packages/ui-kit/src/tokens/primitives.json
                                        (GENERATED - do not hand-edit)

Two modes:

    python scripts/gen_tokens.py            regenerate the JSON in place
    python scripts/gen_tokens.py --check    exit 1 if the JSON is stale (CI)

HONESTY RULES BUILT INTO THIS SCRIPT
------------------------------------
1. Only values that genuinely exist in `globals.css` are treated as runtime
   truth. A JSON name with no runtime counterpart is PRESERVED from the
   previous file and recorded in `provenance.designRecordOnly`. It is never
   given an invented runtime value, and it is never counted as drift-checked.
   Consumers can therefore tell the difference between "this is what ships"
   and "this is design intent with no implementation yet".

2. `--color-bg-scrim` is deliberately design-record-only. `globals.css` has
   `--overlay: 0 0 0` with no alpha channel, so a scrim cannot be derived from
   it; emitting opaque `#000000` as a scrim would be wrong, not merely stale.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
GLOBALS = REPO / "apps" / "web" / "src" / "styles" / "globals.css"
TOKENS = REPO / "packages" / "ui-kit" / "src" / "tokens"
THEMES = TOKENS / "themes"

# Theme name -> the selector that introduces its block in globals.css.
THEME_SELECTORS = {
    "dark": ":root,\n.dark",
    "light": ".light {",
    "high-contrast": ".high-contrast,",
}

# Which globals.css block supplies the theme-independent primitives.
PRIMITIVE_BLOCKS = [":root {"]

# ---------------------------------------------------------------------------
# globals.css custom property  ->  JSON colour token name.
# Many-to-many on purpose: `--error` is both the destructive action fill and
# the error status, exactly as the runtime uses it.
# ---------------------------------------------------------------------------
NAME_MAP: dict[str, list[str]] = {
    "--bg": ["--color-bg-canvas"],
    "--surface": ["--color-bg-surface"],
    "--surface-elevated": ["--color-bg-elevated"],
    "--surface-100": ["--color-bg-subtle"],
    "--surface-50": ["--color-bg-sunken"],
    "--text": ["--color-text-primary"],
    "--text-secondary": ["--color-text-secondary"],
    "--text-muted": ["--color-text-muted"],
    "--text-dim": ["--color-text-dim"],
    "--primary": ["--color-text-brand"],
    "--border": ["--color-border-default"],
    "--border-subtle": ["--color-border-subtle"],
    "--border-strong": ["--color-border-strong"],
    "--accent": ["--color-border-focus"],
    "--action": ["--color-action-primary"],
    "--action-hover": ["--color-action-primary-hover"],
    "--action-active": ["--color-action-primary-active"],
    "--action-fg": ["--color-action-primary-fg"],
    "--surface-200": ["--color-action-secondary"],
    "--surface-300": ["--color-action-secondary-hover"],
    "--surface-400": ["--color-action-secondary-active"],
    "--text-200": ["--color-action-secondary-fg"],
    "--error": [
        "--color-action-destructive",
        "--color-status-error",
    ],
    "--error-muted": [
        "--color-action-destructive-hover",
        "--color-status-error-muted",
    ],
    "--error-fg": [
        "--color-action-destructive-fg",
        "--color-status-error-fg",
    ],
    "--error-active": ["--color-action-destructive-active"],
    "--success": ["--color-status-success"],
    "--success-muted": ["--color-status-success-muted"],
    "--success-fg": ["--color-status-success-fg"],
    "--warning": ["--color-status-warning"],
    "--warning-muted": ["--color-status-warning-muted"],
    "--warning-fg": ["--color-status-warning-fg"],
    "--info": ["--color-status-info"],
    "--info-muted": ["--color-status-info-muted"],
    "--info-fg": ["--color-status-info-fg"],
    # AI semantic states. verified / needs-review / blocked deliberately resolve
    # to the status ramp (a grounded citation IS a success; a blocked tool call
    # IS an error). proposed (violet) and processing (cyan) are the new hues.
    # These were design-record-only until this pass added the globals.css tokens.
    "--ai-proposed": ["--color-ai-proposed"],
    "--ai-proposed-muted": ["--color-ai-proposed-muted"],
    "--ai-proposed-fg": ["--color-ai-proposed-fg"],
    "--ai-processing": ["--color-ai-processing"],
    "--ai-processing-muted": ["--color-ai-processing-muted"],
    "--ai-processing-fg": ["--color-ai-processing-fg"],
    "--ai-verified": ["--color-ai-verified"],
    "--ai-verified-muted": ["--color-ai-verified-muted"],
    "--ai-verified-fg": ["--color-ai-verified-fg"],
    "--ai-needs-review": ["--color-ai-needs-review"],
    "--ai-needs-review-muted": ["--color-ai-needs-review-muted"],
    "--ai-needs-review-fg": ["--color-ai-needs-review-fg"],
    "--ai-blocked": ["--color-ai-blocked"],
    "--ai-blocked-muted": ["--color-ai-blocked-muted"],
    "--ai-blocked-fg": ["--color-ai-blocked-fg"],
    "--color-focus-ring": ["--color-focus-ring"],
    "--color-focus-ring-offset": ["--color-focus-ring-offset"],
}

DECL_RE = re.compile(r"^\s*(--[a-z0-9-]+)\s*:\s*(.+?);\s*$", re.IGNORECASE)
LANDING_RE = re.compile(r"^--landing-")

# Names that are REMOVED from the generated JSON.
#
# Empty by design. An earlier pass dropped `--color-action-destructive-active`
# because globals.css had no `--error-active`, but `semantic.json` and
# `component.json` both dereference that name, so removing it reintroduced the
# dangling-var() reference that `tokens.test.ts` exists to catch. The gap was
# closed in globals.css instead (all three themes now define `--error-active`),
# which is the fix that keeps the reference resolvable AND gives the error ramp
# the same hover/active depth the --action family already had.
#
# If a token is genuinely unimplemented, add it here WITH a one-line reason —
# and confirm no JSON dereferences it first.
DROP_FROM_GENERATED: set[str] = set()


def strip_comments(text: str) -> str:
    return re.sub(r"/\*.*?\*/", "", text, flags=re.S)


def find_block(text: str, selector: str) -> str:
    """Return the body of the first rule whose selector list starts with `selector`."""
    start = text.find(selector)
    if start == -1:
        raise SystemExit(f"selector not found in globals.css: {selector!r}")
    open_brace = text.find("{", start)
    if open_brace == -1:
        raise SystemExit(f"no block for selector: {selector!r}")
    depth = 0
    for i in range(open_brace, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[open_brace + 1 : i]
    raise SystemExit(f"unterminated block for selector: {selector!r}")


def parse_block(body: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in body.splitlines():
        m = DECL_RE.match(line)
        if not m:
            continue
        name, value = m.group(1), m.group(2).strip()
        if LANDING_RE.match(name):
            continue  # 3D-scene-only vars, not part of the token system
        out[name] = value
    return out


def to_hex(value: str) -> str:
    """Normalise a globals.css value to the `#rrggbb` form the JSON uses.

    globals.css stores colours as space-separated `R G B` triplets so Tailwind
    can apply alpha via the `<alpha-value>` placeholder. Bare triplets become
    hex; anything with alpha, gradients or `var()` is passed through verbatim
    because collapsing it would lose meaning.
    """
    v = value.strip()
    if v.startswith("#"):
        return v.lower()
    if "rgb" in v or "var(" in v or "gradient" in v or "/" in v:
        return v
    parts = v.split()
    if len(parts) == 3 and all(p.isdigit() for p in parts):
        r, g, b = (max(0, min(255, int(p))) for p in parts)
        return f"#{r:02x}{g:02x}{b:02x}"
    return v


def build_theme(css: str, theme: str, previous: dict) -> tuple[dict, dict, list[str]]:
    block = parse_block(find_block(css, THEME_SELECTORS[theme]))
    values: dict[str, str] = {}
    derived: list[str] = []
    preserved: list[str] = []

    # Start from the previous file so design-record-only names survive.
    for name, val in previous.items():
        if name in DROP_FROM_GENERATED:
            continue
        values[name] = val

    for globals_name, json_names in NAME_MAP.items():
        if globals_name not in block:
            continue
        hexed = to_hex(block[globals_name])
        for json_name in json_names:
            if json_name in values and values[json_name] != hexed:
                derived.append(json_name)
            values[json_name] = hexed

    for name in values:
        touched = any(name in names for names in NAME_MAP.values())
        if not touched:
            preserved.append(name)

    provenance = {
        "generatedFrom": "apps/web/src/styles/globals.css",
        "generator": "scripts/gen_tokens.py",
        "runtimeDerived": sorted(
            {n for names in NAME_MAP.values() for n in names if n in values}
        ),
        "designRecordOnly": sorted(preserved),
    }
    return values, provenance, derived


def build_primitives(css: str, previous: dict) -> dict:
    """Regenerate radius + elevation (both are real in globals.css).

    `color`, `space`, `typography` and `motion` ramps are design-record data
    with no runtime counterpart, so they are carried through untouched.
    """
    merged: dict[str, str] = {}
    for selector in PRIMITIVE_BLOCKS:
        merged.update(parse_block(find_block(css, selector)))

    for name, value in merged.items():
        short = name.removeprefix("--radius-").removeprefix("--elevation-")
        if name.startswith("--radius-"):
            previous["radius"][short] = value
        elif name.startswith("--elevation-"):
            previous["elevation"][short] = value
    return previous


def write_json(path: Path, payload: dict) -> str:
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == text:
        return "unchanged"
    path.write_text(text, encoding="utf-8")
    return "written"


def write_mapping() -> str:
    """Emit the globals.css -> JSON name map so tests can verify sync.

    `tokens.test.ts` re-derives every runtime-derived value from globals.css and
    compares it against the theme JSON. It reads this file rather than keeping
    its own copy of the map, so the mapping has exactly one definition.
    """
    path = TOKENS / "mapping.json"
    payload = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "name": "vaeloom-token-name-map",
        "description": (
            "GENERATED by scripts/gen_tokens.py. Maps each globals.css custom "
            "property to the --color-* token name(s) it feeds. Many-to-many: "
            "--error supplies both the destructive action fill and the error "
            "status, mirroring how the runtime uses it."
        ),
        "map": {k: v for k, v in sorted(NAME_MAP.items())},
    }
    return write_json(path, payload)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="fail if JSON is stale")
    args = ap.parse_args()

    css = strip_comments(GLOBALS.read_text(encoding="utf-8"))

    report: list[str] = []
    stale: list[str] = []
    any_change = False

    for theme in ("dark", "light", "high-contrast"):
        path = THEMES / f"{theme}.json"
        previous = json.loads(path.read_text(encoding="utf-8"))
        values, provenance, derived = build_theme(css, theme, previous["values"])

        payload = {
            "$schema": previous.get(
                "$schema", "https://json-schema.org/draft/2020-12/schema"
            ),
            "theme": theme,
            "name": previous.get("name", f"Vaeloom {theme}"),
            "generated": True,
            "provenance": provenance,
            "values": values,
        }

        if args.check:
            current = json.loads(path.read_text(encoding="utf-8"))
            if current.get("values") != values or current.get("generated") is not True:
                stale.append(f"themes/{theme}.json")
            report.append(
                f"  {theme:<14} {len(values):>3} values  "
                f"{len(provenance['runtimeDerived']):>3} from globals.css  "
                f"{len(provenance['designRecordOnly']):>2} design-record-only"
            )
            if derived:
                report.append(f"                 corrected: {', '.join(derived)}")
        else:
            state = write_json(path, payload)
            any_change = any_change or state == "written"
            report.append(
                f"  {theme:<14} {len(values):>3} values  {state}  "
                f"({len(derived)} corrected from globals.css)"
            )

    prim_path = TOKENS / "primitives.json"
    prim = json.loads(prim_path.read_text(encoding="utf-8"))
    build_primitives(css, prim)
    if args.check:
        current = json.loads(prim_path.read_text(encoding="utf-8"))
        for key in ("radius", "elevation"):
            if current.get(key) != prim[key]:
                stale.append(f"primitives.json ({key})")
        report.append(f"  {'primitives':<14} radius+elevation checked")
    else:
        state = write_json(prim_path, prim)
        any_change = any_change or state == "written"
        report.append(f"  {'primitives':<14} radius+elevation {state}")

    if args.check:
        map_path = TOKENS / "mapping.json"
        if not map_path.exists():
            stale.append("mapping.json (missing)")
        else:
            current = json.loads(map_path.read_text(encoding="utf-8"))
            if current.get("map") != {k: v for k, v in sorted(NAME_MAP.items())}:
                stale.append("mapping.json (stale)")
        report.append(f"  {'mapping':<14} name map checked")
    else:
        state = write_mapping()
        any_change = any_change or state == "written"
        report.append(f"  {'mapping':<14} name map {state}")

    print("token generation from apps/web/src/styles/globals.css")
    print("\n".join(report))

    if args.check:
        if stale:
            print("\nSTALE - run: python scripts/gen_tokens.py")
            for s in stale:
                print(f"  {s}")
            return 1
        print("\nOK - all token JSON is in sync with globals.css")
        return 0

    if any_change:
        print("\nJSON regenerated. Review the diff before committing.")
    else:
        print("\nNo drift: JSON already matched globals.css.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
