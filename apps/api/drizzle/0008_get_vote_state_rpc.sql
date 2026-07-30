-- `get_vote_state` RPC — read the caller's own vote state from Postgres,
-- not the device (#196).
--
-- Root cause: #126 wired the vote *write* path to `cast_vote`, but the read
-- path (apps/mobile/src/api/votes.ts's `useVoteState`) still branches on
-- `hasApi` only. In the beta's actual shape (`EXPO_PUBLIC_API_URL` unset,
-- Supabase configured) `hasApi` is false, so every read falls through to
-- `getMockVoteState()`, backed by AsyncStorage — votes are written to
-- Postgres and read back from the device. A reinstall then appears to grant
-- a fresh daily budget while the server still holds the real count, the next
-- cast is rejected with `NO_VOTES_REMAINING` against a UI claiming votes
-- remain, two devices on one account disagree until each casts, and the
-- vote-day rollover is evaluated against local storage instead of the
-- server's boundary. Fixing the mobile branch is a follow-up ticket for the
-- client read path — this migration only ships the RPC it will call.
--
-- Shape: returns exactly the `VoteState` shape `cast_vote` already returns
-- (`{ remainingVotes, maxVotes, votedVenueIds, resetAt }`), so the mobile
-- client parses one shape regardless of which call produced it.
--
-- UNVERIFIED: nothing in this migration has been applied to project
-- gcixoqaxahuawklcqzyq (the Supabase MCP connector was not authorized for
-- this session). Verified instead against a scratch local Postgres 16 with
-- stubbed `auth.uid()`/`auth.users`/`anon`/`authenticated` roles and a
-- `"votes: read own"` RLS policy standing in for the live project's
-- (0002_rls_policies.sql) — see apps/api/tests/db/get-vote-state-rpc.test.ts
-- and the backend-engineer's ticket report for the exact scenarios exercised.

-- ============================================================================
-- 1. public.vote_max_daily_votes() — canonical vote cap
-- ============================================================================
--
-- `cast_vote` (0007) declared the 3-vote cap as a local `plpgsql` constant.
-- `get_vote_state` needs the identical value for its `maxVotes` field and its
-- `remainingVotes` calculation — hardcoding a second `3` literal here would
-- let the two drift silently, exactly the class of bug #64 already fixed
-- once for the vote-day boundary. One function, both callers.
--
-- No SECURITY DEFINER, no REVOKE/GRANT: like `vote_day()`, this touches no
-- tables and carries no privilege of its own — safe for any role to call.
CREATE OR REPLACE FUNCTION public.vote_max_daily_votes()
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT 3;
$$;

-- ============================================================================
-- 2. public.vote_reset_at(at, tz) — canonical resetAt instant
-- ============================================================================
--
-- `cast_vote` computed `v_reset_at` inline from `v_vote_day`. Duplicating
-- that expression in `get_vote_state` would risk the same two-implementations
-- drift `public.vote_day()` (0007) was introduced to eliminate for the
-- vote-day boundary itself — so this extracts the "next vote day's cutoff,
-- as an instant" computation once and both functions call it.
--
-- Built on `public.vote_day()`, not a second day computation: `at`'s vote day
-- plus one day, at the 04:00 `tz`-local cutoff. Same DST-gap assumption as
-- `cast_vote`'s original inline expression (VOTE_DAY_CUTOFF_HOUR never falls
-- inside the US 02:00 transition hour) — see 0007's `v_reset_at` comment.
--
-- STABLE, not IMMUTABLE, matching `vote_day()`: depends on Postgres's tzdata.
-- No SECURITY DEFINER, no REVOKE/GRANT: composed entirely of `vote_day()`
-- and date/interval arithmetic over its own arguments — no table access, no
-- privilege of its own.
CREATE OR REPLACE FUNCTION public.vote_reset_at(
  at timestamptz DEFAULT now(),
  tz text DEFAULT 'America/New_York'
)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT ((public.vote_day(at, tz) + 1)::text || ' 04:00:00')::timestamp AT TIME ZONE tz;
$$;

