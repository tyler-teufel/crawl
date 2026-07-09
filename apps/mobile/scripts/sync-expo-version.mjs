#!/usr/bin/env node
// Copies apps/mobile/package.json's version into app.json's expo.version so the
// two never drift. Runs after `changeset version` (root `changeset:version`
// script) — changesets bumps package.json, this propagates it to Expo config.
// Edits app.json in place via string replacement to preserve its formatting.
// ios.buildNumber / android.versionCode are intentionally NOT set here; they
// are injected from `github.run_number` at CI time by staging-build.yml.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
const appJsonPath = fileURLToPath(new URL('../app.json', import.meta.url));

const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
const source = readFileSync(appJsonPath, 'utf8');
const current = JSON.parse(source).expo.version;

if (current === version) {
  console.log(`app.json expo.version already ${version} — nothing to do.`);
  process.exit(0);
}

const updated = source.replace(`"version": "${current}"`, `"version": "${version}"`);
if (updated === source) {
  console.error(`Could not find "version": "${current}" in app.json — sync failed.`);
  process.exit(1);
}

writeFileSync(appJsonPath, updated);
console.log(`app.json expo.version synced to ${version}.`);
