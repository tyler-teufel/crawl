# Turborepo Monorepo Plan

A step-by-step guide for migrating the Crawl project to a Turborepo-managed monorepo. This document explains what Turborepo does, why it's the right tool here, and exactly how to execute the migration.

---

## Table of Contents

1. [What Turborepo Does](#1-what-turborepo-does)
2. [Why Use Turborepo for Crawl](#2-why-use-turborepo-for-crawl)
3. [Target Structure](#3-target-structure)
4. [Step-by-Step Migration Plan](#4-step-by-step-migration-plan)
5. [Turbo Task Pipeline Reference](#5-turbo-task-pipeline-reference)
6. [CI/CD Updates](#6-cicd-updates)
7. [Post-Migration Checklist](#7-post-migration-checklist)

---

## 1. What Turborepo Does

Turborepo is a high-performance build system for JavaScript/TypeScript monorepos. It sits on top of your package manager's workspace protocol (npm workspaces, in this case) and adds two things that workspaces alone don't provide: **task orchestration** and **caching**.

### Task Orchestration

Without Turborepo, running `npm run build` at the root of a workspace just runs the `build` script in every package — simultaneously, with no awareness of dependencies between packages. If `apps/api` depends on `packages/shared-types`, you need to manually ensure `shared-types` builds first.

Turborepo reads a `turbo.json` pipeline configuration and runs tasks in the correct dependency order. You declare that `api#build` depends on `shared-types#build` once, and Turborepo handles the sequencing forever after. Tasks with no dependency between them run in parallel.

```
Without Turborepo:          With Turborepo:
  build ──► all packages      shared-types#build
  (simultaneously)                    │
  (order undefined)                   ▼
                              mobile#build  api#build
                              (in parallel, after shared-types)
```

### Remote and Local Caching

Turborepo hashes every input to a task — source files, environment variables, dependency versions — and stores the output (compiled files, test results, lint output). If nothing has changed since the last run, it restores the output from cache and skips execution entirely. This is called a **cache hit**.

- **Local cache**: stored in `node_modules/.cache/turbo`, shared across tasks in a single machine run.
- **Remote cache**: stored in Vercel's cloud (or self-hosted). Cache hits are shared across your entire team and CI runs. A developer who just pushed code that another developer already built and tested will get instant cache hits on their pull.

### What Turborepo Is NOT

- Not a package manager. It uses npm workspaces for dependency resolution and hoisting.
- Not a bundler or compiler. It delegates to each package's own build tooling (Metro for mobile, tsc/esbuild for the API).
- Not a deployment tool. It handles local task running and caching; deployment remains in your existing GitHub Actions workflows.

---

## 2. Why Use Turborepo for Crawl

### The Core Problem: Shared Types

The most immediate benefit is **shared TypeScript types between the mobile app and the backend API**. Right now, types like `Venue`, `Vote`, `VoteState`, and API response shapes are defined only in `src/types/` for the mobile app. When the backend is built, these same types will need to exist on the server — describing request/response bodies, database row shapes, and validation schemas.

Without a monorepo, there are three bad options:
1. **Duplicate the types** in both the mobile app and the API. They immediately diverge.
2. **Publish a types package to npm**. Requires a publish step on every change; painful in active development.
3. **Copy-paste on change**. Manual, error-prone, not scalable.

With a monorepo and a `packages/shared-types` workspace package, both `apps/mobile` and `apps/api` import from `@crawl/shared-types`. A change to a type is immediately reflected in both consumers. TypeScript catches mismatches at compile time, not at runtime.

### Parallel Task Execution

Right now there is only one app. When the API exists, you'll want to run `lint`, `typecheck`, and `build` across all packages. Turborepo runs them in parallel where possible and in order where required — saturating all CPU cores rather than running sequentially.

```
turbo run typecheck
  ├── packages/shared-types  (runs first, others depend on it)
  └── apps/mobile + apps/api (run in parallel after shared-types)
```

### Build Caching in CI

The current GitHub Actions workflows run lint and type-checks on every push. With Turborepo remote caching enabled, a CI run where only `apps/api` changed will skip re-running `apps/mobile` tasks — because the inputs to those tasks haven't changed. This is especially valuable as the codebase grows.

### Organizational Clarity

A monorepo with clear package boundaries enforces separation of concerns that is easy to violate in a single-package project:

- `apps/mobile` cannot accidentally import backend-only code (database clients, server secrets).
- `apps/api` cannot accidentally import React Native components.
- `packages/shared-types` can be imported by both — it contains only pure TypeScript types and validation schemas, no runtime dependencies.

---

## 3. Target Structure

```
crawl/
├── apps/
│   ├── mobile/                    ← Expo React Native app (moved from root)
│   │   ├── app/                   ← expo-router screens
│   │   ├── components/
│   │   ├── src/
│   │   ├── assets/
│   │   ├── app.json
│   │   ├── babel.config.js
│   │   ├── eas.json
│   │   ├── global.css
│   │   ├── metro.config.js
│   │   ├── nativewind-env.d.ts
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   └── package.json           ← name: "@crawl/mobile"
│   │
│   └── api/                       ← Node.js backend (new)
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── db/
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json           ← name: "@crawl/api"
│
├── packages/
│   ├── shared-types/              ← Shared TS types + Zod schemas
│   │   ├── src/
│   │   │   ├── venue.ts
│   │   │   ├── vote.ts
│   │   │   ├── user.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json           ← name: "@crawl/shared-types"
│   │
│   └── eslint-config/             ← Shared ESLint config (optional)
│       ├── index.js
│       └── package.json           ← name: "@crawl/eslint-config"
│
├── turbo.json                     ← Task pipeline definition
├── package.json                   ← Workspace root (no app code)
├── package-lock.json
├── .gitignore
├── .github/
└── docs/
```

### What Moves vs What's New

| Item | Action |
|------|--------|
| `app/`, `components/`, `src/`, `assets/` | Move into `apps/mobile/` |
| `app.json`, `babel.config.js`, `eas.json`, etc. | Move into `apps/mobile/` (most are already there in `apps/mobile/`) |
| Root `package.json` | Converted to workspace root — no app dependencies |
| `apps/api/` | Created new (backend implementation) |
| `packages/shared-types/` | Created new — extract types from `src/types/` |
| `packages/eslint-config/` | Created new — extract shared ESLint rules |
| `turbo.json` | Created new |

> **Note:** The `apps/mobile/` directory already contains some config files from a prior restructure commit. The migration completes what was started there.

---

## 4. Step-by-Step Migration Plan

### Step 1 — Install Turborepo

At the repository root:

```bash
npm install turbo --save-dev --workspace-root
```

Verify the installation:

```bash
npx turbo --version
```

Add Turborepo's cache directory to `.gitignore`:

```
# Turborepo
.turbo
```

---

### Step 2 — Configure npm Workspaces at Root

Update the root `package.json` to declare workspaces. The root package should not contain any app-specific dependencies after the migration — only devDependencies that apply to the entire repo (Turborepo itself, shared lint tooling).

```json
{
  "name": "crawl-monorepo",
  "version": "0.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "format": "turbo run format",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

---

### Step 3 — Create `turbo.json`

Create `turbo.json` at the repository root. This defines the task dependency graph and caching rules.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalEnv": [
    "NODE_ENV",
    "EXPO_PUBLIC_API_URL"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".expo/**", "build/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "format": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Key concepts in this config:**

- `"dependsOn": ["^build"]` — the `^` prefix means "build all packages this package depends on first." So if `apps/api` has `@crawl/shared-types` in its dependencies, `shared-types` will build before `api`.
- `"cache": false` — dev servers and clean tasks are never cached because their output is not deterministic or reusable.
- `"persistent": true` — marks `dev` tasks as long-running processes (Turborepo won't wait for them to exit).
- `"outputs"` — file globs that should be cached. Only files listed here will be stored and restored from cache.

---

### Step 4 — Create `packages/shared-types`

This is the most architecturally significant step. Create the shared types package that both `apps/mobile` and `apps/api` will import.

**`packages/shared-types/package.json`:**

```json
{
  "name": "@crawl/shared-types",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc --project tsconfig.build.json"
  },
  "devDependencies": {
    "typescript": "^5.9.2"
  },
  "dependencies": {
    "zod": "^3.x.x"
  }
}
```

**`packages/shared-types/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**`packages/shared-types/src/venue.ts`** — migrate types from `apps/mobile/src/types/venue.ts`:

```typescript
import { z } from 'zod';

export const VenueTypeSchema = z.enum(['bar', 'club', 'lounge', 'rooftop', 'brewery']);
export type VenueType = z.infer<typeof VenueTypeSchema>;

export const VenueSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: VenueTypeSchema,
  address: z.string(),
  city: z.string(),
  location: z.object({ lat: z.number(), lng: z.number() }),
  hotspotScore: z.number().int().min(0).max(100),
  voteCount: z.number().int().min(0),
  isOpen: z.boolean(),
  priceLevel: z.number().int().min(1).max(4),
  hours: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export type Venue = z.infer<typeof VenueSchema>;
```

**`packages/shared-types/src/index.ts`:**

```typescript
export * from './venue';
export * from './vote';
export * from './user';
export * from './api';  // API request/response shapes
```

Using Zod schemas here gives you double value: the types are valid TypeScript types (`z.infer<typeof VenueSchema>`), and the same schema validates runtime data on the API server. The mobile app uses the types for compile-time checks; the API uses the schema to validate request bodies.

---

### Step 5 — Set Up `apps/mobile` as a Workspace Package

The `apps/mobile/` directory already has config files from the prior restructure. Complete the setup by adding a `package.json` scoped to the mobile app:

**`apps/mobile/package.json`:**

```json
{
  "name": "@crawl/mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "ios": "expo run:ios",
    "android": "expo run:android",
    "web": "expo start --web",
    "build": "expo export",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --write .",
    "prebuild": "expo prebuild"
  },
  "dependencies": {
    "@crawl/shared-types": "*",
    "expo": "~54.0.0"
    // ... all current dependencies from root package.json
  },
  "devDependencies": {
    // ... all current devDependencies from root package.json
  }
}
```

The `"@crawl/shared-types": "*"` dependency uses the workspace protocol — npm resolves this to the local `packages/shared-types` package without any publishing step.

Update `apps/mobile/tsconfig.json` to add the shared-types path alias:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"],
      "@crawl/shared-types": ["../../packages/shared-types/src/index.ts"]
    }
  }
}
```

Replace imports of local type definitions with imports from the shared package:

```typescript
// Before
import { Venue } from '@/types/venue';

// After
import { Venue } from '@crawl/shared-types';
```

---

### Step 6 — Create `apps/api` Skeleton

Initialize the backend package. At this stage, just the scaffold — implementation follows the phases in `BACKEND_IMPLEMENTATION_PLAN.md`.

**`apps/api/package.json`:**

```json
{
  "name": "@crawl/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --project tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --write .",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@crawl/shared-types": "*"
    // framework and db deps added during Phase 1 of BACKEND_IMPLEMENTATION_PLAN.md
  },
  "devDependencies": {
    "typescript": "^5.9.2",
    "tsx": "^4.x.x"
  }
}
```

**`apps/api/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@crawl/shared-types": ["../../packages/shared-types/src/index.ts"]
    }
  },
  "include": ["src"]
}
```

**`apps/api/src/index.ts`** — minimal placeholder:

```typescript
// API server entry point
// Implementation follows BACKEND_IMPLEMENTATION_PLAN.md Phase 1

