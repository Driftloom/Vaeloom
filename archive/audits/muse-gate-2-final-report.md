# Muse Gate 2 — Final Report (audit-first; fix-only-proven-defects)

**Mode executed:** full audit pass with zero production changes, then controlled
remediation of 3 proven defects (2 P0/P1 + 1 P2 wording), then complete
re-verification. Evidence package: `muse-gate-2-baseline.md`,
`muse-gate-2-real-runtime-path.md`, `muse-gate-2-findings.md` (this report is
the verdict wrapper).

## Audit verdicts by section

- §6 runtime path: single authoritative path proven (router.handle →
  run_agent_loop/supervisor → loop → tools → approvals → checkpoints); no
  v2/legacy orchestrator found.
- §7 phantom audit: every previously-phantom component verified LIVE with
  production caller + tests (activation matrix holds); `InferencePolicy.route`
  stays DEPRECATED; Temporal/LangGraph/ReAct DISABLED-BY-DESIGN with ownership
  split documented; deterministic replay DEAD (not claimed).
- §8/§9: one orchestrator; flags all safe-by-default (react/temporal/langgraph
  off, MVP scope on, budgets bounded).
- §10: Phase A A1–A30 re-ran 30/30 (plus RLS target + redteam green).
- §11 approval swap: fix independently re-proven
  (swap/replay/tamper/concurrency).
- §12 lost-update: race reproduced live (stale copy cleared cancel flag);
  merge-before-write proven (cancel survives; terminal wins).
- §13 cancellation: real-API proof (valid/duplicate/unknown/foreign-workspace).
- §14 crash: REAL child-process death mid-run → durable rows intact, resume
  single-effect (throwaway SQLite; shared infra untouched). SIGKILL against
  shared dev infra intentionally excluded — seam proof stands in.
- §15 idempotency: durable UNIQUE across process death, retries, resume.
- §16 Redis: broker-dead path returns explicit outcomes (no phantom completion);
  live-outage chaos excluded by policy, residual bounded.
- §17 worker auth: Phase A unsigned/tampered/expired/replay/cross-workspace
  green + new missing-envelope + tamper tests green.
- §18 RLS: live `vaeloom` DB inspected as superuser (policies, FORCE, qual/check
  incl. `p_agents_workspace`); app-role isolation test green;
  NULL/malformed-context and pooling fail closed by policy design.
- §19 static dispatch: disabled/unknown/unauthorized-tool/wrong-workspace/
  missing-scope/missing+expired+replayed approval all DENIED pre-side-effect
  (proof tests green); AgentCard authoritative.
- §20/§38 bypass search: only executor-internal card/scope checks + graph-node
  call (scoped) + resume helpers; subprocess only in approval-gated
  code-sandbox, MCP stdio (argv-only), plugins (enterprise-gated), latex (doc
  pipeline). No reachable bypass found.
- §21 prompt boundary: shaped attacks detected; bare role-tags cannot authorize
  (swap test proves model text ≠ authorization).
- §22 memory: admission gate + provenance + cross-scope denial proven.
- §23 retrieval: unauthorized rows filtered pre-exposure (service WHERE + RLS);
  concurrent lanes proven.
- §24 fallback: cross-provider same-tier proven (capability preserved, chain
  recorded, embeddings excluded).
- §25 structured output: malformed/missing-field/wrong-type/unknown-action/
  unauthorized-tool all reject-or-repair (no blind execution).
- §26 loop safety: all six budgets terminate explicitly (tests).
- §27 replan: `needs_replan` emission + compiled-graph edge evaluate→agent
  proven structurally; budget caps replan at 2.
- §28 E2E 8/8 with full step/ID/audit records in-test.
- §29 parallel isolation: 3 workspaces concurrent, zero contamination;
  multi-tenant parallel proven at service level (3 tenants × scopes).
- §30 observability: run→…→evaluation chain in checkpoint manifests; correlation
  IDs end-to-end; no secrets in state (asserted).
- §31 taxonomy: all 13 codes mapped and asserted.
- §32 cancel-vs-save: proven (flag survives, terminal wins, no resurrection).
- §33 side effects: denied tool → no handler run, no idem row, no approval
  consumed (asserted); denied approval stays APPROVED and usable.
