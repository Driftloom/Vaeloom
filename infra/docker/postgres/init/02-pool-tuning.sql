-- Vaeloom PostgreSQL Connection Pool Tuning
-- Adjusts kernel and PostgreSQL settings for optimal connection pooling.

-- ─── Connection Pool Settings ───

-- Max concurrent connections (adjust based on workload)
ALTER SYSTEM SET max_connections = 100;

-- Connection pool sizing (for pgBouncer transaction pooling)
-- Reserve connections for superuser/admin access
ALTER SYSTEM SET superuser_reserved_connections = 5;

-- ─── Statement Timeouts ───

-- Abort any statement that takes longer than 30s
ALTER SYSTEM SET statement_timeout = 30000;

-- Abort idle transactions after 60s
ALTER SYSTEM SET idle_in_transaction_session_timeout = 60000;

-- ─── Resource Limits ───

-- Allow 1000 simultaneous prepared transactions max
ALTER SYSTEM SET max_prepared_transactions = 100;

-- Increase worker processes for parallel queries
ALTER SYSTEM SET max_worker_processes = 8;
ALTER SYSTEM SET max_parallel_workers = 8;
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;

-- ─── Connection Pooling Tuning ───

-- Disable < 1 second TCP keepalives for pooled connections
ALTER SYSTEM SET tcp_keepalives_idle = 60;
ALTER SYSTEM SET tcp_keepalives_interval = 10;
ALTER SYSTEM SET tcp_keepalives_count = 6;

-- ─── Memory Tuning for Pool ───

-- Shared buffers: 25% of RAM in production (default 128MB for dev)
ALTER SYSTEM SET shared_buffers = '256MB';

-- Work memory per query operation
ALTER SYSTEM SET work_mem = '16MB';

-- Maintenance work memory (for VACUUM, CREATE INDEX)
ALTER SYSTEM SET maintenance_work_mem = '128MB';

-- ─── Apply ───

SELECT pg_reload_conf();
