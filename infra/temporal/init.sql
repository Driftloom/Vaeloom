-- Auto-create temporal_visibility role for worker compatibility.
-- This runs as the initial script when temporal-db starts fresh.
CREATE ROLE temporal_visibility WITH LOGIN PASSWORD 'temporal_visibility';
GRANT ALL PRIVILEGES ON DATABASE temporal TO temporal_visibility;
