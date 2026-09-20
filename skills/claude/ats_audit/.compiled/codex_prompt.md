### SKILL: ATS-AUDIT

**Description**: Comprehensive ATS formatting, keyword density, and parseability
audit playbook for Claude Sonnet.

#### Operational Instructions:

# ATS Formatting & Parseability Audit Playbook

## Purpose

Ensure documents cleanly traverse enterprise Applicant Tracking Systems
(Workday, Greenhouse, Lever, Taleo, iCIMS).

## Invariant Guidelines

- Enforce standard header hierarchies (`# Experience`, `## Education`).
- Verify date formats adhere to `MM/YYYY - MM/YYYY` or `Month YYYY - Present`.
- Flag multi-column tables, text boxes, and non-standard vector graphics.
- Extract missing hard skills and generate semantic cosine similarity score.

#### Reference Trajectories:

- **Multi-column Detection**:
  - Input: `Audit PDF resume with 2-column sidebar layout`
  - Output:
    `Detected 2-column layout warning; recommended single-column clean format for Workday ATS parsing.`
