---
name: code-review
description:
  Strict Pydantic JSON schema code review playbook for identifying race
  conditions, memory leaks, and architectural boundary violations.
target_models: [codex, gpt-4o, o3-mini]
tools_required: [run_static_analysis, run_git_diff]
tags: [code-review, static-analysis, security]
examples:
  - title: Direct DB Import Detection
    input: Review diff adding SQLAlchemy select in agent reasoning handler
    output:
      Flagged architectural violation (SEC-P0-01); recommended routing via
      MemoryService.
---

# Enterprise Code Review Playbook (Codex / GPT Edition)

## Rules of Engagement

1. **Unidirectional Architecture**: Ensure no domain agent imports `sqlalchemy`,
   `models`, or `database`.
2. **Deterministic Typing**: Ensure all function signatures have explicit Python
   3.12 type annotations.
3. **Fail-Closed Security**: Verify all external URLs are sanitized by
   `validate_outbound_url` before fetching.
4. Output findings strictly matching the `CodeReviewVerdict` Pydantic model.
