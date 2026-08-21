# Acceptance Criteria — Vaeloom MVP Frontend (P0/P1)

Generated 2026-08-21. Each AC is testable Given/When/Then per prompt §48.

## AC-001 — P0 Conditional hooks crash [FRO-001]
- **Given** enterprise flag OFF (`NEXT_PUBLIC_ENABLE_ENTERPRISE` unset) and user navigates to `/workspace/{id}/admin` (and billing/developer/feature-flags/marketplace/organizations)
- **When** page renders, no early return before hooks, React hook order identical across renders
- **Then** `pnpm --filter @vaeloom/web lint` has 0 `rules-of-hooks` errors; page renders `<EnterpriseGated feature="..."/>` without crash; `pnpm --filter @vaeloom/web build` succeeds in StrictMode
- **Test:** `pnpm --filter @vaeloom/web lint 2>&1 | grep rules-of-hooks → 0` + manual toggle flag on/off render

## AC-002 — P1 Connectors real OAuth [FRO-002]
- **Given** user on Connectors, sees Available `Notion` with scope pill `notion:read`
- **When** clicks `Connect` → modal shows scope + “You will be redirected … never sees password” → `Continue to OAuth`
- **Then** browser navigates to `GET https://…/api/v1/auth/sso/notion?redirect_uri=${encodeURIComponent(origin + "/auth/callback")}` `auth_url`; after redirect back with `code` connector status `connected` and `lastSyncAt` non-empty; toast shows granted scopes
- **And** Available list removes that provider; Connected list shows `Test` + `Sync Now` polls `sync/status` until `connected|error`; Revoke removes row
- **Test:** Mock `fetch /auth/sso/notion` → `{auth_url}` → location asserted via playwright

## AC-003 — P1 Organization Agent rename proposal [FRO-003]
- **Given** Files has `resume.pdf`
- **When** user clicks Rename enters `Resume_2026_Anon.pdf` submits
- **Then** not patched directly — instead transient `Proposal: organization suggests Rename … → …` proposal card appears in chat/notifications with reason “Organize under personal naming policy” and Diff old→new + Approve/Reject; History shows `document_rename` only after Approve; Undo still available after
- **And** direct PATCH call no longer reachable without proposal gate
- **Test:** Spy `agentApi.chat` with `agentName: organization` called; no `documentApi.rename` before approve

## AC-004 — P1 Resume trust [FRO-004]
- **Given** master resume has field `experience[0].is_inferred=true + source_document_id=doc_123`
- **When** master viewed
- **Then** each inferred line has amber badge `Inferred` + tooltip “Generated from memories — confirm?”; each line has provenance source link → Files viewer; variants list shows Diff button opening DiffViewer master↔variant
- **And** ATS score (if present via ats agent) visible as `ATS 82` pill; strip of `is_inferred` fields is reverted
- **Test:** Render with fixture `is_inferred true` → badge visible; click source → navigation to `/files/doc_123`

## AC-005 — P1 Jobs persistence + richness [FRO-005]
- **Given** user searches “Product Manager Berlin”, result proposals `[{title:"PM at X",detail:"…"}]`
- **When** clicks Save then refreshes page
- **Then** Saved tab still shows `PM at X` (localStorage or server-persisted); detail card shows `Match 87%` (if backend returns) + fit explanation + tag list `Missing: OKRs` when backend includes
- **Test:** `localStorage["vaeloom.savedJobs.{workspaceId}"]` non-empty after save + after reload count same

## AC-006 — P1 Chat attachment [FRO-006]
- **Given** Chat input has attachment `cv.pdf` chip
- **When** user presses Send with `Hello`
- **Then** if gateway supports uploads: `documentApi.upload(cv.pdf, workspaceId)` called before `agentApi.chat` and `attached` included as `document_ids:[id]` in payload; chip persists until sent
- **Or** if uploads not yet supported: send button disabled with tooltip “Attachments coming — upload via Files” and chip hidden — not rendered as false affordance
- **Test:** File selected → chip visible; send spy asserts `upload` call or tooltip assertion; no `attached` state silently dropped

