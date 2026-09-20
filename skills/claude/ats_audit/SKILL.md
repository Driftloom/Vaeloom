---
name: ats-audit
description:
  Comprehensive ATS formatting, keyword density, and parseability audit playbook
  for Claude Sonnet.
target_models: [claude, claude-3-5-sonnet, claude-3-7-sonnet]
tools_required: [audit_ats_formatting, extract_missing_hard_skills]
tags: [ats, audit, compliance]
examples:
  - title: Multi-column Detection
    input: Audit PDF resume with 2-column sidebar layout
    output:
      Detected 2-column layout warning; recommended single-column clean format
      for Workday ATS parsing.
---

# ATS Formatting & Parseability Audit Playbook

## Purpose

Ensure documents cleanly traverse enterprise Applicant Tracking Systems
(Workday, Greenhouse, Lever, Taleo, iCIMS).

## Invariant Guidelines

- Enforce standard header hierarchies (`# Experience`, `## Education`).
- Verify date formats adhere to `MM/YYYY - MM/YYYY` or `Month YYYY - Present`.
- Flag multi-column tables, text boxes, and non-standard vector graphics.
- Extract missing hard skills and generate semantic cosine similarity score.
