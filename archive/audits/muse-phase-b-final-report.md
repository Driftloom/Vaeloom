# Muse Phase B — Final Report: Production Runtime Activation + End-to-End Intelligence

**Owner:** Muse Phase B runtime owner. **Security contract:**
`docs/audits/MUSE_SECURITY_HANDOFF.md` (immutable; all 14 invariants preserved —
§34 gate below). Related: `muse-phase-b-baseline.md`,
`muse-runtime-activation-matrix.md`, `muse-phase-b-completion-matrix.md`.

## What changed (no duplicates, no second orchestrator)

Phase B (prior wave) had already made durable state, loop safety, graph replan,
harness wiring, structured outputs, tier fallback, budgets, provenance,
trajectory eval, and the improvement pipeline load-bearing (614-test sweep
green). This Muse wave activated only what was still phantom or missing,
converging the ONE authoritative path (`router.handle` → `run_agent_loop` /
supervisor DAG):

1. **Capability-aware agent selection (§7)** — `score_agent_candidates()` in
   `orchestrator/router.py` (keyword 0.55 + capability 0.20 + availability
   0.15 + cost-fit 0.10; kill-switched agents excluded fail-closed). Wired into
   tie-breaks and low-confidence arbitration. All 32 existing router tests pass
   unchanged.
2. **Cross-provider fallback (§23)** — same-tier, tool-capable-only, key-gated
   candidates appended in both plain and tool-call paths; temperature
   /tools/tier unchanged; chain + downgrade recorded. Embeddings excluded.
3. **Failure taxonomy (§30)** — `failure_code_for()` maps every terminal outcome
   to AUTHORIZATION/VALIDATION/MODEL/TOOL/RETRIEVAL/MEMORY/
   APPROVAL_REQUIRED/APPROVAL_FAILURE/TIMEOUT/CANCELLATION/RETRY_EXHAUSTED/
   CHECKPOINT_FAILURE/POLICY_FAILURE; carried on `AgentResponse.failure_code`.
4. **User cancellation (§31)** — durable `cancel_requested` flag,
   `request_cancel()`, per-iteration loop check (no further side effects),
   `POST /api/v1/agents/runs/{id}/cancel` (auth + double workspace binding,
   404-safe), merge-before-write so concurrent saves can't clear the flag.
5. **Risk-tier action model (§26)** — `action_tier()` over five tiers; loader
   test proves every CONSEQUENTIAL+ tool is approval-gated; tier tags in audit
   logs. Model text ("approved"/"send it") never authorizes — proven by
   swap-rejection test.
6. **Memory admission (§17)** — deterministic admission score (0.5·source +
   0.3·novelty + 0.2·signal, threshold 0.65); merges always pass; conflicts
   linked, never overwritten; every decision audited in metadata; rejected
   candidates reported, not persisted.
7. **P0 approval-swap fix (found during §35)** — `_lookup_approval_internal`
   accepted ANY self-consistent row for ANY requested payload (reason-HMAC
   compared against the stored hash instead of the caller hash). Now requires
   exact canonical-hash equality + keyed-HMAC tamper check (same derivation as
   `ApprovalManager`). Proven by swap/replay/tamper tests; Phase A suite still
   30/30.
8. **Crash-safety merge (§12)** — `save_checkpoint` merges monotonic durable
   signals (cancel flag; terminal outcome wins over stale copies), fixing a real
   lost-update found by the cancel E2E (stale in-memory copy overwrote the
   flag).
9. **RAG testability (§20)** — `_assemble_rag_context(..., session_factory)`
   injectable (default: production factory; prod behavior unchanged).
10. **Test-hygiene fixes (no prod change)** — stale seams aligned to intended
    contracts (search fail-closed, LLM transient message, MCP/client fakes,
    envelope kwarg, migration versions); singleton-shadow order-dependence
    eliminated (class-level patching rule + dual-patch only where a legacy
    shadow must be beaten, documented in-test).

Deliberately NOT done (§15): Temporal/LangGraph/ReAct stay disabled by default
(implemented, wired, tested; enablement is an operator decision with the
documented ownership split). No deterministic LLM replay claimed. No autonomous
self-modification (pipeline gates only).

## Independent verification (§41) — hostile answers

- Dead code? `InferencePolicy.route()` deprecated (model_router owns routing);
  `interrupt_state` graph field still unpopulated (documented).
- Works in tests but not production? RAG-via-prod-factory degrades on live PG
  under pytest (MockUUID model patch) — injected-factory tests + prod-path code
  review cover it; flagged as test-infra gap.
- Flag-gated paths? ReAct/Temporal/LangGraph off by default; each proven in
  isolation, not enabled.
- Bypass the runtime? Direct `execute_tool` callers still bypass caller-side
  gates — executor-boundary checks (card/scope/workspace) hold; approval lookup
  is the remaining caller-side piece (documented gap, swap-proof).
- After restart? Terminal resume + durable idempotency proven; SIGKILL itself
  unexecuted (stated).
- Redis redelivery? Idempotency UNIQUE + single-use approval consume proven at
  row level; live redelivery unexecuted.
- Pooling reuse? GUC isolation is Phase A-verified (unchanged).
- Approval expiry? Expiry paths covered by Phase A suite.
- Malicious tool args? Contract + scope + approval deny (scenario 7 test).
- Retrieved instructions? Quarantine + tags (scenario 7 test).
- Crash after side effect? Single-effect proven via durable row (scenario 4).
- Two tenants at once? Sequential attacks (Phase A) + parallel workspace lanes
  (scenario 8); parallel multi-TENANT lanes deferred (Entity has no tenant
  column; tenant boundary proven at service/router layers).