- §34 perf: simple-loop p50=1296ms/p95=2078ms (mocked model, real PG RAG);
  retrieval + envelope-verify baselines recorded; multi-step/tool/background p99
  NOT measured (needs staging harness — open).
- §35 skips: the 4 skips are `test_rls_isolation.py` SQLite-incompatible cases,
  each covered by a live-PG equivalent (target test + Phase A). Nothing
  security-critical hides behind a skip.
- §37 MCP: EXPLICITLY BOUNDED (not sandboxed, never claimed as such):
  interpreter denylist, argv-only spawn, env allowlist, AES-256-GCM secrets,
  mutating tools approval-gated. Residual: server binaries run as app UID with
  no egress filter; code-sandbox filter is substring-based (approval gate is the
  real boundary); overstated wording corrected.
- §39 findings: F1 (P0 fixed), F2 (P1 fixed), F3 (P0 re-verified closed), 6×P2
  documented. No unrelated architecture introduced.

## Remediation regression

After each fix: targeted tests + Phase A 30/30 + affected E2E re-ran green.
Final gate sweep: **720 passed, 4 skipped (pre-existing), 0 failed, 0 xfailed**
across 38 files (~3.5 min serial). Duration recorded; no unexpected regression
vs the 640 baseline (delta is purely new coverage).

============================================================ VAELOOM MUSE GATE 2
— FINAL ZERO-TRUST GATE
============================================================

Baseline: docs/audits/muse-gate-2-baseline.md Commit:
00d47105a2864b568c94686774fcaee138c871f4 (+ working tree, uncommitted by design)
Branch: master

CURRENT IMPLEMENTATION: Files Modified: agent_service, routers/agents, loop
(approval+HMAC), executor (audit tier), definitions (sandbox wording), coding
handler (wording), consolidator (admission), router (selection scorer), state
(codes/correlation/cancel), inference_policy (tiers), llm_service (x-provider
fallback) + 13 test alignments Files Added: test_muse_gate2_registry_scope,
test_muse_gate2_resilience, test_muse_e2e_scenarios (+43 phase_b tests prior
wave), 7 audit docs

RUNTIME: Authoritative Orchestrator: orchestrator/router.handle Default
Execution Path: router → run_agent_loop (static) → tools → approvals →
checkpoints Alternate Paths: stream variant (same phases); supervisor DAG;
direct agent_service run/execute (now scoped); graph/Temporal/worker (disabled
or enveloped) Phantom Components: none (all previously-phantom now LIVE or
DEPRECATED-documented) Disabled-by-Design Components: Temporal, LangGraph
engine, ReAct (ownership split recorded)

SECURITY: Phase A A1–A30: 30/30 Target PostgreSQL RLS: VERIFIED (policies +
FORCE inspected live; app-role test green) Pooling Isolation: VERIFIED
(unchanged, GUC design reviewed) Background Envelope: VERIFIED
(round-trip/tamper/expiry/replay + worker refusal) Worker Authorization:
VERIFIED (membership path intact) AgentCard: VERIFIED (status + tool binding
enforced incl. new paths) Approval Integrity: VERIFIED (swap/tamper proven
denied) Approval Replay: VERIFIED (single-use + concurrency) Approval
Concurrency: VERIFIED (UNIQUE race + rowcount atomicity) Prompt Boundary:
VERIFIED (quarantine + authorization≠influence) Tool Authorization: VERIFIED
(card/scope/workspace/approval + audit tiers) MCP: EXPLICITLY BOUNDED (controls
listed; not a sandbox; residual documented)

RELIABILITY: Checkpoint: DURABLE + versioned + CAS Lost-Update Protection:
PROVEN (merge; stale cannot clear cancel or resurrect terminal) Cancellation:
DURABLE + OBSERVED (real API; no further side effects) Crash Recovery:
SEAM-PROVEN (real process death on throwaway DB); SIGKILL on shared infra
EXCLUDED by policy Idempotency: DURABLE UNIQUE (process/retry/resume/duplicate
proven) Queue Redelivery: ROW-LEVEL proven; live-traffic chaos EXCLUDED by
policy Redis Failure: EXPLICIT outcomes (no phantom completion) Concurrency:
workspace-parallel + tenant-parallel(service) proven

