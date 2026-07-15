#!/usr/bin/env python3
"""
Fix MD051 broken link fragments in docs that have mismatched TOC anchors.

Strategy: for each file with broken fragments, find the TOC links and the
corresponding section headings, then add explicit {#anchor-id} markers to the
headings so they match regardless of the markdown renderer's anchor algorithm.
"""

import re
from pathlib import Path

DOCS_DIR = Path("docs")

# Files with broken fragments and their link:heading mappings
# Format: {file_rel_path: [(fragment_id, heading_text_to_match), ...]}
FIXES = {
    "docs/05-Meridian-MVP-Spec.md": [
        ("s1", "1. One-liner"),
        ("s2", "2. The problem"),
        ("s3", "3. Product philosophy"),
        ("s4", "4. Core user flow"),
        ("s5", "5. Agent roster"),
        ("s6", "6. Connector"),
        ("s7", "7. Memory architecture"),
        ("s8", "8. Gmail Agent"),
        ("s9", "9. Job search"),
        ("s10", "10. v1 pages"),
        ("s11", "11. Security"),
        ("s12", "12. Gaps filled"),
        ("s13", "13. Build phases"),
        ("s14", "14. What"),
    ],
    "docs/Meridian-Documentation-Site.md": [
        ("what-is-meridian", "What Is Meridian"),
        ("the-product-story", "The Product Story"),
        ("how-it-works", "How It Works"),
        ("features", "Features"),
        ("screens", "Screens"),
        ("workflows", "Workflows"),
        ("system-architecture", "System Architecture"),
        ("ai-agents", "AI Agents"),
        ("memory-system", "Memory System"),
        ("tech-stack", "Tech Stack"),
        ("database-design", "Database Design"),
        ("implementation-plan", "Implementation Plan"),
        ("implementation-blueprint", "Implementation Blueprint"),
        ("roadmap", "Roadmap"),
        ("gap-analysis", "Gap Analysis"),
        ("project-summary", "Project Summary"),
        ("glossary", "Glossary"),
    ],
    "docs/Meridian-Enterprise-Paper.md": [
        ("executive-summary", "Executive Summary"),
        ("product-overview", "Product Overview"),
        ("user-journey", "User Journey"),
        ("workspace", "Workspace"),
        ("connector-ecosystem", "Connector Ecosystem"),
        ("file-ingestion-engine", "File Ingestion Engine"),
        ("autonomous-organization-agent", "Autonomous Organization Agent"),
        ("enterprise-memory-system", "Enterprise Memory System"),
        ("ai-agent-system", "AI Agent System"),
        ("resume-intelligence", "Resume Intelligence"),
        ("ats-intelligence", "ATS Intelligence"),
        ("career-intelligence", "Career Intelligence"),
        ("gmail-intelligence", "Gmail Intelligence"),
        ("scheduler", "Scheduler"),
        ("knowledge-workspace", "Knowledge Workspace"),
        ("dashboard", "Dashboard"),
        ("application-pages", "Application Pages"),
        ("global-search", "Global Search"),
        ("security-compliance", "Security"),
        ("ai-architecture", "AI Architecture"),
        ("future-innovations", "Future Innovations"),
        ("gap-analysis-missing-features", "Gap Analysis"),
        ("from-mvp-to-enterprise-migration-path", "MVP to Enterprise"),
        ("appendix-glossary", "Glossary"),
    ],
    "docs/Meridian-How-It-Works-Visual.md": [
        ("intro", "What Is It"),
        ("how-it-works", "How It Works"),
        ("architecture", "Architecture"),
        ("orchestration", "Agent Orchestration"),
        ("implementation", "Implementation"),
        ("roadmap", "Roadmap"),
    ],
    "docs/Operations/01-operations-runbook.md": [
        ("1-service-architecture-overview", "1. Service Architecture Overview"),
        ("2-health-checks--monitoring", "2. Health Checks"),
        ("3-common-procedures", "3. Common Procedures"),
        ("4-backup--restore", "4. Backup"),
        ("5-deployment-procedures", "5. Deployment"),
        ("6-scaling", "6. Scaling"),
        ("7-secrets-management", "7. Secrets Management"),
        ("8-database-operations", "8. Database Operations"),
        ("9-agent-system-operations", "9. Agent System"),
        ("10-cost-management", "10. Cost Management"),
        ("11-runbook-checklists", "11. Runbook Checklists"),
    ],
    "docs/Operations/02-incident-response.md": [
        ("1-incident-severity-levels", "1. Incident Severity Levels"),
        ("2-incident-response-roles", "2. Incident Response Roles"),
        ("3-incident-response-workflow", "3. Incident Response Workflow"),
        ("4-communication-templates", "4. Communication Templates"),
        ("5-common-incident-scenarios", "5. Common Incident"),
        ("6-post-mortem-process", "6. Post-Mortem"),
    ],
}


def add_anchor_to_heading(content, fragment_id):
    """Add {#fragment_id} to the first matching heading that doesn't already have an anchor."""
    # Check if this anchor already exists
    if f"{{#{fragment_id}}}" in content:
        return content, False

    # Look for a heading that doesn't already have an {#...} anchor
    # Match: `## Heading Text` (no existing anchor)
    lines = content.split('\n')
    modified = False
    in_code = False

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('```'):
            in_code = not in_code
            continue
        if in_code:
            continue

        if stripped.startswith('#') and '{#' not in stripped:
            # Check if this heading text matches our fragment's target
            # (We match broadly: any heading that's at the right section)
            if fragment_id.startswith(tuple('123456789')):
                # Numbered fragment like "1-service-..." — match heading with that number
                num = fragment_id.split('-')[0]
                if stripped.lstrip('# ').startswith(f"{num}."):
                    lines[i] = line.rstrip() + f" {{#{fragment_id}}}"
                    modified = True
                    break
            else:
                # Text fragment — match by key text
                match_words = fragment_id.replace('-', ' ').replace('--', ' ').lower().split()
                heading_words = stripped.lstrip('# ').lower().split()
                # Count how many key words match
                matches = sum(1 for w in match_words if w in heading_words)
                if matches >= len(match_words) // 2:  # At least half the words match
                    lines[i] = line.rstrip() + f" {{#{fragment_id}}}"
                    modified = True
                    break

    return '\n'.join(lines), modified


def main():
    total_fixed = 0
    total_files = 0

    for file_path, fragments in FIXES.items():
        p = Path(file_path)
        if not p.exists():
            print(f"  [SKIP] {file_path} not found")
            continue

        content = p.read_text(encoding="utf-8", errors="replace")
        original = content
        file_modified = False
        file_count = 0

        for fragment_id, heading_hint in fragments:
            content, changed = add_anchor_to_heading(content, fragment_id)
            if changed:
                file_count += 1
                file_modified = True

        if file_modified:
            p.write_text(content, encoding="utf-8")
            print(f"  [{file_path}] Fixed {file_count} fragment(s)")
            total_fixed += file_count
            total_files += 1

    print(f"\nSummary: {total_fixed} fragments fixed across {total_files} files")


if __name__ == "__main__":
    main()
