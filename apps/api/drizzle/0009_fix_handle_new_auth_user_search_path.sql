-- Pin `pg_temp` on handle_new_auth_user()'s search_path (#189, security
-- review of #126's `cast_vote` RPC).
--
-- Root cause: 0005_users_provisioning_and_geo_remediation.sql declared
-- `handle_new_auth_user()` as `SECURITY DEFINER` with `SET search_path =
-- public` — omitting `pg_temp`. Postgres always searches `pg_temp` first
-- regardless of what the `search_path` string says, so pinning only `public`
-- leaves the documented shadowing gap: a role holding default TEMP privilege
-- could create a session-local table with the same name as one this function
-- references unqualified, and the definer-privileged write would land on the
-- attacker's table instead.
--
-- LOW severity, not a live hole (see #189 for the full write-up): the
-- function body already schema-qualifies its only table reference
-- (`public.users`) and it's a trigger function (`RETURNS trigger`), which
-- Postgres refuses to invoke outside trigger context — so nothing today
-- shadows and it can't be called directly as a PostgREST RPC regardless of
-- EXECUTE grants either way. It's safe today by accident of how it happens
-- to be written, not by its declaration; this closes the gap so a future
-- edit introducing an unqualified reference doesn't silently become
-- exploitable. Matches the `search_path = public, pg_temp` pattern 0006's
-- `recalculate_hotspot_scores()` and 0007/0008's RPCs already follow.
--
-- 0005 is an already-applied migration and stays immutable; this uses
-- `CREATE OR REPLACE FUNCTION` to update the function it defined in place,
-- same pattern 0007 used to re-point 0006's `recalculate_hotspot_scores()`.
-- Signature (`handle_new_auth_user()`, no arguments, `RETURNS trigger`) is
-- identical to 0005's, and the body is copied verbatim — only the
-- `search_path` line changes — so this replaces the existing function rather
-- than creating an overload.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- CREATE OR REPLACE preserves the existing ACL (same OID, same signature).
-- 0005 never issued an explicit REVOKE/GRANT for this function, so it has
-- carried Postgres's default (EXECUTE granted to PUBLIC) all along — harmless
-- in practice, since a trigger function can only be invoked by the trigger
-- manager and Postgres rejects any attempt to call it directly regardless of
-- EXECUTE grants (see the header above). Revoked here anyway, belt-and-
-- braces rather than strictly required: nothing needs to call this function
-- directly (the `on_auth_user_created` trigger invokes it through the
-- trigger mechanism, which isn't subject to EXECUTE checks), so there's no
-- role to grant it back to.
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
