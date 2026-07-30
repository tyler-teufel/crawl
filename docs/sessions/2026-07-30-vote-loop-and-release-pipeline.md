# 2026-07-30 — Vote loop goes real; release pipeline unblocked

**Branch:** `claude/scrum-oa73s8` · **PR:** [#188](https://github.com/tyler-teufel/crawl/pull/188)
**Tickets:** #184, #158, #154, #64, #126, #196 · **Filed:** #189–#196

## Outcome

Phase 3 of the beta epic (#125) is code-complete: votes are cast and read
against Postgres, with the 3/day cap enforced inside a transaction rather than
in an undeployed Fastify service. The tag-triggered release pipeline, which had
never once fired, now pushes with a credential that actually triggers workflows.
CI runs database tests against a real Postgres for the first time.

The remaining beta gate is Phase 4 — Apple/Google provider setup — which is
external console work, not code.

## Shipped

**#184 — release tags trigger their workflow** (`eecbc83`)
`release-tag.yml` pushed with the default `GITHUB_TOKEN`; GitHub deliberately
refuses to start workflows from events it creates, so `release-mobile.yml` and
`release-api.yml` never ran. Now mints a GitHub App installation token. Code
review traced the credential end-to-end and confirmed `persist-credentials`
carries it into the later push step. **Not verified end-to-end** — that needs
the App provisioned (see Open).

**#158 — onboarding stopped reappearing every launch** (`c4e3c49`)
The gate read one AsyncStorage flag and silently swallowed read errors. Now
combines the flag with a pre-existing Supabase session and holds `loading` until
both settle. Verified: 114/114 mobile tests, QA confirmed the new regression
test fails against the naive one-signal resolver.

**#154 — `hotspot_score` is computed again** (`a58cf70`)
All 240 venues sat at 0 because the only writer was an hourly `node-cron` job
inside the undeployed API. Migration `0006` adds a `pg_cron`-scheduled
`SECURITY DEFINER` function. The ported formula normalises the Google rating to
0–100 before its 0.1 weight — against the raw 0–5 value every unvoted venue
rounded to 0, reproducing the bug being fixed.

**#64 — vote day moved to a 04:00 city-local boundary** (`8890964`, `8013b5f`)
The vote day was the raw UTC date, resetting the budget at 7–8pm Eastern.
`voteDayFor`/`voteDayResetAt` in `shared-types` are now the single definition
for server, mock store, and countdown. A reviewer independently re-executed the
arithmetic across both 2026 DST transitions and in `America/Los_Angeles`,
`Asia/Kolkata` (+5:30) and `Pacific/Chatham` (+12:45) — all matched.

**#126 — `cast_vote` RPC** (`019256c`, `a1fe0a1`, `ce6509f`)
Migration `0007`. Cap and dedup enforced in-transaction, identity from
`auth.uid()` only, `EXECUTE` granted to `authenticated` and revoked from
`PUBLIC`. A `pg_advisory_xact_lock` closes a COUNT-then-INSERT race that let
concurrent casts exceed the cap — reproduced and fixed, then codified after
review found it was asserted only in prose. Suite went 6 → 26 DB tests.

**#196 — vote state read from the server** (`6094b1a`, `cca9097`)
Migration `0008` adds `get_vote_state()`. `useVoteState` had branched on
`hasApi` alone, so votes were written to Postgres and read back from
AsyncStorage; a reinstall looked like a fresh budget while the server still held
three votes. Four of six new tests were confirmed to fail against the pre-fix
`queryFn` by reverting it and re-running.

**CI runs database tests** (`c36ed5d`)
26 tests were gated on `TEST_DATABASE_URL`, which no workflow set. A change
deleting the advisory lock would have passed CI while reopening a cap bypass.

**`/tldr` skill** (`7e19393`) — this file's generator.

## Decisions

| Decision | Made by | Alternatives rejected |
| --- | --- | --- |
| GitHub App token for tag pushes | User (explicit) | PAT; SSH deploy key; collapsing the two workflows |
| Vote-day cutoff at 04:00 city-local | User (explicit) | Midnight local; 06:00 local |
| `pg_cron` for hotspot scores | **Assumed** — issue recommended it, user never confirmed | Compute-on-write in `cast_vote` (owned by #126); scheduled Edge Function |
| Vote day derives from the user's *selected* city | **Assumed** | Per-venue derivation — incoherent under a global cap |
| `get_vote_state` is `SECURITY INVOKER` | Agent, endorsed on review | `SECURITY DEFINER` — unnecessary; RLS already returns the right rows |
| CI Postgres always-run, not path-filtered | Agent, endorsed | A `services:` block cannot be skipped by condition — only the whole job, which breaks a required check (#84) |
| `TEST_DATABASE_URL` on `tasks.test.env`, not `globalEnv` | Agent | `globalEnv` would invalidate lint/typecheck caches too |
| Skipped a QA pass on #64 | Me, stated openly | Code review had already re-executed the arithmetic; a second pass would repeat it |

**Two assumptions above were never confirmed by the user** and later readers
should not treat them as settled: the `pg_cron` approach for #154, and the
"user's selected city" rule for the vote day. The second is currently
unimplementable anyway — see Open.

## Reversals & corrections

**#154 failed security review.** The `SECURITY DEFINER` function pinned
`search_path = public` without `pg_temp`. Postgres searches `pg_temp` first
regardless, so any role with default TEMP privilege could shadow `votes` with a
session-local table and drive definer-privileged writes. Compounded by no
`REVOKE EXECUTE` — Supabase exposes public-schema functions as PostgREST
endpoints and the anon key is client-bundled. Both fixed and re-verified.

**#154 also had a 7-day window off-by-one.** `>=` against
`CURRENT_DATE - interval '7 days'` covers 8 calendar days over a divisor of 7.
Found by a reviewer executing it against a local Postgres, not by reading.

**#158's first fix still reproduced the bug.** It waited only on the flag, so if
the flag settled before the session read, `<Redirect>` fired off a stale default
and could not be undone. Fixed by gating on both signals.

**I relayed a dependency triage verdict that was wrong.** The triage agent could
not reach the GitHub API and recommended merging #175 and splitting #183
"pending green CI". Both were red, and #183 is eight majors including
`tailwindcss` 3→4 and `typescript` 5→7 — not the routine dev-dep bump it
appeared to be. Corrected after checking CI directly.

**I told the user worktrees cut from this branch. They cut from `main`.** Caught
when the #64 agent reported `0006` missing. Harmless there (no migration), but
it would have handed #126 a colliding migration number. Subsequent agents ran in
the main worktree instead.

**#154's and #64's day concepts disagreed.** `0006` bucketed `daily_count` by
raw `CURRENT_DATE` while the vote budget moved to 04:00 Eastern — so a 9pm ET
Friday vote counted toward Friday's budget but Saturday's hotspot score, with
the vote counter and trending list disagreeing nightly during peak hours.
Neither ticket was wrong alone; the incoherence existed only because they landed
together. Resolved in `0008` via a shared `public.vote_day()`.

## Open

**Needs the user**
- **Provision the GitHub App** before the next release: *Contents: Read and
  write*, installed on this repo only, secrets `RELEASE_TAG_APP_ID` and
  `RELEASE_TAG_APP_PRIVATE_KEY`. Until then `Release — Create Tag` fails at step
  one by design. Recovery via `workflow_dispatch` against an existing tag is
  unchanged.
- **Apple/Google provider setup** (#127) — Phase 4, the last beta gate.
- **#170 was merged after `Release — Create Tag` succeeded.** That job has always
  succeeded — creating the tag was never the broken part, the missing trigger
  was. Checked afterwards: the downstream `Release — Mobile` run dispatched
  2026-07-29 14:27 **failed** at the "Mobile release (binary → staging)" EAS
  build job, both of that workflow's runs ever have failed, and
  `list_releases` is empty. So `action-gh-release` still has not executed and
  `body_path` plus the `awk` changelog extraction remain unexercised. Low risk
  regardless — the v2→v3 diff is a Node 20→24 runtime change with no change to
  the four inputs used — but unvalidated, and a first failure will be ambiguous
  between the bump and the never-run job.
- **The release path's live blocker is EAS build quota, not the tag trigger.**
  #184 fixes the trigger; a first successful end-to-end release still needs
  build capacity (see #186, which made staging builds manual-dispatch only).

**Needs access this session did not have**
- The Supabase connector was never authorised, so **nothing in migrations
  `0006`–`0008` has been applied or verified against project
  `gcixoqaxahuawklcqzyq`.** All SQL verification was against scratch local
  Postgres instances.
- **Confirm `pg_cron` is available** on the project's plan. `0006` fails loudly
  at `CREATE EXTENSION` if not.
- **Confirm `votes` RLS still has only the SELECT policy.** If an INSERT policy
  exists, the direct `POST /rest/v1/votes` bypass that `cast_vote` exists to
  close is still open.
- **Confirm anonymous sign-in resolves to the `authenticated` role** on that
  project. If wrong, voting breaks for every beta user — a functionality risk,
  not a security one.

**Deliberately deferred**
- #189 (`0005`'s `search_path`), #190 (`resetDailyVotes` never prunes), #191
  (`getSession` has no timeout), #192/#193 (tailwind/typescript migrations),
  #194 (Maestro E2E), #195 (docs TOC). #192–#194 are all "after the beta" —
  they touch every screen or the native toolchain, and #148 is queued.

**Unverified**
- #184's trigger fix cannot be proven until the App exists.
- Every device-gated criterion on #158 remains device-gated. #194 exists to
  close this class.
- The mobile RPC paths (#126, #196) are verified against a **mocked**
  `supabase.rpc`, never the live function. In particular, that supabase-js
  surfaces the RPC's raised exception as a bare code string on `error.message`
  is asserted by the migration's comments and assumed by the client's
  exact-match error mapping — **it has not been observed**. If it arrives
  wrapped or prefixed, every error maps to the rethrow branch and the UI shows a
  raw Postgres error instead of "You have used all your votes for today."

## Next

Merge #188, provision the GitHub App, and authorise the Supabase connector — the
last unblocks applying three migrations and answers four of the open questions
at once. Then Phase 4, then #128's device smoke test.

The mobile-side error-contract assumption above is worth ten minutes against a
real project before inviting testers; it is the difference between a clear cap
message and a raw SQL error in the primary loop.
