-- Vaeloom Database Partitioning
-- Time-based partitioning for high-volume tables
-- Run AFTER Prisma migrations have created the base tables.
-- Converts flat tables to partitioned tables (requires table rebuild).

-- ─── Helper: Create a monthly partition ───

CREATE OR REPLACE FUNCTION create_monthly_partition(
  parent_table TEXT,
  partition_date DATE
) RETURNS void AS $$
DECLARE
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  partition_name := parent_table || '_' || to_char(partition_date, 'YYYY_MM');
  start_date := to_char(partition_date, 'YYYY-MM-01');
  end_date := to_char(partition_date + INTERVAL '1 month', 'YYYY-MM-01');

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
      partition_name, parent_table, start_date, end_date
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ─── 1. Events — monthly partitions (by created_at) ───

-- Rename existing table, create partitioned replacement, migrate data
ALTER TABLE IF EXISTS events RENAME TO events_flat;

CREATE TABLE events (
  LIKE events_flat INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES
) PARTITION BY RANGE (created_at);

-- Drop indexes that conflict with partition structure, rebuild later
DROP INDEX IF EXISTS idx_events_tenant_type;
DROP INDEX IF EXISTS idx_events_tenant_status;
DROP INDEX IF EXISTS idx_events_correlation_id;

-- Create initial monthly partitions for 2024-2026
SELECT create_monthly_partition('events', '2024-01-01');
SELECT create_monthly_partition('events', '2024-02-01');
SELECT create_monthly_partition('events', '2024-03-01');
SELECT create_monthly_partition('events', '2024-04-01');
SELECT create_monthly_partition('events', '2024-05-01');
SELECT create_monthly_partition('events', '2024-06-01');
SELECT create_monthly_partition('events', '2024-07-01');
SELECT create_monthly_partition('events', '2024-08-01');
SELECT create_monthly_partition('events', '2024-09-01');
SELECT create_monthly_partition('events', '2024-10-01');
SELECT create_monthly_partition('events', '2024-11-01');
SELECT create_monthly_partition('events', '2024-12-01');
SELECT create_monthly_partition('events', '2025-01-01');
SELECT create_monthly_partition('events', '2025-02-01');
SELECT create_monthly_partition('events', '2025-03-01');
SELECT create_monthly_partition('events', '2025-04-01');
SELECT create_monthly_partition('events', '2025-05-01');
SELECT create_monthly_partition('events', '2025-06-01');
SELECT create_monthly_partition('events', '2025-07-01');
SELECT create_monthly_partition('events', '2025-08-01');
SELECT create_monthly_partition('events', '2025-09-01');
SELECT create_monthly_partition('events', '2025-10-01');
SELECT create_monthly_partition('events', '2025-11-01');
SELECT create_monthly_partition('events', '2025-12-01');
SELECT create_monthly_partition('events', '2026-01-01');
SELECT create_monthly_partition('events', '2026-02-01');
SELECT create_monthly_partition('events', '2026-03-01');
SELECT create_monthly_partition('events', '2026-04-01');
SELECT create_monthly_partition('events', '2026-05-01');
SELECT create_monthly_partition('events', '2026-06-01');
SELECT create_monthly_partition('events', '2026-07-01');
SELECT create_monthly_partition('events', '2026-08-01');
SELECT create_monthly_partition('events', '2026-09-01');
SELECT create_monthly_partition('events', '2026-10-01');
SELECT create_monthly_partition('events', '2026-11-01');
SELECT create_monthly_partition('events', '2026-12-01');

-- Migrate existing data (safe for append-only event store)
INSERT INTO events SELECT * FROM events_flat;
DROP TABLE events_flat;

