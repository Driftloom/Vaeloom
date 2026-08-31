# CONT-P09 — 02 Screen & State Specs

**Deliverable:** `DEL-CONT-P09-02` | **Version:** 1.0 | **Date:** 2026-08-31 | **Owner:** UX Architect

## Approval (trust boundary)

| Component | File | Required Props | States |
|-----------|------|----------------|--------|
| `ApprovalCard` | `apps/web/src/components/shared/ApprovalCard.tsx:9` | `id agentName actionType description diff provenance confidence expiresAt t3Warning onApprove/onReject` | `proposed` `expired(No action)` `approved(diff applied)` `rejected` `aria-label` region `A/R` keyboard `ApprovalCard.tsx:48` |
| `DiffViewer` | `components/shared/DiffViewer.tsx` | `oldText newText` | `side-by-side` `sr-only` diff |
| `ExpiryTimer` | `components/shared/ExpiryTimer.tsx` | `expiresAt` | `countdown` → `expired` disables `A/R` `ApprovalCard.tsx:40` |
| `ProvenanceBadge` `ConfidenceMeter` | `components/shared/*` | `label confidence` | `0-1` confidence + source chips |

**Rule:** `proposed !== executed` — badge `Proposed — not yet executed` `ApprovalCard.tsx:94` plus footer `undo from History` `ApprovalCard.tsx:152` for document mutations; `gmail.send` T3 shows `agent_access` consent warning `ApprovalCard.tsx:144`.

## Admin

| Screen | File | Live source | Fallback | A11y |
|--------|------|-------------|----------|------|
| `Admin Dashboard` | `apps/web/src/app/workspace/[workspaceId]/admin/page.tsx:73` | `iamApi.listUsers()` `auditApi.queryEvents()` `adminApi.servicesHealth()` | `mockUsers/mockServices/mockAuditLog` when `!isEnterpriseEnabled()` or fetch 403 | `EnterpriseGated` `AdminPage.tsx:134` + `Table` `StatusBadge` `role: alert` toast `AdminPage.tsx:165` |
| `Approvals` | `workspace/[workspaceId]/approvals/page.tsx` | `approvalApi.list(status=PENDING)` | `EmptyState` when 0 | `ApprovalCard` `tabIndex 0` + `onKeyDown A/R` |

## Consent / Privacy

| Surface | File/API | Behavior |
|---------|----------|----------|
| Privacy Policy | `apps/web/src/app/privacy/page.tsx` placeholder 2026-08-21 + DPDP scopes `data_processing/agent_access` description | counsel-reviewed before launch `privacy/page.tsx:5` |
| Consent toggle | `consentApi.grant/revoke/me/scopes` `apps/web/src/lib/api-client.ts:1152` | `POST /consent/grant {scope}` `POST /consent/revoke/{scope}` `GET /consent/me` lists `granted/revoked_at ip_address` |
| Data rights | `gdprApi.export/delete` `api-client.ts:1167` | `GET /gdpr/export` JSON + `POST /gdpr/delete` anonymized, backup expiry 30d |
| Terms | `apps/web/src/app/terms/page.tsx` | placeholder |

## Error Content

Every state uses `EmptyState` / `ErrorState` / `LoadingSpinner` (`apps/web/src/components/shared/*`). `403` shows `forbidden/page.tsx` with `request access` CTA; `expired` shows `session-expired`.

---
_Version 1.0 2026-08-31 — `rg "ApprovalCard|ExpiryTimer" apps/web/src/components/shared 170`._
