# Reskin Spec — v1.1.0 (Sprint 2)

**Status:** Active brief for the v1.1.0 reskin · **Canonical visual reference:**
[`crawl-v2-design-board.png`](./crawl-v2-design-board.png) (Crawl v2 — Product,
Design & Architecture board) · **Foundation:**
[`CRAWL_V2_PROPOSAL.md`](../planning/CRAWL_V2_PROPOSAL.md)

This is the refined, board-grounded instruction for the v1.1.0 **reskin**: apply
the Crawl v2 visual language to the app **as it exists today**. It is the first
slice of the v2 direction, shipped as an incremental minor release — **not** the
v2 rebuild.

---

## Scope boundary — read this first

The design board shows the **full v2 target** (5-tab IA, new screens, `theme/`
module, `features/` layout). v1.1.0 delivers **only the visual reskin on the
current 4-tab IA**. Everything structural is a later milestone.

| ✅ In scope for v1.1.0 (reskin) | ❌ Deferred (later milestones) |
| --- | --- |
| Adopt the v2 **design tokens** (colors, radius, spacing, elevation, motion) into the existing token pipeline | The `theme/` folder + `features/`-first restructure (M2 architecture refactor) |
| Vendor **Satoshi + Clash Grotesk** and apply app-wide (#49) | The **5-tab IA** (Home / Discover / Map / Social / Profile) |
| Restyle the **design-system components** (Button, Badge, Chip, VenueCard, Skeleton) to the board | New screens: **Home feed, Discover, Social, Crawl, Collections, v2 Venue Detail** |
| Reskin the **four existing tabs** (Explore, Voting, Global, Profile) with the restyled components | Supabase-native data cutover (#78) — reskin runs on today's mock/data layer |
| Branded animated **splash + logo** (#48) | Live Activity / social graph / crawls (M4–M7 features) |

**Guiding principle:** if a change alters navigation structure, adds a new
screen, or moves files into `features/`/`theme/`, it is **out of scope** — the
reskin is presentation only, so every v1.1.0 release stays shippable/OTA.

---

## Token values (authoritative — from the board's Design System layer)

Adopt these into the **existing** three synced locations (`tailwind.config.js`
`crawl-*` palette, `global.css` CSS vars, `src/lib/theme.ts`) — do **not**
create a `theme/` folder yet.

**Color** (matches `CRAWL_V2_PROPOSAL.md`; ✅ = already present, 🆕 = add, 🔄 = retint):

| Token | Hex | |
| --- | --- | --- |
| purple | `#7f13ec` | ✅ |
| purpleLight | `#a855f7` | ✅ |
| purpleDark | `#5b0daa` | ✅ |
| background | `#0a0a0f` | ✅ |
| surface | `#16162a` | ✅ |
| card | `#1a1a2e` | ✅ |
| success | `#22c55e` | ✅ |
| text | `#ffffff` | ✅ |
| textSecondary | `#c3c3cf` | 🆕 |
| textMuted | `#8b8ba5` | 🔄 (from `#9ca3af`) |
| border | `#27273d` | 🆕 |
| divider | `#222235` | 🆕 |

**Scale tokens** (add as Tailwind theme extensions — the board's Design Tokens panel):

- **Radius:** `8 / 12 / 16 / 24`
- **Spacing:** `0 / 1 / 2 / 4 / 8` (base grid)
- **Elevation:** `0 / 1 / 2 / 3 / 4` (shadow ramp)
- **Motion:** Spring `200 / 300 / 500` (ms) — use with reanimated (already a dep)
- **Z-index:** `0 / 10 / 20 / 30 / 40`

**Typography:** Clash Grotesk (display/headings/logo) · Satoshi (UI/body).
Weights Regular / Medium / Semibold / Bold. Both are Fontshare fonts — vendor
under `apps/mobile/assets/fonts/`, load via `expo-font` (not
`@expo-google-fonts`).

---

## Workstreams (the v1.1.0 reskin tickets)

Sequenced by dependency. Each references the board section it implements.

### R1 — Design-token foundation (no blocker — do first)

The dependency gate for everything below. Add the 🆕 tokens, apply the 🔄
retint, and add the radius/spacing/elevation/motion scales to
`tailwind.config.js`, mirrored in `global.css` and `src/lib/theme.ts`. No
component changes. Ships a `@crawl/mobile` patch changeset. *(This is the
already-identified token-foundation ticket — now with exact values above.)*

### R2 — Typography (#49, blocked on font files)

Vendor Satoshi + Clash Grotesk into `assets/fonts/`, wire `expo-font` loading
app-wide (no flash-of-default-font), map Satoshi → body/UI and Clash Grotesk →
headings/logo. **Asset blocker:** the font files must be provided.

### R3 — Component restyle (Design System layer of the board)

Restyle the shared components to the board's specs, using R1 tokens:

- **Button** — Primary (filled purple), Secondary (outline), Tertiary (ghost).
- **Badge** — Trending (🔥), Open Now (green), Live (purple) variants.
- **Chip / FilterChip** — pill, active vs inactive states per the board.
- **VenueCard** — **photography-first**: hero image, rounded (radius 16–24),
  elevation, bookmark affordance, name + `$$$$ · type · distance` meta, badges.
  (Supersedes the v1.0.1 height-capped card — keep the layout guarantees from
  #47 while adopting the new visual treatment.)
- **Skeletons** — match the new card silhouette; **Elevation** ramp applied.

### R4 — Screen reskin (current 4-tab IA only)

Apply R3 components + R1 tokens to the existing screens **without changing
navigation**: Explore (`(tabs)/index`), Voting (`(tabs)/voting`), Global and
Profile placeholders (visual language only — full build-out stays #50/#51).

### R5 — Splash + logo (#48, blocked on vector export)

Logo from the board's Logo System (martini-pin + `crawl` wordmark, purple
accent); wire `expo-splash-screen` with a reanimated transition. **Asset
blocker:** production vector (SVG/PDF) export of the logo.

---

## Core principles to honor (board footer)

Discovery over Search · Atmosphere over Information · **Photography First** ·
Maps Support Discovery · **One Purpose per Screen** · **Motion with Purpose** ·
**Premium by Default** · Social by Design.

## Asset handoffs still needed from the owner

1. **Font files** — Satoshi + Clash Grotesk (`.otf`/`.ttf`) for R2/#49.
2. **Logo vector export** — SVG/PDF of the martini-pin logo suite for R5/#48.

Until these arrive, **R1 (tokens), R3 (component restyle), R4 (screen reskin)**
proceed unblocked; R2 and R5 wait on their assets.
