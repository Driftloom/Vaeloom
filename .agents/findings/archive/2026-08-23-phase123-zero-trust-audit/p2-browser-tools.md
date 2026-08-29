# P2 Audit — Browser & Scraping Tools (SSRF policy, engines, quotas)

Date: 2026-08-23 · Zero-trust re-verification; includes a successful adversarial
pass against my own guard.

## What was re-verified (fresh)

| Claim                                             | Method                                                                                                                                   | Result      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Literal/private IP denial                         | parametrized matrix: 127.0.0.1, 10/8, 192.168/16, 169.254.169.254, ::1 forms via `ipaddress.is_global`                                   | PASS        |
| Integer-encoded IP (`https://2130706433`)         | falls to hostname branch → getaddrinfo resolves → **post-resolution check catches it**                                                   | PASS (safe) |
| Credentialed URLs / scheme allowlist / length cap | unit tests                                                                                                                               | PASS        |
| DNS post-resolve validation (all addrs global)    | monkeypatched getaddrinfo returning 192.168.0.9 → blocked                                                                                | PASS        |
| Quota sliding window + per-workspace isolation    | unit tests                                                                                                                               | PASS        |
| Kill switch `BROWSER_TOOLS_ENABLED`               | config-off → error result                                                                                                                | PASS        |
| Honest offline degradation                        | engine failure → deterministic mock fixture with explicit note; verify-link → `unreachable_or_offline`; dead domain → `expired_or_error` | PASS        |
| Live smoke                                        | chromium render of example.com → structured fields; `/apply` → 404 → expired verdict                                                     | PASS        |

## Findings

### F-P2-1 [CRITICAL] Redirect-based SSRF bypass — FIXED

**The hole:** `assert_public_http_url()` validated only the initial URL. Both
engines then followed redirects blindly:

- httpx paths used `follow_redirects=True`
- Chromium navigates redirects natively

A public attacker URL answering `302 → http://169.254.169.254/latest/meta-data/`
would have made the API fetch internal endpoints and return the body to the
caller. Classic, well-documented bypass class; confirmed statically by code path
(the live exploit attempt was inconclusive only because this sandbox blocks
egress).

**The fix (this pass):**

1. `_guarded_fetch()`: manual redirect loop — every hop re-runs
   `assert_public_http_url`, capped at 5 hops, else `RedirectPolicyViolation`.
   Policy violations are never retried on the other engine.
2. Chromium: Playwright **route interception** (`context.route("**/*")`) runs
   the same guard on _every_ request the page makes — covers server redirects,
   JS/meta-refresh redirects, and hostile subresources (images/scripts beaconing
   internal hosts). Violations abort the request.
3. `probe_status`: guarded hop loop as well.

**Regression tests added:** cross-origin→private blocked; same-site chain
allowed; loop hits hop cap; chromium route guard continues public / aborts
private (4 tests).

### F-P2-2 [MEDIUM] Mock data could masquerade as insights — FIXED

`scrape_company_insights` reuses `_execute_web_search`, which falls back to mock
results when no Brave/SerpAPI key is set. Axes were returned without labeling.
Now each axis carries `axis_sources[axis] = mock|live|error`.

### F-P2-3 [ACCEPTED RISK] DNS-rebinding TOCTOU

Guard resolves DNS for validation; the HTTP stack resolves again to connect. An
attacker with a rebinding DNS server could race that window. Full mitigation
requires pinning connections to validated IPs (custom resolver + IP-host
rewriting), which fights both httpx and Chromium. Documented in ADR-035 and code
header. Residual risk rated LOW-MED for an MVP (requires attacker-controlled
DNS + timing); revisit if browser tools face untrusted multi-tenant traffic at
scale.

### F-P2-4 [LOW] In-process quota

Per-workspace scrape quota is per-process memory (matches repo's MemoryBackend
precedent). Multi-instance deployments get N× the quota and a restart resets
counters. Accepted for MVP scale; move to Redis when the rate-limit backend
moves.

## Non-issues verified

- HEAD→GET fallback loop terminates (405 twice ⇒ honest unreachable verdict).
- `verify_application_link` never renders pages (cheap probes only).
- Job-posting extraction: benefits/how-to-apply sections excluded from
  requirements; skills capped at 30; company extraction order title-"at X" →
  body patterns → domain-labels-skip-junk.
