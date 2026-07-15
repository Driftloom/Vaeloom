# 11 — Guardrails & Safety (Enterprise upgrade)

## Read first
`mvp/11-guardrails-safety.md`.

## Objective
Move from MVP's harness-level middleware checks to a formal ABAC policy engine, a documented threat model, and supply-chain security review — the rigor an enterprise security review will actually ask for.

## Requirements
- **ABAC policy engine:** generalizes MVP's fixed, hard-coded policy checks (`mvp/11-guardrails-safety.md`'s `guardrails/policy.py` — a short static list like "max N applications per day") into a real, tenant-configurable attribute-based policy engine — a tenant admin can define policy like "no agent may auto-apply to jobs outside these three approved platforms" or "documents tagged confidential are excluded from Job Search Agent context," expressed declaratively, evaluated centrally (same enforcement point as the Permission Engine, not a parallel system). MVP's hard-coded rules should migrate into this engine as its first, simplest policies, not be left running alongside it as a separate mechanism.
- **Formal threat model:** document Meridian's threat model explicitly against the OWASP Top 10 and AI-specific risks (prompt injection — already mitigated in MVP, now formally documented and tested against a larger adversarial suite; data leakage across tenants; tool misuse). This is a deliverable (a document), not just code — enterprise customers will ask for it directly.
- **Supply-chain security:** dependency scanning (SCA) in CI for both `apps/api`/`apps/web` (npm) and `apps/ai-service` (pip) dependencies, with a policy for how quickly a critical CVE must be patched.
- **Prompt injection suite, expanded:** grow MVP's known-pattern test suite with adversarial patterns discovered via the human-eval rotation (`enterprise/10`) and any real incidents — this suite should never shrink, only grow.

## Out of scope
Changing MVP's core guardrail middleware architecture — this upgrade adds policy expressiveness and formal documentation on top of it, not a replacement.

## Acceptance criteria
- [ ] A tenant-defined ABAC policy (e.g. "exclude confidential-tagged documents from Job Search context") is enforced and verified by a test.
- [ ] The threat model document exists, is reviewed, and maps each identified risk to a specific implemented mitigation with a test reference.
- [ ] CI fails on a critical-severity dependency vulnerability in either service's dependency tree.
- [ ] The expanded prompt-injection suite passes with zero regressions versus the MVP baseline suite.
