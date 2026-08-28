# MVP-P02 — 02. Platform & Policy Research (WS-02.2)

> Research date: 2026-08-07 · Sources: official docs only (prompt §15.3 — never
> unofficial tutorials for critical API/legal behavior). Reproducible via URLs.

## 1. Gmail API — push watch, renewal, reconciliation, quota

| Topic | Finding | Source | Implication for MVP |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| Watch mechanism | `users.watch` requires a Cloud Pub/Sub topic + IAM grant (`gmail-api-push@system.gserviceaccount.com` publisher role); notifications carry only `{emailAddress, historyId}` | Google developers (push guide, updated 2026-07-22) | Push requires GCP infra + OAuth; MVP can start with polling |
| Watch expiry | Max 7 days; silently expires; Google recommends **daily renewal** (idempotent); store expiry + renew at 6.5 days | Push guide + multiple official references | Renewal cron mandatory if push used |
| Reconciliation | `users.history.list` diffs changes; historyId valid ~7 days; older → 404 → full re-sync via `messages.list` | Push guide | Must implement fallback sync path regardless of push/poll |
| Notification rate | Max 1 event/sec per watched user; bursts batched/delayed; may be dropped | Push guide | Not binding at cohort scale |
| Quota | Per-user 15,000 units/min; watch=100 units, history.list=5, messages.get=5; project default 1M units/day | Unipile/agenticemail guides citing official docs | Polling `messages.list` (5 units) is cheap for 10–20 users |
| Pub/Sub reliability | Retries delivery up to 7 days; ack immediately (204), process async | Push guide | Event-driven path documented; polling fallback covers gaps |
| Scopes | read-only (`gmail.readonly`) + draft create (`gmail.compose`); no send scope in MVP (DEC-P01-03) | Google OAuth scopes | Draft-only contract enforceable by scope choice |
| Production verification | External app requires Google verification incl. `user.verification.status` grant for sensitive scopes | Google OAuth verification docs | MVP path: polling + limited scopes reduces verification surface |

**Decision DEC-P02-01:** MVP uses **polling** (`users.messages.list(q=...)` +
`history.list`) with exponential backoff; push-watch documented as the upgrade
path (P15+ ops), incl. 7-day renewal cron, Pub/Sub topic, historyId persistence,
and 404 full-resync fallback. Polling latency target: 5–15 min acceptable for
deadline extraction.

## 2. Job-platform access (lawful surface for a consumer MVP)

### Naukri

- **No public/consumer developer API.** Official programmatic access is B2B
 recruiter-side only: Resdex (paid resume database search) and
 job-posting/recruiter products (`naukri.com/recruit/*`, `resdex.naukri.com`).
- Third-party wrappers (Apify Naukri scraper, Parse marketplace,
 Techmap/RapidAPI feeds) are **unofficial scrapers** — outside the
 approved-integration-only rule (DEC-P01-04) and platform ToS. **Excluded.**
- Implication: Naukri job search/apply stays **user-performed**; assistant
 tracks status via email/manual entry (approved integration = Gmail read).

### LinkedIn

- **No public job-search API for consumers.** Open permissions (self-serve, no
 approval) are limited to: Sign In (`r_liteprofile`, `r_emailaddress`,
 `openid`) and Share (`w_member_social`).
- Job posting / ATS / application data = **Talent Solutions partner programs**
 (Recruiter System Connect, Apply Connect, Premium Job Posting) — restricted to
 incorporated-company partners; individual developers cannot access jobs data.
- No official messaging API; Compliance API is closed read/archive for regulated
 enterprises.
- **Scraping risk is proven:** Microsoft sued Proxycurl (scraped LinkedIn data)
 — service shut down 2026-07-04. Unofficial APIs carry legal +
 platform-dependency risk (prompt §16: "unlawful data use blocks").
- Implication: LinkedIn integration for MVP = **Sign In with LinkedIn** only
 (optional convenience); job tracking via email/manual entry.

### Indeed

- Official partner docs exist (Publisher JavaScript plugin for job-board
 syndication; employer/ATS partner APIs) — but these are **B2B partner
 programs**, not consumer self-serve.
- Implication: no consumer API for MVP; Indeed tracking = user-performed +
 Gmail.

### Cross-platform conclusion (CF-P02-02)

No job platform offers a lawful consumer API for job search/apply in India. The
lawful Vaeloom surface:

1. **Gmail read/drafts** (approved integration) — deadline extraction,
 application tracking from confirmations.
2. **User-performed search/apply** — assistant guides, remembers, and organizes
 (suggest-mode).
3. **Sign In with LinkedIn** (optional).
4. No scraping, no anti-bot circumvention, no credential replay, no automated
 submission (DEC-P01-04 hard rule).

## 3. MCP connector rules (prompt overlay)

- MCP spec 2026-07-28 pinned in P01; connector authorization must be
 user-consented per scope; no connector may bypass approval contract
 (payload-bound approve/reject per DEC-P01-02).
- Connectors must be added only through approved-integration registry (P03+
 requirement); untrusted connector input = untrusted data (prompt §16).

## 4. Evidence links

| Claim | Source URL | Verified |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Gmail watch semantics/expiry | https://developers.google.com/workspace/gmail/api/guides/push | 2026-08-07 |
| Gmail quota (15,000 u/min/user; watch 100) | https://www.unipile.com/gmail-api-rate-limits-and-quotas/ (aggregates official docs) | 2026-08-07 |
| LinkedIn open permissions only (Sign In/Share) | https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access | 2026-08-07 |
| LinkedIn no job-search API; partner-gated | https://www.elfsight.com/blog/linkedin-api-access-and-pricing/ (cites MS Learn) | 2026-08-07 |
| Proxycurl shutdown 2026-07-04 (Microsoft suit) | https://www.elfsight.com/blog/linkedin-api-access-and-pricing/ | 2026-08-07 |
| Naukri no public API; B2B recruit products | https://www.naukri.com/recruit/job-posting ; https://parse.bot/marketplace/5f5984ac-34ec-4e49-a9e6-5a56e0039c4b/naukri-com-api (FAQ) | 2026-08-07 |
| Indeed partner docs (B2B) | https://docs.indeed.com/ | 2026-08-07 |
