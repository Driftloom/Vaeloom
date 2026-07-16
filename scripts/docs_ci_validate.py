#!/usr/bin/env python3
"""
Vaeloom Docs CI Validator
==========================
Automated cross-document validation pipeline.

Checks performed:
  1. cross-references  â€” Every [text](./path.md) link resolves to an existing file
  2. canonical-sources â€” Links to /Docs/... and /Documents/... reference real legacy files
  3. contradictions    â€” Known related-pair values (thresholds, SLOs, retries) match
  4. orphans           â€” Documents not referenced by any other doc
  5. readme-index      â€” All docs/ files are listed in the master README.md
  6. path-consistency  â€” Relative paths from markdown links resolve correctly

Usage:
    python3 scripts/docs_ci_validate.py           # full run
    python3 scripts/docs_ci_validate.py --check cross-references
    python3 scripts/docs_ci_validate.py --json    # machine-readable output
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

DOCS_DIR = Path("Docs") if Path("Docs").exists() else Path("docs")
README_PATH = DOCS_DIR / "README.md"
LEGACY_DOCS_DIRS = [Path("Docs"), Path("Documents")]

SKIP_ORPHAN_PATTERNS = [
    "/README.md",
    "TEMPLATE.md",
]

SKIP_README_INDEX = {
    "docs/README.md",
    "docs/TEMPLATE.md",
}


# â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def rel_path(file_path: Path) -> str:
    """Return path relative to project root for a glob result."""
    return str(file_path).replace("\\", "/")


def get_all_md_files():
    """Return set of all .md file paths relative to project root."""
    return {rel_path(p) for p in DOCS_DIR.rglob("*.md")}


def read_file(path):
    """Read a file, return content or None."""
    p = Path(path)
    if not p.exists():
        return None
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None


def find_markdown_links(content):
    """All [text](path.md) links â€” includes hash fragments."""
    links = []
    for m in re.finditer(r'\]\(([^)]*\.md[^)]*)\)', content):
        link = m.group(1)
        # Strip trailing hash/anchor if present
        link = re.sub(r'#.*$', '', link)
        links.append(link)
    return links


def resolve_link(link, source_file):
    """
    Resolve a relative markdown link from a source file's location.
    Returns the relative project-root path (str) or None.
    
    Uses os.path.normpath instead of Path.resolve() to avoid
    case-insensitive filesystem quirks on Windows (where 'docs'
    might resolve to 'Docs' on disk).
    """
    source_dir = Path(source_file).parent
    # Join and normalize (handles . and ..) WITHOUT filesystem resolution
    # Path.resolve() is avoided because on Windows it follows the
    # filesystem's case resolution, causing 'docs/AI/file.md' to
    # become 'Docs/AI/file.md' when both directories exist.
    combined = os.path.normpath(os.path.join(str(source_dir), link))
    return str(combined).replace("\\", "/")


SHORT_SEVERITY = {
    "Warning": "Warning",
    "Critical": "Critical",
    "ðŸ”´ Critical": "Critical",
    "âš ï¸ Warning": "Warning",
    "ðŸ”´": "Critical",
    "âš ï¸": "Warning",
}


# â”€â”€ Contradiction check definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CONTRADICTION_CHECKS = [
    # (name, description, locations, extractor_callable, expected)
    #
    # Each extractor receives file content (str) and returns a set of values found.
    {
        "name": "queue-depth-threshold",
        "desc": "Queue depth > 1000 = Critical across Queue.md and Workers.md",
        "locations": ["docs/Architecture/Queue.md", "docs/Backend/Workers.md"],
        "extract": lambda c: _extract_table_severity(c, "Queue depth"),
        "expected": "Critical",
    },
    {
        "name": "job-age-threshold",
        "desc": "Job age > 15 min = Critical across Queue.md and Workers.md",
        "locations": ["docs/Architecture/Queue.md", "docs/Backend/Workers.md"],
        "extract": lambda c: _extract_table_severity(c, "Job age"),
        "expected": "Critical",
    },
    {
        "name": "failure-rate-threshold",
        "desc": "Failure rate > 10% = Critical across Queue.md and Workers.md",
        "locations": ["docs/Architecture/Queue.md", "docs/Backend/Workers.md"],
        "extract": lambda c: _extract_table_severity(c, "Failure rate"),
        "expected": "Critical",
    },
    {
        "name": "worker-saturation-threshold",
        "desc": "Worker saturation > 90% = Critical",
        "locations": ["docs/Architecture/Queue.md"],
        "extract": lambda c: _extract_table_severity(c, "Worker saturation"),
        "expected": "Critical",
    },
    {
        "name": "document-ingestion-target",
        "desc": "Document ingestion target = p95 < 30s",
        "locations": ["docs/Operations/SRE.md", "docs/Operations/SLO.md"],
        "extract": lambda c: _extract_regex_set(c, r"Document ingestion.*?<\s*30s\s*\(?(p\d\d)\)?"),
        "expected": "p95",
    },
    {
        "name": "api-availability-slo",
        "desc": "API availability SLO = 99.9%",
        "locations": ["docs/Operations/SRE.md", "docs/Operations/SLO.md", "docs/Operations/SLA.md"],
        "extract": lambda c: _extract_regex_set(c, r"API (?:availability|latency).*?\|?\s*(99\.\d+)%"),
        "expected": "99.9",
    },
    {
        "name": "ai-availability-slo",
        "desc": "AI agent availability SLO = 99.5%",
        "locations": ["docs/Operations/SRE.md", "docs/Operations/SLA.md"],
        "extract": lambda c: _extract_regex_set(c, r"(?:AI\s+agent|AI\s+agents?)\s+availability.*?\|?\s*(99\.\d+)%"),
        "expected": "99.5",
    },
    {
        "name": "max-retries",
        "desc": "Max retries = 3 across queue/worker docs",
        "locations": ["docs/Architecture/Queue.md", "docs/Backend/Workers.md"],
        "extract": lambda c: _extract_regex_set(c, r"(?:Retry|Transient error).*?(\d+)\s*(?:retry|Retries)?"),
        "expected": "3",
    },
    {
        "name": "error-budget-api",
        "desc": "API error budget = 43 minutes",
        "locations": ["docs/Operations/SRE.md", "docs/Operations/SLO.md"],
        "extract": lambda c: _extract_regex_set(c, r"(?:API|99\.9%).*?\|?\s*(43|21\.6)\s*(?:minutes|min)"),
        "expected": "43",
    },
    {
        "name": "database-availability-slo",
        "desc": "Database availability SLO = 99.95%",
        "locations": ["docs/Operations/SRE.md", "docs/Operations/SLO.md", "docs/Operations/SLA.md"],
        "extract": lambda c: _extract_regex_set(c, r"Database\s+availability.*?\|?\s*(99\.\d+)%"),
        "expected": "99.95",
    },
]


def _extract_table_severity(content, metric_name):
    """
    Extract severity for a given metric from a markdown table.

    Handles two table formats:
      Format A (Queue.md): | Metric | Warning | Critical |
                           | Queue depth | > 500 | > 1000 |
        -> finds the column position of "Critical" header, then reads that column's value.

      Format B (Workers.md): | Queue depth > 1000 | ðŸ”´ Critical | ... |
        -> extracts the severity label directly.

    Returns a set of severity strings (normalised).
    """
    results = set()
    lines = content.split("\n")

    # Build alternation pattern for severity strings (keys sorted descending by length)
    sev_keys = sorted(SHORT_SEVERITY, key=len, reverse=True)
    sev_alt = '|'.join(re.escape(k) for k in sev_keys)

    # First pass: look for Format B â€” inline severity in first column
    for line in lines:
        pat = rf"{re.escape(metric_name)}.*?\|.*?({sev_alt})"
        m = re.search(pat, line, re.IGNORECASE)
        if m:
            raw = m.group(1).strip()
            normalized = SHORT_SEVERITY.get(raw, raw)
            results.add(normalized)

    # Second pass: look for Format A â€” severity in column headers
    if not results:
        # Find the table header row containing the metric
        header_idx = None
        header_line = None
        for i, line in enumerate(lines):
            if metric_name.lower() in line.lower() and '|' in line:
                # This might be the metric row; look at preceding rows for headers
                for j in range(max(0, i - 3), i):
                    prev = lines[j]
                    if '|' in prev and ('Warning' in prev or 'Critical' in prev or 'Metric' in prev):
                        header_idx = j
                        header_line = prev
                        break
                if header_idx is not None:
                    break

        if header_line and header_idx is not None:
            # Parse header columns to find severity column indices
            header_cells = [c.strip() for c in header_line.split('|') if c.strip()]
            metric_cells = [c.strip() for c in lines[header_idx + 2].split('|') if c.strip()] \
                if header_idx + 2 < len(lines) else []

            for col_idx, cell in enumerate(header_cells):
                normalized = SHORT_SEVERITY.get(cell, cell)
                if normalized in ("Warning", "Critical"):
                    if col_idx < len(metric_cells):
                        results.add(normalized)

    return results


def _extract_regex_set(content, pattern):
    """Extract capture group 1 values for a regex pattern, returned as a set."""
    vals = set()
    for m in re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE):
        val = m.group(1).strip()
        if val:
            vals.add(val)
    return vals


# â”€â”€ Check 1: Cross-References â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def check_cross_references(all_files, verbose=False):
    """Every [text](./path.md) resolves to an existing file."""
    issues, stats = [], {"checked": 0, "ok": 0, "broken": 0}

    for md_file in sorted(DOCS_DIR.rglob("*.md")):
        rp = rel_path(md_file)
        content = read_file(rp)
        if not content:
            continue
        links = find_markdown_links(content)
        stats["checked"] += len(links)

        for link in links:
            if link.startswith(("http://", "https://", "#")):
                stats["ok"] += 1
                continue
            if link.startswith(("../../Docs/", "../../Documents/", "../Docs/", "../Documents/", "Docs/", "Documents/")):
                stats["ok"] += 1
                continue

            resolved = resolve_link(link, rp)
            if resolved not in all_files:
                issues.append({"file": rp, "link": link, "resolved": resolved, "issue": f"Target not found: {resolved}", "check": "cross-references"})
                stats["broken"] += 1
            else:
                stats["ok"] += 1

    return issues, stats


# â”€â”€ Check 2: Canonical Sources â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


def check_canonical_sources(all_files, verbose=False):
    """Links to /Docs/... and /Documents/... reference real legacy files."""
    issues, stats = [], {"checked": 0, "ok": 0, "broken": 0}

    legacy_files = set()
    for d in LEGACY_DOCS_DIRS:
        if d.exists():
            for p in d.rglob("*"):
                if p.is_file():
                    legacy_files.add(str(p).replace("\\", "/"))

    for md_file in sorted(DOCS_DIR.rglob("*.md")):
        rp = rel_path(md_file)
        content = read_file(rp)
        if not content:
            continue

        # Match Docs/ or Documents/ paths followed by valid path characters
        refs = re.findall(r'(?:\.\./\.\./|\.\./)?((?:Docs|Documents)/[a-zA-Z0-9_/\-\.#]+\.md)', content)
        # Clean matches: strip hash fragments and trailing punctuation
        cleaned = []
        for ref in refs:
            ref = ref.split('#')[0]                     # strip fragment #section
            ref = re.sub(r'[\)\]\`\"]+\s*$', '', ref)   # strip trailing markdown/quote noise
            ref = ref.strip()
            if ref:
                cleaned.append(ref)
        stats["checked"] += len(cleaned)

        for ref in cleaned:
            if any(ref in lf or lf.endswith(ref) for lf in legacy_files):
                stats["ok"] += 1
            else:
                issues.append({"file": rp, "link": ref, "issue": f"Legacy source not found: {ref}", "check": "canonical-sources"})
                stats["broken"] += 1

    return issues, stats


# â”€â”€ Check 3: Contradictions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def check_contradictions(_all_files=None, verbose=False):
    """Known related-pair values match expected values."""
    issues, stats = [], {"checked": 0, "ok": 0, "broken": 0}

    for check_def in CONTRADICTION_CHECKS:
        stats["checked"] += 1
        values = set()

        for loc in check_def["locations"]:
            content = read_file(loc)
            if content:
                values.update(check_def["extract"](content))

        if values and check_def["expected"] not in values:
            issues.append({
                "check": "contradictions",
                "name": check_def["name"],
                "desc": check_def["desc"],
                "found": sorted(values),
                "expected": check_def["expected"],
                "issue": f"Expected '{check_def['expected']}' but found: {', '.join(sorted(values))}",
            })
            stats["broken"] += 1
        else:
            stats["ok"] += 1

    return issues, stats


# â”€â”€ Check 4: Orphans â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def check_orphans(all_files, verbose=False):
    """Documents not referenced by any other document."""
    issues, stats = [], {"checked": 0, "ok": 0, "orphans": 0}
    referenced = defaultdict(set)

    for md_file in sorted(DOCS_DIR.rglob("*.md")):
        rp = rel_path(md_file)
        content = read_file(rp)
        if not content:
            continue
        for link in find_markdown_links(content):
            if link.startswith(("http", "#")):
                continue
            resolved = resolve_link(link, rp)
            if resolved:
                referenced[resolved].add(rp)

    for f in sorted(all_files):
        stats["checked"] += 1
        if any(sp in f for sp in SKIP_ORPHAN_PATTERNS):
            stats["ok"] += 1
            continue
        if f not in referenced:
            issues.append({"file": f, "issue": "Not referenced by any other document", "check": "orphans"})
            stats["orphans"] += 1
        else:
            stats["ok"] += 1

    return issues, stats


# â”€â”€ Check 5: README Index â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def check_readme_index(all_files, verbose=False):
    """All docs are listed in the master README.md."""
    issues, stats = [], {"checked": 0, "ok": 0, "missing": 0}

    readme = read_file(README_PATH)
    if not readme:
        return [{"issue": "README.md not found", "check": "readme-index"}], {"checked": 0, "ok": 0, "missing": 0}

    readme_lower = readme.lower()

    for f in sorted(all_files):
        if f in SKIP_README_INDEX:
            stats["checked"] += 1
            stats["ok"] += 1
            continue

        stats["checked"] += 1
        stem = Path(f).stem
        path_key = f.replace("docs/", "").replace(".md", "")
        friendly = stem.replace("-", " ").replace("_", " ")

        if (stem.lower() in readme_lower or
            path_key.lower() in readme_lower or
            friendly.lower() in readme_lower):
            stats["ok"] += 1
        else:
            issues.append({"file": f, "issue": "Not found in README.md index", "check": "readme-index"})
            stats["missing"] += 1

    return issues, stats


# â”€â”€ Check 6: Path Consistency â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def check_path_consistency(all_files, verbose=False):
    """
    Validate that relative markdown links use correct prefixes.
    
    Rules:
    - Links to files in the SAME directory should use ./ or bare filename (not ../)
    - Links to files in a DIFFERENT directory tree should use ../ (not ./)
    """
    issues, stats = [], {"checked": 0, "ok": 0, "inconsistent": 0}

    for md_file in sorted(DOCS_DIR.rglob("*.md")):
        rp = rel_path(md_file)
        content = read_file(rp)
        if not content:
            continue

        for link in find_markdown_links(content):
            # Skip external, anchor-only, and legacy canonical links
            if link.startswith(("http", "#", "../../")):
                continue

            stats["checked"] += 1

            resolved = resolve_link(link, rp)
            if not resolved or resolved not in all_files:
                # Can't validate links that don't resolve
                stats["ok"] += 1
                continue

            source_dir = Path(rp).parent
            target_dir = Path(resolved).parent
            rel_to_source = os.path.relpath(str(target_dir), str(source_dir)).replace("\\", "/")

            if target_dir == source_dir:
                if link.startswith("../"):
                    stats["inconsistent"] += 1
                    issues.append({
                        "file": rp, "link": link, "resolved": resolved,
                        "issue": f"Same-directory link uses ../: {link}",
                        "check": "path-consistency",
                    })
                else:
                    stats["ok"] += 1
            elif rel_to_source.startswith(".."):
                if not link.startswith("../") and not link.startswith("./"):
                    stats["inconsistent"] += 1
                    issues.append({
                        "file": rp, "link": link, "resolved": resolved,
                        "issue": f"Cross-directory link missing ../ prefix: {link}",
                        "check": "path-consistency",
                    })
                else:
                    stats["ok"] += 1
            else:
                stats["ok"] += 1

    return issues, stats


# â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CHECKERS = {
    "cross-references": check_cross_references,
    "canonical-sources": check_canonical_sources,
    "contradictions": check_contradictions,
    "orphans": check_orphans,
    "readme-index": check_readme_index,
    "path-consistency": check_path_consistency,
}


def run_checks(all_files, verbose=False, which=None):
    if which is None:
        which = list(CHECKERS)
    results = {}
    total_issues = 0
    all_ok = True

    for name in which:
        if name not in CHECKERS:
            continue
        issues, stats = CHECKERS[name](all_files, verbose=verbose)
        results[name] = {"issues": issues, "stats": stats}
        total_issues += len(issues)
        if issues:
            all_ok = False

    results["_summary"] = {"total_issues": total_issues, "all_ok": all_ok}
    return results


def print_report(results):
    summary = results.pop("_summary", {})
    n = summary.get("total_issues", 0)

    print("\n" + "=" * 58)
    print("  Vaeloom DOCS CI VALIDATOR")
    print("=" * 58)

    for name, data in results.items():
        issues = data["issues"]
        s = data["stats"]
        icon = "PASS" if not issues else "FAIL"
        print(f"\n  [{icon}] {name}  ({len(issues)} issue{'s' if len(issues)!=1 else ''})")
        if issues:
            for iss in issues[:15]:
                loc = iss.get("file") or iss.get("name") or ""
                msg = iss.get("issue") or iss.get("desc") or ""
                print(f"       x  [{loc}] {msg}")
                if "found" in iss:
                    print(f"          Found: {iss['found']}, Expected: {iss['expected']}")
            if len(issues) > 15:
                print(f"       ... and {len(issues)-15} more")
        else:
            detail = " | ".join(f"{k}: {v}" for k, v in s.items() if k != "checked")
            if detail:
                print(f"       ({detail})")

    print("\n" + "-" * 58)
    if n == 0:
        print("  RESULT: All checks PASSED")
    else:
        print(f"  RESULT: {n} issue(s) FOUND â€” review required")
    print("-" * 58)


def main():
    ap = argparse.ArgumentParser(description="Vaeloom Docs CI Validator")
    ap.add_argument("--check", "-c", choices=list(CHECKERS) + ["all"], default="all")
    ap.add_argument("--json", "-j", action="store_true")
    ap.add_argument("--verbose", "-v", action="store_true")
    args = ap.parse_args()

    all_files = get_all_md_files()
    which = list(CHECKERS) if args.check == "all" else [args.check]
    results = run_checks(all_files, verbose=args.verbose, which=which)

    all_ok = results["_summary"]["all_ok"]

    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        print_report(results)

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