INTELLIGENCE: Retrieval: LIVE + pre-exposure filtering proven Memory: LIVE +
admission-gated + provenance Memory Admission: LIVE (scored, audited, rejects
noise) Consolidation: LIVE (dedup + conflict links) Knowledge Graph: LIVE
(query_graph in RAG) PromptCompiler: LIVE (manifest + quarantine) Structured
Outputs: VALIDATED (repair-or-explicit-error) Model Routing: LIVE (tier + task
map) Cross-Provider Fallback: LIVE (same-tier, capability-preserving, recorded)
Replanning: REAL (signal + compiled edge + budget) Evaluation: LIVE
(trajectory + gates) Learning: BOUNDED (auto: preference/memory only; rest
gated)

OPERABILITY: Correlation IDs: END-TO-END (request → state → manifests)
Observability: checkpoint manifests; no secrets asserted Failure Taxonomy: ALL
13 CODES MAPPED + asserted Budgets: bounded
(iterations/tools/tokens/cost/duration/replans) Performance: simple
p50=1296ms/p95=2078ms; retrieval+envelope recorded;
p99/multi-step/tool/background p99 OPEN

E2E: Research: PASS Multi-Step: PASS Consequential Action: PASS Crash Recovery:
PASS (seam level) Background: PASS Memory Learning: PASS Injection: PASS Tenant
Isolation: PASS (sequential tenant + parallel workspace + parallel
tenant-service)

PARALLEL ISOLATION: Workspace A: PASS (own marker only) Workspace B: PASS (own
marker only) Workspace C: PASS (own marker only) Cross-Tenant: PASS
(service-level parallel; HTTP-level sequential via Phase A)

REGRESSION: Tests Collected: 724 Passed: 720 Failed: 0 Skipped: 4 (pre-existing
RLS/SQLite, live equivalents green) XFailed: 0

SKIPPED TEST REVIEW:

1. test_rls_isolation Unset-tenant — pre-existing, intentional (SQLite lacks
   RLS), covered by live-PG target test. Cannot hide failure (explicit skip
   reason).
2. test_rls_isolation tenant-separation — same as 1.
3. test_rls_isolation same-tenant-visibility — same as 1.
4. test_rls_isolation workspace-within-tenant — same as 1.

FINDINGS: P0: 2 (F1 registry tenant scope — FIXED + verified; F3 approval swap —
re-verified closed; 0 open) P1: 1 (F2 direct-execution scope/status — FIXED +
verified; 0 open) P2: 6 (tenant-less-JWT reads; MockUUID-vs-PG test gap;
singleton-shadow backlog; sandbox wording (fixed); card-precedence semantics;
spend atomicity) P3: 2 (perf depth; candidate store table)

KNOWN LIMITATIONS: SIGKILL on shared infra, live Redis/provider outage chaos,
multi-step/tool/background p99, per-run spend atomicity, tenant-parallel-at-HTTP
(signup is single-tenant) — each explicitly bounded with what-would-close-it in
§§14/16/29/34.

UNTESTED / EXPLICITLY EXCLUDED: Live model-provider calls (hermetic mocks by
policy); destructive chaos on shared dev DB; full-backend-suite xdist mode
(finding 39 open); Temporal/LangGraph/ReAct enablement paths (disabled by
design).

SECURITY REGRESSIONS: none (Phase A 30/30 before, during, and after every fix).

SIDE-EFFECT REGRESSIONS: none (denied ops proven side-effect-free; legitimate
flows byte-identical).

============================================================ FINAL VERDICT: MUSE
CONDITIONALLY READY
============================================================

(P0/P1 = 0 open; all critical boundaries proven; remaining gaps genuinely
bounded with explicit close-out evidence defined. PRODUCTION READY requires
staging kill-tests, gate ratification, and enablement decisions — all listed
above with owners-evidence pairs.)