## E2E scenarios (§35)

1. Research — PASS (retrieval manifest + structured answer).
2. Multi-step — PASS (progress → completion).
3. Consequential — PASS (single-use, replay-denied, swap-denied,
   tamper-skipped).
4. Crash recovery — PASS (write → cache wipe → resume, one effect, one row).
5. Background — PASS (envelope round-trip/tamper/expiry + worker refuses
   unenveloped).
6. Memory learning — PASS (admit legit, reject noise, audit metadata).
7. Injection — PASS (quarantine + deny, never executes).
8. Tenant isolation — PASS sequential (Phase A) + parallel workspace lanes
   (new).

## Performance baseline (§38, mocked model I/O, real PG RAG, n=5)

- Simple single-iteration loop: **p50=1296ms, p95=2078ms** (dominated by live-PG
  RAG round-trips; smoke bound p95 < 60s enforced in-test).
- Retrieval/multi-step/tool/background p50/p95/p99 NOT measured — open follow-up
  (needs staging load harness, not unit tests).

## Security regression (§34)

Phase A suite 30/30 green; RLS target tests green; redteam Tier-3 green
(including the Google-Docs gate closure); no P0/P1 introduced — one P0
found-and-fixed (approval swap, §7 above). Cross-tenant/workspace/RLS/
approval/MCP boundaries intact.

## Counts

- New tests: Phase B 43 + Muse E2E 22 = 65. Full targeted set: **640 passed, 4
  skipped (pre-existing live-PG RLS), 0 failed**.
- Findings this wave: P0: 1 (approval swap — FIXED). P1: 0. P2: 3
  (mock-UUID-vs-live-PG test gap; singleton-shadow hygiene backlog (~60 legacy
  sites, hot spots fixed); concurrent-spend atomicity). P3: 2 (perf beyond
  simple-loop unmeasured; improvement-candidate store table).

============================================================ VAELOOM MUSE PHASE
B FINAL GATE
============================================================

Baseline Commit: 00d47105a2864b568c94686774fcaee138c871f4 Final Commit: (working
tree — uncommitted by design; bot auto-commits) Branch: master

Core Runtime: LIVE Orchestrator: LIVE Agent Routing: LIVE (capability-aware)
Agent Contracts: LIVE (ReAct + executor boundary) Structured Outputs: LIVE
(validated, repair-or-fail) Replanning: LIVE (bounded, max 2) Checkpointing:
LIVE (v2 + CAS + merge) Crash Recovery: LIVE at seam level / UNVERIFIED at
SIGKILL Idempotency: LIVE (durable UNIQUE) Background Execution: LIVE
(enveloped; Temporal/Redis optional) Cancellation: LIVE (durable flag +
endpoint) Budgets: LIVE (per-run hard ceilings)

Intelligence: Retrieval: LIVE (hybrid + policy manifest) Memory: LIVE
(admission-gated consolidation) Consolidation: LIVE Knowledge Graph: LIVE
(query_graph in RAG) Prompt Compiler: LIVE (manifest + quarantine) Model
Routing: LIVE (tier + task map) Fallback: LIVE (tier + cross-provider,
capability-preserving) Evaluation: LIVE (trajectory + gates) Learning: BOUNDED
(personalization/memory auto; rest gated)

Reliability: Queue Redelivery: ROW-LEVEL proven / LIVE-TRAFFIC unverified
Concurrency: workspace-parallel proven; multi-tenant parallel deferred Failure
Recovery: seam-level proven; SIGKILL unverified Side-Effect Safety:
single-effect proven via durable rows

Security: A1–A30: 30/30 Target PostgreSQL RLS: VERIFIED (unchanged) Pooling
Isolation: VERIFIED (unchanged) Background Envelope: VERIFIED (unchanged +
worker test) AgentCard: VERIFIED (unchanged) Approval: VERIFIED + swap hole
closed Prompt Boundary: VERIFIED (unchanged) MCP: VERIFIED (unchanged)

E2E: Scenario 1: PASS Scenario 2: PASS Scenario 3: PASS Scenario 4: PASS (seam
level) Scenario 5: PASS Scenario 6: PASS Scenario 7: PASS Scenario 8: PASS
(sequential tenant + parallel workspace)

Regression: Collected: 644 Passed: 640 Failed: 0 Skipped: 4 (pre-existing)

P0: 1 found, 1 fixed, 0 open P1: 0 P2: 3 (documented above) P3: 2 (documented
above)

Phantom/Dead Components Remaining: InferencePolicy.route (deprecated,
documented); LangGraph/Temporal/ReAct engines (disabled by default, documented);
deterministic replay (not claimed). Known Limitations:
SIGKILL/Redis-outage/provider-outage unexecuted by policy; perf beyond
simple-loop unmeasured; per-run cost atomicity in-memory; improvement candidates
have no store table yet. Technical Debt: ~60 legacy singleton-instance test
patches; MockUUID-vs-live-PG RAG test gap; card_max-vs-settings precedence
semantics.

============================================================ FINAL VERDICT: MUSE
CONDITIONALLY READY
============================================================

(No P0/P1 open; remaining limits explicitly bounded above. Production-ready only
after staging kill-tests, gate ratification, and enablement decisions.)
