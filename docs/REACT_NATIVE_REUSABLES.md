# React Native Reusables — Setup & Usage Guide

React Native Reusables (RNR) is a shadcn/ui-inspired component library for React Native. Instead of installing a package, components are copied into your project as source code — giving you full control to customize.

**Docs:** https://reactnativereusables.com
**GitHub:** https://github.com/mrzachnugent/react-native-reusables

---

## Table of Contents

1. [How It Works](#1-how-it-works)
2. [Installation Status](#2-installation-status)
3. [Crawl Theme Integration](#3-crawl-theme-integration)
4. [Adding Components](#4-adding-components)
5. [Using the cn() Utility](#5-using-the-cn-utility)
6. [Theme System Deep Dive](#6-theme-system-deep-dive)
7. [File Reference](#7-file-reference)
8. [Customizing Components](#8-customizing-components)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. How It Works

RNR follows the shadcn/ui pattern: rather than importing from `node_modules`, you copy component source files into your project. This means:

- **Full ownership** — every component lives in your codebase as editable source
- **No version lock-in** — update components individually when you choose
- **Tree-shaking by default** — you only include what you use
- **Design system alignment** — components read from CSS variables, so changing `global.css` re-themes everything

Components are built on `@rn-primitives/*` packages (headless, accessible primitives) and styled with NativeWind/Tailwind classes using the same CSS variable system as shadcn/ui.

## 2. Installation Status

All manual installation steps are complete:

| Step | File(s) | Status |
|------|---------|--------|
| 1. NativeWind setup | `babel.config.js`, `metro.config.js` | Done |
| 2. Metro `inlineRem: 16` | `metro.config.js` | Done |
| 3. Install dependencies | `package.json` | Done — `tailwindcss-animate`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@rn-primitives/portal` |
| 4. Add PortalHost | `app/_layout.tsx` | Done — `<PortalHost />` as last child |
| 5. Path aliases | `tsconfig.json` | Done — `@/*` → `src/*` |
| 6. Configure styles | `global.css`, `tailwind.config.js` | Done — CSS variables themed with Crawl palette |
| 7. cn() helper | `src/lib/utils.ts` | Done |
| 8. components.json | `components.json` | Done |

### Validate Setup

```bash
npx @react-native-reusables/cli doctor
```

## 3. Crawl Theme Integration

The default shadcn/ui theme uses neutral grays. We've remapped the CSS variables to match Crawl's dark-themed, purple-accented palette.

### Color Mapping

The CSS variables in `global.css` and the TypeScript values in `src/lib/theme.ts` are kept in sync. Here's how the semantic tokens map to Crawl's design:

| Semantic Token | Dark Mode HSL | Crawl Equivalent | Hex |
|----------------|---------------|-------------------|-----|
| `--background` | `240 33% 3%` | crawl-bg | #0a0a0f |
| `--foreground` | `0 0% 98%` | white text | #fafafa |
| `--card` | `240 28% 14%` | crawl-card | #1a1a2e |
| `--popover` | `240 28% 14%` | crawl-card | #1a1a2e |
| `--primary` | `270 85% 50%` | crawl-purple | #7f13ec |
| `--secondary` | `240 33% 12%` | crawl-surface | #16162a |
| `--muted` | `240 33% 12%` | crawl-surface | #16162a |
| `--muted-foreground` | `220 9% 64%` | crawl-text-muted | #9ca3af |
| `--accent` | `270 85% 50%` | crawl-purple | #7f13ec |
| `--destructive` | `0 70.9% 59.4%` | red/error | #ef4444 |
| `--border` | `240 28% 14%` | crawl-card | #1a1a2e |
| `--input` | `240 28% 14%` | crawl-card | #1a1a2e |
| `--ring` | `270 72% 65%` | crawl-purple-light | #a855f7 |

### What This Means in Practice

When you add an RNR `Button` component, it will automatically:
- Use `bg-primary` → crawl purple (#7f13ec) for the default variant
- Use `bg-secondary` → crawl surface (#16162a) for the secondary variant
- Use `bg-destructive` → red for the destructive variant
- Use `text-primary-foreground` → white text on purple buttons
- Use `border-border` → subtle crawl-card borders
- Use `ring-ring` → purple-light focus rings

No per-component color overrides needed — it all flows from the CSS variables.

### Dual Color Systems

The project has two color systems that coexist:

| System | Usage | Example |
|--------|-------|---------|
| `crawl-*` classes | Custom Crawl components | `bg-crawl-purple`, `text-crawl-text-muted` |
| Semantic tokens | RNR components | `bg-primary`, `text-muted-foreground` |

Both are defined in `tailwind.config.js`. The `crawl-*` classes use hardcoded hex values. The semantic tokens use `hsl(var(--token))` and adapt to light/dark mode via `global.css`.

**Guideline:** Use semantic tokens (`bg-primary`, `text-foreground`) for new components when possible. Fall back to `crawl-*` classes when you need a specific color that doesn't map to a semantic role.

## 4. Adding Components

### Via CLI (Recommended)

```bash
# Add a single component
npx @react-native-reusables/cli add button

# Add multiple components
npx @react-native-reusables/cli add button card dialog

# Interactive selection
npx @react-native-reusables/cli add
```

The CLI reads `components.json` to determine where to place files. With the current config, components go to `src/components/ui/`.

### Manual Copy

1. Find the component source on the [RNR docs](https://reactnativereusables.com/docs/components/button)
2. Copy the code into `src/components/ui/<component-name>.tsx`
3. Install any required `@rn-primitives/*` package:
   ```bash
   npx expo install @rn-primitives/<primitive-name>
   ```
4. Verify imports point to `@/lib/utils` for the `cn()` function

### Component Dependencies

Some components depend on others. Common chains:

```
Dialog → Portal (@rn-primitives/portal — already installed)
Select → Portal
DropdownMenu → Portal
AlertDialog → Button (add Button first)
Form → Label + Input
```

### After Adding a Component

1. The component file lands in your source tree — it's now yours to edit
2. Import it: `import { Button } from '@/components/ui/button'`
3. Run `npm run lint` to verify no issues
4. If the component uses a new `@rn-primitives/*` package, the CLI installs it automatically

## 5. Using the cn() Utility

The `cn()` function from `src/lib/utils.ts` merges Tailwind classes intelligently:

```typescript
import { cn } from '@/lib/utils';

// Basic usage — merge classes
cn('px-4 py-2', 'bg-primary')
// → 'px-4 py-2 bg-primary'

// Conditional classes
cn('px-4 py-2', isActive && 'bg-primary', !isActive && 'bg-secondary')
// → 'px-4 py-2 bg-primary' (when isActive is true)

// Conflict resolution — last wins
cn('p-2', 'p-4')
// → 'p-4' (tailwind-merge resolves the conflict)

// Component variant pattern
function MyButton({ className, ...props }) {
  return (
    <Pressable className={cn('rounded-lg bg-primary px-4 py-2', className)} {...props} />
  );
}

// Override defaults at call site
<MyButton className="bg-secondary px-6" />
// → 'rounded-lg bg-secondary px-6 py-2' (bg and px overridden, others kept)
```

**How it works:**
1. `clsx(inputs)` handles conditional logic (booleans, arrays, objects)
2. `twMerge(result)` resolves Tailwind class conflicts (e.g., `p-2` vs `p-4`)

This is the same pattern used by shadcn/ui on the web.

## 6. Theme System Deep Dive

### Three Layers of Theming

```
global.css (CSS Variables)
    ↓ consumed by
tailwind.config.js (Tailwind Classes)
    ↓ used in
Component className props (e.g., bg-primary)

src/lib/theme.ts (TypeScript Values)
    ↓ consumed by
React Navigation ThemeProvider
    ↓ themes
Navigation chrome (headers, tab bars, etc.)
```

### Changing the Theme

To change a color across the entire app:

**Step 1:** Update the CSS variable in `global.css`
```css
.dark:root {
  --primary: 270 85% 50%;  /* Change this HSL value */
}
```

**Step 2:** Update the matching value in `src/lib/theme.ts`
```typescript
dark: {
  primary: 'hsl(270 85% 50%)',  /* Keep in sync */
}
```

**Step 3:** If you also use `crawl-*` classes for the same color, update `tailwind.config.js`:
```javascript
crawl: {
  purple: '#7f13ec',  /* Keep hex in sync with HSL above */
}
```

### Dark Mode

The app forces dark mode on mount in `app/_layout.tsx`:

```typescript
const { colorScheme, setColorScheme } = useColorScheme();

React.useEffect(() => {
  if (colorScheme !== 'dark') {
    setColorScheme('dark');
  }
}, [colorScheme, setColorScheme]);
```

NativeWind applies the `.dark:root` CSS variables when `colorScheme === 'dark'`. To support light mode in the future, remove this `useEffect` and let the system preference take over.

### ThemeProvider

`app/_layout.tsx` wraps the app in React Navigation's `ThemeProvider`:

```typescript
<ThemeProvider value={NAV_THEME[colorScheme]}>
```

This provides themed colors to any React Navigation components (headers, tab bars, etc.) and is required by some RNR components that use navigation theme context internally.

## 7. File Reference

| File | Purpose |
|------|---------|
| `global.css` | CSS variable definitions for light and dark themes. The single source of truth for the color palette that RNR components consume. |
| `tailwind.config.js` | Maps CSS variables to Tailwind utility classes (e.g., `--primary` → `bg-primary`). Also includes the `crawl-*` custom palette, border radius tokens, accordion animations, and the `tailwindcss-animate` plugin. Content array includes `@rnr` node_modules path. |
| `src/lib/utils.ts` | Exports `cn()` — the class merging utility used by every RNR component. Combines `clsx` (conditional logic) with `tailwind-merge` (conflict resolution). |
| `src/lib/theme.ts` | Exports `THEME` (light/dark color objects with HSL strings) and `NAV_THEME` (React Navigation theme objects). Values must stay in sync with `global.css`. |
| `components.json` | Configuration for the RNR CLI. Specifies component output paths, Tailwind config location, and path aliases. The CLI reads this to know where to scaffold components. |
| `app/_layout.tsx` | Root layout — wraps app in `ThemeProvider` with `NAV_THEME`, forces dark mode via `useColorScheme`, renders `PortalHost` for overlay components. |
| `metro.config.js` | Metro bundler config with `inlineRem: 16` in the `withNativeWind` call — converts rem units to 16px base for consistent sizing on native. |

## 8. Customizing Components

Once an RNR component is in your project, it's plain source code. Common customizations:

### Change Default Variant Colors

Edit the component's `cva()` call:

```typescript
// In components/ui/button.tsx
const buttonVariants = cva('...base classes...', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',      // ← edit these
      secondary: 'bg-secondary text-secondary-foreground',
      outline: 'border border-input bg-background',
      ghost: 'hover:bg-accent',
      // Add custom variants:
      crawl: 'bg-crawl-purple text-white',
    },
  },
});
```

### Add a Custom Variant

```typescript
// Add to the variants object in cva()
crawlOutline: 'border-2 border-crawl-purple bg-transparent text-crawl-purple-light',
```

### Adjust Sizes

```typescript
size: {
  default: 'h-12 px-5 py-3',  // ← adjust padding/height
  sm: 'h-9 px-3',
  lg: 'h-14 px-8',
  icon: 'h-10 w-10',
},
```

### Override at Usage Site

Any component that accepts `className` can be overridden inline:

```tsx
<Button className="bg-crawl-green rounded-full" variant="default">
  Check In
</Button>
```

The `cn()` utility ensures your overrides win over the component's defaults.

## 9. Troubleshooting

### Component styles not applying

- Verify `./node_modules/@rnr/**/*.{ts,tsx}` is in the `content` array of `tailwind.config.js`
- Run `npm start -- --clear` to clear Metro cache
- Check that `global.css` is imported in `app/_layout.tsx`

### Portal-based components (Dialog, Select) not rendering

- Verify `<PortalHost />` is the last child in the root layout (after `<Stack>` and `<StatusBar>`)
- It must be inside all providers but outside the navigation stack

### cn() import not resolving

- Verify `tsconfig.json` has `"@/*": ["src/*"]` in paths
- The import should be `import { cn } from '@/lib/utils'`
- Make sure `src/lib/utils.ts` exists

### Colors look wrong / not themed

- Check that `global.css` has the `.dark:root` selector (not `.dark` alone — NativeWind requires `:root`)
- Verify `useColorScheme` is returning `'dark'` — the `useEffect` in the root layout forces this
- Ensure `src/lib/theme.ts` HSL values match `global.css` CSS variable values

### CLI doctor fails

```bash
npx @react-native-reusables/cli doctor
```

Common fixes:
- Missing dependency → `npx expo install <package>`
- Wrong path alias → check `components.json` aliases match `tsconfig.json`
- Missing `inlineRem` → add `inlineRem: 16` to `withNativeWind()` call in `metro.config.js`
