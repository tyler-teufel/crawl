# Contributing Guide

How to add screens, components, and shared logic to the Crawl app while following project conventions.

---

## Adding a New Screen

### Tab Screen

1. Create the file in `app/(tabs)/`:

   ```
   app/(tabs)/favorites.tsx
   ```

2. Register in `app/(tabs)/_layout.tsx`:

   ```tsx
   <Tabs.Screen name="favorites" />
   ```

3. Add to the `TabBar` component (`components/layout/TabBar.tsx`) — add an entry to the `tabs` array:

   ```typescript
   { name: '(tabs)/favorites', label: 'Favorites', icon: 'bookmark' as const },
   ```

4. Write the screen component:

   ```tsx
   import React from 'react';
   import { View, Text } from 'react-native';
   import { useSafeAreaInsets } from 'react-native-safe-area-context';

   export default function FavoritesScreen() {
     const insets = useSafeAreaInsets();

     return (
       <View className="flex-1 bg-crawl-bg" style={{ paddingTop: insets.top }}>
         <Text className="text-white">Favorites</Text>
       </View>
     );
   }
   ```

### Stack Screen (Push Navigation)

1. Create the file in `app/` or a subfolder:

   ```
   app/settings.tsx          # → /settings
   app/venue/reviews.tsx     # → /venue/reviews
   ```

2. Register in `app/_layout.tsx`:

   ```tsx
   <Stack.Screen name="settings" />
   ```

3. Navigate to it:
   ```typescript
   router.push('/settings');
   ```

### Modal Screen

1. Create the file in `app/`:

   ```
   app/city-picker.tsx
   ```

2. Register with modal presentation in `app/_layout.tsx`:
   ```tsx
   <Stack.Screen
     name="city-picker"
     options={{
       presentation: 'transparentModal',
       animation: 'fade',
     }}
   />
   ```

### Dynamic Route

1. Create with square bracket naming:

   ```
   app/venue/[id]/reviews.tsx   # → /venue/123/reviews
   ```

2. Access the param:
   ```typescript
   const { id } = useLocalSearchParams<{ id: string }>();
   ```

---

## Adding a New Component

### Where to Place It

| Directory            | When to Use                                                |
| -------------------- | ---------------------------------------------------------- |
| `components/ui/`     | Generic, reusable across features (buttons, inputs, cards) |
| `components/venue/`  | Venue-specific display components                          |
| `components/map/`    | Map-related components                                     |
| `components/voting/` | Voting feature components                                  |
| `components/layout/` | Navigation chrome, layout wrappers                         |

### Component Conventions

```tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  title: string;
  isActive?: boolean;
  onPress: () => void;
  className?: string; // Allow style overrides
}

export function MyComponent({ title, isActive = false, onPress, className }: MyComponentProps) {
  return (
    <Pressable
      onPress={onPress}
      className={cn('rounded-xl bg-crawl-card p-4', isActive && 'bg-crawl-purple', className)}>
      <Text className="text-white">{title}</Text>
    </Pressable>
  );
}
```

**Guidelines:**

- Accept data via props — avoid importing context directly when the component is presentational
- Use `className` prop with `cn()` for composable styling
- Use NativeWind `className` for styling (not `StyleSheet.create`)
- Use Ionicons from `@expo/vector-icons` for icons
- Use `crawl-*` Tailwind classes or semantic tokens (`bg-primary`) for colors
- Export as named exports (not default exports) for components

### Adding an RNR Component

Use the CLI:

```bash
npx @react-native-reusables/cli add button
```

