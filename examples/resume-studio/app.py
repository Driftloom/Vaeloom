#!/usr/bin/env python3
"""
Vaeloom Resume Studio & Document Compilation Demo.

Demonstrates:
1. Loading candidate profile and job requirements.
2. Industry template selection (Modern, Executive, Technical, Compact).
3. Automated Page-Fit Loop (auto-shrinks typography and spacing to meet page budget).
4. Resume tailoring with keyword injection.
5. Compilation into multi-format artifact descriptors (PDF, DOCX, HTML).
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[2]
for path_dir in [ROOT]:
    if str(path_dir) not in sys.path:
        sys.path.insert(0, str(path_dir))
for pkg in (ROOT / "packages").glob("*/src"):
    if str(pkg) not in sys.path:
        sys.path.insert(0, str(pkg))

from examples.demo_common.data import SAMPLE_CANDIDATE, VAELOOM_JOB_POSTINGS


TEMPLATES = {
    "modern": {
        "name": "Modern Minimalist",
        "font_family": "Inter, -apple-system, sans-serif",
        "primary_color": "#2563eb",
        "layout": "two_column",
        "default_font_pt": 10.5,
        "min_font_pt": 9.0,
        "line_height": 1.4,
    },
    "executive": {
        "name": "Executive Leadership",
        "font_family": "Merriweather, Georgia, serif",
        "primary_color": "#0f172a",
        "layout": "single_column",
        "default_font_pt": 11.0,
        "min_font_pt": 9.5,
        "line_height": 1.45,
    },
    "technical": {
        "name": "Technical Architect",
        "font_family": "JetBrains Mono, Menlo, monospace",
        "primary_color": "#0d9488",
        "layout": "skill_dense",
        "default_font_pt": 10.0,
        "min_font_pt": 8.5,
        "line_height": 1.35,
    },
    "compact": {
        "name": "Compact Single-Page",
        "font_family": "Inter, sans-serif",
        "primary_color": "#334155",
        "layout": "compact_dense",
        "default_font_pt": 9.5,
        "min_font_pt": 8.0,
        "line_height": 1.25,
    },
}


class PageFitOptimizer:
    """Simulates Chromium/WebKit pagination and auto-shrinks typography to fit budget."""

    PAGE_CAPACITY_UNITS = 750.0  # Max printable height units per US Letter page

    @classmethod
    def calculate_raw_units(
        cls, candidate: dict[str, Any], font_pt: float, line_height: float
    ) -> float:
        # Header + summary
        header_units = 90.0 * (font_pt / 10.0)
        summary_lines = math.ceil(len(candidate.get("summary", "")) / 85.0)
        summary_units = summary_lines * 14.0 * line_height * (font_pt / 10.0)

        # Experience entries
        exp_units = 0.0
        for exp in candidate.get("experience", []):
            exp_units += 35.0  # Company + title + date line
            for hl in exp.get("highlights", []):
                lines = math.ceil(len(hl) / 80.0)
                exp_units += lines * 13.0 * line_height * (font_pt / 10.0) + 6.0

        # Skills & Education
        skills_lines = math.ceil(len(", ".join(candidate.get("skills", []))) / 75.0)
        skills_units = skills_lines * 16.0 * (font_pt / 10.0) + 40.0
        edu_units = len(candidate.get("education", [])) * 32.0 * (font_pt / 10.0)

        return header_units + summary_units + exp_units + skills_units + edu_units

    @classmethod
    def optimize(
        cls, candidate: dict[str, Any], template: dict[str, Any], target_pages: int = 1
    ) -> dict[str, Any]:
        max_allowed_units = cls.PAGE_CAPACITY_UNITS * target_pages
        font_pt = float(template["default_font_pt"])
        line_height = float(template["line_height"])
        min_font = float(template["min_font_pt"])

        iterations = 0
        units = cls.calculate_raw_units(candidate, font_pt, line_height)

        while units > max_allowed_units and font_pt > min_font:
            iterations += 1
            font_pt -= 0.5
            line_height = max(1.15, line_height - 0.04)
            units = cls.calculate_raw_units(candidate, font_pt, line_height)

        calculated_pages = max(1, math.ceil(units / cls.PAGE_CAPACITY_UNITS))
        is_fit = calculated_pages <= target_pages

        return {
            "target_pages": target_pages,
            "calculated_pages": calculated_pages,
            "is_fit": is_fit,
            "iterations": iterations,
            "final_font_pt": round(font_pt, 2),
            "final_line_height": round(line_height, 2),
            "total_height_units": round(units, 1),
            "budget_units": max_allowed_units,
        }


def tailor_experience_bullets(
    experience: list[dict[str, Any]], target_job: dict[str, Any]
) -> list[dict[str, Any]]:
    """Simulates AI resume tailoring by emphasizing target job keywords."""
    tailored = []
    job_skills = set(s.lower() for s in target_job.get("required_skills", []))

    for exp in experience:
        new_exp = dict(exp)
        new_highlights = []
        for hl in exp.get("highlights", []):
            hl_lower = hl.lower()
            # If bullet discusses consensus or buffers, weave in target company terminology
            if "raft" in hl_lower and "raft" in job_skills:
                enhanced = (
                    hl + " Formulated formal TLA+ specifications for edge partition tolerance."
                )
                new_highlights.append(enhanced)
            elif "ebpf" in hl_lower and ("ebpf" in hl_lower or "kernel" in " ".join(job_skills)):
                enhanced = (
                    hl + " Directly profiled Linux XDP ring buffers to eliminate drop rates."
                )
                new_highlights.append(enhanced)
            else:
                new_highlights.append(hl)
        new_exp["highlights"] = new_highlights
        tailored.append(new_exp)
    return tailored


def compile_resume_artifact(
    candidate: dict[str, Any],
    template_id: str,
    target_job: dict[str, Any],
    target_pages: int = 1,
) -> dict[str, Any]:
    template = TEMPLATES.get(template_id, TEMPLATES["modern"])

    # 1. Tailor experience
    tailored_exp = tailor_experience_bullets(candidate.get("experience", []), target_job)
    working_candidate = dict(candidate)
    working_candidate["experience"] = tailored_exp

    # 2. Run Page-Fit Loop
    fit_result = PageFitOptimizer.optimize(working_candidate, template, target_pages)

    # 3. Build Compiled HTML Preview
    html_preview = f"""<!DOCTYPE html>
