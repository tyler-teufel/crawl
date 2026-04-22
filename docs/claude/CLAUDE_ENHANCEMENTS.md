# Claude Code Enhancements for Crawl

A practical guide to leveling up your Claude Code / AI-assisted workflow for this specific project. Each section is actionable — not generic advice.

---

## 1. MCP Servers to Add

MCP (Model Context Protocol) servers give Claude direct access to external tools and data sources during a session. Add these to your `~/.claude/claude_desktop_config.json` (or via `claude mcp add`).

### GitHub MCP

**Why**: Lets Claude read PR diffs, create/close issues, comment on PRs, and check CI status without copy-pasting URLs. Especially useful when reviewing a backend PR that touches both `apps/api` and `apps/mobile`.

```bash
claude mcp add github -- npx -y @modelcontextprotocol/server-github
```

Set `GITHUB_PERSONAL_ACCESS_TOKEN` in your environment. Scopes needed: `repo`, `read:org`.

**Immediate value for Crawl**:

- "Create a GitHub issue for the Phase 1 framework decision" → Claude drafts and files it
- "Review PR #42 against the design system rules" → Claude reads the diff and flags issues
- "What CI checks are failing on the feature-backend branch?" → Claude checks without you switching tabs

### Supabase / Postgres MCP

**Why**: Once `apps/api` has a database, Claude can inspect live schema, run exploratory queries, and validate that migrations ran correctly — without you writing the query and pasting results back.

**If you go with Supabase**:

```bash
claude mcp add supabase -- npx -y @supabase/mcp-server-supabase \
  --project-ref <your-project-ref> \
  --access-token <your-access-token>
```

**If you go with a raw Postgres connection** (Neon, Railway, etc.):

```bash
claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres \
  postgresql://user:pass@host/dbname
```

**Immediate value for Crawl**:

- "Did the PostGIS extension get enabled?" → Claude runs `SELECT * FROM pg_extension`
- "Show me the current hotspot scores for Austin venues" → Claude queries live
- "The venues migration failed — what's the current schema?" → Claude inspects and diagnoses

> **Security note**: Point this at your development or staging database, not production.

### Filesystem MCP (already available)

Claude Code has filesystem access by default in your working directory. No action needed, but be aware: tools like the Supabase MCP can combine schema inspection with file reads to give Claude a complete picture of a migration vs. the live DB state.

### Linear or GitHub Issues (task tracking)

If you use Linear for Crawl roadmap items:

```bash
claude mcp add linear -- npx -y @modelcontextprotocol/server-linear
```

Set `LINEAR_API_KEY`. This lets Claude move tickets between states, create tasks from TODOs found in code, and link commits to issues automatically.

If you stick with GitHub Issues, the GitHub MCP above covers this.

---

## 2. Skills to Create

Skills are reusable prompt templates that Claude executes when you type a slash command. They're stored in `~/.claude/skills/` (or project-local in `.claude/skills/`). Create them via `/skill-creator` or write the markdown files directly.

### `/mobile-screen` — New Expo Screen

**Trigger**: When you need a new screen following the project's conventions (expo-router, NativeWind, RNR, VenueContext).

**What it should do**:

1. Read `CLAUDE.md` to recall routing conventions
2. Read an existing screen (`app/(tabs)/voting.tsx`) as a style reference
3. Scaffold the new screen file at the correct `app/` path
4. Add the route to the navigation structure in `ARCHITECTURE.md`
5. Add a `FILE_REFERENCE.md` entry

**Example usage**:

```
/mobile-screen app/(tabs)/leaderboard.tsx — Global leaderboard for a city
```

**Skill prompt outline** (save to `.claude/skills/mobile-screen.md`):

```markdown
The user wants to create a new Expo screen. Follow these steps:

1. Read CLAUDE.md to recall navigation and styling conventions
2. Read app/(tabs)/voting.tsx as a reference for screen structure
3. Create the new screen file at the path the user specified
4. Use NativeWind className styling, VenueContext for shared state,
   and TanStack Query hooks for data fetching
5. Update docs/ARCHITECTURE.md navigation tree
6. Add an entry in docs/FILE_REFERENCE.md
   Screen path and description: $ARGUMENTS
```

### `/api-endpoint` — New API Route

**Trigger**: When adding a new endpoint to `apps/api`.

**What it should do**:

1. Read `docs/BACKEND_IMPLEMENTATION_PLAN.md` to recall route naming and patterns
2. Scaffold the route file, service file, and repository file following the controller→service→repository pattern
3. Add Zod validation schemas for request body and query params
4. Write a Vitest integration test for the new route
5. Update `docs/DATA_PIPELINE.md` with the new endpoint

**Example usage**:

```
/api-endpoint GET /api/v1/venues/:id — fetch single venue by ID with vote count
```

**Skill prompt outline**:

```markdown
The user wants to scaffold a new API endpoint. Follow these steps:

1. Read docs/BACKEND_IMPLEMENTATION_PLAN.md for route naming conventions
2. Read an existing route file as style reference
3. Create: the route handler, a service function, and a repository method
4. Add Zod schemas for all inputs (params, query, body)
5. Return structured errors: { error: string, details?: object }
6. Write a Vitest integration test covering the happy path and a 400/404 case
7. Update docs/DATA_PIPELINE.md with the new endpoint entry
   Endpoint spec: $ARGUMENTS
```

