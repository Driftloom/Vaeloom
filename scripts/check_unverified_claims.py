#!/usr/bin/env python3
"""CI assertion script: fail if unverified claims exist in JSX/TSX.

Enforces Wave 1.10 of the Enterprise Production Readiness Plan:
Scans JSX text content for unqualified security or perfection claims
(e.g., 'RLS VERIFIED', '100% deterministic success rate') that are not
bound to fetched state or live audit evidence.
"""
import os
import re
import sys

FORBIDDEN_PATTERNS = [
    re.compile(r'>\s*RLS\s+VERIFIED\s*<', re.IGNORECASE),
    re.compile(r'>\s*100%\s+deterministic\s*<', re.IGNORECASE),
    re.compile(r'>\s*100%\s+success\s+rate\s*<', re.IGNORECASE),
    re.compile(r'>\s*SCOUTING\s+ACTIVE\s*<', re.IGNORECASE),
]

def scan_files(root_dir="apps/web/src") -> list[str]:
    violations = []
    for root, _, files in os.walk(root_dir):
        for f in files:
            if f.endswith((".tsx", ".jsx")):
                if "spec." in f or "test." in f:
                    continue
                path = os.path.join(root, f)
                with open(path, "r", encoding="utf-8") as fh:
                    for line_no, line in enumerate(fh, 1):
                        stripped = line.strip()
                        if stripped.startswith("//") or stripped.startswith("/*"):
                            continue
                        for pat in FORBIDDEN_PATTERNS:
                            if pat.search(line):
                                violations.append(f"{path}:{line_no}: Unverified claim pattern matched: {stripped}")
    return violations

def main():
    violations = scan_files()
    if violations:
        print("[FAIL] CI Check Failed: Unverified claims found in JSX/TSX:")
        for v in violations:
            print(f"  {v}")
        sys.exit(1)
    print("[PASS] CI Check Passed: Zero unverified security/correctness claims detected in apps/web/src.")
    sys.exit(0)

if __name__ == "__main__":
    main()