console.log('Crawl API server — not yet implemented');
```

---

### Step 7 — Move Root App Files into `apps/mobile`

This is the largest filesystem change. Move all app-specific files from the repository root into `apps/mobile/`.

Files to move:

```
app/           ──► apps/mobile/app/
components/    ──► apps/mobile/components/
src/           ──► apps/mobile/src/
assets/        ──► apps/mobile/assets/
```

The config files (babel.config.js, metro.config.js, tailwind.config.js, etc.) are already in `apps/mobile/` from the prior restructure — verify each one is present and correct before removing the root copies.

After moving, update any paths that reference the old location:
- `.github/workflows` — update working directory references
- `eas.json` — ensure it references the correct app directory
- `app.json` — no path changes needed (it's self-referential)

Verify the mobile app still starts after the move:

```bash
cd apps/mobile && npx expo start
```

---

### Step 8 — Migrate Root `package.json` Dependencies

The root `package.json` should end up with only workspace-level tooling. All Expo, React Native, and app-specific dependencies move to `apps/mobile/package.json`.

After migrating all dependencies:

```bash
# Delete root node_modules and reinstall from scratch
rm -rf node_modules package-lock.json
npm install
```

npm workspaces will hoist compatible dependencies to `node_modules/` at the root and create symlinks for workspace packages. Expo and Metro are compatible with this layout as of SDK 54.

Verify the dependency tree looks correct:

```bash
npm ls --workspaces --depth 0
```

---

### Step 9 — (Optional) Create `packages/eslint-config`

Extract shared ESLint configuration into a workspace package so both `apps/mobile` and `apps/api` use identical rules without duplicating config.

**`packages/eslint-config/package.json`:**

```json
{
  "name": "@crawl/eslint-config",
  "version": "0.0.0",
  "private": true,
  "main": "index.js",
  "dependencies": {
    "eslint-config-expo": "*"
  }
}
```

**`packages/eslint-config/index.js`:**

```javascript
// Re-export shared rules. Each app extends this.
module.exports = require('./mobile.js'); // or a base config
```

Each app's `eslint.config.js` then extends `@crawl/eslint-config` instead of duplicating the full ruleset. This step is optional at initial setup — it becomes valuable once the API has its own linting needs that diverge from the mobile config.

---

### Step 10 — Enable Remote Caching (Optional but Recommended)

Turborepo remote caching stores task outputs in the cloud so CI machines and other developers can reuse results. Vercel provides this for free for open-source projects and at low cost for private repos.

```bash
npx turbo login      # authenticate with Vercel
npx turbo link       # link this repo to a remote cache
```

Add the remote cache token to GitHub Actions secrets:

```
TURBO_TOKEN   ← from `npx turbo token`
TURBO_TEAM    ← your Vercel team slug
```

Update CI workflow files to pass the cache token:

```yaml
- name: Run tasks
  run: npx turbo run lint typecheck build
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