-- ============================================================================
-- 3. Re-point cast_vote(p_venue_id) at the shared helpers
-- ============================================================================
--
-- 0007_cast_vote_rpc.sql is an applied-migration record and stays immutable;
-- this uses CREATE OR REPLACE to update the function it defined in place,
-- same pattern 0007 itself used to re-point 0006's
-- recalculate_hotspot_scores() at public.vote_day(). Only two changes from
-- the 0007 body: `c_max_daily_votes` is now initialized from
-- `public.vote_max_daily_votes()` instead of the literal `3`, and
-- `v_reset_at` is computed via `public.vote_reset_at(now(), c_tz)` instead of
-- the inline expression. No other line changes — same cap enforcement, same
-- dedup, same advisory lock, same error contract.
CREATE OR REPLACE FUNCTION public.cast_vote(p_venue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_max_daily_votes CONSTANT int := public.vote_max_daily_votes();
  c_tz CONSTANT text := 'America/New_York'; -- DEFAULT_VOTE_DAY_TIMEZONE fallback, see 0007's header
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

  -- Serialize concurrent casts from this user for this vote day; see 0007's
  -- concurrency note.
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
  EXCEPTION
    WHEN unique_violation THEN
      -- Belt-and-suspenders: see 0007's concurrency note. The explicit check
      -- above is the normal path; this only fires if two requests somehow
      -- land on either side of the advisory lock.
      RAISE EXCEPTION USING
        MESSAGE = 'ALREADY_VOTED',
        DETAIL = 'You have already voted for this venue today.',
        ERRCODE = 'P0001';
    WHEN foreign_key_violation THEN
      -- The existence check above and this INSERT aren't atomic — a venue
      -- deleted in that window trips `votes_venue_id_venues_id_fk` instead.
      -- Translated to VENUE_NOT_FOUND so the error contract holds and the
      -- internal constraint name never reaches the PostgREST caller.
      RAISE EXCEPTION USING
        MESSAGE = 'VENUE_NOT_FOUND',
        DETAIL = 'Venue not found.',
        ERRCODE = 'P0001';
  END;

  UPDATE public.venues
  SET vote_count = vote_count + 1, updated_at = now()
  WHERE id = p_venue_id;

  SELECT count(*), coalesce(jsonb_agg(venue_id), '[]'::jsonb)
  INTO v_vote_count, v_voted_venue_ids
  FROM public.votes
  WHERE user_id = v_user_id AND voted_at = v_vote_day;

  v_reset_at := public.vote_reset_at(now(), c_tz);

  RETURN jsonb_build_object(
    'remainingVotes', GREATEST(0, c_max_daily_votes - v_vote_count),
    'maxVotes', c_max_daily_votes,
    'votedVenueIds', v_voted_venue_ids,
    'resetAt', to_char(v_reset_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS."000Z"')
  );
END;
$$;

-- CREATE OR REPLACE preserves the existing ACL (same OID, same signature).
-- Re-issued anyway, matching 0007's own precedent for
-- recalculate_hotspot_scores(), so this migration is self-contained.
REVOKE EXECUTE ON FUNCTION public.cast_vote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cast_vote(uuid) TO authenticated;

-- ============================================================================
-- 4. get_vote_state() — the read path
-- ============================================================================
--
-- Returns the caller's own vote state for the current vote day, in the
-- identical shape `cast_vote` returns, without writing anything.
--
-- SECURITY INVOKER (the default — no `SECURITY DEFINER` clause below), unlike
-- `cast_vote`. `cast_vote` needs definer privilege because it writes past
-- RLS's insert-nothing posture for `authenticated` (votes are inserted by
-- the API's service-role key or, now, this definer-privileged RPC — RLS on
-- `votes` only ever defines a SELECT policy, never INSERT/UPDATE/DELETE for
-- `authenticated`). A read of the caller's *own* votes needs no such
-- escalation: `0000_redundant_excalibur.sql` grants `authenticated` table
-- access the way every Supabase project does by default, and
-- `0002_rls_policies.sql`'s `"votes: read own"` policy
-- (`USING (auth.uid() = user_id)`) already restricts a SELECT run as
-- `authenticated` to exactly the caller's own rows. Running this function
-- SECURITY INVOKER gets that enforcement for free from the same policy
-- `cast_vote`'s SECURITY DEFINER path has to defensively re-check with an
-- explicit `WHERE user_id = auth.uid()` anyway (kept below, belt-and-
-- suspenders, same as `cast_vote`'s own explicit filters). Defaulting to
-- SECURITY DEFINER here — the `cast_vote`-shaped instinct — would grant this
-- function privilege it has no use for and every reason not to hold.
--
-- Grants: EXECUTE revoked from PUBLIC, granted only to `authenticated` — not
-- `anon`. Same reasoning as `cast_vote`: `anon` is unauthenticated PostgREST
-- traffic, while both linked-account users and this beta's Supabase
-- anonymous-sign-in users carry `authenticated` with a real `auth.uid()`.
--
-- Identity: `auth.uid()` is the only source of identity, same as `cast_vote`
-- — no user-id parameter, which would let any caller read anyone's vote
-- state.
--
-- A user with zero votes today returns a well-formed full-budget state
-- (`remainingVotes = maxVotes`, `votedVenueIds = []`), not null or an error
-- — there's no row to be missing; the aggregate over zero matching rows is
-- exactly that shape already, same as `cast_vote`'s own post-insert query.
CREATE FUNCTION public.get_vote_state()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  c_max_daily_votes CONSTANT int := public.vote_max_daily_votes();
  c_tz CONSTANT text := 'America/New_York'; -- DEFAULT_VOTE_DAY_TIMEZONE fallback, see 0007's header
  v_user_id uuid := auth.uid();
  v_vote_day date;
  v_vote_count int;
  v_voted_venue_ids jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = 'AUTH_REQUIRED',
      DETAIL = 'A valid Supabase session is required to read vote state.',
      ERRCODE = 'P0001';
  END IF;

  v_vote_day := public.vote_day(now(), c_tz);

  SELECT count(*), coalesce(jsonb_agg(venue_id), '[]'::jsonb)
  INTO v_vote_count, v_voted_venue_ids
  FROM public.votes
  WHERE user_id = v_user_id AND voted_at = v_vote_day;

  RETURN jsonb_build_object(
    'remainingVotes', GREATEST(0, c_max_daily_votes - v_vote_count),
    'maxVotes', c_max_daily_votes,
    'votedVenueIds', v_voted_venue_ids,
    'resetAt', to_char(public.vote_reset_at(now(), c_tz) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS."000Z"')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_vote_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vote_state() TO authenticated;
