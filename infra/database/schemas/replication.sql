-- Vaeloom Streaming Replication Configuration
-- ==============================================
-- This file configures PostgreSQL logical replication for Vaeloom.
-- Run on the PRIMARY database to set up WAL-level logical replication
-- and publish relevant tables for consumption by read replicas,
-- analytics pipelines, and change-data-capture (CDC) consumers.
--
-- Usage:
--   1. Run this SQL on the primary (or include in postgresql.conf).
--   2. On each replica, create a SUBSCRIPTION pointing to this publication.
--   3. Ensure replicas have hot_standby = on for read-only queries.
--
-- Security:
--   - Use a dedicated replication user with the REPLICATION role.
--   - Replication connections should use SSL (hostssl in pg_hba.conf).
--   - Limit max_wal_senders to the number of expected replicas + 1.

-- ─── 1. WAL Level ───

ALTER SYSTEM SET wal_level = logical;

-- ─── 2. Hot Standby ───

ALTER SYSTEM SET hot_standby = on;

-- ─── 3. Max WAL Senders ───
-- Set to number of expected replicas + 1 buffer. Adjust based on your
-- replica count. Each active replication consumer uses one WAL sender.
-- Default is 10; minimum recommended for production with 2-3 replicas.

ALTER SYSTEM SET wal_keep_size = 1024;       -- 1 GB WAL retention for lagging replicas
ALTER SYSTEM SET max_wal_senders = 10;       -- supports up to 9 concurrent replicas
ALTER SYSTEM SET max_replication_slots = 10; -- must match or exceed max_wal_senders

-- ─── 4. Publication ───
-- Creates a publication that publishes INSERT, UPDATE, DELETE, and TRUNCATE
-- for the core Vaeloom tables. The publication name is used by all replicas.

DROP PUBLICATION IF EXISTS vaeloom_pub;

CREATE PUBLICATION vaeloom_pub FOR TABLE
    events,
    agent_actions,
    notifications,
    documents,
    memories
WITH (publish = 'insert, update, delete, truncate');

-- ─── 5. Subscription Template ───
-- Run this on each READ REPLICA to subscribe to the primary publication.
-- Replace placeholders with the actual primary connection details.
--
--   CREATE SUBSCRIPTION vaeloom_sub
--     CONNECTION 'host=<PRIMARY_HOST> port=5432 dbname=vaeloom user=replicator password=<REPLICA_PASS> sslmode=require'
--     PUBLICATION vaeloom_pub
--     WITH (
--       copy_data = true,              -- initial snapshot copy
--       connect = true,                -- connect immediately
--       create_slot = true,            -- create replication slot
--       enabled = true,                -- start replication immediately
--       slot_name = 'vaeloom_replica_slot'
--     );
--
-- To pause replication:
--   ALTER SUBSCRIPTION vaeloom_sub DISABLE;
--
-- To resume:
--   ALTER SUBSCRIPTION vaeloom_sub ENABLE;
--
-- To remove:
--   DROP SUBSCRIPTION vaeloom_sub;

-- ─── 6. Verification Queries ───

-- Check publication status (run on primary):
--   SELECT * FROM pg_publication;
--   SELECT * FROM pg_publication_tables WHERE pubname = 'vaeloom_pub';
--
-- Check replication slots (run on primary):
--   SELECT slot_name, slot_type, active, restart_lsn FROM pg_replication_slots;
--
-- Check WAL sender state (run on primary):
--   SELECT state, sync_state, replay_lag FROM pg_stat_replication;
--
-- Check subscription state (run on replica):
--   SELECT * FROM pg_stat_subscription;

-- ─── 7. Notes ───

-- IMPORTANT: After running ALTER SYSTEM commands, you must reload or restart
-- PostgreSQL for changes to take effect:
--   pg_ctl reload     -- for ALTER SYSTEM SET (reload)
--   pg_ctl restart    -- if changing wal_level (requires restart)
--
-- wal_level = logical requires a full PostgreSQL restart.
-- All other settings can be applied with a reload.
--
-- For zero-downtime WAL level changes on managed databases (RDS, Cloud SQL),
-- consult the provider's documentation for logical replication setup.
