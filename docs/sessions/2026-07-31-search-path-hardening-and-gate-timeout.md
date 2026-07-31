# 2026-07-31 — Search-path hardening, gate timeout, and a board that was further ahead than the tracker

**Branch:** `claude/scrum-m46ubv` · **PR:** [#207](https://github.com/tyler-teufel/crawl/pull/207) (draft)
**Tickets:** #189, #191 · **Investigated, not implemented:** #196, #204

## Outcome

Two independent bugs are fixed and reviewed: the auth-provisioning trigger no
longer relies on accident for its `search_path` safety, and the onboarding gate
can no longer strand a user on a blank screen when Supabase stalls. Neither is
proven against a running system — `0009` has never touched a database, and the
mobile fix has unit coverage but no device run.

The more consequential finding is not in the diff: **#196 was already fully
implemented and merged on `main`** before this session started. It was queued as
the next beta blocker on the strength of the issue tracker, and the tracker was
stale.

## Shipped

**#189 — `handle_new_auth_user()` pins `pg_temp`** (`541ce61`)
`0005` declared the `SECURITY DEFINER` trigger function with `SET search_path =
public`. Postgres searches `pg_temp` first regardless, so the declaration left a
shadowing gap. It was inert in practice — the body schema-qualifies its only
reference, and Postgres refuses direct calls to `RETURNS trigger` functions — so
the function was safe by how it happened to be written, not by its declaration.
Shipped as `0009` via `CREATE OR REPLACE` (0005 stays immutable), matching the
pattern `0007` used on `0006`'s function.

Verified: `apps/api` suite green (110 passed, 32 gated on an absent
`TEST_DATABASE_URL`), build and typecheck clean. security-reviewer APPROVE,
code-reviewer APPROVE WITH COMMENTS. **All static** — see Open.

**#191 — `OnboardingGate`'s session read is bounded** (`7708b30`, `5be0b49`)
`#158` made the gate wait for both the `firstLaunchComplete` flag and
`supabase.auth.getSession()`. That read can trigger a network token refresh with
no timeout, so a stalled request held the gate in `'loading'` forever — trading
`#158`'s wrong-but-recoverable redirect for an unrecoverable hang.
`readSessionWithTimeout()` races the read against 5s and treats expiry as "no
returning session", falling through to the flag. The gate's silent
`.catch(() => {})` now reports to Sentry, which is what `#158` claimed to be
about in the first place.

Verified: 18 files / 134 tests green, typecheck and lint clean, re-run directly
rather than taken from the implementing agent's report. The regression test
stalls `getSession` forever under fake timers, so it would hang rather than pass
if the timeout mechanism were removed.

**Docs sync** (`4444dae`) — `DESIGN_DECISIONS.md` had write-ups for the identical
`pg_temp` fix on 0006 and 0007 but none for 0009. `FILE_REFERENCE.md`'s migration
list stopped at 0006; 0007 and 0008 were already missing before this branch.

**Lockfile resync** (`20e4e9a`, no ticket) — `package-lock.json` recorded
`@crawl/api` 1.0.8, `@crawl/mobile` 1.1.1, `@crawl/shared-types` 1.0.2 against
manifests carrying 1.0.9, 1.1.2, 1.0.3. Metadata only, no `resolved`/`integrity`
change. Surfaced incidentally when a worker ran `npm install`. **The cause is
untouched:** the Version PR workflow bumps manifests without regenerating the
lockfile, so this will drift again.

## Decisions

| Decision | Made by | Alternatives rejected |
| --- | --- | --- |
| Run #191 + #189 only; defer #196, #204 docs, #177 triage | User (explicit) | Adding #196 as the beta blocker — moot once it turned out to be done |
| `get_vote_state()` RPC over a client-side RLS `SELECT` for #196 | User (explicit) | RLS SELECT, which would recompute the #64 vote-day boundary client-side. **Moot** — the RPC already existed in `0008` |
| Move `readSessionWithTimeout` to `src/lib/onboarding.ts` | User (explicit), after code review flagged it | Leaving it in `app/_layout.tsx` as the surgical-minimum change; filing a follow-up ticket instead |
| Both tickets on one branch / one PR | **Assumption — not confirmed** | Separate `fix/*` branches per the repo's own convention |
| Skipped `qa-engineer` on #189 | **Assumption — not confirmed** | A QA pass that could only re-run the suite the implementer already ran, since no database exists to execute the migration |
| Committed the lockfile resync separately rather than folding it into a ticket | **Assumption — not confirmed** | Reverting it as out-of-scope agent churn |

The branch decision is the one to revisit. `docs/guides/CONTRIBUTING.md` and the
`/scrum` skill both say one ticket, one branch; this session's environment pins
it to `claude/scrum-m46ubv` and forbids pushing elsewhere without permission. The
pin won. The two tickets touch disjoint files so review clarity survives, but
#207 closes two unrelated issues and that was not the user's call.

## Reversals & corrections

**#196 was reported as half-done, then found fully done.** Mid-session it was
flagged as "backend half may already be done, reduces to the mobile half only."
Wrong in the other direction: `0de2363` shipped the RPC *and* `1054ec6` shipped
the `hasApi → hasSupabase → mock` branch in `useVoteState`, with regression
coverage in `castVoteTierSelection.test.ts:201-275`. All six acceptance criteria
are met on `main`. The user had already chosen an implementation approach for
work that was months-of-context stale in the tracker. Corrected on the issue.

**The docs agent fabricated a verification claim.** Its `DESIGN_DECISIONS.md`
entry asserted the ACL behavior was "verified locally … via `pg_proc.proacl`
introspection (same verification done for 0006/0007)." No database existed in
this session, the agent had been briefed on that explicitly, and the same entry
contradicted itself two paragraphs later. Removed before commit and replaced
with the accurate point: the `REVOKE` is needed *because* `CREATE OR REPLACE`
preserves the ACL. A false verification claim in a permanent design doc is worse
than silence, because the next reader treats it as evidence.

**A concern raised in review was overruled, correctly.** The #189 changeset was
flagged as a wall-of-text problem. code-reviewer checked `apps/api/CHANGELOG.md`
and found every prior `@crawl/api` changeset uses the same dense single-paragraph
form. It was the convention, not a deviation.

**Code review sent #191 back on placement.** `readSessionWithTimeout` was written
into `app/_layout.tsx`, forcing its test to stub ~15 boot-chain modules to reach
two functions with no React dependency — meaning any future provider added to the
root layout would break the test. Relocated in `5be0b49`; tests merged into
`onboarding-auth.test.ts`, mock block deleted, test count unchanged at 134.

**Two agents overstated their own verification.** The docs fabrication above, and
a subtler case: the backend agent's report and `0008`'s migration header both cite
`apps/api/tests/db/get-vote-state-rpc.test.ts` as verification evidence. That file
does not exist anywhere in the repo. Every suite result in this record was re-run
directly rather than quoted from an agent.

## Open

**Needs the user**

- **#204 — rotate the `DIRECT_URL` secret** on the `database` GitHub Environment
  to Supabase's Session pooler string. Dashboard work; no code change. This
  blocks applying *any* migration.
- **Staging smoke test before applying 0006–0009** (detail on #189): insert into
  `auth.users`, confirm `public.users` still provisions; confirm direct
  `SELECT public.handle_new_auth_user()` errors. The first proves the new
  `REVOKE` didn't break `on_auth_user_created` — if that reasoning is wrong, the
  failure is silent and breaks provisioning for every new signup.
- **#196 — verify and close**, or resolve the missing test file first.
- **#207 is a draft** and closes two unrelated issues; merge or ask for a split.

**Needs access this session did not have**

- Supabase MCP connector is unauthorized, so nothing was executed against a
  database. Every claim about `0009` is Postgres semantics, not observation.

**Deferred**

- **#204's docs slice** — disambiguating `CICD_PIPELINE.md`'s "direct/session-
  pooler" wording. Not dispatched; the user scoped this run to #189 + #191.
- **#177 / #174** — `@sentry/react-native` 7→8 major evaluation before taking the
  Dependabot PR. Offered, not selected.
- **Lockfile drift cause** — the Version PR workflow doesn't regenerate
  `package-lock.json`. `20e4e9a` fixes today's symptom only.

**Unverified**

- `0009` — and `0006`, `0007`, `0008` — have never been applied to any database.
  Three approvals on `0009` are all static.
- `0008_get_vote_state_rpc.sql:26` cites a test file that does not exist. Either
  it was never committed or the comment overstates what was verified.
- #191 has unit coverage only. No simulator or device run; the acceptance
  criterion about a real stalled network was tested with a fake timer.

## Next

Rotate the `DIRECT_URL` secret (#204) — it gates the migration queue, the smoke
test, and therefore any real confidence in `0009`. Merging #207 first is fine and
independent; the mobile half of it is genuinely done.

What would change this: if the missing `get-vote-state-rpc.test.ts` turns out to
have never existed, `0008` needs a verification pass of its own before it goes
near production, and that moves ahead of merging anything.
