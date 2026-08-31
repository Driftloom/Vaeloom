# BROWSER fixtures

Synthetic HTML/JSON mirroring `services/browser_service.py:129` chromium-first +
httpx fallback, without live crawl (avoids rate limit, SSRF, freshness drift per
SOURCES.md).

- `job-page-001.html` — captured
  `browse_job_page("https://acme.example.com/careers/001")` stub (title
  `Software Engineer — Acme Corp`, skills `Python, PostgreSQL, Docker, AWS`,
  salary `18 LPA`, deadline `2026-09-10`, source `greenhouse`). Same `apply_url`
  as `JOBS/job-001.json` and `job-011` dedup.
- `job-page-001.txt` — `strip_html_to_text` result (used by
  `BrowserService._extract_title_company`).
- `company-insights-acme.json` — `scrape_company_insights("Acme Corp")` stub
  (axes 0-1, facets).
- `verify-link-001.json` — `verify_application_link` `live`;
  `verify-link-expired.json` `expired`; `verify-link-ssrf-blocked.json`
  `blocked_ssrf` (http + private IP → `url_guard.py` https-only + global-IP).
- All synthetic, no PII, `retrieved_at` 2026-08-30 per §30.

To live-test: `BrowserService().fetch_page_text_guarded(url, route_guard)` with
`url_guard` will `SSRF blocked` for `verify-link-ssrf-blocked.json` and `live`
for `job-page-001`.
