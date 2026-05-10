-- Wipes ALL data and objects in public. Use only on disposable Supabase/staging DBs.
-- Requires DIRECT_URL in .env (prisma.config.ts datasource).
-- If GRANT ... anon fails (non-Supabase Postgres), remove the last line.

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
