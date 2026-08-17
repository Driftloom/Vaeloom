# Finding: IP Allowlist Middleware Not Mounted

| Metadata     | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| **ID**       | FIND-MAIN-002                                                        |
| **Severity** | P1-HIGH                                                              |
| **Status**   | OPEN                                                                 |
| **Source**   | main.py Audit                                                        |
| **File**     | `apps/api/src/api/middleware/ip_filter.py` (exists but not imported) |

## Description

`IPAllowlistMiddleware` exists at `middleware/ip_filter.py` but is NOT imported
or added to the middleware stack in `main.py`. This is a missing zero-trust
network control.

## Impact

- No IP-based access control
- API is accessible from any network
- Cannot restrict admin endpoints to internal IPs

## Remediation

Import and mount `IPAllowlistMiddleware` in `main.py`, or document why it's
deferred.
