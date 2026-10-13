-- Roles the Alembic chain requires, on a vanilla PostgreSQL image.
--
-- 44 statements across the migration history grant to or create policies
-- `TO` these three roles: `postgres`, `authenticated` and `service_role`.
-- They exist because the schema was authored against Supabase, where they are
-- pre-provisioned. The local pgvector image is not Supabase and creates only
-- `POSTGRES_USER`, so `alembic upgrade head` aborted on
-- `role "service_role" does not exist` and the `api` service crash-looped on
-- restart without ever binding a port.
--
-- Mirrors `scripts/verify_pg_migrations.py:NONLOGIN_ROLES`. `authenticated`
-- and `service_role` are NOLOGIN: they exist only so `GRANT ... TO` and
-- `CREATE POLICY ... TO` resolve, exactly as on Supabase. They are never
-- login roles and must never gain a password.
--
-- `postgres` is the one exception: it is a LOGIN SUPERUSER here because the
-- image was initialised with POSTGRES_USER=vaeloom, so no `postgres` role
-- exists and `ALTER DEFAULT PRIVILEGES FOR ROLE postgres` has nothing to
-- attach to. That statement is skipped rather than fatal when absent, but
-- creating the role keeps the intended grants intact.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        CREATE ROLE postgres LOGIN SUPERUSER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
END
$$;