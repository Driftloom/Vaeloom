# MVP-P00 — 12. Future-Readiness Backlog (prompt overlay)

> **Phase:** MVP-P00 — Intake and Existing-State Assessment **Date:** 2026-08-12
> (completion pass @ `3ad6bca`) **Prompt reference:** MVP-P00 "Phase-Specific
> Future-Readiness and Missing-Idea Overlay" — deferred ideas become required
> when relevant to phase scope or risk; otherwise recorded as a governed future
> backlog with adoption triggers and owner. "Do not expand current scope
> silently." **Rule:** each entry records problem/evidence, target users,
> dependencies, security/privacy/data implications, cost,
> compatibility/migration impact, validation experiment, adoption trigger, owner
> and sunset/rejection condition.

## Backlog entries

### FB-01 — Machine-readable source-of-truth manifest

| Field | Value |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem/evidence | 904 files, 25 packages, 66 prompts, 13k-node knowledge graph — human-only indexing already strains (established 2026-08-04 audit; EVD-001/002) |
| Target users | All agents executing later phases; CI validators; future maintainers |
| Dependencies | Stable repo structure + canonical doc set (P05/P18), JSON schema |
| Security/privacy/data implications | Paths + owners only; no credentials/secrets, no personal data |
| Cost | Low (single generator script, ≤0.5 dev-day) |
| Compatibility/migration impact | Non-breaking; supersedes ad-hoc inventory tables (02) |
| Validation experiment | Generate manifest from repo; diff against 02 inventory; every entry must resolve to a real path/hash |
| Adoption trigger | P05 (architecture) — structure stabilizes; sooner if a second agent mis-indexes the corpus |
| Owner | Enterprise Architect + Technical Writer |
| Sunset/rejection condition | Reject if repo structure churns weekly (manifest churn >20% per commit); revisit at P18 |

### FB-02 — Initial SBOM and AI-BOM

| Field | Value |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem/evidence | Dependency sets large (pnpm-workspace, pyproject/requirements, lockfiles); model/prompt/tool versions scattered across docs; supply-chain posture (SLSA) currently unverified |
| Target users | Security/P13, DevOps/P16, release authority |
| Dependencies | Lockfile-tooling (cyclonedx/syft) availability; CI runner access (P16) |
| Security/privacy/data implications | Public identifiers only (package names + versions); no customer data; AI-BOM records model ids, prompt hashes, retrieval/chunking versions (permissive to disclosure — prompt §3) |
| Cost | Low (CI job + pipeline step) |
| Compatibility/migration impact | None to runtime; becomes required input for release artifacts |
| Validation experiment | Generate one SBOM/AI-BOM pair; verify every runtime dependency resolves and every model/prompt entry has an owner + version |
| Adoption trigger | P16 (CI/CD) or first release artifact; mark missing runtime entries honestly, never invent |
| Owner | Security (SBOM) + AI/Platform (AI-BOM) |
| Sunset/rejection condition | Reject if dependency set not yet reproducible (unpinned ranges); revisit next phase |

### FB-03 — Evidence retention, immutability, artifact hashing policy

| Field | Value |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem/evidence | Evidence already pinned informally (hashes in 01, immutable register set, EVD-011/012); no formal retention/capacity/immutability policy exists |
| Target users | All phase owners, QA, regulatory review (P13) |
| Dependencies | Repository hosting policy; knowledge of anticipated evidence volume |
| Security/privacy/data implications | Hash-only integrity (no content duplication); retention tiers vs consent/legal-hold duties (prompt §17) |
| Cost | Low (policy doc + guard script) |
| Compatibility/migration impact | None; later evidence must conform once adopted |
| Validation experiment | Policy applied retrospectively to 01–14: all files present, hashes match, retention tier assigned |
| Adoption trigger | P05 or first evidence volume >100 artifacts per phase |
| Owner | QA/Release |
| Sunset/rejection condition | Reject if evidence volumes remain <25 artifacts/phase (policy overkill); revisit at P14 |

### FB-04 — Conflict-resolution protocol (canonical vs superseded docs)

| Field | Value |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Problem/evidence | Authority order exists de facto (INT-02 §0.2; DEC-P00-02/04/06; CF-01…06) but is not a written protocol; new conflicting docs will arrive (P18 superseded cleanup) |
| Target users | Every agent executing a phase; reviewers |
| Dependencies | Canonical source register (01) stays current |
| Security/privacy/data implications | None beyond version/authority metadata |
| Cost | Low (single protocol section in 01) |
| Compatibility/migration impact | Prevents silent merges (prompt §12 task 2) — formalizes current practice |
| Validation experiment | Feed a synthetic conflicting doc pair; protocol must name the winner + record the conflict, no silent merge |
| Adoption trigger | Before P18 cleanup or first real conflict after P00 |
| Owner | Phase owner + Enterprise Architect |
| Sunset/rejection condition | Merge into 01 permanently if stable across 3 phases; no rejection path needed |

### FB-05 — Scope protection: enterprise-only runtime stays disabled

| Field | Value |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Problem/evidence | 23 agent dirs vs 8-agent MVP scope; enterprise routes in repo (billing/marketplace/admin/webhooks/SSO/SCIM); CF-05/06 OPEN; RISK-P00-04/10 |
| Target users | All phase gates; release authority; new contributors |
| Dependencies | Scope-lock config (`mvp_scope_enforced`, `enterprise_routes_enabled=False`), 8-name `MVP_CANONICAL_AGENTS` gate — already green in suite (EVD-010) |
| Security/privacy/data implications | Enterprise consumers/data stay out; reduces attack surface, cross-user memory impossible by construction |
| Cost | None beyond gate discipline |
| Compatibility/migration impact | Enterprise features remain in repo but disabled — reversible when formally moved into scope (optimistic: reject promotion unless approved change record exists) |
| Validation experiment | Expand scope-lock tests: any new agent/route must fail MVP builds unless change record approved (already partially true — suite green) |
| Adoption trigger | Continuous — enforced at every phase gate; formalize as P05 deliverable |
| Owner | Product + Phase owner |
| Sunset/rejection condition | Individual enterprise items may be promoted ONLY via approved scope change (prompt §24 change control); items stay disabled otherwise |

## Governance

1. Entries move into phase scope only when their adoption trigger fires AND the
 owning phase owner records the move in that phase's register (change control,
 prompt §24).
2. No backlog entry expands MVP scope by itself (prompt overlay: "Do not expand
 current scope silently").
3. Status column lives here; each entry is revisited at its trigger phase's
 gate.
