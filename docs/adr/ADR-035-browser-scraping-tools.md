# ADR-035: Browser & Scraping Tools — SSRF Policy, Engine Strategy, Quotas

Date: 2026-08-23 Status: Accepted Related: ADR-034 (resume document pipeline —
shared Playwright manager)

## Context

The agentic tool suite needs live web access for career workflows: reading job
postings (LinkedIn/Greenhouse/Lever/Workday), verifying application links, and
aggregating company intelligence. An LLM-controlled `url` argument fetching
arbitrary URLs from the API server is a textbook SSRF vector (cloud metadata,
internal admin panels), and unbounded scraping risks rate-limit bans and cost.

## Decision

### 1. Three read-only tools (no approval gate)

`browse_job_page`, `scrape_company_insights`, `verify_application_link` — all
scope `system.browser.read`, category `connector_read`, wired into the
MVP-canonical JobSearchAgent + ApplicationAgent (and available to enterprise
agents). Read-only web fetches follow the existing `web_search` precedent: no
approval gate. Write actions remain gated via `APPROVAL_GATED_TOOLS`.

### 2. Fail-closed SSRF guard (`api/utils/url_guard.py`)

- https only; no credentials in URL; length cap.
- Literal IPs validated without DNS; hostnames resolved in a worker thread —
 **every** resolved address must be globally routable (loopback / private /
 link-local / reserved / multicast denied). `.local`/`.internal`/
 `metadata.google.internal` names blocked outright.
- Two exception tiers: `UrlBlockedError` (policy) vs `DnsResolutionError` (dead
 domain). Verify-link maps the latter to an honest `expired_or_error` verdict
 instead of a scary policy message.

### 3. Engine strategy: chromium first, httpx fallback

One shared headless Chromium (`playwright_manager` singleton from ADR-034)
renders JS-heavy boards; when it is unavailable or returns empty text, the
service falls back to plain httpx GET + stdlib HTML tag-stripping (no new
parsing dependency). Both engines are behind the same guard.

### 4. Quota, not approval, for cost control

Per-workspace sliding-hour quota (default 20/hour, `SCRAPE_QUOTA_PER_HOUR`)
applies to network-heavy tools; exceeded → error result with retry hint.
In-process counters match the existing MemoryBackend rate-limiter precedent. A
global kill switch exists (`BROWSER_TOOLS_ENABLED=false`). Browser tools get
per-tool timeout overrides (45s browse / 20s insights / 15s verify) because
chromium cold-start exceeds the connector_read default.

### 5. Honest extraction heuristics

Job-posting structuring (title/company/requirements/skills) is heuristic: title
separators → "at X" patterns (page title first, then body) → domain labels
skipping board junk (jobs./careers./apply.). Requirements come from the first
requirements-style heading until a benefits/how-to-apply boundary; skills
intersect the hard-skill gazetteer. When every engine fails, handlers return
deterministic mock fixtures with an explicit note — never silent fabrication
(same contract as web_search).

## Consequences

- No new runtime dependencies (reuses playwright + httpx).
- Tool count 25 → 28; ReAct path needs no gate changes (read-only).
- In-memory quotas reset on process restart — acceptable at MVP scale; move to
 Redis if multi-instance quotas become necessary.

## Verification

- 39 unit tests: guard policy matrix (11 blocked URL shapes), DNS-tier
 exceptions, quota window, extraction heuristics, handler mocks, registry
 wiring incl. agent scope derivation.
- Live smoke: real chromium render of example.com → structured fields; 404 link
 → `expired_or_error`; dead domain → `expired_or_error`.
