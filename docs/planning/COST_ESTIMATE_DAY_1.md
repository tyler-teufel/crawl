# Day 1 Cost Estimation — Crawl Nightlife App

**Prepared:** 2026-04-19
**Prepared for:** Tyler Teufel
**Scope:** Launch-day infrastructure, third-party services, developer program fees, and recurring operational costs for a v1.0 soft launch (single city, <5k MAU target).
**Methodology:** Costs derived from the architecture documented in `BACKEND_IMPLEMENTATION_PLAN.md`, `DATA_PIPELINE.md`, `CICD_PIPELINE.md`, and `ROADMAP.md`, plus current-published pricing for the recommended cost-optimal stack. Figures are USD and reflect list pricing as of April 2026; confirm before commitment.

---

## 1. Recommended Cost-Optimal Stack

The backend research tracker flags DB host, ORM, auth service, and hosting as **undecided**. The following picks minimize Day 1 outlay while preserving the architectural contracts the mobile app already depends on (TanStack Query hooks, `EXPO_PUBLIC_API_URL`, Zod-shared types).

| Layer | Recommendation | Rationale |
|---|---|---|
| **Database + Auth + Realtime** | **Supabase (Free tier)** | PostGIS ships enabled; bundles Auth (JWT + Apple/Google OAuth), Realtime (replaces Socket.IO), and Storage. Collapses 3 paid services into one free tier. |
| **API server (Fastify)** | **Fly.io shared-cpu-1x (1 machine, auto-stop)** | Cheapest container that supports persistent WS; ~$0 idle with auto-stop + $0.0000022/s when running. Alternative: Railway Hobby ($5 flat). |
| **Redis** | **Defer** — use Postgres for vote counts; add Upstash free tier only if leaderboard latency becomes an issue | `BACKEND_IMPLEMENTATION_PLAN.md` Phase 2 explicitly marks Redis "may defer." |
| **Venue data** | **Google Places API** ($200/mo free credit) + Yelp Fusion (500 free calls/day fallback) | $200 credit covers ~11k Place Details calls/mo — enough for single-city seed + nightly refresh. |
| **Maps (mobile)** | **Mapbox** (50k monthly map loads free) | Cheaper ceiling than Google Maps SDK once the $200 credit is exhausted. |
| **Error tracking** | **Sentry Developer (free)** | 5k errors + 10k performance units / mo; one SDK covers mobile + API. |
| **Push notifications** | **Expo Push** | Free, no quota for reasonable volumes. |
| **Mobile builds** | **EAS Build Free** | 30 builds/mo (Medium priority queue) — sufficient pre-launch cadence. |
| **CI/CD** | **GitHub Actions (free allotment)** | 2,000 private-repo minutes/mo; the 5 workflows in `CICD_PIPELINE.md` fit comfortably. |
| **Domain + email** | Namecheap `.app` + Cloudflare Email Routing | TLS via Fly.io / Supabase managed certs at no cost. |

---

## 2. One-Time Launch Costs (Month 0)

| # | Item | Vendor | Cost (USD) | Notes |
|---|---|---|---:|---|
| 1 | Google Play Developer Account | Google | **$25.00** | One-time; required for Play Store submission via `eas submit`. |
| 2 | Domain registration (`.app`, 1 yr) | Namecheap / Cloudflare | **$12.00** | `.com` ~$11; `.app` enforces HSTS (recommended for mobile). |
| 3 | Apple Developer Program (annual — billed up front) | Apple | **$99.00** | Required for App Store submission and push notification certs. |
| 4 | Trademark search (optional, recommended) | USPTO TESS (self-serve) | **$0.00** | TESS is free; formal filing deferred. |
| 5 | Legal — Privacy Policy + ToS (template) | Termly / iubenda Starter | **$0.00–$10.00** | Free tier sufficient for v1; both stores require a hosted privacy URL. |
| | **Subtotal — One-Time** | | **$136.00–$146.00** | |

---

## 3. Recurring Monthly Costs — Launch Month (Month 1)

| # | Item | Vendor | Tier | Monthly (USD) | Notes |
|---|---|---|---|---:|---|
| 1 | Postgres + PostGIS + Auth + Realtime | Supabase | Free | **$0.00** | 500 MB DB, 50k MAU, 5 GB egress, 2 concurrent Realtime connections per client. |
| 2 | API container (Fastify) | Fly.io | shared-cpu-1x @ 256 MB, auto-stop | **$0.00–$5.00** | $5 free allotment covers a single always-on machine; auto-stop drops idle cost to ~$0. |
| 3 | Outbound bandwidth | Fly.io | 160 GB free | **$0.00** | Well above Day-1 needs. |
| 4 | Venue ingestion | Google Places API | $200 credit | **$0.00** | Budget alert at $150 recommended. |
| 5 | Map tiles | Mapbox | 50k loads free | **$0.00** | |
| 6 | Error + performance monitoring | Sentry | Developer (free) | **$0.00** | 5k errors / 10k perf units. |
| 7 | Push notifications | Expo Push | Free | **$0.00** | |
| 8 | Mobile build + OTA | EAS | Free | **$0.00** | 30 builds/mo + unlimited OTA. |
| 9 | CI/CD minutes | GitHub Actions | 2,000 free | **$0.00** | 5 workflows; fingerprint + lint ≈ 6 min per PR. |
| 10 | DNS / TLS / WAF | Cloudflare | Free | **$0.00** | Proxy in front of Fly.io. |
| 11 | Transactional email (auth verify, password reset) | Resend | Free tier (3k emails/mo) | **$0.00** | |
| 12 | Secrets / config | Fly.io + GitHub Encrypted Secrets | — | **$0.00** | |
| 13 | Domain renewal amortized (annual ÷ 12) | Namecheap | — | **$1.00** | |
| 14 | Apple Developer Program amortized (annual ÷ 12) | Apple | — | **$8.25** | |
| | **Subtotal — Recurring (Month 1)** | | | **$9.25–$14.25** | |

