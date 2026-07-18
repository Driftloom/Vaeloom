# Commit Convention

> **Purpose:** Define commit message conventions for Vaeloom
> **Status:** 🆕 New

## Commit Architecture

```mermaid
graph TD
    classDef format fill:#e3f2fd,stroke:#1565c0,color:#000,stroke-width:2px
    classDef type fill:#e8f5e9,stroke:#2e7d32,color:#000,stroke-width:1.5px
    classDef scope fill:#fff3e0,stroke:#e65100,color:#000,stroke-width:1.5px
    classDef rules fill:#f3e5f5,stroke:#6a1b9a,color:#000,stroke-width:1px

    subgraph Format["📝 Commit Format"]
        F["<type>(<scope>): <description><br/><br/>[optional body -- explains what & why]<br/><br/>[optional footer -- Closes/Fixes #issue]"]
    end

    subgraph Types["🏷️ Types"]
        T1["feat: New feature<br/>fix: Bug fix<br/>chore: Maintenance<br/>docs: Documentation"]
        T2["style: Formatting<br/>refactor: No behavior change<br/>test: Test changes<br/>ci: CI/CD changes"]
    end

    subgraph Scopes["🎯 Scopes"]
        S1["web: Frontend<br/>api: Backend API<br/>ai: AI Service<br/>infra: Infrastructure<br/>deps: Dependencies<br/>docs: Documentation"]
    end

    subgraph Rules["📋 Rules"]
        R1["First line < 72 chars"]
        R2["Imperative mood: "Add" not "Added""]
        R3["Capitalize first letter"]
        R4["No period at end of subject"]
        R5["Body explains what & why"]
    end

    Format --> Types --> Scopes --> Rules

    class F format
    class T1,T2 type
    class S1 scope
    class R1,R2,R3,R4,R5 rules
```

> **Diagram:** Commit convention following conventional commits format — **format** specifies `<type>(<scope>): <desc>` with optional body/footer. **8 types** (feat, fix, chore, docs, style, refactor, test, ci) and **6 scopes** (web, api, ai, infra, deps, docs). **5 rules** ensure readable, consistent messages.

---

## Commit Message Format

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

## Types

| Type | When | Example |
|------|------|---------|
| `feat` | New feature | `feat(api): add document upload endpoint` |
| `fix` | Bug fix | `fix(memory): correct entity merge confidence threshold` |
| `chore` | Maintenance | `chore(deps): update express to 4.18.2` |
| `docs` | Documentation | `docs(readme): update API examples` |
| `style` | Formatting | `style(web): format with prettier` |
| `refactor` | Code change (no behavior change) | `refactor(api): extract permission middleware` |
| `test` | Test changes | `test(ai): add golden dataset for memory agent` |
| `ci` | CI/CD changes | `ci: add dependency caching to workflow` |

## Scopes

| Scope | Area |
|-------|------|
| `web` | Frontend (apps/web) |
| `api` | Backend API (apps/api) |
| `ai` | AI Service (apps/ai-service) |
| `infra` | Infrastructure (infra/) |
| `deps` | Dependencies |
| `docs` | Documentation |

## Examples

```text
feat(api): add document upload endpoint with queue processing

Implements POST /workspaces/{id}/documents with:
- File validation (type, size)
- Queue-based processing via BullMQ
- Permission check via Permission Engine

Closes #142
```

```text
fix(ai): correct entity merge confidence threshold

The merge threshold was incorrectly set to 0.5 instead of 0.95,
causing unrelated entities to be merged. Fixed the threshold value
and added test coverage for edge cases.

Fixes #89
```

## Rules

| Rule | Rationale |
|------|-----------|
| First line < 72 chars | Readable in git log |
| Use imperative mood | "Add" not "Added" or "Adds" |
| Capitalize first letter | Consistency |
| No period at end of subject | Convention |
| Body explains what and why | Context for future readers |

## Common Mistakes

| Mistake | Consequence |
|---------|-------------|
| Writing vague commit messages | "Fix bug", "Update stuff", or "Address PR feedback" provide no context for future readers — a good commit message explains what changed and why |
| Using past tense in commit subjects | "Added" instead of "Add" breaks the conventional commits convention — the subject line should complete the sentence "This commit will..." |
| Including too much in a single commit | A commit that changes 20 files across 3 concerns can't be reverted independently — each commit should represent a single logical change |
| Forgetting the body for non-trivial changes | A one-line commit message for a complex change provides no context for why the change was made — the body should explain motivation and trade-offs |

