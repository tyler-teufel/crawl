// React Native defines `__DEV__` as a global; Vitest (node environment) does
// not. Modules that read it at load time (e.g. src/lib/sentry.ts) would throw a
// ReferenceError when imported in tests. Define it once here for all tests.
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