Or manually copy from the [RNR docs](https://reactnativereusables.com/docs/components/button) into `src/components/ui/`. See the [RNR guide](./REACT_NATIVE_REUSABLES.md) for full details.

---

## Adding Shared Logic

### Where to Place It

| Directory        | What Goes Here                             | Import As                |
| ---------------- | ------------------------------------------ | ------------------------ |
| `src/types/`     | TypeScript interfaces and type definitions | `@/types/venue`          |
| `src/hooks/`     | Custom React hooks                         | `@/hooks/useCountdown`   |
| `src/api/`       | API client functions (future)              | `@/api/venues`           |
| `src/lib/`       | Utility functions (cn, theme)              | `@/lib/utils`            |
| `src/context/`   | React Context providers                    | `@/context/VenueContext` |
| `src/constants/` | Static configuration values                | `@/constants/colors`     |
| `src/data/`      | Mock/seed data                             | `@/data/venues`          |

### Custom Hook Convention

```typescript
// src/hooks/useMyHook.ts
import { useState, useEffect } from 'react';

export function useMyHook(param: string) {
  const [data, setData] = useState<MyType | null>(null);

  useEffect(() => {
    // ...
  }, [param]);

  return { data };
}
```

---

## Color Palette

Colors are defined in three places that must stay in sync when modified:

| File                      | Format                                                                   | Used By                                   |
| ------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `global.css`              | HSL in CSS variables (e.g., `270 85% 50%`)                               | NativeWind `className` props via Tailwind |
| `tailwind.config.js`      | Hex values for `crawl-*` tokens, `hsl(var(--token))` for semantic tokens | Tailwind class generation                 |
| `src/lib/theme.ts`        | HSL strings (e.g., `hsl(270 85% 50%)`)                                   | React Navigation `ThemeProvider`          |
| `src/constants/colors.ts` | Hex values (e.g., `#7f13ec`)                                             | Inline `style` props in JS                |

### When to Use Which

| Scenario                   | Use                                                           |
| -------------------------- | ------------------------------------------------------------- |
| Component `className` prop | Tailwind classes: `bg-crawl-purple` or `bg-primary`           |
| Inline `style` prop        | `colors.purple` from `@/constants/colors`                     |
| Reanimated animated style  | Hex string directly or from `colors` constant                 |
| Icon `color` prop          | Hex string: `color="#a855f7"` or `color={colors.purpleLight}` |

---

## State Management Guidelines

| State Type                                  | Approach                                      |
| ------------------------------------------- | --------------------------------------------- |
| UI state (filters, toggles, selections)     | React Context (`VenueContext`)                |
| Server state (venues, votes, user data)     | TanStack Query (when backend exists)          |
| Form state                                  | Local component `useState` or React Hook Form |
| Navigation state                            | Managed by expo-router automatically          |
| Persistent state (auth tokens, preferences) | `expo-secure-store` or `AsyncStorage`         |

### Adding to VenueContext

1. Add the state type to `src/types/venue.ts`
2. Add the state and setter to `VenueContextValue` interface in `src/context/VenueContext.tsx`
3. Add `useState` and action functions inside `VenueProvider`
4. Add to the provider's `value` object

---

## Code Quality

### Before Submitting Changes

```bash
npm run lint      # ESLint + Prettier check (must pass with 0 errors)
npm run format    # Auto-fix formatting
npm start         # Verify app launches and navigates correctly
```

### Style Rules

- **Prettier:** 100 char line width, single quotes, bracket same line, trailing commas (ES5)
- **ESLint:** Expo flat config, no unused variables, no display-name warnings
- **Tailwind:** Classes auto-sorted by Prettier plugin. Use utility classes, not inline styles.
- **TypeScript:** Strict mode enabled. No `any` types without justification.

### Naming Conventions

| Item                | Convention                    | Example                          |
| ------------------- | ----------------------------- | -------------------------------- |
| Screen files        | `lowercase.tsx`               | `voting.tsx`, `profile.tsx`      |
| Component files     | `PascalCase.tsx`              | `VenueCard.tsx`, `SearchBar.tsx` |
| Hook files          | `camelCase.ts`                | `useCountdown.ts`                |
| Type files          | `camelCase.ts`                | `venue.ts`                       |
| Context files       | `PascalCase.tsx`              | `VenueContext.tsx`               |
| Constants           | `camelCase.ts`                | `colors.ts`                      |
| Exported components | `PascalCase`                  | `export function VenueCard()`    |
| Exported hooks      | `camelCase` with `use` prefix | `export function useCountdown()` |
| Props interfaces    | `PascalCase` + `Props`        | `interface VenueCardProps`       |
