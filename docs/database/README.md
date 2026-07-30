# Database

> **Purpose:** Define Vaeloom's PostgreSQL-based data layer — schema, indexes, migrations, backup strategy, and operational runbooks
> **Status:** ✅ Upgraded to enterprise quality
> **Owner:** Backend Team
> **Version:** 1.0
> **Last Updated:** 2026-07-16

## Overview

The Database directory documents every aspect of Vaeloom's persistent data layer, built on PostgreSQL with a 9-core-table relational model. The documentation covers the complete stack: logical and physical schema design (ER diagram, data dictionary, DDL), index strategy (B-tree, composite, GIN), migration lifecycle (development, CI, production rollout, rollback), and operational runbooks (backup, replication, partitioning, query optimization). Every document follows enterprise documentation standards with clear purpose, scope, and audience definitions.

The data model revolves around a user → workspace → entity hierarchy with `workspace_id` as the universal tenant isolation key. Schema changes follow a rigorous four-phase migration lifecycle with zero-downtime patterns, and the indexing strategy is monitored through `pg_stat_user_indexes` to prevent over-indexing. Operational concerns scale from MVP (single-node PostgreSQL with daily backups) to enterprise (read replicas, hash partitioning at 50M+ rows, cross-region DR).

Key architectural decisions include UUID v7 primary keys, JSONB for semi-structured memory content, soft deletes throughout, append-only audit logs, and a three-replica streaming replication topology. The golden rule across all documents: measure before optimizing, verify every backup by restoring it, and never modify the schema directly in production.

## What's here

| Document | Location | Status |
|----------|----------|--------|
| Database Design | [`./Database-Design.md`](./Database-Design.md) | ✅ Excellent |
| Schema | [`./Schema.md`](./Schema.md) | ✅ Complete |
| ER Diagram | [`./ER-Diagram.md`](./ER-Diagram.md) | ✅ Complete |
| Data Dictionary | [`./Data-Dictionary.md`](./Data-Dictionary.md) | 🆕 New |
| Indexes | [`./Indexes.md`](./Indexes.md) | ✅ Good |
| Migrations | [`./Migrations.md`](./Migrations.md) | ✅ Good |
| Backups | [`./Backups.md`](./Backups.md) | ✅ Good |
| Replication | [`./Replication.md`](./Replication.md) | ✅ Good |
| Partitioning | [`./Partitioning.md`](./Partitioning.md) | ✅ Good |
| Optimization | [`./Optimization.md`](./Optimization.md) | ✅ Good |

## Related Documents

- [Architecture/Storage.md](../Architecture/Storage.md)
- [Architecture/Caching.md](../Architecture/Caching.md)
- [Backend/Queue.md](../Backend/Queue.md)
- [README.md](../README.md)
