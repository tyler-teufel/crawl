# Crawl App — Documentation

**Version:** 1.1.0
**Last Updated:** 2026-07-14

Docs are grouped by intent. Pick the folder that matches what you're trying to do.

- [`architecture/`](#architecture) — how the system works today (reference)
- [`guides/`](#guides) — how-tos for contributors
- [`planning/`](#planning) — forward-looking plans and implementation tracks
- [`ops/`](#ops) — deploy and infra runbooks
- [`claude/`](#claude) — Claude / AI workflow assets
- [`archive/`](#archive) — frozen historical snapshots

## Architecture

How the system works today. Read these to orient.

| Document                                                  | Description                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [Project Overview](./architecture/PROJECT_OVERVIEW.md)    | What Crawl is, what's been built, current status, and tech stack summary        |
| [Architecture](./architecture/ARCHITECTURE.md)            | Project structure, state management, navigation, styling pipeline, and diagrams |
| [File Reference](./architecture/FILE_REFERENCE.md)        | Every file in the project with detailed descriptions of purpose and behavior    |
| [Design Decisions](./architecture/DESIGN_DECISIONS.md)    | Rationale behind every major technical choice                                   |
| [API Client Layer](./architecture/API_CLIENT.md)          | Mobile API client architecture, mock/live data flow, environment config         |
| [API Reference](./architecture/API_REFERENCE.md)          | All endpoints, request/response shapes, auth, error codes, and Postman usage    |

## Guides

How-tos for contributors.

| Document                                                     | Description                                                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| [Contributing](./guides/CONTRIBUTING.md)                     | How to add screens, components, shared logic, and follow project conventions |
| [Monorepo Guide](./guides/MONOREPO_GUIDE.md)                 | Day-to-day Turborepo usage: commands, workspace graph, config scoping        |
| [Installing Packages](./guides/INSTALLING_PACKAGES.md)       | Where to add deps (root vs workspace) and how to troubleshoot install issues |
| [React Native Reusables](./guides/REACT_NATIVE_REUSABLES.md) | RNR setup, theming integration, adding components                            |
| [Maps SDK Integration](./guides/MAPS_INTEGRATION.md)         | Step-by-step plan for replacing the map placeholder with react-native-maps   |

## Planning

Forward-looking — what we're building next.

| Document                                                              | Description                                                                  |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Roadmap](./planning/ROADMAP.md)                                      | Prioritized next steps across v1.1, v1.2, and v2.0                           |
| [Sprint Plan — July 2026](./planning/SPRINT_PLAN_2026-07.md)          | Active root-caused backlog: bugs, polish, and screens scoped to semver releases |
| [Crawl v2 Proposal](./planning/CRAWL_V2_PROPOSAL.md)                  | Living v2 foundation: brand overhaul, discovery-first IA, milestone ladder M1–M10; design assets in `docs/design/` |

## Ops

Deploy and infra runbooks.

| Document                                                      | Description                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| [CI/CD Pipeline](./ops/CICD_PIPELINE.md)                      | Build, test, release pipeline for mobile (EAS) and API (Railway)    |
| [Railway Setup](./ops/RAILWAY_SETUP.md)                       | Hosting the API on Railway: project config, env, deploys            |

## Claude

AI/LLM workflow assets.

| Document                                                          | Description                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| [Agent Team Charter](./claude/AGENT_TEAM.md)                      | Active agent roster, /scrum orchestration flow, ground rules |
| [Claude Enhancements](./claude/CLAUDE_ENHANCEMENTS.md)            | Project-level Claude Code tuning, hook ideas, agent notes    |
| [Claude Directory Overhaul](./claude/CLAUDE_DIRECTORY_PLAN.md)    | Plan for agent roster, hooks, and rule refinements           |
| [Google Sheets Prompt](./claude/google-sheets-prompt.md)          | Prompt template for the backend-research sheet               |
| [Backend Research Tracker](./claude/backend-research-tracker.csv) | CSV of vendor/decision research rows                         |

## Archive

Frozen historical — kept for reference, no longer maintained.

| Document                                                  | Description                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| [Version 1.0 Document](./archive/VERSION_1.0_DOCUMENT.md) | Original consolidated version document                              |
| [Turborepo Migration](./archive/TURBOREPO_MIGRATION.md)   | Historical record of the monorepo migration (completed)             |
| [Turborepo Monorepo Plan](./archive/TURBOREPO_MONOREPO_PLAN.md)         | Original migration plan (executed — see Turborepo Migration above)        |
| [Backend Implementation Plan](./archive/BACKEND_IMPLEMENTATION_PLAN.md) | Phased backend plan (executed — see `apps/api` + API Reference)           |
| [Data Pipeline](./archive/DATA_PIPELINE.md)                             | Venue ingest architecture plan (executed — venues seeded via `syncVenues`) |
| [Dev / Staging Plan](./archive/DEV_STAGING_PLAN.md)                     | Dev/staging/prod environment plan (executed — mobile-API-Supabase is live) |
| [Day-1 Cost Estimate](./archive/COST_ESTIMATE_DAY_1.md)                 | Original infra cost estimate (superseded by the Railway deploy decision)  |
