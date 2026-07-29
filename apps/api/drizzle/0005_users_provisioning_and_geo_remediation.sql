-- Sprint 4 migration wave — profile provisioning, role RLS hardening, and
-- venue/city geo remediation (#129, #131, #156, #167 remediation).
--
-- Order (each step is safe to re-run; see the comment above each block):
--   1. Auto-provisioning trigger + backfill (#129) — independent of the
--      steps below; run first so every identity has a profile row.
--   2. Column-level protection for `role` (#131) — depends on the `role`
--      column added in 0003_users_provisioning_columns.sql.
--   3. South End -> Charlotte merge (#156) — reassigns venues.city_id and
--      deletes the South End `cities` row BEFORE step 4, so step 4's
--      geo pass evaluates venues against the final set of cities/radii
--      (no venue is evaluated against a city row that's about to disappear,
--      and none of South End's venues get double-processed).
--   4. Sayville radius correction, then the general out-of-radius
--      reassign-or-deactivate pass (#167 remediation) — runs last.

-- ============================================================================
-- 1. Auto-provision public.users rows for every Supabase identity (#129)
-- ============================================================================
--
-- Root cause of the observed gap (14 of 15 auth.users identities with no
-- matching public.users row): the previous mechanism was a per-request
-- upsert in apps/api/src/plugins/jwt.ts's `authenticate` decorator, which
-- only ever ran the first time a user hit an *authenticated* endpoint
-- (voting). Anonymous users who only ever browsed venues/cities (unauthed
-- routes) never triggered it. A SECURITY DEFINER trigger on auth.users
-- fires at identity-creation time — anonymous or linked — independent of
-- whether the user ever calls an authenticated endpoint, which closes this
-- gap at the source instead of relying on incidental application traffic.
--
-- `search_path` is pinned to `public` and all references are schema-qualified
-- so the function can't be tricked by a session-level search_path change
-- (standard hardening for SECURITY DEFINER functions).
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill the identities that predate this trigger (the 14 orphaned rows).
DO $$
DECLARE
  backfilled_count int;
BEGIN
  INSERT INTO public.users (id, email)
  SELECT au.id, au.email
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.id = au.id
  WHERE pu.id IS NULL
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS backfilled_count = ROW_COUNT;
  RAISE NOTICE 'users backfill: inserted % missing public.users row(s)', backfilled_count;
END $$;

-- ============================================================================
-- 2. Prevent self-promotion via the new `role` column (#131)
-- ============================================================================
--
-- The existing "users: update own" policy (0002_rls_policies.sql) only
-- constrains *which row* a session may update (`auth.uid() = id`); for
-- UPDATE, Postgres defaults an omitted WITH CHECK to the USING clause, so it
-- re-checks the same row-identity predicate against the new row and nothing
-- else. It does not constrain which *columns* may change — a session
-- authenticated as the row owner could otherwise run
-- `UPDATE users SET role = 'developer' WHERE id = auth.uid()` and pass RLS.
--
-- Column-level privileges are the standard Supabase mechanism for closing
-- this without a bespoke trigger. NOTE: a table-wide UPDATE grant (e.g.
-- `GRANT ALL`/`GRANT UPDATE ON users TO authenticated`, which is part of a
-- Supabase project's default schema privileges) is NOT narrowed by a
-- column-level REVOKE alone — Postgres's ACL model treats table-wide and
-- column-level grants independently, and a table-wide grant still permits
-- updating any column. The only reliable pattern is to revoke the table-wide
-- UPDATE privilege entirely and re-grant UPDATE on just the safe columns.
-- (Verified locally: `REVOKE UPDATE (role) ...` alone did NOT block a
-- `role`-only update while a table-wide UPDATE grant was in effect.)
--
-- After this, only `service_role` (bypasses RLS and retains its own
-- table-wide grant from the project's default privileges) can change a
-- user's role — i.e. only apps/api, using the service-role key, can
-- promote/demote a user to 'developer'.
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (email, display_name, city, device_id) ON public.users TO authenticated;

-- ============================================================================
-- 3. Merge South End into Charlotte (#156)
-- ============================================================================
--
-- Decision (2026-07-28): reassign South End, Charlotte's 27 venues to
-- Charlotte and remove the South End `cities` row. Charlotte's existing
-- 8000m radius already covers all 27 (max observed distance 2,614m), so no
-- radius change is needed for the merge itself.
--
-- Looks up both cities by name (not a hardcoded id, since those are only
-- known in the live database) and fails loudly if the expected Charlotte row
-- is missing, rather than silently doing nothing — a mismatched `name`
-- string here would otherwise leave the venue.city_id pass below evaluating
-- a stale set of cities.
DO $$
DECLARE
  charlotte_id uuid;
  south_end_id uuid;
  reassigned_count int;
BEGIN
  SELECT id INTO charlotte_id FROM public.cities WHERE name = 'Charlotte' AND state = 'NC';
  SELECT id INTO south_end_id FROM public.cities WHERE name = 'South End, Charlotte';

  IF charlotte_id IS NULL THEN
    RAISE EXCEPTION
      'South End merge: no cities row found for name=''Charlotte'', state=''NC''. '
      'Verify the exact stored name/state before re-running this migration.';
  END IF;

  IF south_end_id IS NULL THEN
    RAISE NOTICE 'South End merge: no "South End, Charlotte" cities row found — skipping (already merged?).';
  ELSE
    UPDATE public.venues
    SET city_id = charlotte_id, updated_at = now()
    WHERE city_id = south_end_id;
    GET DIAGNOSTICS reassigned_count = ROW_COUNT;

    DELETE FROM public.cities WHERE id = south_end_id;

    RAISE NOTICE 'South End merge: reassigned % venue(s) to Charlotte and removed the South End cities row', reassigned_count;
  END IF;
END $$;

-- ============================================================================
-- 4. Sayville radius correction + out-of-radius venue remediation (#167)
-- ============================================================================
--
-- Sayville's radius_meters was 250 — almost certainly a dropped zero (58 of
-- 60 venues fell outside it, up to 11,050m away). Corrected to 2,500m,
-- matching Patchogue's already-reasonable radius for a same-scale Long
-- Island hamlet, rather than inventing a new figure.
DO $$
DECLARE
  updated_count int;
BEGIN
  UPDATE public.cities
  SET radius_meters = 2500, updated_at = now()
  WHERE name = 'Sayville' AND state = 'NY';
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count = 0 THEN
    RAISE EXCEPTION
      'Sayville radius fix: no cities row found for name=''Sayville'', state=''NY''. '
      'Verify the exact stored name/state before re-running this migration.';
  END IF;
END $$;

-- General remediation for venues whose assigned city does not actually
-- contain them (the ingest-time cause was fixed in PR #168's distance guard;
-- this is the one-time cleanup of the rows that predate that guard).
--
-- For every active venue whose distance from its assigned city's center
-- exceeds that city's radius, reassign it to whichever *other* active city's
-- radius actually contains it (closest match wins); if no active city's
-- radius contains it, deactivate it instead of leaving it silently
-- mis-plotted (e.g. a Stamford, CT venue with no matching Crawl city).
-- Venues already inside their assigned city's (now-corrected) radius are
-- untouched — the Sayville radius fix above resolves the bulk of that
-- city's flagged rows on its own, since they were only "outside" due to the
-- dropped-zero bug, not because they belong elsewhere.
--
-- Distance uses the same great-circle (haversine) formula as the ingest-time
-- guard added in PR #168 (apps/api/src/jobs/places/geo.ts), evaluated in SQL
-- against latitude/longitude (populated on every row) rather than the
-- `location` PostGIS geography column (not populated on all rows).
DO $$
DECLARE
  reassigned_count int;
  deactivated_count int;
BEGIN
  WITH venue_distances AS (
    SELECT
      v.id AS venue_id,
      v.city_id AS current_city_id,
      c.id AS candidate_city_id,
      c.radius_meters AS candidate_radius,
      2 * 6371000.0 * asin(
        sqrt(
          power(sin(radians((c.center_lat - v.latitude)::float8) / 2), 2) +
          cos(radians(v.latitude::float8)) * cos(radians(c.center_lat::float8)) *
          power(sin(radians((c.center_lng - v.longitude)::float8) / 2), 2)
        )
      ) AS distance_m
    FROM public.venues v
    CROSS JOIN public.cities c
    WHERE v.is_active = true AND c.is_active = true
  ),
  best_fit AS (
    -- Closest active city whose radius actually contains the venue, per venue
    -- (absent if none does).
    SELECT DISTINCT ON (venue_id)
      venue_id, candidate_city_id, distance_m
    FROM venue_distances
    WHERE distance_m <= candidate_radius
    ORDER BY venue_id, distance_m ASC
  ),
  mis_assigned AS (
    -- Venues whose CURRENT city assignment does not contain them.
    SELECT vd.venue_id
    FROM venue_distances vd
    WHERE vd.candidate_city_id = vd.current_city_id
      AND vd.distance_m > vd.candidate_radius
  ),
  updated AS (
    UPDATE public.venues v
    SET
      city_id = COALESCE(bf.candidate_city_id, v.city_id),
      is_active = (bf.candidate_city_id IS NOT NULL),
      updated_at = now()
    FROM mis_assigned ma
    LEFT JOIN best_fit bf ON bf.venue_id = ma.venue_id
    WHERE v.id = ma.venue_id
    RETURNING (bf.candidate_city_id IS NOT NULL) AS was_reassigned
  )
  SELECT
    count(*) FILTER (WHERE was_reassigned),
    count(*) FILTER (WHERE NOT was_reassigned)
  INTO reassigned_count, deactivated_count
  FROM updated;

  RAISE NOTICE 'geo remediation: reassigned % venue(s) to a different city, deactivated % venue(s) with no matching city',
    coalesce(reassigned_count, 0), coalesce(deactivated_count, 0);
END $$;
