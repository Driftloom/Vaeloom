# ENT-P07 — 02 Database Migration & Reversible Rollback Plan

> **Phase:** `ENT-P07` (Data Architecture and Database Design)  
> **Deliverable:** `DEL-ENT-P07-02` (v1.0)  
> **Owner:** Lead Database Administrator (DBA) & Release Engineer  
> **Date:** 2026-09-29 | **Commit:** HEAD (`592db98e`)

---

## 1. Zero-Downtime Migration Architecture (Expand/Contract)

To guarantee zero service disruption during production upgrades, all enterprise
database migrations follow the expand/contract design pattern. Existing code
continues to operate seamlessly while additive schema objects are applied.

```
Step 1 (Expand): Apply Additive Schema Objects (Tables, Nullable Columns, Indexes)
Step 2 (Deploy): Shift Application Services to New Model (Dual-Read/Write)
Step 3 (Verify): Execute Live Integrity Audits & Performance Sanity Checks
Step 4 (Contract): Remove Deprecated Columns in Subsequent Maintenance Cycle
```

---

## 2. Enterprise Migration Sequence (0062 – 0066)

### Migration 0062: Sovereign Vaults & Consent Grants

```sql
-- Migration 0062_create_sovereign_vaults_and_consent.up.sql
CREATE TABLE IF NOT EXISTS candidate_sovereign_vaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    dek_ciphertext TEXT NOT NULL,
    kms_key_id VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    last_rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consent_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grantee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(64) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    signature TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_grants_grantee_active
ON consent_grants(grantee_id, expires_at);
```

### Migration 0063: Academic Hierarchy & Cohorts

```sql
-- Migration 0063_create_academic_cohorts.up.sql
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    graduation_year INT NOT NULL,
    term VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cohort_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cohort_id, user_id)
);
```

### Migration 0064: 22-Memory Cognitive Vector Store

```sql
-- Migration 0064_create_cognitive_memories.up.sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS cognitive_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    memory_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(1536),
    confidence_score FLOAT NOT NULL DEFAULT 1.0,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMPTZ,
    provenance_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cog_mem_user_type
ON cognitive_memories(user_id, memory_type);
```

### Migration 0065: pgvector HNSW Semantic Indexing

```sql
-- Migration 0065_create_hnsw_indexes.up.sql
CREATE INDEX IF NOT EXISTS idx_cog_mem_embedding_hnsw
ON cognitive_memories
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Migration 0066: Native Row-Level Security Policies

```sql
-- Migration 0066_enforce_rls_enterprise.up.sql
ALTER TABLE candidate_sovereign_vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_sovereign_vaults FORCE ROW LEVEL SECURITY;

ALTER TABLE consent_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_grants FORCE ROW LEVEL SECURITY;

ALTER TABLE cognitive_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognitive_memories FORCE ROW LEVEL SECURITY;

-- Candidate Sovereign Vault: Accessible only by user
CREATE POLICY p_vault_candidate_isolation ON candidate_sovereign_vaults
FOR ALL USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- Cognitive Memories: Accessible by user OR authorized advisor with active consent
CREATE POLICY p_cog_mem_candidate_or_consented ON cognitive_memories
FOR SELECT USING (
    tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND (
        user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
        OR id IN (
            SELECT cg.id FROM consent_grants cg
            WHERE cg.user_id = cognitive_memories.user_id
              AND cg.grantee_id = NULLIF(current_setting('app.user_id', true), '')::uuid
              AND cg.expires_at > NOW()
        )
    )
);
```

---

## 3. Reversible Rollback Scripts (Down Migrations)

Every migration has an idempotent, tested reversal script:

```sql
-- Reversal: 0066_down.sql
DROP POLICY IF EXISTS p_cog_mem_candidate_or_consented ON cognitive_memories;
DROP POLICY IF EXISTS p_vault_candidate_isolation ON candidate_sovereign_vaults;

-- Reversal: 0065_down.sql
DROP INDEX IF EXISTS idx_cog_mem_embedding_hnsw;

-- Reversal: 0064_down.sql
DROP TABLE IF EXISTS cognitive_memories;

-- Reversal: 0063_down.sql
DROP TABLE IF EXISTS cohort_memberships;
DROP TABLE IF EXISTS cohorts;
DROP TABLE IF EXISTS departments;

-- Reversal: 0062_down.sql
DROP TABLE IF EXISTS consent_grants;
DROP TABLE IF EXISTS candidate_sovereign_vaults;
```

---

## 4. Pre-Flight Migration Lock & Safety Profiling

All migrations must pass pre-flight lock profiling in staging before production
release:

1. **Lock Duration Ceiling:** No DDL statement may hold an exclusive table lock
   (`AccessExclusiveLock`) for longer than **`100 milliseconds`**.
2. **Concurrent Index Creation:** All large indexes
   (`idx_cog_mem_embedding_hnsw`) must use `CREATE INDEX CONCURRENTLY` in
   production environments to prevent blocking read/write queries.
3. **Data Loss Pre-condition:** Reversals must be tested against simulated
   candidate data, verifying that rollback scripts execute cleanly without
   database deadlocks.

_Signed: Lead Database Administrator (DBA) & Release Engineer — 2026-09-29_
