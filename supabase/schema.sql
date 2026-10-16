-- Gifts Stars Mini App — Supabase (Postgres) schema.
-- How to use: Supabase Dashboard → SQL Editor → paste & run.
-- NOTE: the app also auto-creates these tables on first run (see lib/db.ts),
-- so running this file is optional but recommended for a clean setup.
-- All access is server-side only (Next.js API routes); never expose the
-- connection string or service_role key to the browser.

CREATE TABLE IF NOT EXISTS gifts (
  id   TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id   TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  tg_id BIGINT PRIMARY KEY,
  data  JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS referrals (
  inviter BIGINT NOT NULL,
  invited BIGINT PRIMARY KEY,
  at      BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals (inviter);

CREATE TABLE IF NOT EXISTS kv (
  key  TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- RLS: keep enabled. The server connects with the privileged Postgres
-- connection string (server-only env DATABASE_URL), so API routes keep
-- working while direct anonymous access stays locked down.
ALTER TABLE gifts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE kv        ENABLE ROW LEVEL SECURITY;
-- No permissive policies for anon/authenticated on purpose:
-- the browser never talks to Supabase directly in this project.
