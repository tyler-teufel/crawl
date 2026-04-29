# SonarQube Community Build Integration Plan

**Goal:** Add a SonarQube Community Build instance as a trailing code-quality and security dashboard for `apps/api`, `apps/mobile`, and `packages/shared-types`. Wire scanner runs into existing CI so every push to `main` updates the dashboard, and (eventually) gate the merge queue on the Sonar quality gate.

**Status:** Plan — nothing implemented yet.

---

## 0. What "Community Build" gives us (and what it does not)

SonarQube **Community Build** is the free, self-hostable distribution. As of 2025 it replaces the old "Community Edition / LTA" naming and ships on a biweekly release cadence. It includes the SonarJS analyzer, which covers JavaScript, TypeScript, JSX/TSX, and CSS — i.e. everything in this repo.

| Capability                                  | Community Build      | Notes                                               |
| ------------------------------------------- | -------------------- | --------------------------------------------------- |
| JS/TS/JSX/TSX rules + bug/smell/vuln engine | ✅                    | Covers `apps/api` (Node) and `apps/mobile` (RN).    |
| Test coverage import (LCOV / generic)       | ✅                    | We already produce v8 LCOV in `apps/api/coverage/`. |
| Quality gates on `main`                     | ✅                    | "Failed gate" surfaces in the UI and via API.       |
| **Multi-branch analysis**                   | ❌                    | Only `main` is analyzed.                            |
| **Pull-request decoration**                 | ❌                    | No inline PR comments; no per-PR gate.              |
| Project-level security hotspots / SAST      | ✅ (community ruleset) | Overlaps but does not replace CodeQL.               |
| SSO / LDAP                                  | ❌                    | Local users only.                                   |

**Implication for our PR workflow:** Sonar will tell us about new issues *after* a PR lands on `main`. PR-time quality gates remain CodeQL + ESLint + the `validate` job. We accept this as the cost of staying on the free tier; the alternative (SonarCloud free) would require making the repo public, and Developer Edition is paid.

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions runner (ci.yml → new sonarqube job)         │
│                                                             │
│   actions/checkout@v6  (fetch-depth: 0 — required by Sonar) │
│           │                                                 │
│           ▼                                                 │
│   npm ci  →  turbo run test --filter=api  (LCOV produced)   │
│           │                                                 │
│           ▼                                                 │
│   sonarsource/sonarqube-scan-action@v6                      │
│      env: SONAR_TOKEN, SONAR_HOST_URL                       │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTPS, token auth
               ▼
┌─────────────────────────────────────────────────────────────┐
│  SonarQube Community Build (Docker)                         │
│   sonarqube:community  (port 9000)                          │
│        │                                                    │
│        ├── postgres:16  (sonar metadata DB)                 │
│        └── volume: sonarqube_data, sonarqube_extensions     │
│                                                             │
│  Hosting options (pick one — see §3):                       │
│   A. Railway service (matches our existing infra)           │
│   B. Small VPS (Hetzner/Fly) we already manage              │
│   C. Local-only (docker-compose.sonar.yml) — dashboard      │
│      reachable only by devs running it locally; no CI feed  │
└─────────────────────────────────────────────────────────────┘
```

The scanner is stateless: it ships analysis to the server, which stores history in Postgres. No Sonar plugins or rules live in this repo — only `sonar-project.properties` and a small `.github/workflows/sonarqube.yml`.

---

## 2. Files this plan would add

| Path                                 | Purpose                                                              |
| ------------------------------------ | -------------------------------------------------------------------- |
| `sonar-project.properties`           | Project key, sources, exclusions, coverage report paths.             |
| `.github/workflows/sonarqube.yml`    | Runs scanner on `push → main` (and optionally manual dispatch).      |
| `docker-compose.sonar.yml`           | Local-dev stack for the SQ server (separate from the existing app    |
|                                      | `docker-compose.yml` so we don't slow down everyday `docker compose  |
|                                      | up`).                                                                |
| `docs/ops/SONARQUBE_OPERATIONS.md`   | Runbook (start/stop, upgrade, restore admin password, token rotate). |

No changes to `apps/api` or `apps/mobile` source.

---

## 3. Phased rollout

### Phase 1 — Stand up the server (local only)

- [ ] Add `docker-compose.sonar.yml` with `sonarqube:community` + `postgres:16` + named volumes.
- [ ] Document `sysctl -w vm.max_map_count=524288` requirement (Sonar's Elasticsearch needs it on Linux hosts).
- [ ] First-boot: log in as `admin`/`admin`, rotate password, create a project named `crawl`, generate a **project analysis token**.
- [ ] Verify a manual scan from a developer machine populates the dashboard.

**Exit criteria:** A developer can run `npm run sonar:scan` locally against `http://localhost:9000` and see results.

### Phase 2 — Configure analysis surface

- [ ] Author `sonar-project.properties` (see §5 for the proposed contents).
- [ ] Tune exclusions: `**/*.test.ts`, `**/dist/**`, `**/.expo/**`, `apps/mobile/ios/**`, `apps/mobile/android/**`, `**/drizzle/**` migrations.
- [ ] Wire API coverage: point `sonar.javascript.lcov.reportPaths` at `apps/api/coverage/lcov.info`.
- [ ] Decide whether to add coverage to `apps/mobile` *now* (out of scope here) or accept "no coverage data" for mobile in v1.

**Exit criteria:** Local scan reports issues against the right files only; coverage > 0% for `apps/api`.

### Phase 3 — Host the server somewhere CI can reach

Pick one — **decision needed before Phase 4**:

