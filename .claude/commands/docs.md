---
description: Update project documentation to reflect current codebase state
---

# Documentation Update

You are updating the Crawl project documentation. Your job is to bring the docs in `docs/` into sync with the current state of the codebase.

## Process

### 1. Assess What Changed

First, determine the scope of changes that need documenting. Run these in parallel:

- `git diff --name-only HEAD~5` — recent file changes
- `git log --oneline -10` — recent commit context
- Read `docs/README.md` for the document index

If the user provided `$ARGUMENTS`, treat that as a description of what changed and focus your updates accordingly. If no arguments, scan the full codebase diff.

### 2. Determine Which Docs Need Updates

Map the changed files to the docs they affect:

| Changed Files | Docs to Update |
|---------------|----------------|
| `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, any new route files | ARCHITECTURE.md (navigation), FILE_REFERENCE.md |
| Any file in `app/` | FILE_REFERENCE.md (screen files section) |
| Any file in `components/` | FILE_REFERENCE.md (components section), ARCHITECTURE.md (component graph) |
| Any file in `src/` | FILE_REFERENCE.md (shared logic section) |
| `tailwind.config.js`, `global.css`, `src/lib/theme.ts` | REACT_NATIVE_REUSABLES.md (theme mapping), ARCHITECTURE.md (styling pipeline) |
| `package.json` (new deps) | PROJECT_OVERVIEW.md (tech stack) |
| `components.json`, RNR-related files | REACT_NATIVE_REUSABLES.md |
| Config files (babel, metro, eslint, prettier, tsconfig) | FILE_REFERENCE.md (config section) |
| New screens or major features | PROJECT_OVERVIEW.md, ARCHITECTURE.md, DESIGN_DECISIONS.md |
| `eas.json`, CI/CD workflows | CICD_PIPELINE.md |
| API client files, backend-related | DATA_PIPELINE.md |

### 3. Read the Affected Docs and the Changed Source Files

Read each doc that needs updates AND the source files that changed. Do not update docs based on assumptions — verify against actual code.

### 4. Apply Updates

For each document that needs changes:

**FILE_REFERENCE.md** — Add or update entries for new/changed files. Each entry should describe:
- What the file does (purpose and behavior, not just the file name restated)
- Key implementation details a developer would need to know
- How it connects to other files

**ARCHITECTURE.md** — Update:
- Project structure tree if directories changed
- Navigation route tree if routes changed
- State management section if context/providers changed
- Component dependency graph if component relationships changed
- System diagrams if the overall architecture shifted
- Always include ASCII diagrams for navigation flow and component relationships

**DESIGN_DECISIONS.md** — Add a new section when:
- A new library or framework was adopted
- An architectural pattern was chosen over alternatives
- A significant trade-off was made
- Format: What was chosen → What the alternatives were → Why this approach won → Trade-offs accepted

**PROJECT_OVERVIEW.md** — Update:
- Screens table if new screens were added
- Key features list if new features were implemented
- Tech stack table if new dependencies were added
- Status indicators (Placeholder → Complete, etc.)

**REACT_NATIVE_REUSABLES.md** — Update when:
- New RNR components were added (add to usage examples)
- Theme tokens changed (update the color mapping table)
- New customization patterns were established

**CONTRIBUTING.md** — Update when:
- New directory conventions were established
- New naming patterns were introduced
- Code quality rules changed

**ROADMAP.md** — Update:
- Move completed items from the roadmap to PROJECT_OVERVIEW.md
- Adjust effort estimates based on experience
- Add newly identified future work items

**docs/README.md** — Update if new docs were created or existing ones renamed.

### 5. Diagrams

Include or update ASCII diagrams in these situations:

- **Navigation changes** → Update the navigation flow diagram in ARCHITECTURE.md
- **New component trees** → Update the component dependency graph in ARCHITECTURE.md
- **State management changes** → Update the state tree diagram in ARCHITECTURE.md
- **Integration guides** → Include data flow diagrams showing how systems connect
- **New architecture layers** → Update the full system architecture diagram

Diagram style: Use box-drawing characters (`┌─┐│└─┘`), arrows (`──►`, `◄──`, `▼`, `▲`), and clear labels. Keep diagrams under 80 characters wide when possible.

### 6. Verify

After making changes:
- Ensure internal links between docs still work (e.g., `[RNR guide](./REACT_NATIVE_REUSABLES.md)`)
- Check that the README.md index accurately reflects all docs
- Verify no doc references files or features that no longer exist
