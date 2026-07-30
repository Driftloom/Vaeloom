-- Vaeloom pgvector + Apache AGE Setup
-- Per Docs/Database/Schema.md, Implementation/02
--
-- Run AFTER Prisma migrations have created the base tables.
-- This script enables extensions and creates the vector index.

-- ─── Extensions ───

-- pgvector for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Apache AGE for graph queries (optional — skip if not installed)
-- AGE requires separate installation on the Postgres server.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'age') THEN
    CREATE EXTENSION IF NOT EXISTS age;
    -- Load AGE into the search path so Cypher functions are available
    SET search_path = ag_catalog, "$user", public;
  END IF;
END $$;

-- ─── Vector Index ───

-- IVFFlat index for MVP; HNSW planned for enterprise scale.
-- The `lists` parameter should be sqrt(row_count). Starting with 100 for MVP.
-- Rebuild with higher value as embedding count grows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_embeddings_vector_ivfflat'
  ) THEN
    CREATE INDEX idx_embeddings_vector_ivfflat
      ON embeddings
      USING ivfflat (vector vector_cosine_ops)
      WITH (lists = 100);
  END IF;
END $$;

-- ─── AGE Graph ───

-- Create the knowledge graph in AGE (mirrors entities/relationships tables).
-- Entities → vertices, Relationships → edges.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'age') THEN
    -- Create graph if it doesn't exist
    PERFORM ag_catalog.create_graph('vaeloom_knowledge');
  EXCEPTION
    WHEN OTHERS THEN
      -- Graph may already exist
      NULL;
  END IF;
END $$;

-- ─── Append-Only Audit Log Protection ───

-- Prevent UPDATE and DELETE on agent_actions (audit log).
-- Per Docs/Security/Audit-Logs.md: immutability enforced at DB level.
CREATE OR REPLACE FUNCTION prevent_agent_action_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'agent_actions is append-only: UPDATE and DELETE are prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_actions_no_update ON agent_actions;
CREATE TRIGGER trg_agent_actions_no_update
  BEFORE UPDATE ON agent_actions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_agent_action_mutation();

DROP TRIGGER IF EXISTS trg_agent_actions_no_delete ON agent_actions;
CREATE TRIGGER trg_agent_actions_no_delete
  BEFORE DELETE ON agent_actions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_agent_action_mutation();
