"""Route-guard invariant (Loop 4): every destructive or admin route must
carry an auth dependency. Static scan over routers/ — fails the build if a
new unguarded DELETE or /admin route lands."""
import re
from pathlib import Path

import pytest

ROUTERS = Path(__file__).resolve().parent.parent / "src" / "api" / "routers"


def _routes():
    out = []
    for f in sorted(ROUTERS.glob("*.py")):
        src = f.read_text(encoding="utf-8", errors="replace")
        # For each route decorator, the guarded body runs until the next
        # top-level def. Stacked decorators share one body: attach to the
        # LAST decorator before the def by scanning route matches in order
        # and extending each body to the following def.
        matches = list(re.finditer(
            r"@router\.(get|post|put|patch|delete)\(\s*[\"']([^\"']+)[\"']",
            src,
        ))
        defs = list(re.finditer(r"^async def (\w+)", src, re.M))
        for m in matches:
            nxt = next((d for d in defs if d.start() > m.start()), None)
            if nxt is None:
                continue
            out.append((f.name, m.group(1), m.group(2), nxt.group(1),
                        src[m.start():nxt.end() + 2500]))
    return out


def _guarded(body: str) -> bool:
    return (
        "require_role" in body
        or "require_permission" in body
        or "get_current_user" in body
        or "_verify_workspace_access" in body
        or "check_user_workspace_access" in body
    )


class TestRouteGuards:
    def test_no_unguarded_deletes(self):
        bad = [f"{fn} {v} {p} ({fnm})" for fn, v, p, fnm, b in _routes()
               if v == "delete" and not _guarded(b)]
        assert bad == [], f"unguarded DELETE routes: {bad}"

    def test_no_unguarded_admin_routes(self):
        bad = [f"{fn} {v} {p} ({fnm})" for fn, v, p, fnm, b in _routes()
               if "/admin" in p and "require_role" not in b]
        assert bad == [], f"admin routes without require_role: {bad}"

    def test_sensitive_verbs_guarded(self):
        pat = re.compile(r"suspend|deprovision|revoke_all|impersonate|payout|refund", re.I)
        bad = [f"{fn} {v} {p} ({fnm})" for fn, v, p, fnm, b in _routes()
               if (pat.search(p) or pat.search(fnm)) and not _guarded(b)]
        assert bad == [], f"sensitive routes without guard: {bad}"