<html>
<head>
<style>
  body {{
    font-family: {template['font_family']};
    font-size: {fit_result['final_font_pt']}pt;
    line-height: {fit_result['final_line_height']};
    color: #1e293b;
    margin: 0.5in;
  }}
  h1 {{ color: {template['primary_color']}; font-size: {fit_result['final_font_pt'] * 1.8}pt; margin-bottom: 2px; }}
  h2 {{ color: {template['primary_color']}; font-size: {fit_result['final_font_pt'] * 1.2}pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }}
  .tag {{ background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }}
</style>
</head>
<body>
  <h1>{candidate['name']}</h1>
  <p><strong>{candidate['title']}</strong> | {candidate['email']}</p>
  <p>{candidate['summary']}</p>
  <h2>Tailored Experience (for {target_job['title']} @ {target_job['company']})</h2>
  <ul>
    {"".join(f"<li><strong>{e['title']}</strong> at {e['company']}: {e['highlights'][0]}</li>" for e in tailored_exp)}
  </ul>
  <h2>Core Competencies</h2>
  <p>{" &bull; ".join(candidate['skills'])}</p>
</body>
</html>"""

    return {
        "artifact_id": f"art_res_{candidate['id']}_{template_id}",
        "candidate_id": candidate["id"],
        "target_job_id": target_job["id"],
        "template": {
            "id": template_id,
            "name": template["name"],
            "primary_color": template["primary_color"],
        },
        "page_fit": fit_result,
        "download_formats": [
            {"format": "pdf", "status": "ready", "pages": fit_result["calculated_pages"]},
            {"format": "docx", "status": "ready"},
            {"format": "json", "status": "ready"},
        ],
        "html_preview_snippet": html_preview[:350] + "\n  <!-- ... truncated for preview ... -->\n</html>",
    }


def run_resume_studio_demo():
    print("=" * 72)
    print("      VAELOOM RESUME STUDIO & COMPILATION ENGINE DEMO")
    print("=" * 72)

    candidate = SAMPLE_CANDIDATE
    target_job = VAELOOM_JOB_POSTINGS[0]  # Cloudflare Staff Systems Engineer

    print(f"\n[1] Candidate Profile Loaded:")
    print(f"    Name:  {candidate['name']}")
    print(f"    Title: {candidate['title']}")
    print(f"    Skills: {', '.join(candidate['skills'][:6])}...")

    print(f"\n[2] Target Opportunity:")
    print(f"    Role:    {target_job['title']} @ {target_job['company']}")
    print(f"    Budget:  {target_job['salary_range']} ({target_job['target_level']})")

    for template_id in ["modern", "technical", "compact"]:
        print(f"\n" + "-" * 72)
        print(f"[*] Compiling Template: [{template_id.upper()}] (Target: 1 Page Budget)")
        print("-" * 72)

        artifact = compile_resume_artifact(
            candidate=candidate,
            template_id=template_id,
            target_job=target_job,
            target_pages=1,
        )

        fit = artifact["page_fit"]
        status_sym = "[PASS]" if fit["is_fit"] else "[OVERFLOW]"
        print(f"  {status_sym} Pages: {fit['calculated_pages']} / {fit['target_pages']} allowed")
        print(f"  Page-Fit Loop Adjustments: {fit['iterations']} iterations")
        print(f"  Applied Typography: Font {fit['final_font_pt']}pt | Line-Height {fit['final_line_height']}")
        print(f"  Artifact Generated: {artifact['artifact_id']}")
        print(f"  Formats Ready: {[f['format'].upper() for f in artifact['download_formats']]}")

    print("\n" + "=" * 72)
    print("  VAELOOM RESUME STUDIO: ALL TARGET TEMPLATES COMPILED SUCCESSFULLY")
    print("=" * 72)


if __name__ == "__main__":
    run_resume_studio_demo()
