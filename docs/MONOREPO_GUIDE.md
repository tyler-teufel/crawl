# Monorepo Developer Guide

Everything you need to know to work in the Crawl turborepo on a daily basis. This covers running tasks, installing packages, understanding the workspace graph, and avoiding common pitfalls.

---

## Table of Contents

1. [Workspace Map](#1-workspace-map)
2. [Day-to-Day Commands](#2-day-to-day-commands)
3. [Installing Packages](#3-installing-packages)
4. [Where Does This Package Go?](#4-where-does-this-package-go)
5. [How Workspaces Connect](#5-how-workspaces-connect)
6. [Adding a Shared Type](#6-adding-a-shared-type)
7. [Config Files — What Lives Where](#7-config-files--what-lives-where)
8. [How Hoisting Works](#8-how-hoisting-works)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Workspace Map

```
crawl/                          ← repo root (run all commands from here)
├── apps/
│   ├── mobile/                 ← @crawl/mobile     Expo React Native app
│   └── api/                    ← @crawl/api         Fastify API server
├── packages/
│   ├── shared-types/           ← @crawl/shared-types   Venue, VoteState, FilterOption
│   └── eslint-config/          ← @crawl/eslint-config  Shared ESLint base
├── package.json                ← workspace root (declares apps/* and packages/*)
├── package-lock.json           ← single lockfile for entire repo
├── turbo.json                  ← task pipeline config
├── eslint.config.js            ← root eslint (minimal)
└── prettier.config.js          ← root prettier (base, no Tailwind)
```

Every directory under `apps/` and `packages/` that contains a `package.json` is a **workspace**. Each has its own name (the `@crawl/*` scoped name in its `package.json`), its own dependencies, and its own scripts.

---

## 2. Day-to-Day Commands

All commands run from the **repo root**. Never `cd` into a workspace to run things.

### Start developing

```bash
# Start everything (mobile + API in parallel)
turbo dev --parallel

# Start just the mobile app
turbo dev --filter=@crawl/mobile

# Start just the API server
turbo dev --filter=@crawl/api
```

### Check your work

```bash
# Type-check all workspaces (respects dependency order)
turbo typecheck

# Lint all workspaces
turbo lint

# Run tests
turbo test

# Build everything
turbo build
```

### Target a single workspace

The `--filter` flag accepts the package name:

```bash
turbo typecheck --filter=@crawl/api
turbo build --filter=@crawl/mobile
turbo test --filter=@crawl/api
```

### Run a workspace script directly

If a workspace has a script that isn't in `turbo.json` (like `start` or `prebuild`), use npm's workspace flag:

```bash
npm run start -w @crawl/mobile
npm run prebuild -w @crawl/mobile
npm run start -w @crawl/api
```

---

## 3. Installing Packages

### The golden rule

**Always run `npm install` from the repo root.** Use the `-w` flag to target a workspace. Never `cd` into a workspace and run `npm install` there.

### Commands

```bash
# Add to mobile
npm install <package> -w @crawl/mobile
npm install <package> -D -w @crawl/mobile       # dev dependency

# Add to API
npm install <package> -w @crawl/api
npm install <package> -D -w @crawl/api

# Add to shared types
npm install <package> -w @crawl/shared-types

# Add to root (repo-wide tools only)
npm install <package> -D

# Remove from a workspace
npm uninstall <package> -w @crawl/api
```

### Expo-specific packages

For Expo packages that need native module linking, use `npx expo install` with the workspace flag:

```bash
npx expo install expo-haptics --project apps/mobile
```

Or install normally and let Expo's autolinking handle it:

```bash
npm install expo-haptics -w @crawl/mobile
```

---

## 4. Where Does This Package Go?

This is the most common question. Use this decision tree:

```
Is it a repo-wide tool (turbo, husky, lint-staged)?
  └── YES → install at root: npm install <pkg> -D
  └── NO ↓

Does only the mobile app use it?
  └── YES → npm install <pkg> -w @crawl/mobile
  └── NO ↓

Does only the API use it?
  └── YES → npm install <pkg> -w @crawl/api
  └── NO ↓

Is it part of the shared type contract (used in type definitions)?
  └── YES → npm install <pkg> -w @crawl/shared-types
  └── NO ↓

Both apps use it independently for different things?
  └── YES → install in each: npm install <pkg> -w @crawl/mobile -w @crawl/api
```

### Common examples

| Package | Where | Why |
|---------|-------|-----|
| `expo-haptics` | `@crawl/mobile` | Mobile-only Expo package |
| `react-native-maps` | `@crawl/mobile` | Mobile-only native module |
| `@fastify/jwt` | `@crawl/api` | API-only Fastify plugin |
| `drizzle-orm` | `@crawl/api` | API-only database ORM |
| `zod` | `@crawl/shared-types` | Used in shared type definitions, transitive to both apps |
| `turbo` | Root | Repo-wide task runner |
| `husky` | Root | Repo-wide git hooks |
| `typescript` | Each workspace that uses it | Workspaces may need different TS configs |
| `prettier` | Each workspace that uses it | Mobile has Tailwind plugin, API doesn't |
| `date-fns` | Both apps separately | Used independently in mobile and API |

### The `@crawl/shared-types` transitive rule

When you add a dependency to `@crawl/shared-types`, both `@crawl/mobile` and `@crawl/api` get access to it automatically because they both depend on `@crawl/shared-types`. This is useful for packages like `zod` that define the shared type contract.

```
@crawl/shared-types
├── zod (installed here)
│
├── @crawl/api (depends on shared-types → gets zod transitively)
└── @crawl/mobile (depends on shared-types → gets zod transitively)
```

**Only use this for packages that are genuinely part of the shared interface.** If only one app uses a package at runtime, install it in that app's workspace even if shared-types also happens to use it.

---

## 5. How Workspaces Connect

### Dependency graph

```
@crawl/shared-types          ← no dependencies on other workspaces
        │
        ▼  (both import from it)
@crawl/api                    ← depends on @crawl/shared-types
@crawl/mobile                 ← depends on @crawl/shared-types (via src/types/venue.ts)
```

### How imports resolve

When `@crawl/api` does `import { Venue } from '@crawl/shared-types'`, Node.js follows a symlink:

```
node_modules/@crawl/shared-types → ../../packages/shared-types
```

npm creates these symlinks automatically during `npm install`. The `"main": "./src/index.ts"` field in `packages/shared-types/package.json` tells Node which file to load.

### Task ordering

Turbo reads the dependency graph and orders tasks automatically. When you run `turbo typecheck`:

1. **First:** `@crawl/shared-types` builds (other packages depend on it)
2. **Then, in parallel:** `@crawl/api` and `@crawl/mobile` typecheck

This is controlled by `"dependsOn": ["^build"]` in `turbo.json`. The `^` means "run `build` in my dependencies first."

---

## 6. Adding a Shared Type

When you need a new type that both apps will use:

### Step 1 — Define it in shared-types

Edit `packages/shared-types/src/venue.ts` (or create a new file):

```typescript
// packages/shared-types/src/api.ts
export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}
```

### Step 2 — Export it from the barrel

Add it to `packages/shared-types/src/index.ts`:

```typescript
export type { Venue, FilterOption, VoteState } from './venue.ts';
export type { ApiError, PaginatedResponse } from './api.ts';
```

### Step 3 — Import it in your app

```typescript
// In apps/api/src/routes/venues.ts
import type { Venue, PaginatedResponse } from '@crawl/shared-types';

// In apps/mobile/src/api/venues.ts
import type { Venue, PaginatedResponse } from '@crawl/shared-types';
```

In the mobile app, if you're importing via the `@/types/venue` alias, add a re-export to `apps/mobile/src/types/venue.ts`:

```typescript
export type { Venue, FilterOption, VoteState } from '@crawl/shared-types';
export type { ApiError, PaginatedResponse } from '@crawl/shared-types';
```

### Step 4 — Verify

```bash
turbo typecheck
```

Both apps should resolve the new type.

---

## 7. Config Files — What Lives Where

Config files are **scoped per workspace** because the mobile app and API have different tooling needs.

| Config | Root | Mobile | API | Why split? |
|--------|------|--------|-----|------------|
| `eslint.config.js` | Minimal (ignores only) | Expo/React rules | TypeScript/Node rules | React rules don't apply to a Node server |
| `prettier.config.js` | Base (no plugins) | + Tailwind class sorting | Inherits root | Tailwind plugin is mobile-only |
| `tsconfig.json` | — | Extends `expo/tsconfig.base` | ES2022, NodeNext, strict | Completely different module systems |
| `tailwind.config.js` | — | Full config | — | API has no Tailwind |
| `babel.config.js` | — | NativeWind + worklets | — | API uses tsx, no Babel |

**How ESLint/Prettier resolution works:** These tools walk up from the file being checked until they find a config. A file in `apps/api/src/` finds `apps/api/eslint.config.js` first. A file in `apps/mobile/components/` finds `apps/mobile/eslint.config.js` first. Files at the repo root find the root config.

---

## 8. How Hoisting Works

npm workspaces install all packages into the **root** `node_modules/`. Individual workspace `node_modules/` directories are only created when version conflicts exist.

```
crawl/
├── node_modules/
│   ├── fastify/              ← hoisted from @crawl/api
│   ├── expo/                 ← hoisted from @crawl/mobile
│   ├── zod/                  ← shared by api + shared-types
│   ├── typescript/           ← shared (same version in all workspaces)
│   ├── @crawl/
│   │   ├── api/       → ../../apps/api              ← symlink
│   │   ├── mobile/    → ../../apps/mobile            ← symlink
│   │   └── shared-types/ → ../../packages/shared-types  ← symlink
│   └── ...
├── package-lock.json         ← ONE lockfile, entire repo
└── apps/
    └── api/
        └── (no node_modules unless a version conflict exists)
```

**What this means in practice:**

- `npm install` is fast — shared packages install once
- `package-lock.json` at the root is the single source of truth
- You can technically `import` any hoisted package from any workspace even if it's not in that workspace's `package.json` — **don't do this.** Always declare your dependencies explicitly. Turbo uses the declared dependencies to build the task graph.

---

## 9. Troubleshooting

### "Module not found" after installing a package

```bash
# Verify it's in the right workspace
npm ls <package>

# If it's missing, install it to the correct workspace
npm install <package> -w @crawl/api

# If it's there but still not found, try a clean install
rm -rf node_modules package-lock.json
npm install
```

### Nested `package-lock.json` appeared in a workspace

This happens if you accidentally ran `npm install` inside a workspace directory.

```bash
# Delete it
rm apps/mobile/package-lock.json    # or whichever workspace

# Reinstall from root
npm install
```

### Turbo says "No package found with name 'api'"

Use the full scoped package name, not the directory name:

```bash
# Wrong
turbo build --filter=api

# Right
turbo build --filter=@crawl/api
```

### Type errors after changing shared-types

Turbo may have cached a stale build. Force a fresh run:

```bash
turbo typecheck --force
```

Or clear the Turbo cache entirely:

```bash
rm -rf .turbo
turbo typecheck
```

### "Cannot find module '@crawl/shared-types'"

The symlink may be broken. Reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

Then verify the symlink exists:

```bash
ls -la node_modules/@crawl/
```

You should see symlinks pointing to `../../apps/*` and `../../packages/*`.

### A package is available in a workspace where I didn't install it

This is hoisting. The package is physically in root `node_modules/` and Node.js can resolve it from anywhere. While it works, your code will break if the other workspace removes it. **Always add the package to your workspace's `package.json` explicitly:**

```bash
npm install <package> -w @crawl/api
```

Even if it's already hoisted and resolvable, this makes the dependency explicit and ensures Turbo's task graph is correct.