## Best Practices

| Practice | Why |
|----------|-----|
| Write the subject line as "This commit will..." | "Add document upload endpoint" completes the sentence — "Added document upload endpoint" does not. This convention makes every commit message read naturally |
| Keep the subject line under 72 characters | 72 characters is the standard git log limit — longer subjects are truncated in terminal output and lose readability |
| Use the body to explain what and why, not how | The code itself shows how — the body should explain why this approach was chosen and what alternatives were considered |
| Use a consistent type and scope from the allowed list | `feat(api):`, `fix(ai):`, `docs(readme):` — consistent types enable automated changelog generation and release notes |

## Security Considerations

| Consideration | Mitigation |
|--------------|-----------|
| Commit messages exposing vulnerabilities | Commit messages for security fixes should describe the fix abstractly without detailing the exploit path — use "Fix token validation" not "Fix token replay attack by adding nonce" |
| Sensitive data in commit history | Credentials, API keys, or internal URLs committed by accident are in the git history permanently — use `git filter-branch` or `bfg` to remove them, then rotate affected credentials |

## Performance Considerations

| Consideration | Approach |
|--------------|----------|
| Commit granularity and CI efficiency | Every commit triggers CI — 50 commits with broken intermediate state waste CI resources. Use `git rebase -i` to squash WIP commits before pushing |
| Commit size and review efficiency | A commit that changes 3 unrelated files is harder to review than 3 commits changing 1 file each — granular commits make `git blame` and `git bisect` more effective |

## Workflows

1. **Stage changes:** `git add` relevant files for a single logical change
2. **Write commit message:** `<type>(<scope>): <description>` (under 72 chars)
3. **Add optional body** explaining what changed and why (not how)
4. **Add optional footer** referencing issue: `Closes #142` or `Fixes #89`
5. **Commit locally:** `git commit -m` with the formatted message
6. **Push and verify:** `git push` — ensure CI passes on the branch
7. **For WIP commits:** `git rebase -i` to squash before opening PR

---

## APIs

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `POST /repos/{owner}/{repo}/git/commits` | POST | Create a commit via API | GitHub token |
| `POST /repos/{owner}/{repo}/git/refs` | POST | Create a branch ref | GitHub token |
| `GET /repos/{owner}/{repo}/commits` | GET | List commits with conventional commit filtering | GitHub token |
| `POST /repos/{owner}/{repo}/git/blobs` | POST | Create file blob for commit | GitHub token |

---

## Scalability

| Dimension | Current Limit | 10x Strategy | 100x Strategy |
|-----------|--------------|--------------|---------------|
| Commit volume | 20 commits/day | 200 commits/day: squash WIP commits before push | 2000 commits/day: merge-train grouping |
| Conventional commit compliance | Manual review | Pre-commit hook validation | CI-enforced conventional commit linting |
| Changelog generation | Manual | Automated from conventional commits | AI-summarized changelog per release |
| Commit message review burden | Reading every message | Automated type/scope validation | Blame-skip for trivial commits |

---

## Error Handling

| Scenario | Detection | Mitigation | Recovery |
|----------|-----------|------------|----------|
| Commit message exceeds 72 chars | Pre-commit hook | Warn and reject commit | Reword subject line |
| Missing type or scope in commit | Commitlint check | Block push to remote | Amend commit with correct format |
| Commit to wrong branch | Git reflog | Use `git reset` or `git revert` | Cherry-pick to correct branch |
| Secrets accidentally committed | Pre-push hook scanning | Reject push, scrub from history | `git filter-branch` + rotate secret |

---

## Monitoring

| Metric | Alert Threshold | Severity | Dashboard |
|--------|----------------|----------|-----------|
| Conventional commit compliance rate | < 95% of commits | Warning | GitHub Insights |
| Average commits per PR | > 10 | Info | PR Quality |
| Commit message body missing rate | > 30% | Info | Commit Quality |
| WIP commit rate (squash before merge) | > 50% of feature branches | Warning | Developer workflow stats |

---

## Limitations

