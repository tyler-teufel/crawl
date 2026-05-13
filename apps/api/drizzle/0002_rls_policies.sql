-- Enable Row Level Security and add policies for all public tables.
--
-- Auth model: the mobile app uses Supabase Auth exclusively (anonymous sign-in
-- on boot, upgraded to Apple/Google via identity linking). auth.uid() therefore
-- returns the Supabase Auth UUID for every connected session.
--
-- Access pattern:
--   cities / venues  → read directly by the Supabase client (anon key)
--   users  / votes   → written by the API via the service-role key (bypasses RLS)
--                       reads may come from either path
--
-- Service-role connections always bypass RLS — no explicit policy needed for
-- the API's write paths.

-- ── Enable RLS ────────────────────────────────────────────────────────────────

ALTER TABLE cities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes   ENABLE ROW LEVEL SECURITY;

-- ── cities ────────────────────────────────────────────────────────────────────
-- Public reference data. Any session (including anonymous) may read.
-- Writes are service-role only (venue sync script).

CREATE POLICY "cities: public read"
  ON cities FOR SELECT
  USING (true);

-- ── venues ────────────────────────────────────────────────────────────────────
-- Public venue data. Any session may read.
-- Writes are service-role only (venue sync script).

CREATE POLICY "venues: public read"
  ON venues FOR SELECT
  USING (true);

-- ── users ─────────────────────────────────────────────────────────────────────
-- Users may read and update only their own row.
-- Inserts are service-role only (API /auth/register endpoint).

CREATE POLICY "users: read own"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users: update own"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- ── votes ─────────────────────────────────────────────────────────────────────
-- Users may read only their own votes.
-- Inserts and deletes are service-role only (API /votes endpoints enforce
-- daily-limit and ownership business logic).

CREATE POLICY "votes: read own"
  ON votes FOR SELECT
  USING (auth.uid() = user_id);
