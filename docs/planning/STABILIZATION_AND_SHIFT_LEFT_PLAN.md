# Crawl — Stabilization & Shift-Left Delivery Plan

> Status: draft · Owner: Tyler · Context: written after debugging the "TestFlight
> crashes instantly on launch" standstill (PR #43). Goal: stop losing weeks to
> build plumbing, catch failures before TestFlight, and get to reliable testing
> this week without prematurely paying for hosting.

---

## 1. TL;DR

The app didn't stall because of hard feature problems. It stalled because of a
**feedback-loop problem**: the only place failures surfaced was TestFlight — the
slowest, most expensive, most opaque stage in the pipeline. Every diagnosis
required a ~30-minute EAS build plus an App Store submission, so a one-line
config mistake cost half a day to see.

Three concrete things broke; all three share the same root shape (a failure that
was invisible until the last possible moment):

1. **Instant launch crash** — `supabase.ts` threw at module-load when env vars
   weren't in the bundle; this ran before React, before any error boundary, and
   before Sentry initialized.
2. **Sentry was a no-op** — no DSN ever reached the bundle, and it initialized
   *after* the code that crashed, so the one tool meant to explain the crash
   reported nothing.
3. **Env injection was unreliable** — `EXPO_PUBLIC_*` values were expected to
   arrive from an EAS "environment" that didn't actually carry them, and nothing
   validated that before shipping.

The fix is not more careful TestFlight builds. It's **moving every one of these
failure classes to the left** — into local dev and CI — so they fail in seconds
with a clear message instead of silently, 30 minutes downstream.

---

## 2. What actually broke (evidence)

### 2.1 The instant crash
`apps/mobile/src/lib/supabase.ts` did `throw new Error(...)` at module scope when
`EXPO_PUBLIC_SUPABASE_URL/KEY` were missing. That module is imported on the first
tick of bundle evaluation via `_layout.tsx → AuthContext → supabase`. ES imports
evaluate before the importing module's body, so the throw fired **before React
mounted, before any error boundary, and before `initSentry()` ran** — a textbook
instant, unreported launch crash.

### 2.2 Monitoring that couldn't see the crash
- `initSentry()` early-returned because `EXPO_PUBLIC_SENTRY_DSN` was set nowhere.
- Even with a DSN, `initSentry()` was a *statement* in `_layout.tsx` that runs
  after the imports — so a module-load crash always beat it. **Sentry had zero
  events, which is exactly the fingerprint of a pre-init crash.** Monitoring was
  coupled to the same fragile env pipeline it was supposed to watchdog.

### 2.3 The pattern in the git history
Of the **last 50 commits, 37 were build / EAS / CI / release plumbing**
(`fix(eas): …`, `fix(ci): …`, `autoincrement`, `hotfix-*`, distribution value
typos, build-number fights, "pin staging profile to staging environment"). That
is a project spending its energy fighting its own pipeline instead of building
the product.

### 2.4 The structural gap that let it happen
- **CI never builds or bundles the app.** `ci.yml` runs `lint`, `typecheck`,
  `test`, and a native fingerprint — none of which *execute module-load code*.
  A top-level `throw`, a missing env inline, or a bad Babel/Metro transform sails
  through CI green and only detonates at TestFlight.
- **No error boundary exists** anywhere in `app/`. Any render-time throw also
  white-screens with no fallback and no report.
- **Env configuration is spread across four mechanisms** (inline `eas.json`,
  EAS-hosted environments, GitHub Actions runner env, GitHub Environment vars)
  with no single source of truth and no validation — so "which layer supplies
  this key for this build?" was never answerable with confidence.

---

## 3. Why this kept happening (the systemic read)

