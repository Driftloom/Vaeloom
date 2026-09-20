# Database Migration Verification Report

**Date**: 2026-09-20  
**Tool**: Alembic  
**Target Migration**: `0045_auth_lockout_verification_onboarding.py`  
**Current Alembic Head**: `0045 (head)`

---

## 1. Migration Chain & Integrity

- **Revision ID**: `0045`
- **Revises**: `0044` (`0044_enterprise_org_invitations_and_ratings.py`)
- **Linear DAG**: Verified with zero branches/divergent heads.
- **Dialect Compatibility**:
  - PostgreSQL: Applies
    `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY;` and
    sets RLS policies.
  - SQLite: Uses batch alter table operations; skips RLS statements cleanly.

---

## 2. Table & Column Additions

1. **Table `users`**:
   - `email_verified`: Boolean, default `False`, nullable=False.
   - `failed_login_attempts`: Integer, default `0`, nullable=False.
   - `locked_until`: DateTime(timezone=True), nullable=True.
2. **Table `auth_sessions`**:
   - `user_agent`: String(500), nullable=True.
   - `family_id`: UUID, nullable=True, indexed (`idx_auth_sessions_family_id`).
3. **Table `email_verification_tokens`**:
   - `id`: UUID PK
   - `user_id`: UUID FK -> `users.id` (CASCADE)
   - `token_hash`: String(64) UNIQUE, indexed
     (`idx_email_verification_token_hash`)
   - `expires_at`: DateTime(timezone=True)
   - `created_at`: DateTime(timezone=True)
4. **Table `onboarding_states`**:
   - `id`: UUID PK
   - `user_id`: UUID FK -> `users.id` (CASCADE), UNIQUE
   - `tenant_id`: UUID FK -> `tenants.id` (CASCADE), indexed
   - `workspace_id`: UUID FK -> `workspaces.id` (SET NULL), indexed
   - `current_step`: String(50), default `"PROFILE"`
   - `completed_steps`: JSON, default `[]`
   - `is_completed`: Boolean, default `False`
   - `step_data`: JSON, default `{}`

---

## 3. Downgrade Safety

- Full downgrade path implemented in `0045.py:downgrade()`.
- Successfully drops RLS policies, tables, indexes, and columns in reverse
  foreign key order.