### `/db-migration` — Database Migration File

**Trigger**: When changing the database schema.

**What it should do**:

1. Read the current schema files to understand existing tables/columns
2. Generate a migration file with an up and down migration
3. Name it with a timestamp prefix: `YYYYMMDDHHMMSS_description.sql`
4. Validate that the migration is reversible
5. Update `docs/DATA_PIPELINE.md` schema section

**Example usage**:

```
/db-migration add venue_hours table with day_of_week, open_time, close_time columns
```

**Skill prompt outline**:

```markdown
The user wants to create a database migration. Follow these steps:

1. Read existing migration files to understand naming and style conventions
2. Read docs/DATA_PIPELINE.md for the schema reference
3. Generate a SQL migration file with:
   - Timestamp-prefixed filename: YYYYMMDDHHMMSS\_<description>.sql
   - UP migration (the schema change)
   - DOWN migration (the rollback)
4. Use parameterized types consistent with the existing schema
   (PostGIS geography, UUID primary keys, timestamptz)
5. Update the schema table in docs/DATA_PIPELINE.md
   Migration description: $ARGUMENTS
```

### `/commit-and-push` — Smart Monorepo Git Workflow

**Trigger**: When you're ready to commit work and push to the feature branch.

**What it should do**:

1. Run `git status` to see what changed
2. Group changes by workspace: `apps/mobile`, `apps/api`, `packages/shared-types`, `docs/`
3. Stage and commit each workspace group separately with a scoped commit message (e.g., `feat(api): add venue repository`)
4. Or, if the changes span multiple workspaces in one logical unit, stage them together with a cross-workspace message
5. Push to the current branch

**Why this matters for a monorepo**: Commit scoping (`feat(mobile):`, `fix(api):`, `chore(docs):`) makes the git log readable and lets you filter history by workspace.

**Skill prompt outline**:

```markdown
The user wants to commit and push their current changes. Follow these steps:

1. Run git status and git diff to see all changes
2. Group changes by workspace (apps/mobile, apps/api, packages/shared-types, docs)
3. For each logical unit of work:
   - Stage the relevant files
   - Write a commit message with conventional commits format and workspace scope:
     feat(mobile): ..., fix(api): ..., chore(docs): ..., etc.
4. If multiple workspaces changed together for one feature, one commit is fine
5. Push to the current branch
6. Report the commit SHAs and push result
   $ARGUMENTS
```

---

## 3. Agents to Consider

Agents are autonomous Claude processes that run independently on a task. Use `claude --agent` or configure via the Agent SDK.

### PR Review Agent — Design System Checker

**Purpose**: Before merging any mobile PR, verify that new/modified components follow the design system rules.

**What it checks**:

- No hardcoded hex colors — use semantic tokens (`bg-primary`) or crawl palette classes
- No inline `style={{}}` props where a `className` would work
- NativeWind `className` props used instead of StyleSheet
- New screens export a default function and follow the expo-router naming pattern
- No direct `AsyncStorage` imports — all persistence goes through context or a hook

**How to trigger**: Comment `/review-design-system` on a PR, or run it automatically in CI via GitHub Actions + Claude API.

**Implementation sketch**:

```typescript
// In a GitHub Actions step, after checkout:
const changed = await getChangedFiles(pr); // only app/, components/
const violations = await claudeAgent({
  prompt: `Review these React Native files for design system violations.
           Rules: ${designSystemRules}
           Files: ${changed.map((f) => f.content).join('\n---\n')}`,
  model: 'claude-sonnet-4-6',
});
await postPRComment(violations);
```

### Test Generation Agent — Vitest + React Native Testing

**Purpose**: Given a new hook, service, or utility function, generate a test file.

**Why it's worth automating**: Writing tests is the task most likely to be skipped when moving fast. An agent that generates a first-draft test file (with the happy path, edge cases, and a TODO for any cases it couldn't infer) removes the blank-page problem.

**What it generates**:

- For `src/api/hooks/useVenues.ts` → a Vitest test with mocked TanStack Query and assertions on filter behavior
- For `apps/api/src/services/venueService.ts` → a Vitest unit test with a mock repository
- For `apps/api/src/routes/votes.ts` → a supertest/httpx integration test

**How to trigger**:

```bash
# Point at a file, get a test file back
claude "generate tests for apps/api/src/services/venueService.ts"
```

---

## 4. CLAUDE.md Improvements (Keep Improving)

The CLAUDE.md in this repo is already solid. Here's what to add over time as the project matures:

### Add Slash Command Triggers

As you create skills above, document them in CLAUDE.md so Claude (and future contributors) know they exist:

```markdown
## Slash Commands

| Command                                        | What it does                         |
| ---------------------------------------------- | ------------------------------------ |
| `/docs`                                        | Update docs/ after a code change     |
| `/mobile-screen <path> — <description>`        | Scaffold a new Expo screen           |
| `/api-endpoint <METHOD /path> — <description>` | Scaffold a new API route             |
| `/db-migration <description>`                  | Generate a migration file            |
| `/commit-and-push`                             | Stage, commit by workspace, and push |
```

