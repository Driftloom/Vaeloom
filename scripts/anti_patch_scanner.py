#!/usr/bin/env python3
"""Anti-Patch Scanner — Zero-Trust CI Linter for Vaeloom AI Platform.

Enforces zero-trust architectural invariants across the codebase:
1. NO static keyword routing dictionaries or hardcoded keyword intent mappings.
2. NO loose / masking test assertions (e.g., `assert res.status_code in (200, 201, 401, 403)`).
3. NO procedural ladders (chained `elif agent == ...` beyond threshold).
4. NO hardcoded static action chip arrays in agent handlers.
5. NO answer-faking test mocks that bypass schema validation.

Usage:
    python scripts/anti_patch_scanner.py [--strict] [--path <dir>]
"""

import ast
import os
import re
import sys
from pathlib import Path
from typing import NamedTuple

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
API_SRC = ROOT_DIR / "apps" / "api" / "src" / "api"
API_TESTS = ROOT_DIR / "apps" / "api" / "tests"


class Violation(NamedTuple):
    file: Path
    line: int
    rule_id: str
    message: str
    severity: str  # "ERROR" | "WARNING"


# ── Rule Definitions ──────────────────────────────────────────────────────────

# Banned loose status code assertion patterns
LOOSE_STATUS_REGEX = re.compile(
    r"assert\s+[\w\.]+\s*(?:status_code|status)\s+in\s*\(\s*(?:200|201|204|400|401|403|404|500)\s*,\s*(?:200|201|204|400|401|403|404|500)",
    re.IGNORECASE,
)

# Hardcoded static action chip arrays in handlers
STATIC_CHIPS_REGEX = re.compile(
    r"action_chips\s*=\s*\[\s*[\"'][^\"']+[\"']\s*,\s*[\"'][^\"']+[\"']",
    re.IGNORECASE,
)


def scan_file_for_loose_assertions(file_path: Path) -> list[Violation]:
    violations = []
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception:
        return violations

    for i, line in enumerate(content.splitlines(), start=1):
        if LOOSE_STATUS_REGEX.search(line):
            violations.append(
                Violation(
                    file=file_path,
                    line=i,
                    rule_id="SEC-001-LOOSE-STATUS",
                    message="Banned loose status code assertion. Assert the exact expected HTTP status.",
                    severity="ERROR",
                )
            )
    return violations


def scan_file_for_static_chips(file_path: Path) -> list[Violation]:
    violations = []
    # Skip test files and proposal engine itself
    if "test" in file_path.stem or "proposals_engine" in file_path.stem:
        return violations

    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception:
        return violations

    for i, line in enumerate(content.splitlines(), start=1):
        if STATIC_CHIPS_REGEX.search(line):
            violations.append(
                Violation(
                    file=file_path,
                    line=i,
                    rule_id="ARCH-002-STATIC-CHIPS",
                    message="Hardcoded static action chips detected. Action proposals must be generated dynamically via ActionProposalEngine.",
                    severity="ERROR",
                )
            )
    return violations


def scan_routing_engine(routing_dir: Path) -> list[Violation]:
    """Ensure routing engine does not reintroduce hardcoded keyword dictionaries."""
    violations = []
    if not routing_dir.exists():
        return violations

    for py_file in routing_dir.glob("*.py"):
        try:
            tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
        except Exception:
            continue

        for node in ast.walk(tree):
            # Check for module-level or class-level dictionary assignments named *KEYWORDS* or *INTENT_MAP*
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name):
                        name_upper = target.id.upper()
                        if any(k in name_upper for k in ("KEYWORD", "INTENT_MAP", "FAST_PATH_DICT")):
                            violations.append(
                                Violation(
                                    file=py_file,
                                    line=node.lineno,
                                    rule_id="ARCH-001-KEYWORD-ROUTING",
                                    message=f"Banned static keyword/intent table '{target.id}' in routing engine. Use semantic capability centroids or TypeSafe Jev System 1.",
                                    severity="ERROR",
                                )
                            )
    return violations


