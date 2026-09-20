#!/usr/bin/env python3
"""
Vaeloom ATS Scoring Lab & Skill Gap Analysis Demo.

Demonstrates:
1. Extracting candidate profile into normalized plain text.
2. Deterministic ATS scoring using n-gram tokenization and gazetteer matching.
3. Comparative audit across multiple tier-1 tech job postings (Cloudflare, Anthropic, Stripe).
4. Keyword gap extraction (hard skills, architectures, frameworks).
5. Formatting & parseability checks.
6. Actionable bullet optimization recommendations.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[2]
for path_dir in [ROOT]:
    if str(path_dir) not in sys.path:
        sys.path.insert(0, str(path_dir))
for pkg in (ROOT / "packages").glob("*/src"):
    if str(pkg) not in sys.path:
        sys.path.insert(0, str(pkg))

from examples.demo_common.data import SAMPLE_CANDIDATE, VAELOOM_JOB_POSTINGS
from vaeloom_domain.ats import calculate_deterministic_ats_score, ATSScoreResult


def candidate_to_text(candidate: dict[str, Any]) -> str:
    """Converts structured candidate record into ATS-parsable raw text."""
    lines = [
        candidate["name"],
        f"{candidate['title']} | {candidate['email']}",
        candidate["summary"],
        "\nEXPERIENCE:",
    ]
    for exp in candidate.get("experience", []):
        lines.append(f"{exp['title']} - {exp['company']} ({exp['period']})")
        for hl in exp.get("highlights", []):
            lines.append(f"• {hl}")
    lines.append("\nSKILLS:")
    lines.append(", ".join(candidate.get("skills", [])))
    lines.append("\nEDUCATION:")
    for edu in candidate.get("education", []):
        lines.append(f"{edu['degree']} - {edu['institution']} ({edu['year']})")
    return "\n".join(lines)


def job_to_text(job: dict[str, Any]) -> str:
    """Combines job requirements, title, and description into target text."""
    return f"{job['title']} {job['department']} {job['description']} {' '.join(job.get('required_skills', []))}"


def run_ats_scoring_lab():
    print("=" * 76)
    print("       VAELOOM ATS SCORING LAB & KEYWORD GAP ANALYSIS")
    print("=" * 76)

    candidate = SAMPLE_CANDIDATE
    resume_text = candidate_to_text(candidate)

    print(f"\n[1] Candidate: {candidate['name']} ({candidate['title']})")
    print(f"    Total Resume Tokens Parsed: ~{len(resume_text.split())} words")

    print("\n[2] Benchmarking Candidate Against Active Opportunities:")
    print("-" * 76)

    for job in VAELOOM_JOB_POSTINGS:
        job_text = job_to_text(job)
        score_result: ATSScoreResult = calculate_deterministic_ats_score(resume_text, job_text)

        score = score_result.overall_score
        if score >= 75.0:
            status = "STRONG MATCH (Ready to apply)"
            badge = "[PASS]"
        elif score >= 50.0:
            status = "MODERATE MATCH (Tailoring recommended)"
            badge = "[WARN]"
        else:
            status = "SKILL GAP (Significant tailoring needed)"
            badge = "[FAIL]"

        print(f"\nTarget: {job['title']} @ {job['company']}")
        print(f"Location: {job['location']} | Band: {job['salary_range']}")
        print(f"Outcome:  {badge} {score}% ({status})")
        print(f"  - Hard Skills Score: {score_result.hard_skills_score}%")
        print(f"  - Experience Match:  {score_result.experience_score}%")
        print(f"  - Matched Keywords:  {', '.join(score_result.matched_keywords[:8])}")
        print(f"  - Missing Keywords:  {', '.join(score_result.missing_keywords[:8])}")

        if score_result.formatting_issues:
            print(f"  - Formatting Warnings: {score_result.formatting_issues}")
        else:
            print(f"  - Formatting Check: Clean ATS Structure (No tabs, proper section markers)")

        # Optimization recommendation
        if score_result.missing_keywords:
            top_missing = score_result.missing_keywords[:3]
            print(f"  [>] Optimization Tip: Incorporate keywords '{', '.join(top_missing)}' into recent experience highlights.")

    print("\n" + "=" * 76)
    print("  ATS AUDIT COMPLETE: ALL TARGET POSTINGS PROCESSED DETERMINISTICALLY")
    print("=" * 76)


if __name__ == "__main__":
    run_ats_scoring_lab()
