import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { voteDayFor, voteDayResetAt } from '@crawl/shared-types';

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
const NY = 'America/New_York';

describe.skipIf(!TEST_DATABASE_URL)('cast_vote RPC (requires TEST_DATABASE_URL)', () => {
  let client: pg.Client;

  const USER_CAP = '10000000-0000-0000-0000-0000000000ca';
  const USER_DUP = '10000000-0000-0000-0000-0000000000dd';
  const USER_COUNT = '10000000-0000-0000-0000-0000000000c0';
  const USER_CONCURRENT = '10000000-0000-0000-0000-0000000000cc';
  const VENUE_1 = '20000000-0000-0000-0000-000000000001';
  const VENUE_2 = '20000000-0000-0000-0000-000000000002';
  const VENUE_3 = '20000000-0000-0000-0000-000000000003';
  const VENUE_4 = '20000000-0000-0000-0000-000000000004';
  const VENUE_5 = '20000000-0000-0000-0000-000000000005';

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

  // Unlike castVoteAs, this opens its own connection per call — a single
  // pg.Client serializes queries over one physical connection, so calls
  // through it can never actually race at the wire level. True concurrency
  // (two backends contending for the same advisory lock) requires distinct
  // connections issuing requests in parallel.
  async function castVoteOnOwnConnection(
    userId: string,
    venueId: string
  ): Promise<{ state: Record<string, unknown> | null; error: Error | null }> {
    const conn = new pg.Client({ connectionString: TEST_DATABASE_URL });
    await conn.connect();
    try {
      await conn.query('SET ROLE authenticated');
      await conn.query(`SET request.jwt.claim.sub = '${userId}'`);
      const res = await conn.query('SELECT public.cast_vote($1) AS state', [venueId]);
      return { state: res.rows[0].state as Record<string, unknown>, error: null };
    } catch (err) {
      return { state: null, error: err as Error };
    } finally {
      await conn.end();
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

    await client.query('INSERT INTO public.users (id) VALUES ($1), ($2), ($3), ($4)', [
      USER_CAP,
      USER_DUP,
      USER_COUNT,
      USER_CONCURRENT,
    ]);
    await client.query('INSERT INTO public.venues (id) VALUES ($1), ($2), ($3), ($4), ($5)', [
      VENUE_1,
      VENUE_2,
      VENUE_3,
      VENUE_4,
      VENUE_5,
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
    await client.query('RESET request.jwt.claim.sub');
    await expect(client.query('SELECT public.cast_vote($1)', [VENUE_1])).rejects.toMatchObject({
      message: 'AUTH_REQUIRED',
    });
    await client.query('RESET ROLE');
  });

  it('denies the anon role EXECUTE outright (never reaches auth.uid())', async () => {
    await client.query('SET ROLE anon');
    await expect(client.query('SELECT public.cast_vote($1)', [VENUE_1])).rejects.toThrow(
      /permission denied for function cast_vote/
    );
    await client.query('RESET ROLE');
  });

  // #126 review finding (both security and correctness reviewers, independently):
  // the cap is a COUNT-then-INSERT, a classic TOCTOU race without the
  // pg_advisory_xact_lock in cast_vote. This proves the lock actually
  // closes it — codifying the manual 5-parallel-`psql`-process check from
  // the ticket report so a future edit that "simplifies away" the lock (or
  // changes its keys so it stops actually serializing same-user casts)
  // gets caught here instead of in production.
  it('serializes concurrent casts from the same user so 5 parallel requests still yield exactly 3 votes', async () => {
    const venues = [VENUE_1, VENUE_2, VENUE_3, VENUE_4, VENUE_5];
    const results = await Promise.all(
      venues.map((venueId) => castVoteOnOwnConnection(USER_CONCURRENT, venueId))
    );

    const succeeded = results.filter((r) => r.error === null);
    const rejected = results.filter((r) => r.error !== null);

    expect(succeeded).toHaveLength(3);
    expect(rejected).toHaveLength(2);
    for (const r of rejected) {
      expect(r.error?.message).toBe('NO_VOTES_REMAINING');
    }

    const { rows } = await client.query(
      'SELECT count(*)::int AS n FROM public.votes WHERE user_id = $1',
      [USER_CONCURRENT]
    );
    expect(rows[0].n).toBe(3);
  });

  // #126 review finding (both reviewers): the migration header and
  // DESIGN_DECISIONS.md both cite manual TS/SQL parity verification that
  // nothing re-runs. This codifies it directly against @crawl/shared-types'
  // voteDayFor/voteDayResetAt — the same instants exercised manually in the
  // ticket report, covering the 03:59:59/04:00:00/04:00:01 boundary on a
  // plain day and on both of 2026's US DST transition dates (2026-03-08
  // spring-forward, 2026-11-01 fall-back). The 04:00 cutoff never falls
  // inside the US 02:00 transition hour on either date, so none of these
  // instants are themselves ambiguous/nonexistent wall-clock times — see
  // the DST-gap assumption documented at the `v_reset_at` computation in
  // 0007_cast_vote_rpc.sql.
  describe('public.vote_day() parity with voteDayFor()/voteDayResetAt()', () => {
    const cases: Array<[label: string, iso: string]> = [
      ['non-DST day, just before cutoff (EDT)', '2026-07-15T07:59:59Z'],
      ['non-DST day, at cutoff (EDT)', '2026-07-15T08:00:00Z'],
      ['non-DST day, just after cutoff (EDT)', '2026-07-15T08:00:01Z'],
      ['spring-forward day, just before cutoff', '2026-03-08T07:59:59Z'],
      ['spring-forward day, at cutoff', '2026-03-08T08:00:00Z'],
      ['spring-forward day, just after cutoff', '2026-03-08T08:00:01Z'],
      ['fall-back day, just before cutoff', '2026-11-01T08:59:59Z'],
      ['fall-back day, at cutoff', '2026-11-01T09:00:00Z'],
      ['fall-back day, just after cutoff', '2026-11-01T09:00:01Z'],
    ];

    it.each(cases)('vote_day: %s (%s)', async (_label, iso) => {
      const expected = voteDayFor(new Date(iso), NY);
      const { rows } = await client.query('SELECT public.vote_day($1::timestamptz, $2) AS d', [
        iso,
        NY,
      ]);
      const actual = (rows[0].d as Date).toISOString().slice(0, 10);
      expect(actual).toBe(expected);
    });

    it.each(cases)('resetAt: %s (%s)', async (_label, iso) => {
      const expected = voteDayResetAt(new Date(iso), NY).toISOString();
      const dayRes = await client.query('SELECT public.vote_day($1::timestamptz, $2) AS d', [
        iso,
        NY,
      ]);
      const voteDay = (dayRes.rows[0].d as Date).toISOString().slice(0, 10);
      // Mirrors cast_vote's inline resetAt expression
      // (0007_cast_vote_rpc.sql, the `v_reset_at` assignment) exactly —
      // there's no standalone SQL function for it to call directly.
      const resetRes = await client.query(
        `SELECT to_char(
           ((($1::date + 1)::text || ' 04:00:00')::timestamp AT TIME ZONE $2) AT TIME ZONE 'UTC',
           'YYYY-MM-DD"T"HH24:MI:SS."000Z"'
         ) AS r`,
        [voteDay, NY]
      );
      expect(resetRes.rows[0].r).toBe(expected);
    });
  });

  // #126 review finding (optional/if-cheap): the other half of what this
  // migration claims to fix — recalculate_hotspot_scores()'s daily_count
  // now buckets by public.vote_day(now()) instead of raw CURRENT_DATE —
  // had no coverage anywhere. Can't rely on wall-clock time at suite-run
  // time to make CURRENT_DATE and vote_day(now()) actually differ (that's
  // only true during a ~4h window nightly), so this pins vote_day() to a
  // fixed sentinel for the duration of the test, deterministically proving
  // daily_count follows vote_day() and not CURRENT_DATE, then restores the
  // real function by re-applying the shipped migration.
  it("recalculate_hotspot_scores buckets daily_count by vote_day(), not raw CURRENT_DATE", async () => {
    const PINNED_DAY = '2099-06-15'; // far-future sentinel; guaranteed != CURRENT_DATE
    const VENUE_PINNED = '20000000-0000-0000-0000-0000000000a1';
    const VENUE_RAW = '20000000-0000-0000-0000-0000000000a2';
    const EXTRA_USER_1 = '10000000-0000-0000-0000-0000000000e1';
    const EXTRA_USER_2 = '10000000-0000-0000-0000-0000000000e2';

    await client.query('INSERT INTO public.venues (id, rating) VALUES ($1, NULL), ($2, NULL)', [
      VENUE_PINNED,
      VENUE_RAW,
    ]);
    await client.query('INSERT INTO public.users (id) VALUES ($1), ($2)', [
      EXTRA_USER_1,
      EXTRA_USER_2,
    ]);

    await client.query(`
      CREATE OR REPLACE FUNCTION public.vote_day(at timestamptz DEFAULT now(), tz text DEFAULT 'America/New_York')
      RETURNS date LANGUAGE sql STABLE SET search_path = public, pg_temp
      AS $$ SELECT date '${PINNED_DAY}' $$;
    `);

    try {
      // Two votes dated at the pinned "today" (old enough that velocity's
      // 60-minute window doesn't pick them up).
      await client.query(
        `INSERT INTO public.votes (user_id, venue_id, voted_at, created_at)
         VALUES ($1, $2, $3::date, now() - interval '2 days')`,
        [EXTRA_USER_1, VENUE_PINNED, PINNED_DAY]
      );
      await client.query(
        `INSERT INTO public.votes (user_id, venue_id, voted_at, created_at)
         VALUES ($1, $2, $3::date, now() - interval '2 days')`,
        [EXTRA_USER_2, VENUE_PINNED, PINNED_DAY]
      );
      // One vote dated at raw CURRENT_DATE (what the pre-#126 formula
      // bucketed by) on a different venue — under the fix this must NOT
      // count as "today" once "today" means the pinned vote day.
      await client.query(
        `INSERT INTO public.votes (user_id, venue_id, voted_at, created_at)
         VALUES ($1, $2, CURRENT_DATE, now() - interval '2 days')`,
        [USER_COUNT, VENUE_RAW]
      );

      await client.query('SELECT public.recalculate_hotspot_scores()');

      const { rows } = await client.query(
        'SELECT id, hotspot_score FROM public.venues WHERE id IN ($1, $2)',
        [VENUE_PINNED, VENUE_RAW]
      );
      const scores = Object.fromEntries(rows.map((r) => [r.id as string, r.hotspot_score as number]));

      // VENUE_RAW's only vote is dated CURRENT_DATE, which the pinned
      // "today" doesn't recognize as today (and the historical-average
      // window, anchored to the far-future pinned day, doesn't reach back
      // to it either) — no signal at all, so score is exactly 0.
      expect(scores[VENUE_RAW]).toBe(0);
      // VENUE_PINNED's two votes land exactly on the pinned vote day, so
      // daily_count picks them up.
      expect(scores[VENUE_PINNED]).toBeGreaterThan(0);
    } finally {
      // Restore the real vote_day() (and re-affirm cast_vote/
      // recalculate_hotspot_scores) by re-applying the shipped migration —
      // avoids hand-duplicating the real definition and risking drift.
      await client.query(migrationSql);
    }
  });
});
