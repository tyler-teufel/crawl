# Turborepo Migration

A record of every change made to convert the Crawl project from a single-package Expo app into a Turborepo monorepo, and why this structure is the right fit.

---

## Table of Contents

1. [Why a Monorepo?](#1-why-a-monorepo)
2. [Workspace Layout](#2-workspace-layout)
3. [Changes Made](#3-changes-made)
4. [How Turbo Orchestrates Tasks](#4-how-turbo-orchestrates-tasks)
5. [What Changed Per File](#5-what-changed-per-file)

---

## 1. Why a Monorepo?

Crawl has two applications — a React Native mobile app and a Fastify API server — that share TypeScript types for venues, votes, and authentication. A monorepo lets both apps import from a single `@crawl/shared-types` package without publishing to npm or managing version synchronization across repositories.

### Benefits for this project

| Benefit | How it applies to Crawl |
|---------|------------------------|
| **Shared types** | The `Venue`, `VoteState`, and `FilterOption` interfaces are defined once in `packages/shared-types` and imported by both `apps/mobile` and `apps/api`. Changes propagate instantly — no publish/install cycle. |
| **Single dependency tree** | npm workspaces hoists shared dependencies (TypeScript, Zod, ESLint, Prettier) to the root `node_modules/`, reducing disk usage and ensuring version consistency. |
| **Unified task runner** | `turbo typecheck` type-checks all four packages in the correct order. `turbo dev --parallel` starts both the mobile app and API server simultaneously. One command, full-stack development. |
| **Task caching** | Turbo caches build and typecheck outputs. If `packages/shared-types` hasn't changed, its build is replayed from cache in milliseconds instead of recompiled. |
| **Dependency graph awareness** | Turbo knows that `@crawl/api` depends on `@crawl/shared-types`. When you run `turbo build --filter=@crawl/api`, it automatically builds shared-types first. |
| **Atomic commits** | A change to a shared type and the corresponding API route and mobile screen can be a single commit and a single PR. No cross-repo coordination needed. |

### Why Turborepo specifically

- **Zero config** — Turborepo reads `workspaces` from `package.json` and `tasks` from `turbo.json`. No plugin system, no complex configuration files.
- **npm-native** — Works directly with npm workspaces. No custom package manager or linking tool required.
- **Incremental adoption** — Each workspace keeps its own `package.json`, `tsconfig.json`, and tooling config. Workspaces don't need to know they're in a monorepo.

---

## 2. Workspace Layout

```
crawl/
├── apps/
│   ├── mobile/              @crawl/mobile    Expo React Native app
│   └── api/                 @crawl/api       Fastify API server
├── packages/
│   ├── shared-types/        @crawl/shared-types   Shared TypeScript interfaces
│   └── eslint-config/       @crawl/eslint-config  Shared ESLint base config
├── package.json             Root workspace manifest
├── turbo.json               Task pipeline config
├── eslint.config.js         Root ESLint config (minimal)
└── prettier.config.js       Root Prettier config (base)
```

The root `package.json` declares the workspace pattern:

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

npm automatically discovers every directory under `apps/` and `packages/` that contains a `package.json` and links them into the root `node_modules/` as symlinks.

---

## 3. Changes Made

### 3.1 — Root `package.json`

**Added `packageManager` field.** Turborepo requires this to resolve workspaces. Without it, `turbo` exits immediately with `Missing packageManager field in package.json`.

```json
"packageManager": "npm@11.4.2"
```

**Added `test` script.** The root scripts proxy to Turbo. `test` was missing.

```json
"test": "turbo run test"
```

### 3.2 — `turbo.json`

**Added `test` task.** Mirrors the pattern of `typecheck` — depends on upstream builds, produces no cacheable output.

```json
"test": {
  "dependsOn": ["^build"],
  "outputs": []
}
```

The `^build` dependency means: before testing `@crawl/api`, build `@crawl/shared-types` first (since the API imports from it).

### 3.3 — Mobile app (`apps/mobile/`)

**Renamed package** from `crawl` to `@crawl/mobile`. In a monorepo, every workspace must have a unique, scoped name. The `@crawl/` prefix groups all project packages together.

**Removed nested `package-lock.json`.** npm workspaces manage a single lockfile at the repo root. A nested lockfile causes npm to treat the directory as an independent project, breaking dependency hoisting and workspace linking.

**Removed `turbo` from `devDependencies`.** Turbo belongs in the root `package.json` only — it's a repo-level tool, not a per-workspace dependency.

**Created `eslint.config.js`** (copied from root). The Expo-specific ESLint config (`eslint-config-expo` with React rules) was previously at the repo root. Since the API workspace doesn't use React, this config was moved into `apps/mobile/` where it belongs. ESLint's config resolution walks up from the file being linted, so the mobile workspace finds its own config first.

**Created `prettier.config.js`** (copied from root). The Tailwind-specific Prettier config (`prettier-plugin-tailwindcss`) was previously at the repo root. Since the API workspace has no Tailwind classes, this config was moved into `apps/mobile/` to avoid unnecessary plugin loading.

**Created `src/types/venue.ts`** — a re-export barrel that bridges the old import path to the new shared package:

```typescript
export type { Venue, FilterOption, VoteState } from '@crawl/shared-types';
```

All mobile source files import from `@/types/venue` (via the `@/*` → `src/*` path alias). Rather than rewriting every import across the codebase, this file maps the existing path to `@crawl/shared-types`. Type-only re-exports have zero runtime cost.

### 3.4 — API workspace (`apps/api/`)

**Added `"type": "module"`** to `package.json`. Fastify and the TypeScript ecosystem assume ESM. This enables `import`/`export` syntax in compiled output.

**Added all Fastify dependencies.** Production: `fastify`, `@fastify/cors`, `fastify-type-provider-zod`, `fastify-plugin`, `zod`. Dev: `vitest`, `@types/node`, `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`.

**Added `test` and `test:watch` scripts.** `vitest run --passWithNoTests` ensures the test task doesn't fail when no test files exist yet.

**Created `tsconfig.build.json`.** The `build` script references this file (`tsc --project tsconfig.build.json`). It extends the main `tsconfig.json` and excludes test files from production builds.

**Added `esModuleInterop` and `skipLibCheck`** to `tsconfig.json`. Required for clean interop with Fastify's CommonJS plugins and to avoid type-checking third-party `.d.ts` files that may conflict.

**Created `eslint.config.js`.** A Node.js-appropriate ESLint config using `typescript-eslint` without React rules.

### 3.5 — Shared types (`packages/shared-types/`)

**Moved `package.json` and `tsconfig.json` into the correct directory.** These files were accidentally placed at the `packages/` level instead of inside `packages/shared-types/`. npm's workspace resolution pattern (`packages/*`) looks for `package.json` files one level deep — so `packages/shared-types/package.json` is found, but `packages/package.json` creates an unintended workspace at the `packages/` level itself.

**Created `src/index.ts`** — barrel file that re-exports all types from `venue.ts`. Without this, other packages importing `@crawl/shared-types` would get an empty module (the `main` field in `package.json` points to `./src/index.ts`).

**Created `tsconfig.build.json`.** The `build` script references this file but it didn't exist. Extends the base `tsconfig.json` and adds `declaration: true` for `.d.ts` output.

### 3.6 — Root configs

**Replaced root `eslint.config.js`** with a minimal config that only defines ignores. Each workspace now provides its own full ESLint config. This prevents the Expo-specific React rules from applying to the Node.js API.

**Replaced root `prettier.config.js`** with a base config without the Tailwind plugin. The mobile workspace overrides this with its own config that includes `prettier-plugin-tailwindcss`. The API workspace inherits the root config as-is.

---

## 4. How Turbo Orchestrates Tasks

When you run `turbo typecheck`, Turbo reads the task pipeline from `turbo.json` and the dependency graph from each workspace's `package.json`:

```
@crawl/shared-types  (no deps)
        │
        ▼  ^build
┌───────────────────┐
│  @crawl/api       │   depends on @crawl/shared-types
│  @crawl/mobile    │   depends on @crawl/shared-types (via re-export)
└───────────────────┘
```

The `typecheck` task has `"dependsOn": ["^build"]`, which means:

1. Turbo builds `@crawl/shared-types` first (it's a dependency of both apps)
2. Once shared-types is built, Turbo runs `typecheck` in `@crawl/api` and `@crawl/mobile` **in parallel**
3. Results are cached — subsequent runs skip unchanged packages

### Task reference

| Command | What it does |
|---------|-------------|
| `turbo dev --parallel` | Starts mobile dev server + API dev server simultaneously |
| `turbo dev --filter=@crawl/api` | Starts only the API server |
| `turbo build` | Builds shared-types, then API and mobile in parallel |
| `turbo typecheck` | Type-checks all packages respecting dependency order |
| `turbo lint` | Runs ESLint in every workspace that has a `lint` script |
| `turbo test` | Runs test suites across all workspaces |

---

## 5. What Changed Per File

| File | Action | Why |
|------|--------|-----|
| `package.json` | Added `packageManager`, `test` script | Turbo requires `packageManager`; `test` was missing |
| `turbo.json` | Added `test` task | Enables `turbo test` across workspaces |
| `eslint.config.js` (root) | Replaced with minimal config | Previous config was Expo-specific, broke API linting |
| `prettier.config.js` (root) | Removed Tailwind plugin | Tailwind plugin is mobile-only |
| `apps/mobile/package.json` | Renamed to `@crawl/mobile`, removed `turbo` dep | Scoped name required; turbo is root-only |
| `apps/mobile/package-lock.json` | Deleted | Nested lockfiles break workspace hoisting |
| `apps/mobile/eslint.config.js` | Created (from root) | Expo-specific rules scoped to mobile |
| `apps/mobile/prettier.config.js` | Created (from root) | Tailwind plugin scoped to mobile |
| `apps/mobile/src/types/venue.ts` | Created | Re-exports from `@crawl/shared-types` to preserve `@/types/venue` imports |
| `apps/api/package.json` | Added `type: module`, Fastify deps, test scripts | ESM support, Fastify framework, Vitest testing |
| `apps/api/tsconfig.json` | Added `esModuleInterop`, `skipLibCheck` | Clean Fastify interop |
| `apps/api/tsconfig.build.json` | Created | Production builds excluding tests |
| `apps/api/eslint.config.js` | Created | Node.js/TypeScript linting without React rules |
| `packages/shared-types/package.json` | Moved from `packages/` | Correct workspace directory placement |
| `packages/shared-types/tsconfig.json` | Moved from `packages/` | Correct workspace directory placement |
| `packages/shared-types/tsconfig.build.json` | Created | Missing file referenced by build script |
| `packages/shared-types/src/index.ts` | Created | Barrel export so imports resolve |
