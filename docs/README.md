# Crawl App — Documentation

**Version:** 1.0.0-alpha
**Last Updated:** 2026-04-22

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
| [API Client Layer](./architecture/API_CLIENT.md)          | TypeScript API client architecture, data flow, environment config               |
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
| [Backend Implementation Plan](./planning/BACKEND_IMPLEMENTATION_PLAN.md) | Phased plan for building the full backend                                 |
| [Data Pipeline](./planning/DATA_PIPELINE.md)                          | Venue ingest architecture; stays here until first cities are fully seeded    |
| [Dev / Staging Plan](./planning/DEV_STAGING_PLAN.md)                  | Environment strategy for dev/staging/prod                                    |
| [Turborepo Monorepo Plan](./planning/TURBOREPO_MONOREPO_PLAN.md)      | Target monorepo shape and in-flight work                                     |
| [Day-1 Cost Estimate](./planning/COST_ESTIMATE_DAY_1.md)              | Expected infra + API spend at launch                                         |

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
