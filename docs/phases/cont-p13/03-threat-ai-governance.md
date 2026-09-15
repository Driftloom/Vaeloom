# CONT-P13 — 03 Threat / AI Governance (WS-13.1 + WS-13.4)

## Carried + re-signed @ HEAD

- **Red-team:** `tests/security/test_redteam_loop.py` 46/46, Tier-1 bypass
  0/18 (Wave 2 gate, still green — no router/eval regressions since).
- **Judge quality gate:** `tests/eval/test_orchestrator_quality_gate.py`
  pass_rate 1.0 enforced in CI set.
- **Prompt-injection defense:** middleware + `injection_classifier.py` (gated)
  + `llm_validator.py` regex + router step-0 adversarial screen (Wave 2).
- **Model supply chain:** `model_router.py` pinned catalog; BYOK keys;
  `prompt_registry.py` sha256 lineage per prompt version.
- **Threat model:** OWASP Agentic Top 10 2026 mapping retained from P12/P13
  baselines (goal-hijack → router screen; tool misuse → approval gates +
  `execute_code_sandbox` gated Wave 2; privilege abuse → RBAC + noauth 105;
  memory poisoning → sanitization + injection screens; cascading → circuit
  breakers + budgets).

## New this phase

- SAML signature bypass closed (01) — removes identity-spoofing vector from
  the threat model (was: unsigned assertion → authenticated session).