| Symptom | Root shape | Shift-left correction |
| --- | --- | --- |
| Crash only seen on TestFlight | Failure surfaces at the slowest stage | Reproduce the failure class in CI (bundle the app) |
| Missing env → hard crash | Fail-fast with no diagnostics, no fallback | Validate env at build time **and** degrade gracefully at runtime |
| Sentry blind | Monitoring depends on the broken pipeline + inits too late | Init first; never let telemetry be load-bearing; add a build-time check so you don't *need* runtime monitoring to catch boot crashes |
| 37/50 commits are plumbing | No fast local/CI signal, so every change is a gamble | A green pipeline that actually exercises a production bundle |
| Env config sprawl | Four injection mechanisms, no source of truth | One documented matrix (§6) |

The unifying theme: **feedback arrived too late and too quietly.** Everything
below is about making it arrive early and loud.

---

## 4. What's already fixed (PR #43)

- `supabase.ts` no longer throws at import — warns and uses a placeholder client,
  so the app **always boots**; callers already degrade (mock data / swallowed
  auth errors). `isSupabaseConfigured` lets callers branch.
- Sentry initializes as an **import side-effect, imported first** in `_layout.tsx`,
  so its handlers are installed before the auth/data chain evaluates — it can now
  catch boot-time crashes. `initSentry()` is idempotent.
- `EXPO_PUBLIC_SUPABASE_*` inlined in `eas.json` (non-secret); `EXPO_PUBLIC_API_URL`
  and `EXPO_PUBLIC_SENTRY_DSN` injected at build time from the `staging` GitHub
  Environment (switchable, out of the repo).
- Supabase project restored from paused.

This gets the app **booting and testable**. The rest of this doc is about never
landing back here.

---

## 5. Shift-left pipeline modernization (the ladder)

Order stages fastest-feedback first. Each new gate below is cheap and catches a
failure class that currently only TestFlight would.

| # | Stage | Feedback | Catches | Status |
| --- | --- | --- | --- | --- |
| 0 | Local Expo Go / dev client | seconds | most logic/UI bugs | have it (`expo-dev-client`) |
| 1 | `lint` + `typecheck` + `test` (CI) | ~1–2 min | type errors, unit regressions | have it |
| 2 | **`expo-doctor`** (CI) | ~30 s | version mismatches, plugin/config drift | **add** |
| 3 | **`expo export` production bundle** (CI) | ~2–3 min | import-resolution, syntax, Metro/Babel/plugin-config, asset errors; produces the real shippable bundle | **add** |
| 4 | **Central env module** (`src/lib/env.ts`) + `verify-env` matrix check | build-time | scattered/typo'd `EXPO_PUBLIC_*`; a named, logged config matrix per build | **add** |
| 5 | **Boot smoke test** (execute boot-chain modules w/ native leaves mocked) | ~1 min | **module-load throws — the exact class that broke TestFlight** — plus provider/context crashes | **add — highest leverage** |
| 6 | **EAS `simulator` build + launch check** (Maestro/Detox) | ~10–15 min | native-layer + true launch crashes, no Apple round-trip | optional / milestone |
| 7 | TestFlight | ~30 min + review | device-only issues, real-tester UX | **release gate, not a debugger** |

**Two complementary gates, because bundling ≠ executing.** `npx expo export`
builds the real shippable JS bundle and catches import-resolution, syntax,
transform, plugin-config, and asset errors — but Metro *bundles* code without
*running* it, so a top-level `throw` (the failure that stalled the project)
does **not** fire during export. Catching that requires actually executing the
boot-chain modules, which is what the stage-5 boot smoke test does in ~1 minute
(native leaves mocked). Together they cover both "does it bundle?" and "does it
survive being run?" — the two questions TestFlight used to answer for us.

**Guardrails to add alongside:**
- **Root error boundary** — expo-router supports exporting `ErrorBoundary` from a
  route; add one at `app/_layout.tsx` so any render throw shows a fallback screen
  and reports to Sentry instead of white-screening.
- **Never let telemetry be load-bearing** — Sentry init is already guarded and
  idempotent; keep any future analytics/monitoring behind the same "must not
  crash the app" contract.

---

## 6. One environment/config source of truth

The sprawl was a root cause. Adopt one rule per config category and document it
here (and only here):