| Option                                | Pros                                            | Cons                                                       |
| ------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| **A. Railway service**                | Matches existing API hosting; one bill.         | Sonar+Postgres min plan likely $10–20/mo; Railway          |
|                                       |                                                 | services can sleep — Sonar dislikes cold starts.           |
| **B. Hetzner CX22 / Fly.io VM**       | Cheapest predictable cost (~$4–5/mo); full      | Adds a new host to operate; we own backups.                |
|                                       | control; no sleeps.                             |                                                            |
| **C. Local-only (no CI feed)**        | Free; no infra changes.                         | Only the dev who runs it sees data; useless for trends.    |

Default recommendation: **B** (small VM) unless we want everything on Railway for billing simplicity, in which case **A** with a "no-sleep" plan tier.

- [ ] Provision host; deploy via the same compose file.
- [ ] Put it behind an HTTPS reverse proxy (Caddy or Traefik — autocert).
- [ ] Add `SONAR_HOST_URL` and `SONAR_TOKEN` as GitHub repo secrets.

**Exit criteria:** `curl -fsSL "$SONAR_HOST_URL/api/system/status"` from a runner returns `UP`.

### Phase 4 — CI integration

- [ ] Add `.github/workflows/sonarqube.yml` triggered on `push → main` and `workflow_dispatch`.
- [ ] Job order: checkout (depth 0) → `npm ci` → `npx turbo run test --filter=api` (produces LCOV) → `sonarsource/sonarqube-scan-action@v6`.
- [ ] **Do not** trigger on `pull_request` — Community Build cannot decorate PRs and the run would just overwrite `main`'s data.
- [ ] Update `docs/ops/CICD_PIPELINE.md` with a SonarQube box in the diagram.

**Exit criteria:** Every merged PR to `main` results in a fresh dashboard update within ~5 min.

### Phase 5 — Quality gate enforcement (optional, later)

- [ ] In SQ, define a stricter "Crawl Default" gate: 0 new bugs/vulns, ≥80% coverage on new code, 0 new security hotspots.
- [ ] In `sonarqube.yml`, after the scan step, add `sonarsource/sonarqube-quality-gate-action@master` so a failed gate **fails the post-merge build** and pages whoever broke it.
- [ ] Decide: post-merge failure only, or do we also want a nightly "summary issue" auto-filed via `gh issue create`?

**Exit criteria:** A deliberate regression on a feature branch, after merge, turns the workflow red.

---

## 4. Quality gate strategy

Sonar's default gate ("Sonar way") is reasonable to start. We tighten only after we've seen one full week of clean runs, otherwise we'll be drowning in red. Proposed progression:

1. Week 1–2: default gate, **report-only** (no CI failure).
2. Week 3+: enforce gate on `push → main` (failed gate fails the workflow but doesn't auto-revert).
3. Later: add coverage threshold for `apps/api` once we've stabilized which files are excluded.

---

## 5. Proposed `sonar-project.properties`

```properties
sonar.projectKey=crawl
sonar.projectName=Crawl
sonar.sources=apps/api/src,apps/mobile/app,apps/mobile/components,apps/mobile/src,packages/shared-types/src
sonar.tests=apps/api/src,apps/api/tests
sonar.test.inclusions=**/*.test.ts,**/*.test.tsx
sonar.exclusions=**/dist/**,**/.expo/**,apps/mobile/ios/**,apps/mobile/android/**,**/drizzle/**,**/node_modules/**
sonar.javascript.lcov.reportPaths=apps/api/coverage/lcov.info
sonar.typescript.tsconfigPaths=apps/api/tsconfig.json,apps/mobile/tsconfig.json,packages/shared-types/tsconfig.json
sonar.sourceEncoding=UTF-8
```

(Final exclusions to be tuned in Phase 2 — this is a starting point.)

---

## 6. What this does *not* replace

| Tool               | Stays                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| ESLint + Prettier  | Yes — fast PR-time feedback; Sonar is post-merge.                       |
| CodeQL             | Yes — deeper SAST and runs on PRs; complementary to SonarJS.            |
| gitleaks           | Yes — Sonar Community has no first-class secret scanner.                |
| `npm audit`        | Yes — Sonar Community has no SCA / dependency CVE scanner.              |
| Vitest             | Yes — Sonar consumes its coverage output, doesn't run tests.            |

Net new value Sonar adds: a **trend-over-time dashboard** for technical debt, code smells, duplication, and cyclomatic complexity that none of the existing tools surface in one place.

---

## 7. Open decisions

1. **Hosting:** Railway, small VPS, or local-only? (See Phase 3 table.)
2. **Mobile coverage:** Add Jest/Vitest coverage to `apps/mobile` in v1, or ship without and just analyze code structure?
3. **Gate enforcement:** Hard-fail post-merge builds on gate failure, or only annotate?
4. **Repo visibility:** Confirmed private? If we ever flip the repo public, SonarCloud free tier becomes available and gives us PR decoration — we should reconsider Community Build at that point.
5. **Token rotation cadence:** 90 days is the SQ default — do we wire that into a calendar reminder or just rely on the "expires soon" warning?

---

## 8. Effort estimate

| Phase | Work                                              | Estimate    |
| ----- | ------------------------------------------------- | ----------- |
| 1     | Local docker-compose + first scan                 | 0.5 day     |
| 2     | Tune `sonar-project.properties` + exclusions      | 0.5 day     |
| 3     | Provision host + HTTPS + secrets                  | 0.5–1 day   |
| 4     | CI workflow + docs update                         | 0.5 day     |
| 5     | Quality gate tuning (deferred ~2 weeks)           | 0.5 day     |
|       | **Total to "live dashboard, post-merge gating"**  | **~3 days** |

Recurring cost: $0 (option C), ~$5/mo (option B), ~$15/mo (option A).
