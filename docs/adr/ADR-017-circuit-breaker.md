# ADR-017: Circuit Breaker for External Dependencies

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

Vaeloom depends on external services: LLM providers (Anthropic, OpenAI), integration APIs (Google, GitHub), Redis, and PostgreSQL. Any of these can become slow or unavailable. The system must fail fast when dependencies are degraded, avoid cascading failures, and provide fallback behavior for non-critical operations.

Options considered: Custom circuit breaker, pybreaker, resilience4j, tenacity with custom retry, Hystrix.

## Decision

Implement a **custom circuit breaker** (`infrastructure/circuit_breaker.py`) with three states (CLOSED, OPEN, HALF_OPEN), configurable thresholds, and per-dependency isolation.

Configuration per dependency:
- `failure_threshold`: consecutive failures before opening (default: 5)
- `recovery_timeout`: seconds before HALF_OPEN probe (default: 30)
- `half_open_max_requests`: probes before closing again (default: 3)
- Fallback policies for non-critical operations (stale cache, degraded response)

## Consequences

**Positive:**
- LLM provider outage does not cascade to agent execution — circuit opens and request fails fast with clear error
- Recovery timeout with HALF_OPEN probes automatically restores service when dependency recovers
- Per-dependency circuits allow Redis circuit to open while PostgreSQL remains fully operational
- Circuit state exposed via `/metrics` endpoint for monitoring and alerting
- Lightweight — no external dependencies, pure Python implementation under 200 lines

**Negative:**
- In-memory circuit state resets on application restart — circuits start CLOSED even if the dependency is still down
- Without distributed state, each replica has its own circuit breaker state — a dependency could be OPEN on one replica and CLOSED on another
- Fallback policies for LLM providers are inherently limited — there's no meaningful fallback for "generate text"
- Circuit breaker decisions are binary (open/closed) — gradual degradation (high latency) is not directly addressed
