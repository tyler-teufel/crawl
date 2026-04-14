---
name: docs
description: Update project documentation to reflect current codebase state. Use when code changes alter architecture, add/remove files, introduce new patterns, add dependencies, or change how systems connect.
when_to_use: After making code changes that affect project structure, navigation, state management, styling, dependencies, configuration, or API endpoints. Also use when the user explicitly asks to update docs or when a PostToolUse hook suggests documentation may need updating.
argument-hint: "[description of what changed]"
allowed-tools: Read Grep Glob Bash(git diff *) Bash(git log *)
---

# Documentation Update

You are updating the Crawl project documentation. Bring the docs in `docs/` into sync with the current state of the codebase.

## Process

### 1. Assess What Changed

Determine the scope of changes that need documenting. Run these in parallel:

- `git diff --name-only HEAD~5` — recent file changes
- `git log --oneline -10` — recent commit context
- Read `docs/README.md` for the document index

If `$ARGUMENTS` was provided, treat that as a description of what changed and focus updates accordingly. If no arguments, scan the full codebase diff.

### 2. Map Changes to Docs

Use this table to determine which docs need updates:

| Changed Files | Docs to Update |
|---------------|----------------|
| `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, new route files | ARCHITECTURE.md (navigation), FILE_REFERENCE.md |
| Any file in `app/` | FILE_REFERENCE.md (screen files) |
| Any file in `components/` | FILE_REFERENCE.md (components), ARCHITECTURE.md (component graph) |
| Any file in `src/` | FILE_REFERENCE.md (shared logic) |
| `tailwind.config.js`, `global.css`, `src/lib/theme.ts` | REACT_NATIVE_REUSABLES.md (theme), ARCHITECTURE.md (styling) |
| `package.json` (new deps) | PROJECT_OVERVIEW.md (tech stack) |
| RNR-related files | REACT_NATIVE_REUSABLES.md |
| Config files (babel, metro, eslint, prettier, tsconfig) | FILE_REFERENCE.md (config) |
| New screens or major features | PROJECT_OVERVIEW.md, ARCHITECTURE.md, DESIGN_DECISIONS.md |
| CI/CD workflows, `eas.json` | CICD_PIPELINE.md |
| `apps/api/src/**` | FILE_REFERENCE.md (backend), ARCHITECTURE.md (backend), DATA_PIPELINE.md |
| `apps/api/package.json` | PROJECT_OVERVIEW.md (tech stack) |
| `packages/shared-types/**` | FILE_REFERENCE.md, ARCHITECTURE.md |
| `turbo.json`, root `package.json` | TURBOREPO_MIGRATION.md (if structural), FILE_REFERENCE.md |
| New library or framework adopted | DESIGN_DECISIONS.md |
| Roadmap item completed | ROADMAP.md, PROJECT_OVERVIEW.md |

### 3. Read Affected Docs and Source Files

Read each doc that needs updates AND the source files that changed. Do not update docs based on assumptions — verify against actual code.

### 4. Apply Updates

For each document that needs changes:

**FILE_REFERENCE.md** — Add or update entries. Each entry should describe:
- What the file does (purpose and behavior, not just restating the filename)
- Key implementation details
- How it connects to other files

**ARCHITECTURE.md** — Update:
- Project structure tree if directories changed
- Navigation route tree if routes changed
- State management section if context/providers changed
- Component dependency graph if component relationships changed
- System diagrams if architecture shifted
- Backend architecture section if API changed

**DESIGN_DECISIONS.md** — Add a new section when a library, framework, or architectural pattern was chosen. Format: What was chosen → Alternatives → Why → Trade-offs.

**PROJECT_OVERVIEW.md** — Update screens table, features list, tech stack, status indicators.

**REACT_NATIVE_REUSABLES.md** — Update when RNR components added or theme tokens changed.

**CONTRIBUTING.md** — Update when new conventions or naming patterns introduced.

**ROADMAP.md** — Move completed items, adjust estimates, add new work items.

**BACKEND_IMPLEMENTATION_PLAN.md** — Update when backend decisions are made or phases completed.

**DATA_PIPELINE.md** — Update backend architecture diagrams and API endpoint tables.

**TURBOREPO_MIGRATION.md** — Update when workspace structure or turbo config changes.

**INSTALLING_PACKAGES.md** — Update when new workspaces added or install patterns change.

**docs/README.md** — Update if new docs were created or existing ones renamed.

### 5. Diagrams

Include or update ASCII diagrams when:
- Navigation flow changes → ARCHITECTURE.md
- Component trees change → ARCHITECTURE.md
- State management changes → ARCHITECTURE.md
- Backend architecture changes → ARCHITECTURE.md, DATA_PIPELINE.md
- New integration added → relevant guide doc

Diagram style: box-drawing characters (`┌─┐│└─┘`), arrows (`──►`, `◄──`, `▼`, `▲`), clear labels. Under 80 chars wide.

### 6. Verify

After making changes:
- Ensure internal links between docs still work
- Check that docs/README.md index reflects all docs
- Verify no doc references files or features that no longer exist
