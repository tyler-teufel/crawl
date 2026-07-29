-- Postgres-native hotspot score recalculation (#154).
--
-- Root cause: `hotspot_score` (and `vote_count`) were only ever maintained by
-- the hourly node-cron job in apps/api/src/jobs/recalculate-scores.ts, which
-- runs in-process inside the Fastify API. That API is not deployed for this
-- beta (Railway trial expired, unpaid) — so on the Supabase-native path
-- nothing ever recomputes `hotspot_score`, and all 240 active venues sit at
-- the column default of 0.
--
-- Fix: a SECURITY DEFINER function ports the formula documented at the top
-- of recalculate-scores.ts, scheduled hourly via pg_cron so it keeps running
-- with no Fastify host required. `vote_count` is intentionally left alone —
-- that column's writer is #126's `cast_vote` RPC, not this migration; this
-- function only *reads* votes to derive the score, it never writes
-- `vote_count`.
--
-- UNVERIFIED: pg_cron availability on project gcixoqaxahuawklcqzyq's Supabase
-- plan has not been confirmed (the Supabase MCP connector was not authorized
-- for this session, so nothing here has been checked against the live
-- database). Confirm the extension is available before applying this
-- migration; if it isn't, the schedule step below will fail loudly at
-- `CREATE EXTENSION`, before anything else runs.
--
-- UNVERIFIED: which role `cron.schedule` executes this job as on this
-- project. Below we grant EXECUTE only to `postgres` (the role Supabase's
-- direct/session-pooler connection — and therefore this migration — runs
-- as). If pg_cron jobs run as a different role on this project, the
-- scheduled call will fail with "permission denied for function" and the
-- GRANT must be repointed at that role before the schedule will work.

-- ============================================================================
-- 1. pg_cron extension
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- 2. Scoring function
-- ============================================================================
--
-- Ports the "Phase 2" formula from recalculate-scores.ts:
--   score = (velocity * 0.4) + (dailyCount * 0.3) + (historicalAvg * 0.2)
--           + (externalRating * 0.1)
--
-- Signal definitions (matching the doc comment's "today's vote count, hourly
-- velocity, 7-day rolling average, external rating"):
--   velocity      = votes in the last 60 minutes
--   dailyCount    = votes today (voted_at = current_date)
--   historicalAvg = votes strictly after (CURRENT_DATE - 7 days) — i.e. the
--                    7 calendar days ending today, not 8 — averaged per day.
--                    (`>=` against the 7-days-ago midnight boundary would
--                    include an 8th day and inflate this term ~14%.)
--   externalRating = the venue's Google rating, normalized from its native
--                    0-5 scale to 0-100 before the 0.1 weight is applied.
--
-- Deviation from a literal port: the source comment gives externalRating as
-- the raw 0-5 Google value. Multiplying that directly by 0.1 caps the entire
-- pre-vote contribution at 0.5, which rounds to 0 for every venue and
-- reproduces exactly the "every score is 0" bug this migration exists to
-- fix. Normalizing to 0-100 first (consistent with "scores are normalized
-- 0-100" and with dailyCount/velocity/historicalAvg being counts on a
-- comparable order of magnitude once voting starts) gives each active venue
-- a 0-10 point baseline driven by its rating, which is what acceptance
-- criteria asks for. velocity/dailyCount/historicalAvg are ported as literal
-- unnormalized counts per the source comment — with zero votes cast so far
-- they don't affect today's output either way, and choosing a cap for them
-- would be speculative ahead of real vote volume.
--
-- Hardening on this SECURITY DEFINER function:
--   - `search_path` is pinned to `public, pg_temp` with `pg_temp` explicitly
--     last. Postgres implicitly searches the caller's temp schema *before*
--     any configured search_path unless pg_temp is listed — so omitting it
--     (as opposed to merely setting `search_path = public`) would let any
--     role with ordinary TEMP privilege (granted to PUBLIC by default,
--     which includes Supabase's `anon`/`authenticated`) shadow `votes` with
--     a same-named temp table and feed arbitrary counts into the UPDATE
--     below, running as this function's owner. Listing `pg_temp` last
--     forces `public.votes`/`public.venues` to resolve first.
--   - EXECUTE is revoked from PUBLIC and granted only to the role this
--     migration runs as (see the UNVERIFIED note above). Without this,
--     Postgres's default EXECUTE-to-PUBLIC grant plus Supabase's automatic
--     PostgREST exposure of public-schema functions would make this
--     callable as an unauthenticated RPC (`POST /rest/v1/rpc/...`) by
--     anyone holding the anon key — itself sufficient to trigger an
--     unbounded full-table `UPDATE` on demand, independent of the
--     search_path issue above.
CREATE OR REPLACE FUNCTION public.recalculate_hotspot_scores()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH vote_stats AS (
    SELECT
      venue_id,
      count(*) FILTER (WHERE voted_at = CURRENT_DATE) AS daily_count,
      count(*) FILTER (WHERE created_at >= now() - interval '60 minutes') AS velocity,
      count(*) FILTER (WHERE voted_at > CURRENT_DATE - interval '7 days') / 7.0 AS historical_avg
    FROM votes
    GROUP BY venue_id
  ),
  scored AS (
    SELECT
      v.id,
      LEAST(100, GREATEST(0, ROUND(
        (COALESCE(vs.velocity, 0) * 0.4)
        + (COALESCE(vs.daily_count, 0) * 0.3)
        + (COALESCE(vs.historical_avg, 0) * 0.2)
        + ((COALESCE(v.rating, 0) / 5.0) * 100 * 0.1)
      )))::int AS new_score
    FROM venues v
    LEFT JOIN vote_stats vs ON vs.venue_id = v.id
    WHERE v.is_active = true
  )
  -- NOTE: this touches updated_at for every active venue on every run,
  -- whether or not its score actually changed — anything keyed off
  -- venues.updated_at will see a change event for all ~240 rows hourly.
  UPDATE venues v
  SET
    hotspot_score = scored.new_score,
    is_trending = scored.new_score >= 80,
    updated_at = now()
  FROM scored
  WHERE v.id = scored.id;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and Supabase auto-exposes
-- public-schema functions as PostgREST RPC endpoints — without this REVOKE,
-- anyone holding the client-bundled anon key could call this as an
-- unauthenticated RPC and force an unbounded recalculation on demand.
REVOKE EXECUTE ON FUNCTION public.recalculate_hotspot_scores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_hotspot_scores() TO postgres;

-- ============================================================================
-- 3. Hourly schedule, same cadence as the old node-cron job ('0 * * * *')
-- ============================================================================
--
-- cron.schedule() upserts by job name in current pg_cron versions, but we
-- unschedule first so this migration is safe to re-run against a project
-- that already has a same-named job from a partially-applied prior attempt.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recalculate-hotspot-scores') THEN
    PERFORM cron.unschedule('recalculate-hotspot-scores');
  END IF;
END $$;

SELECT cron.schedule(
  'recalculate-hotspot-scores',
  '0 * * * *',
  $$SELECT public.recalculate_hotspot_scores();$$
);

-- ============================================================================
-- 4. Seed a non-zero baseline immediately, so the leaderboard isn't flat at 0
--    from now until the first scheduled run.
-- ============================================================================

SELECT public.recalculate_hotspot_scores();
