# 03 — Ingestion Pipeline (Enterprise upgrade)

## Read first
`mvp/03-ingestion-pipeline.md`.

## Objective
Broaden the connector catalog and move from batch/scheduled sync to incremental, streaming sync at the throughput enterprise tenants require.

## Requirements
- **New connectors:** Dropbox, OneDrive, Slack, Notion, Figma, LinkedIn, and coding-profile platforms (LeetCode, Codeforces, HackerRank, Kaggle) — each built to the same MCP-shaped tool contract from `mvp/07-mcp-tool-ecosystem.md`, no exceptions.
- **Incremental/streaming sync:** replace MVP's simpler poll-based connector sync with webhook/push-based incremental sync where the platform supports it (e.g. Slack events API, Google Drive push notifications), falling back to efficient delta-polling (changed-since-last-sync, not full re-scan) elsewhere.
- **Throughput:** load-test the ingestion queue (file 03 MVP's BullMQ setup) at the concurrent-tenant volume expected at enterprise scale; tune worker concurrency and add horizontal worker scaling before it's needed, not after a real tenant's bulk import causes a backlog.
- **Access control on ingestion:** ingestion must now respect tenant-level connector policy (file 01's tenant admin can restrict which connector types are permitted for their tenant) — check this before enqueueing, not just at the UI layer.

## Out of scope
Any new parser logic beyond what MVP already supports (OCR, code understanding, etc. are unchanged) — this file is about breadth of sources and throughput, not depth of parsing.

## Acceptance criteria
- [ ] Each new connector passes the same connection/health-check/revocation tests as MVP's original three.
- [ ] A Slack or Drive push-notification-triggered sync reflects a source change within seconds, not the next scheduled poll window.
- [ ] Load testing shows the ingestion queue handling the target concurrent-tenant volume without unbounded backlog growth.
- [ ] A tenant admin's connector restriction is enforced at ingestion time, verified by a test attempting to enqueue a disallowed connector type.
