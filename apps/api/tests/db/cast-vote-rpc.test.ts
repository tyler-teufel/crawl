import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

/**
 * Integration test for the `cast_vote` RPC (drizzle/0007_cast_vote_rpc.sql,
 * #126) — the 3/day cap + per-venue dedup enforced *inside the transaction*
 * by a SECURITY DEFINER Postgres function, since the equivalent check in
 * vote.service.ts (covered by tests/services/vote.service.test.ts) only
 * protects the Fastify path, which isn't deployed for this beta.
 *
 * Opt-in: requires TEST_DATABASE_URL, pointed at a scratch Postgres
 * instance this suite is free to drop/recreate tables in — deliberately
 * NOT `DATABASE_URL`/`DIRECT_URL`, which may point at a real dev/prod
 * database. Skipped entirely when unset, matching the rest of this repo's
 * tests (in-memory repositories, no live database required). To run
 * locally against a scratch Postgres 16+:
 *
 *   createdb crawl_rpc_test
 *   TEST_DATABASE_URL=postgres://localhost/crawl_rpc_test npm test -- cast-vote-rpc
 *
 * This applies the real 0007 migration file verbatim, so it's exercising
 * the exact SQL that ships. It does not exercise 0006's pg_cron scheduling
 * (unavailable outside Supabase) — only the functions 0007 creates/
 * replaces in `public`, against a minimal hand-rolled `users`/`venues`/
 * `votes` schema (not the full migration chain, which assumes a live
 * Supabase project's `auth.users`/seed data for its data-remediation
 * steps).
 */

