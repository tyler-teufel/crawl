# Installing Packages

How to add, remove, and manage npm packages across the Crawl monorepo.

---

## The Golden Rule

**Always run `npm install` from the repo root.** Never `cd` into a workspace and run `npm install` there — this can create a nested `package-lock.json` that breaks workspace hoisting.

---

## Adding a Package to a Workspace

Use the `-w` (workspace) flag to target a specific workspace by its package name.

### Mobile app (`@crawl/mobile`)

```bash
# Add a production dependency
npm install <package> -w @crawl/mobile

# Add a dev dependency
npm install <package> -D -w @crawl/mobile

# Examples
npm install expo-haptics -w @crawl/mobile
npm install @types/react-native -D -w @crawl/mobile
```

### API server (`@crawl/api`)

```bash
# Add a production dependency
npm install <package> -w @crawl/api

# Add a dev dependency
npm install <package> -D -w @crawl/api

# Examples
npm install @fastify/jwt -w @crawl/api
npm install @types/bcrypt -D -w @crawl/api
```

### Shared types (`@crawl/shared-types`)

```bash
# Add a production dependency (available to all consumers)
npm install <package> -w @crawl/shared-types

# Add a dev dependency
npm install <package> -D -w @crawl/shared-types

# Example
npm install zod -w @crawl/shared-types
```

When you add a dependency to `@crawl/shared-types`, every workspace that imports from it gets access to that dependency transitively. Use this for packages that define shared interfaces (like `zod` for schema definitions).

---

## Adding a Root-Level Dependency

Root dependencies are tools that operate on the entire repo, not on a single workspace. Turbo itself is the primary example.

```bash
# Add to root devDependencies
npm install <package> -D

# Example — this is how turbo is installed
npm install turbo -D
```

Only install at the root level if the tool is truly repo-wide (task runners, commit hooks, workspace-level scripts). Linting, formatting, and testing tools belong in the workspaces that use them.

---

## Removing a Package

```bash
# Remove from a specific workspace
npm uninstall <package> -w @crawl/mobile
npm uninstall <package> -w @crawl/api
npm uninstall <package> -w @crawl/shared-types

# Remove from root
npm uninstall <package>
```

---

## Where Does the Package Go?

| Scenario | Where to install | Flag |
|----------|-----------------|------|
| Only the mobile app needs it | `@crawl/mobile` | `-w @crawl/mobile` |
| Only the API needs it | `@crawl/api` | `-w @crawl/api` |
| Both apps need the same type definitions | `@crawl/shared-types` | `-w @crawl/shared-types` |
| A repo-wide tool (turbo, husky, etc.) | Root | no `-w` flag |
| Both apps need the same runtime package independently | Install in each workspace separately | `-w @crawl/mobile -w @crawl/api` |

### The "both apps need it" case

If both the mobile app and API need the same package (e.g., `zod`), you have two options:

1. **Install in `@crawl/shared-types`** — if the package is part of the shared interface (types, schemas). Both apps already depend on `@crawl/shared-types`, so they get it transitively.

2. **Install in each workspace separately** — if the package is used independently in each app for different purposes. This keeps dependencies explicit.

```bash
# Option 2: install in both workspaces
npm install zod -w @crawl/mobile -w @crawl/api
```

---

## How Hoisting Works

npm workspaces hoist packages to the root `node_modules/` by default. This means:

- There is **one copy** of each package version on disk, shared across workspaces
- The root `package-lock.json` is the **single source of truth** for all resolved versions
- Workspace-specific `node_modules/` directories only appear when version conflicts exist

```
crawl/
├── node_modules/
│   ├── fastify/           ← hoisted from @crawl/api
│   ├── expo/              ← hoisted from @crawl/mobile
│   ├── zod/               ← hoisted, shared by api + shared-types
│   ├── @crawl/
│   │   ├── api → ../../apps/api           ← symlink
│   │   ├── mobile → ../../apps/mobile     ← symlink
│   │   └── shared-types → ../../packages/shared-types  ← symlink
│   └── ...
├── package-lock.json      ← single lockfile for entire repo
└── ...
```

The `@crawl/*` symlinks are how one workspace imports from another. When `@crawl/api` does `import { Venue } from '@crawl/shared-types'`, Node follows the symlink to `packages/shared-types/src/index.ts`.

---

## Verifying After Installation

After adding or removing packages, verify the workspace graph is healthy:

```bash
# Check that all workspaces are recognized
npm ls --depth=0

# Type-check everything (catches broken imports)
turbo typecheck

# If something looks wrong, clean and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Common Mistakes

| Mistake | What happens | Fix |
|---------|-------------|-----|
| Running `npm install` inside a workspace | Creates a nested `package-lock.json` | Delete the nested lockfile, run `npm install` from root |
| Installing a workspace-specific tool at the root | Bloats the root `package.json` | `npm uninstall <pkg>` from root, reinstall with `-w` flag |
| Forgetting the `-w` flag | Installs to root instead of workspace | `npm uninstall <pkg>`, reinstall with `-w @crawl/<workspace>` |
| Two workspaces requiring incompatible versions | npm creates a nested `node_modules` in one workspace | Usually fine — npm handles this automatically. Check with `npm ls <pkg>` if issues arise |