---

## 4. Consumption-Based / Variable Costs (Day 1 Bounded Estimate)

| Service | Free Ceiling | Expected Day 1 Usage | Overage Rate | Expected Overage |
|---|---|---|---|---:|
| Supabase DB storage | 500 MB | ~50 MB (seed venues + test users) | $0.125/GB-mo | $0.00 |
| Supabase Auth MAU | 50,000 | <500 | $0.00325/MAU | $0.00 |
| Supabase Realtime msgs | 2M/mo | <100k | $2.50/M | $0.00 |
| Fly.io compute | $5 credit | ~$3 worth | $0.0000022/s | $0.00 |
| Google Places | $200 credit | ~$30 (≈3k Place Details calls) | $17/1k | $0.00 |
| Mapbox loads | 50,000 | <10,000 | $0.50/1k over | $0.00 |
| Sentry errors | 5,000/mo | <500 | $0.00029/error | $0.00 |
| GitHub Actions | 2,000 min | ~400 | $0.008/min (Linux) | $0.00 |

**Projected overage at launch: $0.00.** First meaningful cost pressure arrives when MAU crosses ~5k (Supabase Pro at $25/mo becomes necessary) or Places calls cross ~11k/mo.

---

## 5. App Store / Platform Fees (Revenue-Side, Non-Launch)

Listed for completeness; **no Day 1 cash outlay** as the app ships free with no IAP at v1.0.

| Platform | Fee | Applies To |
|---|---|---|
| Apple App Store | 30% (15% under Small Business Program, <$1M ARR) | Future paid features / subscriptions. |
| Google Play | 30% (15% on first $1M annually; 15% on subs) | Future paid features / subscriptions. |
| Stripe (if web billing added) | 2.9% + $0.30 / transaction | Not applicable Day 1. |

---

## 6. Day 1 Total Cost Summary

| Category | Amount (USD) |
|---|---:|
| One-time launch fees (Section 2) | **$136.00–$146.00** |
| Month 1 recurring (Section 3) | **$9.25–$14.25** |
| Variable / consumption overages (Section 4) | **$0.00** |
| **Total — Launch Month cash outlay** | **~$145.25–$160.25** |
| **Total — Month 2+ ongoing run-rate** | **~$9.25–$14.25 / mo** |

**Annualized Year-1 run-rate** (12 mo recurring + one-time): **≈ $250–$320.**

---

## 7. Key Risks & Sensitivity Drivers

1. **Places API burn.** If venue refresh cron runs hourly instead of nightly, $200 credit can exhaust mid-month. Mitigation: nightly refresh + diff-only upserts; set a $100 billing alert.
2. **Supabase 500 MB ceiling.** Vote history grows unbounded. Mitigation: enforce the `DATE` UNIQUE constraint already in schema + TTL-prune `votes` older than 90 days (planned in `BACKEND_IMPLEMENTATION_PLAN.md` Phase 2 "scheduled jobs").
3. **WebSocket scaling.** Fly.io single-machine WS ceiling ~5k concurrent. v2.0 realtime (`ROADMAP.md`) will force horizontal scaling (+$5–15/mo per extra machine) or Supabase Realtime entirely.
4. **EAS free-tier queue times** can exceed 30 min at peak — upgrade to Production ($19/mo) only if release cadence demands it.
5. **Decision reversibility.** Choosing Supabase couples Auth + DB + Realtime. Swapping out any one component later is a multi-day refactor (`DESIGN_DECISIONS.md` should capture this trade-off when the decision is formalized).

---

## 8. Recommended Budget Posture

- **Provision a $200 Year-1 infra budget** plus the $124 in developer-program fees → **$324 envelope**.
- **Set billing alerts** at 50% / 80% / 100% on Google Cloud (Places), Fly.io, and Supabase.
- **Revisit at 2,500 MAU.** Expected tier jump: Supabase Pro ($25) + Fly.io second machine ($5) → new run-rate ~$40/mo.

---

*Figures reflect published pricing at the time of writing and should be re-validated before vendor commitment. The recommended stack resolves 4 of the 17 still-open rows in the backend research tracker — documenting these picks in `DESIGN_DECISIONS.md` is the suggested next step per the root CLAUDE.md doc-maintenance mandate.*