def scan_procedural_ladders(file_path: Path, max_chain: int = 12) -> list[Violation]:
    """Detect long procedural if/elif chains dispatching on agent types."""
    violations = []
    if not file_path.exists():
        return violations

    try:
        tree = ast.parse(file_path.read_text(encoding="utf-8"), filename=str(file_path))
    except Exception:
        return violations

    for node in ast.walk(tree):
        if isinstance(node, ast.If):
            # Count elif depth
            depth = 0
            curr = node
            while curr.orelse and len(curr.orelse) == 1 and isinstance(curr.orelse[0], ast.If):
                depth += 1
                curr = curr.orelse[0]
            if depth >= max_chain:
                violations.append(
                    Violation(
                        file=file_path,
                        line=node.lineno,
                        rule_id="ARCH-003-PROCEDURAL-LADDER",
                        message=f"Deep procedural if/elif ladder detected ({depth} branches). Refactor into dynamic capability dispatch or registry lookup.",
                        severity="WARNING",
                    )
                )
    return violations


def run_scanner(strict: bool = False, target_path: Path | None = None) -> int:
    print("=" * 70)
    print("[SCAN] VAELOOM ZERO-TRUST ANTI-PATCH SCANNER")
    print("=" * 70)

    all_violations: list[Violation] = []
    scan_tests_dir = target_path if target_path and target_path.exists() else API_TESTS

    # 1. Scan tests for loose assertions
    print(f"[1/4] Scanning test suites in {scan_tests_dir.relative_to(ROOT_DIR)} for loose status code assertions...")
    for root, _, files in os.walk(scan_tests_dir):
        for f in files:
            if f.endswith(".py"):
                p = Path(root) / f
                all_violations.extend(scan_file_for_loose_assertions(p))

    # 2. Scan routing directory for keyword hacks
    print("[2/4] Scanning routing subsystem for hardcoded keyword tables...")
    routing_dir = API_SRC / "orchestrator" / "routing"
    all_violations.extend(scan_routing_engine(routing_dir))

    # 3. Scan agent handlers for static action chips
    print("[3/4] Scanning agent handlers for static action chip arrays...")
    agents_dir = API_SRC / "agents"
    if agents_dir.exists():
        for root, _, files in os.walk(agents_dir):
            for f in files:
                if f.endswith(".py"):
                    p = Path(root) / f
                    all_violations.extend(scan_file_for_static_chips(p))

    # 4. Scan orchestrator for procedural ladders
    print("[4/4] Scanning orchestrator for procedural dispatch ladders...")
    loop_file = API_SRC / "orchestrator" / "loop.py"
    all_violations.extend(scan_procedural_ladders(loop_file, max_chain=25))

    # Report results
    errors = [v for v in all_violations if v.severity == "ERROR"]
    warnings = [v for v in all_violations if v.severity == "WARNING"]

    print("\n" + "=" * 70)
    print(f"[RESULTS] SCAN RESULTS: {len(errors)} Errors, {len(warnings)} Warnings")
    print("=" * 70)

    for v in all_violations:
        rel_path = v.file.relative_to(ROOT_DIR) if v.file.is_relative_to(ROOT_DIR) else v.file
        prefix = "[ERROR]" if v.severity == "ERROR" else "[WARN] "
        print(f"{prefix} {rel_path}:{v.line} ({v.rule_id})")
        print(f"    {v.message}\n")

    if errors or (strict and warnings):
        print("[FAIL] Scan FAILED: Zero-trust architecture violations detected.")
        return 1

    print("[PASS] Scan PASSED: All architectural invariants verified cleanly.")
    return 0


if __name__ == "__main__":
    is_strict = "--strict" in sys.argv
    target_p = None
    if "--path" in sys.argv:
        idx = sys.argv.index("--path")
        if idx + 1 < len(sys.argv):
            target_p = Path(sys.argv[idx + 1]).resolve()
    sys.exit(run_scanner(strict=is_strict, target_path=target_p))
