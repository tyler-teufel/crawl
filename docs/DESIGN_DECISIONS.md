# Design Decisions

Rationale behind every major technical choice in the Crawl app. Each section explains what was chosen, what the alternatives were, and why this approach won.

---

## expo-router (File-Based Routing)

**Chosen over:** Manual React Navigation configuration

Expo-router maps the file system to the navigation tree. `app/(tabs)/voting.tsx` becomes the `/voting` route automatically.

**Why:**

- **Self-documenting routes** — new screens are just new files. No route registration boilerplate.
- **Free deep linking** — every route is a URL. Critical for sharing venue links (`crawl://venue/123`) later.
- **Layout nesting** — `_layout.tsx` files make provider/navigator hierarchy visible at the filesystem level.
- **Convention over configuration** — parenthesized groups `(tabs)` create navigators, square brackets `[id]` create dynamic params, all without manual setup.

**Trade-off:** Less flexibility than raw React Navigation for highly custom navigation patterns. Not an issue for Crawl's standard tab+stack+modal structure.

---

## NativeWind (Tailwind CSS for React Native)

**Chosen over:** `StyleSheet.create()`, styled-components, Tamagui

**Why:**

- **Development speed** — utility classes are faster to write and iterate than named style objects. `className="flex-1 bg-primary p-4 rounded-lg"` vs. defining a `StyleSheet` with named properties.
- **Centralized design system** — `tailwind.config.js` defines the full color palette, spacing scale, and typography. Every component pulls from the same source.
- **Tooling** — `prettier-plugin-tailwindcss` auto-sorts class names, eliminating formatting debates. Tailwind IntelliSense provides autocomplete.
- **Web familiarity** — developers with Tailwind CSS experience on the web can immediately read and write React Native styles.
- **RNR compatibility** — React Native Reusables is built on NativeWind, so the styling system is fully aligned.

**Trade-off:** Longer `className` strings can be harder to scan than named styles. Mitigated by Prettier sorting and the `cn()` utility for conditional logic.

---

## React Native Reusables (Component Library)

**Chosen over:** Building all UI components from scratch, UI Kitten, React Native Paper, Tamagui

**Why:**

- **Source ownership** — components are copied into the project as editable source code, not imported from a package. This means no version lock-in and full customization control.
- **Tailwind-native** — built on NativeWind with the same CSS variable theming as shadcn/ui. Components automatically pick up the Crawl theme from `global.css`.
- **Accessible primitives** — built on `@rn-primitives/*` which handle ARIA roles, keyboard navigation, and screen reader support.
- **Incremental adoption** — add components one at a time. No all-or-nothing framework commitment.

**Trade-off:** No automatic updates — when RNR releases improvements, you manually update individual component files. In practice, this is fine because components are customized after adoption anyway.

---

## Map Placeholder Instead of react-native-maps

**Chosen over:** Immediate `react-native-maps` integration

**Why:**

- **No native build required** — `react-native-maps` requires native module linking, platform-specific API keys (Google Maps for Android, Apple Maps for iOS), and Xcode/Android Studio setup. The placeholder lets the team validate UX flows in Expo Go without any of that.
- **Same component interface** — `MapPlaceholder` accepts `venues: Venue[]` and `onPinPress: (venue) => void`, exactly what a real map wrapper would accept. Swapping is a single import change.
- **Animation validation** — the pulsing glow on `MapPin` proves that reanimated animations work correctly before adding the complexity of rendering inside `<Marker>` components.

**Migration path:** See [Maps Integration Guide](./MAPS_INTEGRATION.md).

---

## React Context for State Management

**Chosen over:** Zustand, Redux, Jotai, MobX

**Why:**

- **Simplicity** — the app state is small: 10 filter toggles, a search string, a city name, and a vote tracker with 3 slots. Context handles this without any external dependency.
- **Co-location** — all state consumers are within the same component tree (tabs, modals, detail screens). No cross-tree or cross-app communication needed.
- **No async cache** — there's no server data to cache, invalidate, or deduplicate. When a backend exists, TanStack Query will handle that layer separately.
- **Zero learning curve** — `useContext` is a standard React primitive.

**Why at root (not per-tab):** The filter modal (`/filters`) is a separate route rendered outside the `(tabs)` layout group. If the provider lived inside `(tabs)/_layout.tsx`, the modal couldn't access filter state. Hoisting to `app/_layout.tsx` ensures all routes share the same context instance.

**Future plan:** When backend integration happens, split into:

- TanStack Query for server state (venues, votes, user data)
- Context or Zustand for UI-only state (filter toggles, search text)

---

## react-native-svg for the Hotspot Score Ring

**Chosen over:** Canvas-based solutions, pre-rendered images, CSS-only approaches

**Why:**

- **SVG `strokeDashoffset`** — the canonical technique for animated circular progress indicators. A `<Circle>` element with `strokeDasharray` set to the circumference and `strokeDashoffset` animated from full to partial creates a smooth fill effect.
- **Reanimated integration** — `Animated.createAnimatedComponent(Circle)` + `useAnimatedProps` drives the SVG attribute on the UI thread at 60fps. No JS thread blocking.
- **Cross-platform consistency** — renders identically on iOS and Android with no platform-specific code.
- **Lightweight** — only imports `Svg` and `Circle` from the library. The full SVG feature set is available if needed later (charts, custom shapes).

---

## Ionicons for Icons

**Chosen over:** MaterialIcons, FontAwesome, custom SVG icons, Lucide

**Why:**

- **Zero dependency** — `@expo/vector-icons` ships bundled with every Expo project. Ionicons is included in that bundle.
- **Outline/filled pairs** — every icon has both an outline variant (inactive state) and a filled variant (active state), which matches the tab bar and button patterns in the app.
- **Comprehensive set** — covers all current needs: compass, heart, globe, person, search, options, beer, flame, musical-notes, location, navigate, sparkles, etc.

---

## Dark Mode Forced On

**Chosen over:** System preference detection, manual toggle, light-first design

**Why:**

- **Nightlife context** — Crawl is designed for use in dark environments (bars, clubs). A dark UI reduces eye strain and screen glare.
- **Design consistency** — all mockups and design tokens were created for a dark theme. Supporting light mode would require designing and testing a second visual language.
- **Simplified development** — one theme to maintain, one set of colors to test against.

**Future flexibility:** The theme system supports light mode out of the box (light tokens exist in `global.css` and `src/lib/theme.ts`). To enable light mode, remove the `useEffect` that forces dark in `app/_layout.tsx` and let `useColorScheme` follow the system preference.

---

## `inlineRem: 16` in Metro Config

**Chosen over:** Default rem handling

**Why:** React Native doesn't have a browser-like `rem` unit. NativeWind's `inlineRem: 16` converts all rem-based Tailwind utilities (font sizes, spacing) to absolute pixel values using a 16px base. This ensures consistent sizing across platforms and matches web Tailwind defaults. Required by RNR for correct component sizing.

---

## Prettier Plugin for Tailwind Class Sorting

**Chosen over:** Manual class ordering, ESLint rules

**Why:** Tailwind class strings can become long. Without consistent ordering, the same styles look different in every file. `prettier-plugin-tailwindcss` auto-sorts classes on save in a canonical order (layout → spacing → sizing → typography → colors → etc.), eliminating all formatting debates and making className strings scannable.