| Limitation | Impact | Workaround | Future Resolution |
|------------|--------|------------|-------------------|
| No enforcement for conventional commits in CI | Team members may use inconsistent formats | Pre-commit hooks | CI-enforced commitlint gate |
| Squash merge loses individual commit history | Granular context lost in feature merge | Detailed squash message describes all changes | Stacked PRs preserve per-commit context |
| Breaking change detection not automated | Major version bumps may be missed | Manual SemVer check in release PR | Automated breaking change detection from commit messages |
| Multi-line commit bodies rendered poorly in tools | Body content truncated in git log | Keep body under 72 chars per line | Git tooling improvements (external) |

---

## Overview

This document defines the commit message convention used by every Vaeloom engineer across all services — `apps/web`, `apps/api`, and `apps/ai-service`. Following the Conventional Commits specification, each message includes a type (`feat`, `fix`, `chore`, etc.), an optional scope (`web`, `api`, `ai`, `infra`, `deps`, `docs`), a descriptive subject under 72 characters, and an optional body explaining what changed and why.

Consistent commit messages enable automated changelog generation, semantic version bump detection, and release note creation — all critical for Vaeloom's bi-weekly release cadence. The convention is enforced through pre-commit hooks (planned Q3 2026) and CI-enforced commitlint gates (planned Q4 2026), but the primary enforcement is developer discipline and code review.

All Vaeloom engineers are expected to follow this convention for every commit. The branch strategy in `Branch-Strategy.md` and the PR workflow in `PR-Guidelines.md` depend on well-formed commit messages for squash merge descriptions and changelog automation.

## Goals

- Standardize commit messages across all Vaeloom services for readability and automation
- Enable automated changelog generation and semantic version detection from commit history
- Ensure every commit is a single logical change that can be independently reverted or cherry-picked
- Provide clear examples and rules so new engineers write compliant messages from day one
- Establish a commit granularity standard that balances CI efficiency with git bisect effectiveness

## Scope

### In Scope

- Conventional Commits format: `<type>(<scope>): <description>` with optional body and footer
- Eight commit types: feat, fix, chore, docs, style, refactor, test, ci
- Six Vaeloom scopes: web, api, ai, infra, deps, docs
- Five formatting rules (72-char limit, imperative mood, capitalization, no period, body explains why)
- Good and bad commit message examples
- Workflow for staging, writing, amending, and squashing commits

### Out of Scope

- Pre-commit hooks for conventional commit validation (planned Q3 2026)
- CI-enforced commitlint gate on PR branches (planned Q4 2026)
- Automated breaking change detection from commit messages (planned Q1 2027)
- AI-powered commit message suggestion based on diff (planned Q2 2027)
- Multi-line commit body formatting beyond the 72-char-per-line rule

---

## Examples

```text
# Good commit — feature with body explaining what and why
feat(api): add document upload endpoint with queue processing

Implements POST /workspaces/{id}/documents with:
- File validation (type, size limits)
- Queue-based processing via BullMQ
- Permission check via Permission Engine

Closes #142

# Good commit — bug fix with rationale
fix(ai): correct entity merge confidence threshold

The merge threshold was incorrectly set to 0.5 instead of 0.95,
causing unrelated entities to be merged. Fixed the threshold value
and added test coverage for edge cases.

Fixes #89

# Good commit — documentation change
docs(readme): update API examples for v2 endpoints

# Bad commit — vague, no context
fixed stuff

# Bad commit — past tense, too long
Added new document upload endpoint that processes files through the
queue and validates them against the permission engine before returning
the document ID to the caller which then uses it for further processing
```

---

## Future Improvements

| Improvement | Priority | Complexity | Timeline |
|-------------|----------|------------|----------|
| Pre-commit hook for conventional commit validation | High | Low | Q3 2026 |
| Automated changelog generation from conventional commits | High | Low | Q3 2026 |
| CI-enforced commitlint gate on PR branches | Medium | Low | Q4 2026 |
| Breaking change auto-detection in CI pipeline | Medium | Medium | Q1 2027 |
| AI-powered commit message suggestion based on diff | Low | High | Q2 2027 |

## Related Documents

- [Git Workflow.md](./Git-Workflow.md)
- [Branch Strategy.md](./Branch-Strategy.md)
- [`/docs/Engineering/Implementation/00-master-build-order.md`](../../docs/Engineering/Implementation/00-master-build-order.md)