const dir = path.dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(path.resolve(dir, '../../drizzle/0007_cast_vote_rpc.sql'), 'utf8');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)('cast_vote RPC (requires TEST_DATABASE_URL)', () => {
  let client: pg.Client;

  const USER_CAP = '10000000-0000-0000-0000-0000000000ca';
  const USER_DUP = '10000000-0000-0000-0000-0000000000dd';
  const USER_COUNT = '10000000-0000-0000-0000-0000000000c0';
  const VENUE_1 = '20000000-0000-0000-0000-000000000001';
  const VENUE_2 = '20000000-0000-0000-0000-000000000002';
  const VENUE_3 = '20000000-0000-0000-0000-000000000003';
  const VENUE_4 = '20000000-0000-0000-0000-000000000004';

  async function castVoteAs(
    userId: string,
    venueId: string
  ): Promise<{ state: Record<string, unknown> | null; error: Error | null }> {
    await client.query('SET ROLE authenticated');
    await client.query(`SET request.jwt.claim.sub = '${userId}'`);
    try {
      const res = await client.query('SELECT public.cast_vote($1) AS state', [venueId]);
      return { state: res.rows[0].state as Record<string, unknown>, error: null };
    } catch (err) {
      return { state: null, error: err as Error };
    } finally {
      await client.query('RESET ROLE');
    }
  }

  beforeAll(async () => {
    client = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();

    // Minimal Supabase-shaped scaffolding this migration assumes exists:
    // an `auth` schema with `uid()` (reads a session GUC this test sets per
    // call, standing in for a request's decoded JWT `sub` claim) and the
    // `anon`/`authenticated` roles PostgREST maps unauthenticated/
    // authenticated requests to. `cast_vote` is SECURITY DEFINER, so
    // `authenticated` needs no direct table grants — only EXECUTE on the
    // function, which the migration itself grants.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
      END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE
      AS $f$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $f$;

      DROP TABLE IF EXISTS public.votes CASCADE;
      DROP TABLE IF EXISTS public.venues CASCADE;
      DROP TABLE IF EXISTS public.users CASCADE;

      CREATE TABLE public.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid()
      );
      CREATE TABLE public.venues (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL DEFAULT 'Test Venue',
        rating numeric(3, 2),
        vote_count integer NOT NULL DEFAULT 0,
        hotspot_score integer NOT NULL DEFAULT 0,
        is_trending boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT true,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE public.votes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
        venue_id uuid NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
        voted_at date NOT NULL DEFAULT CURRENT_DATE,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (user_id, venue_id, voted_at)
      );
    `);

    // The migration under test, applied verbatim — creates public.vote_day,
    // public.cast_vote, replaces public.recalculate_hotspot_scores, and
    // sets up the EXECUTE grants.
    await client.query(migrationSql);

    await client.query('INSERT INTO public.users (id) VALUES ($1), ($2), ($3)', [
      USER_CAP,
      USER_DUP,
      USER_COUNT,
    ]);
    await client.query('INSERT INTO public.venues (id) VALUES ($1), ($2), ($3), ($4)', [
      VENUE_1,
      VENUE_2,
      VENUE_3,
      VENUE_4,
    ]);
  });

  afterAll(async () => {
    await client.query(`
      DROP TABLE IF EXISTS public.votes CASCADE;
      DROP TABLE IF EXISTS public.venues CASCADE;
      DROP TABLE IF EXISTS public.users CASCADE;
      DROP FUNCTION IF EXISTS public.cast_vote(uuid);
      DROP FUNCTION IF EXISTS public.recalculate_hotspot_scores();
      DROP FUNCTION IF EXISTS public.vote_day(timestamptz, text);
    `);
    await client.end();
  });

  it('allows exactly 3 votes/day and rejects a 4th with NO_VOTES_REMAINING', async () => {
    const r1 = await castVoteAs(USER_CAP, VENUE_1);
    expect(r1.error).toBeNull();
    expect(r1.state?.remainingVotes).toBe(2);

    const r2 = await castVoteAs(USER_CAP, VENUE_2);
    expect(r2.state?.remainingVotes).toBe(1);

    const r3 = await castVoteAs(USER_CAP, VENUE_3);
    expect(r3.state?.remainingVotes).toBe(0);

    // A 4th cast, even against a venue never voted for, must be rejected
    // server-side — the cap is global per user, not per venue.
    const r4 = await castVoteAs(USER_CAP, VENUE_4);
    expect(r4.error?.message).toBe('NO_VOTES_REMAINING');

    const { rows } = await client.query(
      'SELECT count(*)::int AS n FROM public.votes WHERE user_id = $1',
      [USER_CAP]
    );
    expect(rows[0].n).toBe(3);
  });

  it('rejects a duplicate vote for the same venue with ALREADY_VOTED', async () => {
    const first = await castVoteAs(USER_DUP, VENUE_1);
    expect(first.error).toBeNull();
    expect(first.state?.remainingVotes).toBe(2);

    const duplicate = await castVoteAs(USER_DUP, VENUE_1);
    expect(duplicate.error?.message).toBe('ALREADY_VOTED');

    const { rows } = await client.query(
      'SELECT count(*)::int AS n FROM public.votes WHERE user_id = $1',
      [USER_DUP]
    );
    expect(rows[0].n).toBe(1);
  });

  it('rejects voting for an unknown venue with VENUE_NOT_FOUND', async () => {
    const result = await castVoteAs(USER_COUNT, '20000000-0000-0000-0000-0000000000ff');
    expect(result.error?.message).toBe('VENUE_NOT_FOUND');
  });

  it('increments venues.vote_count on each successful cast', async () => {
    const before = await client.query('SELECT vote_count FROM public.venues WHERE id = $1', [
      VENUE_2,
    ]);
    await castVoteAs(USER_COUNT, VENUE_2);
    const after = await client.query('SELECT vote_count FROM public.venues WHERE id = $1', [
      VENUE_2,
    ]);
    expect(after.rows[0].vote_count).toBe(before.rows[0].vote_count + 1);
  });

  it('rejects an unauthenticated call (no auth.uid())', async () => {
    await client.query('SET ROLE authenticated');
    await client.query("RESET request.jwt.claim.sub");
    await expect(client.query('SELECT public.cast_vote($1)', [VENUE_1])).rejects.toMatchObject({
      message: 'AUTH_REQUIRED',
    });
    await client.query('RESET ROLE');
  });

  it("denies the anon role EXECUTE outright (never reaches auth.uid())", async () => {
    await client.query('SET ROLE anon');
    await expect(client.query('SELECT public.cast_vote($1)', [VENUE_1])).rejects.toThrow(
      /permission denied for function cast_vote/
    );
    await client.query('RESET ROLE');
  });
});