## AC-007 — P1 Approval Center [FRO-007]
- **Given** there exists pending approvals from memory, schedule, application agents
- **When** user navigates to `/workspace/{id}/approvals` (or via Dashboard badge count vs explicit page — judged mandatory bonus page)
- **Then** list shows tabs All/Pending/Approved/Rejected/Expired with count badge; each row shows agentName, actionType, DiffViewer if diff present, ConfidenceMeter, risk, expiry `ExpiryTimer` countdown; Approve/Reject flips status and toast; Dashboard card “Pending approvals (N)” links to it
- **Test:** `approvalApi.list({status:PENDING})` spy → rows count matches; approve click → `approve` called + status pill becomes APPROVED

## AC-008 — P1 File detail route + upload pipeline [FRO-008/009 composite]
- **Given** Files has row `report.pdf`
- **When** user clicks row
- **Then** navigates to `/workspace/{id}/files/report_id` (push URL, not modal) showing title, size, date, badge archived, Download, Rename, Archive/Restore, History actions tab; browser refresh retains page
- **And** after Upload new file `a.txt`, banner “Processing… parsing (3s)” remains until `documentApi.list` metadata shows `ingestion_status===ready|failed` within 30s; failed shows “Failed ingestion — retry” with Retry button
- **Test:** History export includes uploaded doc; direct URL fetch 200; polling stub verifies status transition

## AC-009 — P1 Global search [FRO-010]
- **Given** user presses `⌘K` on any workspace page
- **When** types `Q3 plan`
- **Then** palette shows grouped results `Files: … | Memories: … | Events: …` ranked with `score` + source badge; arrow ↑↓ selects, Enter navigates to file viewer / memory lineage / schedule detail; Esc closes and restores focus to prior element
- **Test:** Input `Q3` → `searchApi.all` called with `query:Q3`; result rows ≥1 per section or “No results” empty state

## AC-010 — P1 Resume diff export + scheduler ops [FRO-011/014]
- **Given** Resume has variant `tailored` v2 and Master v1
- **When** selects two variants → Show Diff → Download PDF
- **Then** DiffViewer shows character diff green/red; ATS score pilled if ats agent returns; Download navigates to `getContent blob` with correct filename
- **And** Schedule card for cron job `Daily sync` has buttons Pause/Resume/Trigger with confirm → status flips via `schedulerApi.pause/resume/trigger` and toast
- **Test:** Diff rendered rows include `+/-` span; Download `href` is blob URL; scheduler button spies verified

## AC-011 — P1 Settings connector persistence + files mobile fallback [FRO-012/027/029]
- **Given** user toggles Settings connector `Read` off for `drive`
- **When** reloads Settings
- **Then** toggle stays off (PATCH persisted) via `integrationApi.update({config:{read:false}})` or canonical equivalent; server GET on reload returns false
- **And** Files on 375px shows cards not table, table row keyboard Enter opens viewer, focus trap inside viewer/history modals with Esc to close
- **Test:** PATCH spy asserted after toggle; GET replay reflects; viewport 375 snapshot has selector `.card` count === doc count

## AC-012 — P0 release gate safety net
- **Given** all AC-001…011 PASS
- **When** `pnpm lint --max-warnings=0` and `tsc --noEmit` both PASS and no HARDCODED mocks remain outside `ENTERPRISE` flag guard and page inventory table has 0 “Missing required page” REQUIRED rows
- **Then** audit gate becomes `APPROVED WITH NON-BLOCKING ACTIONS` or `APPROVED`; otherwise `NOT APPROVED`

> Each AC must be implemented before `FRONTEND_MVP_COMPLETENESS ≥90` can be claimed. Where spec ambiguous, record assumption in `docs/phases/mvp-p10/assumptions.md` instead of silently inventing.