| Category | Example | Where it lives | Why |
| --- | --- | --- | --- |
| Non-secret, same everywhere | Supabase URL + publishable key | `eas.json` per-profile `env` (committed) | simplest, reproducible, can't be misconfigured on a dashboard |
| Non-secret, differs per env | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SENTRY_DSN` | GitHub **Environment** variable, injected into `eas.json` at build time | switchable staging/prod, out of the repo |
| Build-time secret | `SENTRY_AUTH_TOKEN`, Apple/ASC creds | EAS secret / GitHub secret | never in the bundle or repo |

Rule of thumb: **if it's `EXPO_PUBLIC_*` it will ship to devices — so it's never a
secret, and it must be validated at bundle time** (stage 4). If it's a true
secret, it must never be `EXPO_PUBLIC_*`.

---

## 7. Backend path that respects the cost concern

You paused because you didn't want Railway/hosting bills before the POC proved
out. That instinct is right — so make "testable" independent of "hosted":

- **Mode A — Mock (zero hosting):** leave `EXPO_PUBLIC_API_URL` and Supabase env
  unset; the app already falls back to bundled mock data (`USE_REAL_API` /
  `USE_SUPABASE` flags). Perfect for UI/UX iteration and TestFlight demos at **$0**.
- **Mode B — Supabase-direct (free tier):** auth + venue reads straight from
  Supabase (already on the generous free tier you have). Needs the `venues`
  schema + seed — the `public` schema is currently **empty**, so this is a small
  data task, not a hosting cost.
- **Mode C — Full API (Railway):** the Fastify API. **Defer until the POC
  justifies it.** Run it locally against Supabase for dev; only deploy to Railway
  when remote testers need real data.

**Recommendation for this week: ship in Mode A (or B if you want real auth), keep
Railway undeployed/paused.** You get a launchable TestFlight build with $0 of new
spend, and the switch to Mode C is one GitHub Environment variable when you're
ready.

---

## 8. One-week plan to "testing successfully"

| Day | Outcome | Work |
| --- | --- | --- |
| **1** | App launches on TestFlight again | Merge PR #43. Add stages 2–3 (expo-doctor + `expo export`) to `ci.yml`. Ship a **Mode A** staging build; confirm launch. |
| **2** | Boot failures can't reach TestFlight | Add stage 4 (env validation) + stage 5 (boot smoke test) + root error boundary. |
| **3** | Real data (optional) | If going Mode B: create `venues` schema + seed in Supabase, enable anon sign-in. Else stay Mode A. |
| **4** | Fast iteration loop | Standardize daily dev on Expo Go / dev client; document the loop in `CONTRIBUTING.md`. TestFlight only for milestones. |
| **5** | Confidence | Optional stage 6 (simulator build + Maestro launch check). Retro: is the pipeline green and boring? |

Success criteria: a change goes from commit → known-good bundle in CI in <5 min,
and TestFlight is something you *release* to, not something you *debug* on.

---

## 9. Immediate next actions

- [ ] Merge **PR #43** (crash fix + Sentry + env injection).
- [ ] Add `EXPO_PUBLIC_SENTRY_DSN` (and optionally `EXPO_PUBLIC_API_URL`) to the
      **staging** GitHub Environment.
- [ ] Add to `ci.yml`: `npx expo-doctor` and `npx expo export --platform ios`
      (with production-like env) as required checks.
- [ ] Add `src/lib/env.ts` (zod validation of `EXPO_PUBLIC_*`) imported by the
      export path so missing config fails the bundle with a named error.
- [ ] Add a root `ErrorBoundary` in `app/_layout.tsx`.
- [ ] Add a boot smoke test that renders the root with native modules mocked.
- [ ] Decide Mode A vs B for this week's testing (recommend A).

> The north star: **the pipeline should be boring.** Every failure that reached
> TestFlight this past month should, going forward, be a red check in CI within
> minutes — with a message that says exactly what's wrong.
