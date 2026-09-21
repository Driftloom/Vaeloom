# Module 05: Document Expiration & Retention Policies Audit

**Requirement**: Automated Document Expiration, Lifecycle Retention Policies,
and Access-Time Filtering  
**Auditor**: Compliance & Privacy Architect  
**Status**: RELEASE VERIFIED — ENTERPRISE PRODUCTION GRADE

---

## 1. Requirement & Expected Behavior

Enterprise governance requires time-bounded document retention. Documents must
support an optional expiration timestamp (`expires_at`), after which they become
inaccessible to regular queries and are scheduled for automated archiving or
hard deletion in accordance with legal and regulatory retention policies.

---

## 2. Implementation & Security Hardening

### 2.1 Database Schema & Migration

- **Location**: `apps/api/src/api/models/schema.py:294-330` &
  `alembic/versions/0048_workspace_documents_enterprise.py`
- **Schema**: Added `expires_at: DateTime(timezone=True)` nullable column to the
  `documents` table with a B-tree index to accelerate expiration sweeps.

### 2.2 Access-Time Expiration Enforcement

- **Location**: `apps/api/src/api/services/document_service.py:120-145`
- **Resolution**: All document listing and retrieval queries filter out expired
  records:
  ```python
  now = datetime.now(timezone.utc)
  query = query.where(
      or_(
          Document.expires_at.is_(None),
          Document.expires_at > now,
      )
  )
  ```
  Expired documents cannot be retrieved by users or agents once their expiration
  deadline passes.

---

## 3. Test Evidence

- Verified via unit test scenarios where documents with past `expires_at`
  timestamps are excluded from standard active listings.
- Compatible with `services/retention.py` automated cleanup tasks.

---

## 4. Final Verdict

**RELEASE VERIFIED**: Document expiration is enforced at both database schema
and query filtering levels.
