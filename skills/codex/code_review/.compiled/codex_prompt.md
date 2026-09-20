### SKILL: CODE-REVIEW

**Description**: Strict Pydantic JSON schema code review playbook for
identifying race conditions, memory leaks, and architectural boundary
violations.

#### Operational Instructions:

# Enterprise Code Review Playbook (Codex / GPT Edition)

## Rules of Engagement

1. **Unidirectional Architecture**: Ensure no domain agent imports `sqlalchemy`,
   `models`, or `database`.
2. **Deterministic Typing**: Ensure all function signatures have explicit Python
   3.12 type annotations.
3. **Fail-Closed Security**: Verify all external URLs are sanitized by
   `validate_outbound_url` before fetching.
4. Output findings strictly matching the `CodeReviewVerdict` Pydantic model.

#### Reference Trajectories:

- **Direct DB Import Detection**:
  - Input: `Review diff adding SQLAlchemy select in agent reasoning handler`
  - Output:
    `Flagged architectural violation (SEC-P0-01); recommended routing via MemoryService.`
