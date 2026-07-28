---
'@crawl/api': patch
---

Bump `node-cron` from `^3.0.3` to `^4.6.0` to clear the `uuid < 11.1.1` buffer-bounds-check advisory (GHSA-w5hq-g745-h8pq), which was pulled in transitively via node-cron's v3 dependency on `uuid@8.3.2`. node-cron v4 is a zero-dependency rewrite, so the advisory is removed entirely rather than patched. Updated the two job files (`reset-votes.ts`, `recalculate-scores.ts`) for v4's typings, which now export `ScheduledTask` as a named type rather than a property of the default import; schedules and timezone behavior (daily vote reset at 00:00 UTC, hourly hotspot score recalculation) are unchanged. Also dropped the now-redundant `@types/node-cron` devDependency since v4 ships its own type declarations.
