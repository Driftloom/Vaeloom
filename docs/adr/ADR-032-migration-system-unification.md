# ADR-032: Migration System Unification

| Metadata     | Value                            |
| ------------ | -------------------------------- |
| **Status**   | Accepted                         |
| **Date**     | 2026-08-16                       |
| **Deciders** | Backend Lead, Database Architect |
| **Owner**    | Backend Team                     |
| **Tags**     | database, migrations, alembic    |

## Context

Vaeloom has two competing migration systems:

1. **Alembic** (`alembic/versions/`) — industry-standard, 6 migrations
2. **Custom runner** (`src/api/migrations/`) — hand-rolled, 6 migrations

This dual system creates:

- Confusion about which system is authoritative
- Risk of conflicting version histories
- Maintenance burden for two systems
- No clear rollback strategy

## Decision

We will standardize on **Alembic** as the sole migration system.

### Migration History Reconciliation

| Version | Alembic                       | Custom                        | Action                         |
| ------- | ----------------------------- | ----------------------------- | ------------------------------ |
| 0001    | `0001_initial_schema.py`      | N/A (create_all)              | Keep Alembic                   |
| 0002    | `0002_microservice_tables.py` | `0002_microservice_tables.py` | Keep Alembic (duplicate)       |
| 0003    | `0003_approval_tables.py`     | `0003_approvals.py`           | Keep Alembic                   |
| 0004    | `0004_memory_taxonomy.py`     | `0004_memory_taxonomy.py`     | Keep Alembic                   |
| 0005    | `0005_rls_expanded.py`        | `0005_rls.py`                 | Keep Alembic                   |
| 0006    | `0006_provenance.py`          | `0006_idempotency.py`         | Keep Alembic (different scope) |
| 0007    | N/A                           | `0007_gmail_watch.py`         | Add to Alembic                 |

### Implementation

1. **Add missing migration to Alembic**: Create `0007_gmail_watch.py` in
   `alembic/versions/`
2. **Update main.py**: Use `alembic.command.upgrade()` instead of custom runner
3. **Keep custom runner for backward compatibility**: Don't delete yet;
   deprecate
4. **Update ADR-015**: Reflect the unification decision

## Rationale

| Alternative                     | Pros                                        | Cons                              | Why Not        |
| ------------------------------- | ------------------------------------------- | --------------------------------- | -------------- |
| Keep both systems               | No migration needed                         | Confusion, conflicts, maintenance | —              |
| Remove Alembic, keep custom     | No external dependency                      | Non-standard, harder to onboard   | —              |
| Standardize on Alembic (chosen) | Industry standard, well-documented, tooling | Initial reconciliation effort     | Best long-term |

## Consequences

**Positive:**

- Single source of truth for migrations
- Standard tooling (alembic CLI, migration autogenerate)
- Easier onboarding for new developers
- Clear rollback strategy

**Negative:**

- Must reconcile version history (one-time effort)
- Custom runner code becomes dead code (deprecate, don't delete yet)

**Risks:**

- Database may have migrations from both systems applied (mitigate with version
  check)

## Verification

1. `alembic heads` — single head revision
2. `alembic history` — clean, linear history
3. No references to custom runner in production code paths

## Related ADRs

- ADR-015: Alembic Migrations (original decision)

## Reversibility

Moderate — requires database version reconciliation. Rollback:

1. Revert main.py to use custom runner
2. No data migration needed
