-- `cast_vote` RPC — Postgres-enforced 3/day cap + per-venue dedup (#126).
--
-- Root cause: the 3-vote/day cap and duplicate-vote rejection currently live
-- only in apps/api/src/services/vote.service.ts, a Fastify code path that
-- stays unpaid and undeployed for this beta (Railway trial expired, #78).
-- On the Supabase-native path the mobile app talks to Postgres directly with
-- the client-bundled anon key, so any cap enforced only in application code
-- is trivially bypassable — a client can call PostgREST's auto-generated
-- `POST /rest/v1/votes` directly and insert as many rows as it wants. The
-- cap has to live *inside the transaction* that writes the vote, which means
-- a `SECURITY DEFINER` RPC.
--
-- This migration also fixes a day-boundary inconsistency introduced by
-- landing #64 (04:00 city-local vote day) and #154 (0006, hotspot scoring)
-- as separate tickets: 0006's `recalculate_hotspot_scores()` still buckets
-- `daily_count` by raw `CURRENT_DATE` (UTC midnight), while the vote budget
-- (packages/shared-types/src/voteDay.ts, wired into vote.service.ts by #64)
-- resets at 04:00 America/New_York. A vote cast at, say, 9pm ET Friday counts
-- toward Friday's vote budget but Saturday's hotspot `daily_count` — two
-- different "days" driving numbers a user sees side by side (their remaining
-- votes vs. the trending list) for a 4-hour window every night. Fixed here by
-- introducing one canonical SQL vote-day function and pointing both
-- `cast_vote` and (via `CREATE OR REPLACE`, not editing the immutable 0006
-- file) `recalculate_hotspot_scores()` at it.
--
-- UNVERIFIED: nothing in this migration has been applied to project
-- gcixoqaxahuawklcqzyq (the Supabase MCP connector was not authorized for
-- this session). Verified instead against a scratch local Postgres 16 with
-- stubbed `auth.uid()`/`auth.users`/`anon`/`authenticated` roles — see the
-- backend-engineer's ticket report for the exact scenarios exercised
-- (cap exhaustion, dedup, global-not-per-city scope, `vote_count` increment,
-- the 03:59:59/04:00:00 boundary, and ACL survival across `CREATE OR
-- REPLACE`). `pg_cron`/`postgis` availability remain unconfirmed on the live
-- project per 0006's existing UNVERIFIED notes; this migration doesn't touch
-- either.

-- ============================================================================
-- 1. public.vote_day(at, tz) — canonical Postgres vote-day boundary
-- ============================================================================
--
-- Mirrors packages/shared-types/src/voteDay.ts's `voteDayFor` exactly: the
-- vote day is the local calendar date in `tz`, except that local hours
-- before VOTE_DAY_CUTOFF_HOUR (04:00) belong to the *previous* day's vote
-- day. `(at AT TIME ZONE tz)` converts the timestamptz instant to a naive
-- timestamp holding `tz`'s wall-clock reading (Postgres resolves this from
-- the same IANA tzdata JS's Intl.DateTimeFormat uses, so the two stay in
-- lockstep across DST transitions without reimplementing zoned-parts logic
-- in SQL); subtracting 4 hours before truncating to a date is equivalent to
-- "if local hour < 4, use yesterday's date" — a wall-clock time of
-- 03:59:59 shifts back across midnight into the previous calendar date,
-- while 04:00:00 does not.
--
-- `tz` defaults to 'America/New_York', matching
-- DEFAULT_VOTE_DAY_TIMEZONE in voteDay.ts — the API has no per-user
-- "currently selected city" to resolve a real per-user timezone from (no
-- `cityId` on `users`, no city param on the vote endpoints; see
-- docs/architecture/DESIGN_DECISIONS.md, "Vote-Day Boundary"), and all four
-- active cities are America/New_York today, so this default is behaviorally
-- correct rather than a placeholder that silently diverges from callers
-- that do pass an explicit city timezone (e.g. a future per-city caller
-- would pass `c.timezone` instead of relying on the default).
--
-- STABLE (not IMMUTABLE): the result is a function of `at`/`tz` plus
-- Postgres's tzdata, which can change out from under a running server —
-- the standard classification for any timezone-conversion function.
--
-- No SECURITY DEFINER, no REVOKE/GRANT: this function touches no tables and
-- carries no privilege of its own — it's pure date arithmetic over its
-- arguments, safe for any role (including `anon`) to call directly, same as
-- built-ins like `now()`.
CREATE OR REPLACE FUNCTION public.vote_day(
  at timestamptz DEFAULT now(),
  tz text DEFAULT 'America/New_York'
)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT ((at AT TIME ZONE tz) - interval '4 hours')::date;
$$;

-- ============================================================================
-- 2. Re-point 0006's recalculate_hotspot_scores() at the same vote day
-- ============================================================================
--
-- 0006_hotspot_score_pg_cron.sql is an applied-migration record and stays
-- immutable; this uses CREATE OR REPLACE to update the function it defined
-- in place, same pattern as any other `public.*` function fix. Only the
-- `daily_count`/`historical_avg` filters change, from raw `CURRENT_DATE`
-- (UTC) to `public.vote_day(now())` (04:00 America/New_York) — the same
-- boundary `votes.voted_at` values are already bucketed by (see
-- apps/api/src/services/vote.service.ts's `today()` / this migration's
-- `cast_vote`, both of which write `voted_at` as a vote-day date, never a
-- raw calendar date). `velocity` is untouched — it's a rolling 60-minute
-- window off `created_at`, a timestamptz, with no day-boundary concept to
-- align.
CREATE OR REPLACE FUNCTION public.recalculate_hotspot_scores()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH today AS (
    SELECT public.vote_day(now()) AS d
  ),
  vote_stats AS (
    SELECT
      venue_id,
      count(*) FILTER (WHERE voted_at = (SELECT d FROM today)) AS daily_count,
      count(*) FILTER (WHERE created_at >= now() - interval '60 minutes') AS velocity,
      count(*) FILTER (WHERE voted_at > (SELECT d FROM today) - interval '7 days') / 7.0 AS historical_avg
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
  UPDATE venues v
  SET
    hotspot_score = scored.new_score,
    is_trending = scored.new_score >= 80,
    updated_at = now()
  FROM scored
  WHERE v.id = scored.id;
$$;

-- CREATE OR REPLACE preserves the existing ACL (same OID, same signature),
-- so 0006's REVOKE-then-GRANT-to-postgres already survives this replace.
-- Re-issued anyway so this migration is self-contained and idempotent on
-- its own re-run, without depending on 0006 having left the ACL in the
-- expected state (verified locally — see ticket report).
REVOKE EXECUTE ON FUNCTION public.recalculate_hotspot_scores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_hotspot_scores() TO postgres;

-- ============================================================================
-- 3. cast_vote(p_venue_id) — the write path
-- ============================================================================
--
-- Enforces, atomically, inside one transaction:
--   - global 3-votes/day/user cap (#62/#134 — not per-city)
--   - one vote per user per venue per vote-day (dedup)
-- then inserts the vote and maintains the denormalized `venues.vote_count`
-- counter, which #154 (0006) deliberately left for this ticket to own —
-- `recalculate_hotspot_scores()` only ever reads `votes`, never writes
-- `vote_count`, so there's no other writer to race with.
--
-- Identity: `auth.uid()` is the *only* source of the voter's identity — no
-- user id is accepted as a parameter, which would let any caller vote as
-- anyone. `anon` callers never reach the body: EXECUTE is revoked from
-- `anon` below, and PostgREST/Postgres reject the call before auth.uid()
-- is ever evaluated. `authenticated` covers both linked accounts and
-- Supabase anonymous-sign-in sessions (the beta's actual users) — both
-- carry a real `auth.uid()`, just with different claims.
--
-- Concurrency: the daily cap is a COUNT-then-INSERT, which on its own is a
-- classic TOCTOU race — two concurrent cast_vote calls from the same user
-- could both read count=2 and both insert a 3rd vote, breaching the cap.
-- `pg_advisory_xact_lock`, keyed on (user, vote day), serializes concurrent
-- casts from the *same* user for the lock's duration (auto-released at
-- transaction end) without taking a table-level lock that would serialize
-- unrelated users' votes against each other. Per-venue duplicate votes are
-- additionally backstopped by the `votes_user_venue_date_idx` unique index
-- (0000_redundant_excalibur.sql) — the explicit dedup check below is the
-- normal path, but a second layer (the unique_violation handler) exists in
-- case two requests ever land on either side of the advisory lock's tiny
-- acquisition window.
--
-- Hardening: same as 0006 — `search_path` pinned to `public, pg_temp` (with
-- `pg_temp` listed explicitly last, so a same-named temp table can't shadow
-- `public.votes`/`public.venues` and redirect this definer-privileged
-- function's reads/writes), and EXECUTE revoked from PUBLIC then granted
-- only to `authenticated` (not `anon` — see identity note above; not
-- `postgres`/`service_role`, which don't need this RPC and already have
-- broader access via Supabase's default schema grants).
--
-- Error contract: mirrors apps/api/src/services/vote.service.ts's VoteError
-- codes exactly, so the mobile client's onError handler can match against
-- the same strings it already does in mock mode (apps/mobile/src/api/votes.ts).
-- PostgREST surfaces a `RAISE EXCEPTION ... USING MESSAGE = 'CODE', DETAIL =
-- '...'` as `{ message: 'CODE', details: '...', ... }` in the RPC's error
-- response, so `error.message` is exactly one of 'NO_VOTES_REMAINING',
-- 'ALREADY_VOTED', or 'VENUE_NOT_FOUND' — an exact-match check, not a
-- substring/prefix parse. 'AUTH_REQUIRED' is a defensive extra (auth.uid()
-- returning null despite passing the `authenticated`-only EXECUTE grant)
-- with no matching VoteError code today, since Fastify's `authenticate`
-- decorator currently rejects unauthenticated requests before VoteService
-- ever runs.
CREATE OR REPLACE FUNCTION public.cast_vote(p_venue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_max_daily_votes CONSTANT int := 3;
  c_tz CONSTANT text := 'America/New_York'; -- DEFAULT_VOTE_DAY_TIMEZONE fallback, see header
  v_user_id uuid := auth.uid();
  v_vote_day date;
  v_vote_count int;
  v_already_voted boolean;
  v_venue_exists boolean;
  v_voted_venue_ids jsonb;
  v_reset_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = 'AUTH_REQUIRED',
      DETAIL = 'A valid Supabase session is required to vote.',
      ERRCODE = 'P0001';
  END IF;

  v_vote_day := public.vote_day(now(), c_tz);

  -- Serialize concurrent casts from this user for this vote day; see the
  -- concurrency note above. hashtext() gives a well-distributed int4 key
  -- from arbitrary text without needing an extension.
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(v_vote_day::text));

  SELECT count(*) INTO v_vote_count
  FROM public.votes
  WHERE user_id = v_user_id AND voted_at = v_vote_day;

  IF v_vote_count >= c_max_daily_votes THEN
    RAISE EXCEPTION USING
      MESSAGE = 'NO_VOTES_REMAINING',
      DETAIL = 'You have used all your votes for today.',
      ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.votes
    WHERE user_id = v_user_id AND venue_id = p_venue_id AND voted_at = v_vote_day
  ) INTO v_already_voted;

  IF v_already_voted THEN
    RAISE EXCEPTION USING
      MESSAGE = 'ALREADY_VOTED',
      DETAIL = 'You have already voted for this venue today.',
      ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.venues WHERE id = p_venue_id) INTO v_venue_exists;
  IF NOT v_venue_exists THEN
    RAISE EXCEPTION USING
      MESSAGE = 'VENUE_NOT_FOUND',
      DETAIL = 'Venue not found.',
      ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.votes (user_id, venue_id, voted_at)
    VALUES (v_user_id, p_venue_id, v_vote_day);
  EXCEPTION WHEN unique_violation THEN
    -- Belt-and-suspenders: see the concurrency note above. The explicit
    -- check above is the normal path; this only fires if two requests
    -- somehow land on either side of the advisory lock.
    RAISE EXCEPTION USING
      MESSAGE = 'ALREADY_VOTED',
      DETAIL = 'You have already voted for this venue today.',
      ERRCODE = 'P0001';
  END;

  UPDATE public.venues
  SET vote_count = vote_count + 1, updated_at = now()
  WHERE id = p_venue_id;

  SELECT count(*), coalesce(jsonb_agg(venue_id), '[]'::jsonb)
  INTO v_vote_count, v_voted_venue_ids
  FROM public.votes
  WHERE user_id = v_user_id AND voted_at = v_vote_day;

  v_reset_at := ((v_vote_day + 1)::text || ' 04:00:00')::timestamp AT TIME ZONE c_tz;

  RETURN jsonb_build_object(
    'remainingVotes', GREATEST(0, c_max_daily_votes - v_vote_count),
    'maxVotes', c_max_daily_votes,
    'votedVenueIds', v_voted_venue_ids,
    'resetAt', to_char(v_reset_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS."000Z"')
  );
END;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, and Supabase auto-exposes
-- public-schema functions as PostgREST RPC endpoints — without this REVOKE,
-- `POST /rest/v1/rpc/cast_vote` would be callable by anyone holding the
-- client-bundled anon key. Granting to `authenticated` (not `anon`) is
-- deliberate: Supabase's `anon` role is unauthenticated traffic, while both
-- linked-account users and this beta's anonymous-sign-in users carry the
-- `authenticated` role with a real `auth.uid()` — granting to `anon` would
-- let unauthenticated callers vote, and granting to any narrower subset
-- would break voting for the beta's actual (anonymous-sign-in) users.
REVOKE EXECUTE ON FUNCTION public.cast_vote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cast_vote(uuid) TO authenticated;
