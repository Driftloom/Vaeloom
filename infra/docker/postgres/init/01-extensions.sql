-- Vaeloom Postgres extensions. Runs once on first container init.
-- Enables vector similarity search (pgvector) and the graph store (Apache AGE).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS age;
LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- gen_random_uuid() lives in pgcrypto on some builds; ensure it is available.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