-- Rebuild indexes on the partitioned parent (applies to all partitions)
CREATE INDEX IF NOT EXISTS idx_events_tenant_type ON events (tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_events_tenant_status ON events (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_events_correlation_id ON events (correlation_id);

-- ─── 2. Agent Actions — monthly partitions ───

ALTER TABLE IF EXISTS agent_actions RENAME TO agent_actions_flat;

CREATE TABLE agent_actions (
  LIKE agent_actions_flat INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES
) PARTITION BY RANGE (created_at);

DROP INDEX IF EXISTS idx_agent_actions_workspace_created;
DROP INDEX IF EXISTS idx_agent_actions_workspace_agent;

SELECT create_monthly_partition('agent_actions', '2024-01-01');
SELECT create_monthly_partition('agent_actions', '2024-02-01');
SELECT create_monthly_partition('agent_actions', '2024-03-01');
SELECT create_monthly_partition('agent_actions', '2024-04-01');
SELECT create_monthly_partition('agent_actions', '2024-05-01');
SELECT create_monthly_partition('agent_actions', '2024-06-01');
SELECT create_monthly_partition('agent_actions', '2024-07-01');
SELECT create_monthly_partition('agent_actions', '2024-08-01');
SELECT create_monthly_partition('agent_actions', '2024-09-01');
SELECT create_monthly_partition('agent_actions', '2024-10-01');
SELECT create_monthly_partition('agent_actions', '2024-11-01');
SELECT create_monthly_partition('agent_actions', '2024-12-01');
SELECT create_monthly_partition('agent_actions', '2025-01-01');
SELECT create_monthly_partition('agent_actions', '2025-02-01');
SELECT create_monthly_partition('agent_actions', '2025-03-01');
SELECT create_monthly_partition('agent_actions', '2025-04-01');
SELECT create_monthly_partition('agent_actions', '2025-05-01');
SELECT create_monthly_partition('agent_actions', '2025-06-01');
SELECT create_monthly_partition('agent_actions', '2025-07-01');
SELECT create_monthly_partition('agent_actions', '2025-08-01');
SELECT create_monthly_partition('agent_actions', '2025-09-01');
SELECT create_monthly_partition('agent_actions', '2025-10-01');
SELECT create_monthly_partition('agent_actions', '2025-11-01');
SELECT create_monthly_partition('agent_actions', '2025-12-01');
SELECT create_monthly_partition('agent_actions', '2026-01-01');
SELECT create_monthly_partition('agent_actions', '2026-02-01');
SELECT create_monthly_partition('agent_actions', '2026-03-01');
SELECT create_monthly_partition('agent_actions', '2026-04-01');
SELECT create_monthly_partition('agent_actions', '2026-05-01');
SELECT create_monthly_partition('agent_actions', '2026-06-01');
SELECT create_monthly_partition('agent_actions', '2026-07-01');
SELECT create_monthly_partition('agent_actions', '2026-08-01');
SELECT create_monthly_partition('agent_actions', '2026-09-01');
SELECT create_monthly_partition('agent_actions', '2026-10-01');
SELECT create_monthly_partition('agent_actions', '2026-11-01');
SELECT create_monthly_partition('agent_actions', '2026-12-01');

INSERT INTO agent_actions SELECT * FROM agent_actions_flat;
DROP TABLE agent_actions_flat;

CREATE INDEX IF NOT EXISTS idx_agent_actions_workspace_created
  ON agent_actions (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_actions_workspace_agent
  ON agent_actions (workspace_id, agent_name);

-- ─── 3. Notifications — list partitioning by type ───
-- Notifications table is NOT managed by Prisma — create standalone.

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  tenant_id UUID,
  user_id UUID,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY LIST (type);

CREATE TABLE IF NOT EXISTS notifications_email PARTITION OF notifications FOR VALUES IN ('email');
CREATE TABLE IF NOT EXISTS notifications_sms PARTITION OF notifications FOR VALUES IN ('sms');
CREATE TABLE IF NOT EXISTS notifications_push PARTITION OF notifications FOR VALUES IN ('push');
CREATE TABLE IF NOT EXISTS notifications_slack PARTITION OF notifications FOR VALUES IN ('slack');
CREATE TABLE IF NOT EXISTS notifications_in_app PARTITION OF notifications FOR VALUES IN ('in_app');
CREATE TABLE IF NOT EXISTS notifications_webhook PARTITION OF notifications FOR VALUES IN ('webhook');
CREATE TABLE IF NOT EXISTS notifications_other PARTITION OF notifications DEFAULT;

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_read
  ON notifications (tenant_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, read, created_at DESC);

-- ─── 4. Maintenance: auto-create future partitions ───

CREATE OR REPLACE FUNCTION maintain_partitions() RETURNS void AS $$
DECLARE
  next_month DATE;
  i INT;
BEGIN
  FOR i IN 0..2 LOOP
    next_month := date_trunc('month', now()) + (i + 1) * INTERVAL '1 month';
    PERFORM create_monthly_partition('events', next_month);
    PERFORM create_monthly_partition('agent_actions', next_month);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('partition-maintenance', '0 0 1 * *', 'SELECT maintain_partitions();');
  END IF;
END;
$$;
