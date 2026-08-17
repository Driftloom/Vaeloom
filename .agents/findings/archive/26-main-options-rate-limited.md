# Finding: OPTIONS Requests Can Be Rate-Limited

| Metadata     | Value                                       |
| ------------ | ------------------------------------------- |
| **ID**       | FIND-MAIN-007                               |
| **Severity** | P2-MEDIUM                                   |
| **Status**   | OPEN                                        |
| **Source**   | main.py Audit                               |
| **File**     | `apps/api/src/api/middleware/rate_limit.py` |

## Description

`RateLimitMiddleware` only checks `SKIP_PATHS` against the path, not the HTTP
method. OPTIONS preflight requests to non-health/metrics paths will be
rate-limited. Under heavy CORS preflight load, this could cause 429s for
legitimate browser requests.

## Impact

- Browsers may get 429 on OPTIONS preflight
- Frontend appears broken under load

## Remediation

Skip rate limiting for OPTIONS method, or add OPTIONS to a skip-methods list.