---

## 5. Turbo Task Pipeline Reference

Once migration is complete, these are the primary commands run from the repository root:

| Command | What it does |
|---------|-------------|
| `npm run dev` | Starts both `apps/mobile` (Expo) and `apps/api` (tsx watch) in parallel |
| `npm run build` | Builds `shared-types`, then builds `mobile` and `api` in parallel |
| `npm run typecheck` | Type-checks all packages in dependency order |
| `npm run lint` | Lints all packages in parallel |
| `npx turbo run dev --filter=mobile` | Run dev server for mobile only |
| `npx turbo run build --filter=api...` | Build `api` and all its local dependencies |
| `npx turbo run lint --filter=...shared-types` | Lint everything that depends on `shared-types` |

### Dependency Graph

```
                    ┌─────────────────────┐
                    │  @crawl/shared-types │
                    └──────────┬──────────┘
                               │  depended on by
              ┌────────────────┼────────────────┐
              ▼                                  ▼
  ┌──────────────────────┐         ┌──────────────────────┐
  │    @crawl/mobile     │         │     @crawl/api        │
  │  (Expo React Native) │         │  (Node.js backend)    │
  └──────────────────────┘         └──────────────────────┘
```

Tasks that depend on `^build` will run `shared-types#build` before `mobile#build` or `api#build`. Lint and format tasks have no cross-package dependencies and always run in parallel.

