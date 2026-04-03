# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start development server
npm start            # or: npm run ios | npm run android | npm run web

# Lint and format check
npm run lint

# Auto-fix lint and formatting issues
npm run format

# Native build prep
npm run prebuild
```

There is no test suite configured yet.

## Architecture

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
- `src/` — Shared logic aliased as `@/*` (`types/`, `data/`, `constants/`, `context/`, `hooks/`, `lib/`)
- `docs/` — Project documentation (see Documentation section below)
- `assets/` — Static images

### Styling

Styling uses **NativeWind** (Tailwind CSS for React Native). Use `className` props on React Native components. The Babel preset is configured with `jsxImportSource: 'nativewind'` so JSX automatically gets NativeWind support. Prettier auto-sorts Tailwind classes via `prettier-plugin-tailwindcss`.

There are two color systems:
- **Semantic tokens** (`bg-primary`, `text-muted-foreground`) — CSS variable-based, defined in `global.css`, used by RNR components. Prefer these for new components.
- **Crawl palette** (`bg-crawl-purple`, `text-crawl-text-muted`) — hardcoded hex in `tailwind.config.js`, used by existing custom components.

Tailwind content paths: `app/**`, `components/**`, `src/**`, `node_modules/@rnr/**`.

### Path Aliases

`@/*` maps to `src/*` (configured in `tsconfig.json`). Place shared code under `src/`.

### Component Library

**React Native Reusables** (RNR) is integrated. Components are source-copied, not package-imported. Add components via `npx @react-native-reusables/cli add <component>`. Components use `cn()` from `@/lib/utils` for class merging. Theme flows from CSS variables in `global.css` through `tailwind.config.js` into component `className` props.

### State Management

A single `VenueContext` (React Context) at the root layout level manages filters, search, votes, and derived `filteredVenues`. All screens and modals share this context.

### Key Dependencies

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

## Documentation

### Automatic Documentation Maintenance

**IMPORTANT:** When you make changes to the codebase that alter architecture, add/remove files, introduce new patterns, add dependencies, or change how systems connect, you MUST update the relevant documentation in `docs/`. Documentation is a living part of this project, not an afterthought.

### When to Update Docs

Update documentation alongside code changes in these situations:

| Change Type | Docs to Update |
|-------------|----------------|
| New screen or route | `ARCHITECTURE.md` (navigation tree, diagrams), `FILE_REFERENCE.md`, `PROJECT_OVERVIEW.md` |
| New component | `FILE_REFERENCE.md` (components section), `ARCHITECTURE.md` (dependency graph) |
| New file in `src/` | `FILE_REFERENCE.md` (shared logic section) |
| New dependency added | `PROJECT_OVERVIEW.md` (tech stack), `DESIGN_DECISIONS.md` if a choice was made |
| Theme/color changes | `REACT_NATIVE_REUSABLES.md` (color mapping table), `ARCHITECTURE.md` (styling pipeline) |
| State management changes | `ARCHITECTURE.md` (state tree) |
| Config file changes | `FILE_REFERENCE.md` (config section) |
| Major architectural decision | `DESIGN_DECISIONS.md` (new section explaining what, why, trade-offs) |
| Feature completed from roadmap | `ROADMAP.md` (move to done), `PROJECT_OVERVIEW.md` (update status) |
| New conventions established | `CONTRIBUTING.md` |

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
├── README.md                    # Index linking to all docs
├── PROJECT_OVERVIEW.md          # What the app is, features, tech stack
├── ARCHITECTURE.md              # Structure, navigation, state, styling, diagrams
├── FILE_REFERENCE.md            # Every file with detailed descriptions
├── DESIGN_DECISIONS.md          # Rationale behind technical choices
├── REACT_NATIVE_REUSABLES.md    # RNR setup, theming, adding components
├── MAPS_INTEGRATION.md          # Guide for replacing map placeholder
├── DATA_PIPELINE.md             # Backend architecture and migration plan
├── CICD_PIPELINE.md             # Build, test, release pipeline
├── CONTRIBUTING.md              # How to add screens, components, follow conventions
├── ROADMAP.md                   # Prioritized next steps
└── VERSION_1.0_DOCUMENT.md      # Historical v1.0 consolidated doc
```

### The `/docs` Skill

Run `/docs` (or `/docs <description of what changed>`) to trigger a comprehensive documentation update pass. This scans recent changes, determines which docs are affected, reads the source files and existing docs, and applies targeted updates.
