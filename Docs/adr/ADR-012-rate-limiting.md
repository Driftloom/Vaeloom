# ADR-012: Rate Limiting with Sliding Window

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-07-22 |
| **Deciders** | Engineering Team |

## Context

Vaeloom's API must protect against abuse, fair-share resource allocation across tenants, and prevent individual agents from consuming all LLM quota. The rate limiting strategy must work per-endpoint, per-tenant, per-user, and support burst handling.

Options considered: Sliding window (Redis), Token bucket, Leaky bucket, Fixed window.

## Decision

Implement **sliding window rate limiting** using Redis sorted sets, with an in-memory fallback when Redis is unavailable.

Architecture:
- `RateLimitMiddleware` wraps every request (except health checks)
- Default: 100 requests per 60-second window per client IP
- Per-endpoint overrides configurable via decorator or config
- Per-agent rate limits via `agent_limits.py` — separate counter per agent_id
- Sliding window using Redis ZREMRANGEBYSCORE + ZCOUNT — sub-millisecond per check
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- `Retry-After` header on 429 responses
- In-memory fallback degrades gracefully but loses counts on restart

## Consequences

**Positive:**
- Sliding window prevents boundary spikes that plague fixed-window algorithms
- Redis sorted set implementation is O(log N) per check — negligible overhead
- Per-agent rate limits prevent a runaway agent from exhausting LLM API quota
- Rate limit headers enable clients to implement backoff without polling
- In-memory fallback ensures the API stays operational during a Redis outage (with degraded fairness)

**Negative:**
- Redis sorted set entries accumulate until trimmed — each window creates ~100-200 entries per client
- Distributed rate limiting requires all instances to share the same Redis — a single point of failure for rate limit accuracy
- Burst handling is limited — a client at the limit gets 429 immediately rather than a gradual slowdown
- Rate limit reset times are approximate (sliding window has no fixed reset boundary)
