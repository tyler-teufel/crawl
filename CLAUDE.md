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

This is an **Expo React Native** app (SDK 54) using **file-based routing** via `expo-router`. The entry point is `expo-router/entry` and all screens live under `app/`.

- `app/_layout.tsx` — Root layout wrapping all screens in `SafeAreaView` + `Stack` navigator (headers hidden globally)
- `app/index.tsx` — Home screen (the only screen currently)
- `global.css` — NativeWind/Tailwind global CSS entry point, processed by Metro via `nativewind/metro`

### Styling

Styling uses **NativeWind** (Tailwind CSS for React Native). Use `className` props on React Native components. The Babel preset is configured with `jsxImportSource: 'nativewind'` so JSX automatically gets NativeWind support. Prettier auto-sorts Tailwind classes via `prettier-plugin-tailwindcss`.

Tailwind content paths are `app/**` and `components/**`.

### Path Aliases

`@/*` maps to `src/*` (configured in `tsconfig.json`). Place shared code under `src/`.

### Key dependencies

- `react-native-reanimated` + `react-native-worklets` — animations/worklets (worklets Babel plugin is active)
- `react-native-safe-area-context` + `react-native-screens` — navigation primitives
- TypeScript strict mode is enabled
