# 09 — AI Gateway & Model Routing (Enterprise upgrade)

## Read first
`mvp/09-ai-gateway-model-routing.md`.

## Objective
Move from MVP's single-provider-with-fallback to genuine multi-provider routing, with cost- and quality-aware dynamic decisions instead of static per-agent config.

## Requirements
- **Multi-provider support:** add real alternative providers (OpenAI, Gemini, and/or a self-hosted open model such as Llama/Qwen/DeepSeek for cost-sensitive, high-volume, lower-stakes agents like classification-heavy Gmail Agent) behind the same `complete()` interface from MVP — no agent code should need to know which provider actually served a given call.
- **Dynamic, cost-aware routing:** replace MVP's static per-agent model tier config with a router that considers real-time cost, latency, and (from the eval framework) quality data to choose a model per call — the cheapest model is not always the right choice, the most expensive is not always the smartest either; the router's job is to make that trade-off explicitly and measurably, not by default-to-the-biggest-model habit.
- **Model-response caching:** beyond MVP's prompt caching, cache full responses for genuinely repeatable, deterministic-enough calls (e.g. a classification call on identical input) with clear invalidation rules.
- **Per-tenant model policy:** an enterprise tenant may require a specific provider (data residency / procurement requirement) — the router must support a tenant-level override that takes precedence over the default cost/quality optimization.
- **Hard cost-budget enforcement:** MVP's soft alert-only budget becomes real enforcement at the tenant level — once a tenant's configured budget is reached, the gateway either throttles further requests or requires explicit approval to continue, per the tenant's own policy (tied into the ABAC policy engine, `enterprise/11-guardrails-safety.md`), rather than silently continuing to spend past a limit the tenant set.

## Out of scope
Any change to the fallback-chain safety behavior from MVP (still required, now just spanning more providers).

## Acceptance criteria
- [ ] The same agent request, run multiple times, is demonstrably served by different providers under different simulated cost/latency conditions, with zero agent-code changes.
- [ ] A tenant-level provider policy override is respected even when it contradicts what the cost/quality router would otherwise choose.
- [ ] Response caching produces a measurable cost reduction on a repeated-classification benchmark without any observed quality regression (verified via the eval framework).
- [ ] A tenant configured for hard budget enforcement is correctly throttled once its budget is reached in a test, with a clear, distinguishable response (not a generic error) explaining why.
