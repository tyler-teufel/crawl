# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## External Knowledge Base (Crawl Wiki)

An LLM-maintained knowledge base lives at `C:\Users\tyler\Coding Projects\crawl\wiki\`. It is a structured second brain for the Crawl nightlife app: cross-referenced **source summaries** (one per `docs/*.md`), **entity pages** (Fastify, Turborepo, VenueContext, apps/mobile, apps/api, shared-types, TanStack Query, NativeWind, React Native Reusables, expo-router, Zod, EAS Build, GitHub Actions Workflows, Hotspot Score, Crawl App), **concept pages** (File-Based Routing, Controller-Service-Repository Pattern, Monorepo Workspace Scoping, Query Key Factory Pattern, Optimistic Updates, OTA vs Binary Releases, PostGIS Geo Queries, Semantic vs Crawl Color Tokens, etc.), **syntheses**, and filed **queries**. Pages are markdown with YAML frontmatter (`type: source|entity|concept|synthesis|query`) and use Obsidian-style `[[wikilinks]]`.

### When to consult it

- Before answering non-trivial research or synthesis questions about Crawl's architecture, tech choices, or decision history.
- When the user references prior research or asks "what did we decide about X".
- When working on code that touches systems documented there — backend plan, monorepo scoping, state/data flow, styling pipeline.

### How to consult it

1. **Always read `wiki/index.md` first** to locate candidate pages.
2. If you need schema details (page types, linking rules, ingest workflow), read `wiki/CLAUDE.md` — it is the authority for anything beyond passive reads.
3. Follow `[[wikilinks]]` to connected pages; pages are designed to be traversed, not read in isolation.

### Boundaries

- **Treat the wiki as read-only from this directory.** This CLAUDE.md's directory is not the wiki's home — do not create, modify, or reorganize wiki pages from here. Wiki maintenance (ingest, lint, restructuring) happens in the Crawl repo where `wiki/CLAUDE.md` is the authority.
- If insights from work done here should be filed into the wiki, tell the user to switch into the Crawl repo and run an ingest there.
- **The wiki may lag reality.** If a wiki claim conflicts with the current working directory's source code, trust the local code and flag the discrepancy to the user so the wiki can be refreshed.

## Commands

```bash
# ── Monorepo (Turborepo) ──────────────────────────────────
turbo dev                         # Start all apps in dev mode
turbo dev --filter=mobile         # Start only the mobile app
turbo dev --filter=api            # Start only the API server
turbo build                       # Build all packages
turbo build --filter=mobile       # Build mobile only
turbo lint                        # Lint all workspaces
turbo typecheck                   # Type-check all workspaces
turbo test                        # Run tests across all workspaces

# ── Mobile (apps/mobile) ─────────────────────────────────
npm start            # or: npm run ios | npm run android | npm run web
npm run prebuild     # Native build prep (run before iOS/Android builds)
npm run lint         # Lint and format check
npm run format       # Auto-fix lint and formatting issues

# ── API (apps/api) ───────────────────────────────────────
# (Not yet scaffolded — see docs/BACKEND_IMPLEMENTATION_PLAN.md)
# npm run dev         # Start API with hot-reload (tsx watch)
# npm run build       # Compile TypeScript
# npm run test        # Run Vitest suite
```

There is no test suite configured yet.

## Monorepo Structure

This project is in-progress migration to a **Turborepo monorepo**. The target structure:

```
crawl/
├── apps/
│   ├── mobile/          → Expo React Native app (primary screen code + config)
│   └── api/             → Backend API server (to be scaffolded)
├── packages/
│   └── shared-types/    → TypeScript types shared between mobile and API
├── docs/                → Project-wide documentation
├── turbo.json           → Turborepo pipeline config
└── package.json         → Root workspace manifest
```

**Current migration state**: Config files for the mobile app have been moved to `apps/mobile/` (`babel.config.js`, `metro.config.js`, `tailwind.config.js`, `tsconfig.json`, etc.). The main app source (`app/`, `components/`, `src/`) still lives at the repo root until the migration is complete.

**`packages/shared-types`** — Once created, shared types (Venue, Vote, User, API request/response shapes) should live here and be imported by both `apps/mobile` and `apps/api`.

## Mobile App (apps/mobile)

This is an **Expo React Native** app (SDK 54) using **file-based routing** via `expo-router`. The entry point is `expo-router/entry`.

### Navigation Structure

```
app/_layout.tsx         → Root Stack (ThemeProvider + VenueProvider + PortalHost)
app/(tabs)/_layout.tsx  → Tab navigator with custom TabBar
app/(tabs)/index.tsx    → Explore screen (map + search + venue carousel)
app/(tabs)/voting.tsx   → Daily voting screen (countdown + ranked list)
app/(tabs)/global.tsx   → Global Rankings (placeholder)
app/(tabs)/profile.tsx  → Profile (placeholder)
app/venue/[id].tsx      → Venue detail (push navigation)
app/filters.tsx         → Filter modal (transparentModal presentation)
```

### Directory Layout

- `app/` — Screens and navigation (expo-router file-based routing)
- `components/` — Presentational components organized by domain (`ui/`, `map/`, `venue/`, `voting/`, `layout/`)
- `src/` — Shared logic aliased as `@/*` (`types/`, `data/`, `constants/`, `context/`, `hooks/`, `lib/`, `api/`)
- `docs/` — Project documentation (see Documentation section below)
- `assets/` — Static images

### Styling

Styling uses **NativeWind** (Tailwind CSS for React Native). Use `className` props on React Native components. The Babel preset is configured with `jsxImportSource: 'nativewind'` so JSX automatically gets NativeWind support. Prettier auto-sorts Tailwind classes via `prettier-plugin-tailwindcss`.

There are two color systems:

- **Semantic tokens** (`bg-primary`, `text-muted-foreground`) — CSS variable-based, defined in `global.css`, used by RNR components. Prefer these for new components.
- **Crawl palette** (`bg-crawl-purple`, `text-crawl-text-muted`) — hardcoded hex in `tailwind.config.js`, used by existing custom components.

Tailwind content paths: `app/**`, `components/**`, `src/**`, `node_modules/@rnr/**`.

### Path Aliases

`@/*` maps to `src/*` (configured in `tsconfig.json`). Place shared mobile logic under `src/`.

### Component Library

**React Native Reusables** (RNR) is integrated. Components are source-copied, not package-imported. Add components via `npx @react-native-reusables/cli add <component>`. Components use `cn()` from `@/lib/utils` for class merging. Theme flows from CSS variables in `global.css` through `tailwind.config.js` into component `className` props.

### State Management

A single `VenueContext` (React Context) at the root layout level manages filters, search, votes, and derived `filteredVenues`. All screens and modals share this context.

**Data fetching** uses **TanStack Query** (`src/api/`). Query hooks (`useVenues`, `useVoteState`, `useCastVote`, etc.) currently return mock data — the `queryFn` implementations will be swapped to call the real API when `apps/api` is live. The API client (`src/api/client.ts`) reads from `EXPO_PUBLIC_API_URL`.

### Key Dependencies

- `@tanstack/react-query` — server state, caching, and mutations
- `react-native-reanimated` + `react-native-worklets` — animations/worklets (worklets Babel plugin is active)
- `react-native-svg` — SVG rendering (used for HotspotScore circular progress)
- `react-native-safe-area-context` + `react-native-screens` — navigation primitives
- `@rn-primitives/portal` — portal rendering for RNR overlay components
- `class-variance-authority` + `clsx` + `tailwind-merge` — component variant/class utilities
- `tailwindcss-animate` — CSS animation utilities
- TypeScript strict mode is enabled

### Theme Configuration

Colors are defined in three synced locations:

1. `global.css` — CSS variables (HSL values) for light/dark mode
2. `tailwind.config.js` — Maps CSS vars to Tailwind classes + `crawl-*` hex palette
3. `src/lib/theme.ts` — `THEME` and `NAV_THEME` objects for React Navigation

The app forces dark mode on mount via `useColorScheme` + `setColorScheme('dark')` in the root layout.

## Backend (apps/api)

The API is being built as a Node.js/TypeScript server in `apps/api/`. See `docs/BACKEND_IMPLEMENTATION_PLAN.md` for the full phased plan. Key points:

### Route Structure

```
GET    /api/v1/venues              List venues (city, lat, lng, radius, filters, q, page, limit)
GET    /api/v1/venues/:id          Single venue detail
GET    /api/v1/votes               User's vote state (auth required)
POST   /api/v1/votes               Cast a vote (auth required)
DELETE /api/v1/votes/:venueId      Remove a vote (auth required)
GET    /api/v1/trending/:city      Ranked venues for a city
POST   /api/v1/auth/register       Create account
POST   /api/v1/auth/login          Authenticate
POST   /api/v1/auth/refresh        Refresh JWT
GET    /api/v1/health              Health check (DB + Redis connectivity)
```

### Architecture Pattern

```
Route handler (HTTP layer)
    └── Service (business logic — independently testable)
            └── Repository (DB queries — one per entity)
```

### Key Technology Decisions (pending — see plan)

- **Framework**: Express / Fastify / Hono (undecided — document choice in `DESIGN_DECISIONS.md` when made)
- **Database**: Postgres with PostGIS; hosting TBD (Supabase / Neon / Railway)
- **ORM**: Drizzle / Prisma / Kysely (undecided)
- **Auth**: Custom JWT or Supabase Auth (undecided)
- **Validation**: Zod (strongly preferred — shares types with mobile app)
- **Testing**: Vitest

### Environment Variables

```
DATABASE_URL          Postgres connection string
REDIS_URL             Redis connection string (if used)
JWT_SECRET            Access token signing secret
JWT_REFRESH_SECRET    Refresh token signing secret
CORS_ORIGIN           Allowed CORS origins
```

## Documentation

### Automatic Documentation Maintenance

**IMPORTANT:** When you make changes to the codebase that alter architecture, add/remove files, introduce new patterns, add dependencies, or change how systems connect, you MUST update the relevant documentation in `docs/`. Documentation is a living part of this project, not an afterthought.

### When to Update Docs

Update documentation alongside code changes in these situations:

| Change Type                    | Docs to Update                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| New screen or route            | `ARCHITECTURE.md` (navigation tree, diagrams), `FILE_REFERENCE.md`, `PROJECT_OVERVIEW.md` |
| New component                  | `FILE_REFERENCE.md` (components section), `ARCHITECTURE.md` (dependency graph)            |
| New file in `src/`             | `FILE_REFERENCE.md` (shared logic section)                                                |
| New API endpoint               | `BACKEND_IMPLEMENTATION_PLAN.md`, `FILE_REFERENCE.md`, `DATA_PIPELINE.md`                 |
| New dependency added           | `PROJECT_OVERVIEW.md` (tech stack), `DESIGN_DECISIONS.md` if a choice was made            |
| Theme/color changes            | `REACT_NATIVE_REUSABLES.md` (color mapping table), `ARCHITECTURE.md` (styling pipeline)   |
| State management changes       | `ARCHITECTURE.md` (state tree)                                                            |
| Config file changes            | `FILE_REFERENCE.md` (config section)                                                      |
| Major architectural decision   | `DESIGN_DECISIONS.md` (new section explaining what, why, trade-offs)                      |
| Backend technology chosen      | `DESIGN_DECISIONS.md` + resolve pending items in `BACKEND_IMPLEMENTATION_PLAN.md`         |
| Feature completed from roadmap | `ROADMAP.md` (move to done), `PROJECT_OVERVIEW.md` (update status)                        |
| New conventions established    | `CONTRIBUTING.md`                                                                         |

### Documentation Standards

Every doc update must follow these standards:

**Diagrams** — Include ASCII diagrams when documenting:

- Navigation flow changes (box diagrams showing route relationships)
- Component hierarchy changes (tree diagrams showing parent-child relationships)
- Data flow changes (arrow diagrams showing how data moves between systems)
- System architecture changes (layered diagrams showing runtime stack)

Use box-drawing characters (`┌─┐│└─┘`), arrows (`──►`, `◄──`), and clear labels. Keep under 80 chars wide.

**Design decisions** — When introducing a new library, pattern, or making a significant choice, add a section to `DESIGN_DECISIONS.md` with:

- What was chosen
- What the alternatives were
- Why this approach won
- Trade-offs accepted

**File entries** — When adding to `FILE_REFERENCE.md`, describe:

- What the file does (behavior, not just restating the filename)
- Key implementation details
- How it connects to other files in the project

**Use guides** — When adding a new system or integration, include practical usage examples showing:

- How to use the feature as a developer
- Common customization patterns
- Troubleshooting for known issues

### Doc Structure

```
docs/
├── README.md                      # Index linking to all docs
├── PROJECT_OVERVIEW.md            # What the app is, features, tech stack
├── ARCHITECTURE.md                # Structure, navigation, state, styling, diagrams
├── FILE_REFERENCE.md              # Every file with detailed descriptions
├── DESIGN_DECISIONS.md            # Rationale behind technical choices
├── REACT_NATIVE_REUSABLES.md      # RNR setup, theming, adding components
├── MAPS_INTEGRATION.md            # Guide for replacing map placeholder
├── DATA_PIPELINE.md               # Backend architecture and migration plan
├── BACKEND_IMPLEMENTATION_PLAN.md # Phased backend build-out plan
├── CICD_PIPELINE.md               # Build, test, release pipeline
├── CONTRIBUTING.md                # How to add screens, components, follow conventions
├── ROADMAP.md                     # Prioritized next steps
├── CLAUDE_ENHANCEMENTS.md         # Claude Code / AI workflow improvements
└── VERSION_1.0_DOCUMENT.md        # Historical v1.0 consolidated doc
```

### The `/docs` Skill

Run `/docs` (or `/docs <description of what changed>`) to trigger a comprehensive documentation update pass. This scans recent changes, determines which docs are affected, reads the source files and existing docs, and applies targeted updates.

## Wiki / Knowledge Base (`wiki/`)

The repository also contains an **LLM-maintained knowledge base** at `wiki/`, distinct from `docs/`. Where `docs/` is human-facing project documentation that you update alongside code changes, `wiki/` is a structured second brain — entity pages, concept pages, source summaries, and cross-referenced syntheses — owned and maintained entirely by the LLM agent.

**When to use the wiki:**

- The user asks a research/synthesis question that spans multiple docs or sources ("how does the voting flow connect to the backend plan?", "what's the rationale behind X decision?").
- The user references prior research, ingested articles, or wants to recall something filed previously.
- The user explicitly says "check the wiki", "ingest this", "lint the wiki", or "file this answer".
- You're about to answer a non-trivial question and the wiki may already contain a relevant synthesis — read `wiki/index.md` first to check.

**How to use the wiki:**

1. Load `wiki/CLAUDE.md` for the schema and operating rules — it governs all wiki operations.
2. Always read `wiki/index.md` before answering a wiki query.
3. Follow the ingest / query / lint workflows defined in the schema. Never edit `wiki/raw/` or pages outside the schema's conventions.
4. Wiki operations are **separate from `docs/` maintenance**. Updating the wiki does not satisfy the doc-update mandate above, and updating docs does not auto-update the wiki.