---

## 6. CI/CD Updates

The existing GitHub Actions workflows in `.github/workflows/` target the root package. After migration, update them to use Turborepo commands, which handle multi-package orchestration automatically.

### validate.yml (lint + typecheck)

```yaml
# Before
- run: npm run lint
- run: npm run typecheck

# After
- run: npx turbo run lint typecheck
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

### mobile-specific workflows (EAS Build, OTA updates)

These workflows only affect the mobile app and should `cd apps/mobile` before running Expo/EAS commands — or use the `working-directory` option:

```yaml
- name: EAS Build
  working-directory: apps/mobile
  run: eas build --platform all --non-interactive
```

### backend CI (new workflow, add when API is implemented)

```yaml
name: API CI
on:
  push:
    paths:
      - 'apps/api/**'
      - 'packages/shared-types/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx turbo run lint typecheck build --filter=api...
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

The `--filter=api...` flag runs tasks only for `apps/api` and its local dependencies (i.e., `shared-types`). Mobile-related tasks are skipped entirely.

---

## 7. Post-Migration Checklist

Work through these items in order to verify the migration is complete and stable.

### Workspace Setup

- [ ] `turbo.json` exists at repo root with task pipeline defined
- [ ] Root `package.json` declares `"workspaces": ["apps/*", "packages/*"]`
- [ ] `npm install` from root installs all workspaces without errors
- [ ] `npm ls --workspaces --depth 0` shows all three packages
- [ ] `@crawl/shared-types` symlinked correctly in `node_modules/@crawl/`

