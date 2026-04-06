Create a Google Sheets spreadsheet called "Crawl Backend Research Tracker" with the following structure:

## Sheet 1: "Decision Tracker"

Create a table with these columns: Area, Decision, Options to Evaluate, Status, Choice, Pros, Cons, Notes, Priority, Research Links.

Populate it with this data:

| Area | Decision | Options | Status | Choice | Priority |
|------|----------|---------|--------|--------|----------|
| Framework | API server framework | Express, Fastify, Hono, NestJS | Not Started | | High |
| Architecture | Monorepo vs separate repo | Turborepo, npm workspaces, separate repo | Decided | Turborepo | High |
| API style | REST vs tRPC | REST (current plan), tRPC (end-to-end types) | Not Started | | High |
| Database | Hosting provider | Supabase, Neon, Railway, AWS RDS | Not Started | | High |
| Database | ORM / query builder | Drizzle, Prisma, Kysely, raw pg | Not Started | | High |
| Database | Pagination strategy | Cursor-based vs offset-based | Not Started | | Medium |
| Cache | Redis provider + necessity | Upstash, Railway, defer to later | Not Started | | Low |
| Auth | Build vs service | Custom JWT, Supabase Auth, Clerk, Firebase Auth | Not Started | | High |
| Auth | OAuth providers | Apple (required if any social), Google | Not Started | | Medium |
| Venues | Data source | Google Places, Yelp Fusion, Foursquare, manual | Not Started | | High |
| Scoring | Hotspot algorithm | Vote count, velocity, recency, external ratings | Not Started | | Medium |
| Real-time | WebSocket approach | Socket.IO, ws, Supabase Realtime, SSE, managed service | Not Started | | Low |
| Hosting | Deployment platform | Railway, Render, Fly.io, AWS, Supabase Edge Functions | Not Started | | Medium |
| Hosting | Container vs serverless | Containers (WS support) vs serverless (cost) | Not Started | | Medium |
| Observability | Error tracking | Sentry, Bugsnag, Datadog | Not Started | | Low |
| Observability | Logging platform | Datadog, Logtail, CloudWatch | Not Started | | Low |
| Testing | Test framework | Vitest vs Jest | Not Started | | Medium |
| Testing | Test database strategy | Separate DB, transaction rollback, Docker per run | Not Started | | Medium |

### Formatting requirements

1. **Header row**: Bold, white text on dark purple (#2D1B69) background, frozen so it stays visible when scrolling.
2. **Status column**: Use data validation dropdowns with options: "Not Started", "Researching", "Decided". Color-code with conditional formatting — red for Not Started, yellow for Researching, green for Decided.
3. **Priority column**: Use data validation dropdowns with options: "High", "Medium", "Low". Conditional formatting — red for High, orange for Medium, blue for Low.
4. **Area column**: Group rows by area visually — merge or apply alternating light gray (#F3F3F3) and white backgrounds per area group so related decisions are visually clustered.
5. **Column widths**: Auto-fit, but make Notes and Pros/Cons columns wider (~300px) for longer text. Options to Evaluate should also be wider (~250px).
6. **Wrap text** on all cells so nothing is clipped.
7. **Borders**: Light gray gridlines on all cells.

## Sheet 2: "Option Deep Dives"

Create a second sheet for detailed per-option research with columns: Decision (reference), Option Name, Free Tier / Pricing, DX / Ease of Use (1-5), Performance Notes, Community / Ecosystem, Compatibility with Stack, Verdict (Keep / Eliminate / Winner).

Pre-populate rows for every option listed in the "Options to Evaluate" column from Sheet 1 (e.g., Express gets its own row, Fastify gets its own row, etc.). Leave research columns blank for me to fill in.

Apply the same header styling as Sheet 1. Add a data validation dropdown on the Verdict column with options: "Keep", "Eliminate", "Winner" with green/red/gold conditional formatting.
