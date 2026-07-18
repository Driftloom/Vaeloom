#!/usr/bin/env python3
"""
Vaeloom Documentation Audit — Phase 10
=======================================
Comprehensive enterprise documentation audit engine.

Scans all Docs/*.md files and produces:
  - Per-file section coverage and quality scores
  - Category coverage matrices
  - Missing document detection
  - Cross-reference graph data
  - Enterprise readiness scoring

Usage:
    python scripts/docs_audit_phase10.py
    python scripts/docs_audit_phase10.py --json > audit-results.json
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from pathlib import Path

# Resolve docs directory (supports Docs/ and docs/)
DOCS_DIR = Path("Docs") if Path("Docs").exists() else Path("docs")

SECTIONS = [
    "overview", "goals", "scope", "functional_requirements",
    "non_functional_requirements", "architecture", "components",
    "workflows", "sequence", "data_flow", "apis", "database",
    "security", "performance", "scalability", "error_handling",
    "monitoring", "deployment", "configuration", "examples",
    "best_practices", "risks", "limitations", "future_improvements",
    "related_documents",
]

SECTION_PATTERNS = {
    "overview": r"^##\s+Overview",
    "goals": r"^##\s+Goals",
    "scope": r"^##\s+Scope",
    "functional_requirements": r"^##\s+Functional Requirements",
    "non_functional_requirements": r"^##\s+Non-Functional Requirements",
    "architecture": r"^##\s+Architecture",
    "components": r"^##\s+Components",
    "workflows": r"^##\s+Workflows",
    "sequence": r"sequenceDiagram",
    "data_flow": r"^##\s+Data Flow",
    "apis": r"^##\s+APIs?",
    "database": r"^##\s+Database",
    "security": r"^##\s+Security",
    "performance": r"^##\s+Performance",
    "scalability": r"^##\s+Scalability",
    "error_handling": r"^##\s+Error Handling",
    "monitoring": r"^##\s+Monitoring",
    "deployment": r"^##\s+Deployment",
    "configuration": r"^##\s+Configuration",
    "examples": r"^##\s+Examples",
    "best_practices": r"^##\s+Best Practices",
    "risks": r"^##\s+Risks",
    "limitations": r"^##\s+Limitations",
    "future_improvements": r"^##\s+Future Improvements",
    "related_documents": r"^##\s+Related Documents",
}

REQUIRED_ENTERPRISE_DOCS = {
    "Product": [
        "Vision.md", "Mission.md", "PRD.md", "BRD.md", "SRS.md",
        "User-Stories.md", "Use-Cases.md", "Wireflows.md",
        "Roadmap.md", "Features.md",
    ],
    "Architecture": [
        "System-Design.md", "High-Level-Design.md", "Low-Level-Design.md",
        "03-adrs.md",
    ],
    "Backend": ["API-Reference.md", "Authentication.md", "Authorization.md"],
    "AI": ["AI-Agents.md", "Memory.md", "RAG.md", "MCP.md"],
    "Database": ["Schema.md", "ER-Diagram.md"],
    "Security": ["Threat-Model.md", "Compliance.md", "SOC2.md", "GDPR.md"],
    "DevOps": ["CI-CD.md", "Deployment.md", "Docker.md"],
    "Testing": ["Testing-Strategy.md"],
    "Project": [
        "Glossary.md", "Technical-Debt-Register.md", "Risk-Register.md",
        "Known-Limitations.md", "Changelog.md", "Release-Notes.md",
        "Migration-Guide.md", "Documentation-Roadmap.md",
        "Recommended-Reading-Order.md",
    ],
    "Developer_Experience": ["Plugin-Guide.md", "Setup.md", "Contributing.md"],
    "Backend_specs": ["openapi.yaml"],
}

CATEGORY_SCORES = {
    "Product": {"weight": 1.0},
    "Architecture": {"weight": 1.0},
    "Backend": {"weight": 1.0},
    "Frontend": {"weight": 1.0},
    "AI": {"weight": 1.0},
    "Database": {"weight": 1.0},
    "Security": {"weight": 1.0},
    "DevOps": {"weight": 1.0},
    "Testing": {"weight": 1.0},
    "Operations": {"weight": 1.0},
    "Engineering": {"weight": 0.8},
    "Developer_Experience": {"weight": 0.9},
    "Enterprise": {"weight": 0.7},
    "Project": {"weight": 0.8},
    "Root": {"weight": 0.6},
}


@dataclass
class FileAudit:
    path: str
    category: str
    purpose: str = ""
    sections_present: dict = field(default_factory=dict)
    coverage_pct: float = 0.0
    completeness_pct: float = 0.0
    quality_score: float = 0.0
    has_mermaid: bool = False
    has_metadata: bool = False
    word_count: int = 0
    classification: str = "Needs Upgrade"
    missing_sections: list = field(default_factory=list)
    broken_refs: list = field(default_factory=list)


def get_category(path: Path) -> str:
    parts = path.parts
    if len(parts) <= 2:
        return "Root"
    return parts[1] if parts[0] in ("Docs", "docs") else "Root"


def extract_purpose(content: str) -> str:
    m = re.search(r"\*\*Purpose\*\*\s*\|\s*(.+?)\s*\|", content)
    if m:
        return m.group(1).strip()
    m = re.search(r">\s*\*\*Purpose:\*\*\s*(.+)", content)
    return m.group(1).strip() if m else ""


def audit_file(path: Path) -> FileAudit:
    content = path.read_text(encoding="utf-8", errors="replace")
    rel = str(path).replace("\\", "/")
    category = get_category(path)

    sections = {}
    for name, pattern in SECTION_PATTERNS.items():
        sections[name] = bool(re.search(pattern, content, re.MULTILINE | re.IGNORECASE))

    applicable = [s for s in SECTIONS if s not in ("functional_requirements", "non_functional_requirements", "apis", "database")]
    if category in ("Backend", "Database"):
        applicable.extend(["apis", "database"])
    if category in ("Product", "Architecture"):
        applicable.extend(["functional_requirements", "non_functional_requirements"])

    present_count = sum(1 for s in applicable if sections.get(s, False))
    coverage = (present_count / len(applicable)) * 100 if applicable else 0

    # Completeness: content depth
    word_count = len(content.split())
    has_mermaid = "```mermaid" in content
    has_metadata = "**Purpose**" in content or "**Purpose:**" in content

    completeness = min(100, (
        (30 if word_count > 500 else word_count / 500 * 30) +
        (20 if has_mermaid else 0) +
        (15 if has_metadata else 0) +
        (35 * (present_count / max(len(applicable), 1)))
    ))

    quality = (coverage * 0.4 + completeness * 0.35 + (20 if has_mermaid else 0) + (5 if has_metadata else 0))
    quality = min(100, quality)

    missing = [s for s in applicable if not sections.get(s, False)]

    if quality >= 85 and coverage >= 70:
        classification = "Enterprise Ready"
    elif quality >= 65 or coverage >= 50:
        classification = "Needs Upgrade"
    elif word_count < 200:
        classification = "Needs Rewrite"
    else:
        classification = "Needs Upgrade"

    return FileAudit(
        path=rel,
        category=category,
        purpose=extract_purpose(content),
        sections_present=sections,
        coverage_pct=round(coverage, 1),
        completeness_pct=round(completeness, 1),
        quality_score=round(quality, 1),
        has_mermaid=has_mermaid,
        has_metadata=has_metadata,
        word_count=word_count,
        classification=classification,
        missing_sections=missing[:8],
    )


def find_missing_docs() -> dict:
    missing = {}
    for folder, files in REQUIRED_ENTERPRISE_DOCS.items():
        if folder == "Backend_specs":
            for f in files:
                p = DOCS_DIR / "Backend" / f
                if not p.exists():
                    missing.setdefault("Backend", []).append(f)
            continue
        for f in files:
            p = DOCS_DIR / folder / f
            if not p.exists():
                missing.setdefault(folder, []).append(f)
    return missing


def build_xref_graph(files: list[Path]) -> dict:
    graph = defaultdict(set)
    link_re = re.compile(r'\]\(([^)]*\.md[^)]*)\)')

    for path in files:
        content = path.read_text(encoding="utf-8", errors="replace")
        src = str(path).replace("\\", "/")
        for m in link_re.finditer(content):
            link = re.sub(r'#.*$', '', m.group(1))
            if link.startswith(("http", "#")):
                continue
            target_dir = path.parent
            import os
            resolved = os.path.normpath(os.path.join(str(target_dir), link)).replace("\\", "/")
            graph[src].add(resolved)
    return {k: sorted(v) for k, v in graph.items()}


def compute_domain_scores(audits: list[FileAudit]) -> dict:
    domains = {
        "Product": ["Product", "Root"],
        "Architecture": ["Architecture", "Enterprise"],
        "Backend": ["Backend"],
        "Frontend": ["Frontend"],
        "Database": ["Database"],
        "AI": ["AI"],
        "Security": ["Security"],
        "DevOps": ["DevOps"],
        "Testing": ["Testing"],
        "Operations": ["Operations"],
        "Developer Experience": ["Developer_Experience", "Engineering"],
    }
    scores = {}
    for domain, cats in domains.items():
        relevant = [a for a in audits if a.category in cats]
        if relevant:
            scores[domain] = round(sum(a.quality_score for a in relevant) / len(relevant), 1)
        else:
            scores[domain] = 0.0
    return scores


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    md_files = sorted(DOCS_DIR.rglob("*.md"))
    audits = [audit_file(p) for p in md_files]

    by_category = defaultdict(list)
    for a in audits:
        by_category[a.category].append(a)

    category_summary = {}
    for cat, items in by_category.items():
        category_summary[cat] = {
            "files": len(items),
            "avg_coverage": round(sum(i.coverage_pct for i in items) / len(items), 1),
            "avg_quality": round(sum(i.quality_score for i in items) / len(items), 1),
            "enterprise_ready": sum(1 for i in items if i.classification == "Enterprise Ready"),
            "needs_upgrade": sum(1 for i in items if i.classification == "Needs Upgrade"),
            "needs_rewrite": sum(1 for i in items if i.classification == "Needs Rewrite"),
        }

    missing_docs = find_missing_docs()
    domain_scores = compute_domain_scores(audits)
    enterprise_readiness = round(sum(domain_scores.values()) / len(domain_scores), 1)

    global_section_coverage = {}
    for section in SECTIONS:
        count = sum(1 for a in audits if a.sections_present.get(section, False))
        global_section_coverage[section] = round(count / len(audits) * 100, 1)

    result = {
        "phase": 10,
        "date": "2026-07-15",
        "total_files": len(audits),
        "docs_directory": str(DOCS_DIR),
        "has_application_code": False,
        "enterprise_readiness_score": enterprise_readiness,
        "category_summary": category_summary,
        "domain_scores": domain_scores,
        "global_section_coverage": global_section_coverage,
        "missing_documents": missing_docs,
        "classification_counts": {
            "Enterprise Ready": sum(1 for a in audits if a.classification == "Enterprise Ready"),
            "Needs Upgrade": sum(1 for a in audits if a.classification == "Needs Upgrade"),
            "Needs Rewrite": sum(1 for a in audits if a.classification == "Needs Rewrite"),
        },
        "files": [asdict(a) for a in audits],
    }

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"Phase 10 Audit — {len(audits)} files in {DOCS_DIR}/")
        print(f"Enterprise Readiness: {enterprise_readiness}/100")
        print(f"Enterprise Ready: {result['classification_counts']['Enterprise Ready']}")
        print(f"Needs Upgrade: {result['classification_counts']['Needs Upgrade']}")
        print(f"Missing doc categories: {len(missing_docs)}")
        for cat, files in missing_docs.items():
            print(f"  {cat}: {', '.join(files)}")


if __name__ == "__main__":
    main()