### Mobile App

- [ ] `apps/mobile/package.json` exists with `"name": "@crawl/mobile"`
- [ ] All app source files live under `apps/mobile/` — nothing app-specific at root
- [ ] `expo start` launches from `apps/mobile/` without errors
- [ ] All imports using `@/` alias resolve correctly
- [ ] TypeScript types imported from `@crawl/shared-types` where applicable
- [ ] EAS Build configuration (`eas.json`) updated with correct project directory

### Shared Types Package

- [ ] `packages/shared-types/package.json` exists with `"name": "@crawl/shared-types"`
- [ ] All shared types extracted from `apps/mobile/src/types/` and mirrored in `shared-types`
- [ ] `npx turbo run typecheck --filter=shared-types` passes
- [ ] Mobile app can `import { Venue } from '@crawl/shared-types'` without errors

### API Package

- [ ] `apps/api/package.json` exists with `"name": "@crawl/api"`
- [ ] `apps/api/src/index.ts` exists (even if placeholder)
- [ ] `npx turbo run typecheck --filter=api` passes

### Turborepo

- [ ] `npx turbo run lint` runs lint across all packages
- [ ] `npx turbo run typecheck` runs in correct dependency order
- [ ] Second run of any task shows `cache hit` for unchanged packages
- [ ] `.turbo` directory added to `.gitignore`

### CI/CD

- [ ] `validate.yml` uses `turbo run` instead of direct `npm run`
- [ ] Mobile-specific workflows use `working-directory: apps/mobile`
- [ ] CI passes on a test branch after migration
- [ ] Remote caching configured (Vercel team + `TURBO_TOKEN` secret) if desired

---

## Related Documentation

- `docs/BACKEND_IMPLEMENTATION_PLAN.md` — 10-phase plan for building the API server
- `docs/DATA_PIPELINE.md` — Database schema and API endpoint reference
- `docs/CICD_PIPELINE.md` — Existing build, test, and release pipeline
- `docs/ARCHITECTURE.md` — Navigation and component structure for the mobile app