### Document Environment Variables

Add an `## Environment Variables` section:

```markdown
## Environment Variables

### Mobile (apps/mobile)

- `EXPO_PUBLIC_API_URL` — Base URL for the API server (e.g., `https://api.crawlapp.com`)
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps key (iOS/Android)

### API (apps/api)

- `DATABASE_URL` — Postgres connection string
- `REDIS_URL` — Redis connection string
- `JWT_SECRET` — Access token signing secret (min 32 chars)
- `JWT_REFRESH_SECRET` — Refresh token signing secret (different from JWT_SECRET)
- `CORS_ORIGIN` — Comma-separated allowed origins

Never commit `.env` files. Use `.env.example` files with placeholder values.
```

### Document the Zod Type Contract

Once `packages/shared-types` exists, add a note about where types live and how to import them, so Claude always reaches for the shared package instead of duplicating types:

```markdown
### Shared Types (packages/shared-types)

Import shared types from `@crawl/shared-types`, not from local files:

- `Venue`, `VenueType`, `VenueFilters` — venue domain types
- `Vote`, `VoteState` — voting domain types
- `ApiResponse<T>`, `PaginatedResponse<T>` — API response envelopes
- Zod schemas: `VenueSchema`, `VoteSchema` — use for both validation and type inference
```

### Keep the `/docs` Trigger

The current `/docs` trigger is well-placed. Keep it. Add this specific instruction to make doc updates even more reliable:

```markdown
When adding a new API endpoint or database table, run:
/docs added <endpoint or table description>
```

---

## 5. Workflow Automations

### Scheduled: Weekly TODO Audit

Every Monday, run an automated scan of `// TODO` and `// FIXME` comments across the codebase, grouped by file and priority, and post a summary to a GitHub issue or Slack.

**Using Claude Code's scheduled tasks**:

```bash
/schedule "Every Monday at 9am: scan the codebase for TODO and FIXME comments,
group them by apps/mobile and apps/api, estimate which ones are blocking
production launch vs nice-to-have, and create a GitHub issue titled
'Weekly TODO Audit - <date>' with the results"
```

Or via the `cron` trigger in your CI pipeline:

```yaml
# .github/workflows/todo-audit.yml
on:
  schedule:
    - cron: '0 9 * * 1' # Monday 9am UTC
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: grep -rn "TODO\|FIXME" apps/ src/ --include="*.ts" --include="*.tsx" > todos.txt
      - run: gh issue create --title "TODO Audit $(date +%Y-%m-%d)" --body "$(cat todos.txt)"
```

### Auto-Docs on New Screen or Endpoint

Add a pre-commit hook (via `lefthook` or `husky`) that detects when a new file is added in `app/` or `apps/api/src/routes/` and reminds you to run `/docs`:

```bash
# lefthook.yml
pre-commit:
  commands:
    new-screen-reminder:
      glob: "app/**/*.tsx"
      run: |
        echo "New screen detected. Remember to run /docs to update ARCHITECTURE.md and FILE_REFERENCE.md"
    new-route-reminder:
      glob: "apps/api/src/routes/**/*.ts"
      run: |
        echo "New API route detected. Remember to run /docs to update DATA_PIPELINE.md"
```

### Auto-Lint on API Changes

In CI, when `apps/api` changes are detected, automatically run the full `turbo lint --filter=api && turbo typecheck --filter=api` pipeline before allowing merge. This is especially important as the shared-types package grows — a type change in `packages/shared-types` should gate on both `mobile` and `api` type checks passing.

```yaml
# .github/workflows/api-checks.yml
on:
  pull_request:
    paths:
      - 'apps/api/**'
      - 'packages/shared-types/**'
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: turbo lint typecheck test --filter=api --filter=shared-types
```

### Environment Validation on Startup

Add a startup check to `apps/api/src/index.ts` that validates required env vars are present before the server starts. This prevents the silent "API is up but hitting undefined URL" class of bugs:

```typescript
// apps/api/src/config.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3000),
});

export const config = envSchema.parse(process.env);
// Throws with a clear error message if any required var is missing
```

This pattern pairs well with the `/api-endpoint` skill — the skill should import from `config.ts` rather than reading `process.env` directly.

---

## Quick-Start Checklist

In order of highest impact for where the project is right now (early backend build-out):

- [ ] Add GitHub MCP: gets Claude reading PRs and issues without context-switching
- [ ] Create `/api-endpoint` skill: every new route scaffolded consistently from day one
- [ ] Create `/db-migration` skill: no ad-hoc schema changes, every change is tracked
- [ ] Add Postgres MCP (point at dev DB): Claude can inspect schema during debugging
- [ ] Add environment variable docs to CLAUDE.md: prevents "what's this env var for?" in future sessions
- [ ] Set up weekly TODO audit: surfaces deferred work before it becomes launch blockers
- [ ] Create `/mobile-screen` skill: keeps the frontend consistent as new screens are added
