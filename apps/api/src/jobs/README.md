# `src/jobs/`

Jobs are scheduled background tasks that run on a cron schedule inside the API process. They use `node-cron` and are started in `src/index.ts` after the server binds (never in tests).

## How it fits in the architecture

```
src/index.ts
  │  calls startJobs() after server starts
  ▼
src/jobs/index.ts
  │  schedules each job
  ├── scheduleVoteReset(...)       runs at 00:00 UTC daily
  └── scheduleScoreRecalculation(...)  runs at :00 every hour
         │
         ▼
         calls service methods — same interfaces used by routes
```

Jobs depend on service methods, not repositories directly. This means the same business logic used at runtime (e.g. `voteService.resetDailyVotes()`) is reused in scheduled tasks without duplication.

## Files

| File                    | Schedule                        | What it does                                                                                 |
| ----------------------- | ------------------------------- | -------------------------------------------------------------------------------------------- |
| `reset-votes.ts`        | `0 0 * * *` (midnight UTC)      | Deletes all today's votes, resets venue `voteCount` and `hotspotScore` to 0                  |
| `recalculate-scores.ts` | `0 * * * *` (top of every hour) | Recomputes hotspot scores for all venues; marks top scorers as trending                      |
| `index.ts`              | —                               | Wires services into each job and calls all `schedule*` functions; imported by `src/index.ts` |

## Adding a new job

### 1. Create the job file

```ts
// src/jobs/sync-venues.ts
import cron from 'node-cron';
import type { VenueService } from '../services/venue.service.js';

/**
 * Nightly venue sync: pulls fresh data from the external Places API
 * and upserts changes into the venue repository.
 *
 * Schedule: 3:00 AM UTC daily — after vote reset, before peak hours.
 * Phase 2: swap the no-op venueService.syncFromPlacesApi() with
 * a real implementation that calls the Google Places or Yelp API.
 */
export function scheduleVenueSync(
  venueService: VenueService,
  logger: { info: (msg: string) => void; error: (msg: string, err?: unknown) => void }
): cron.ScheduledTask {
  return cron.schedule(
    '0 3 * * *', // 3:00 AM UTC every day
    async () => {
      try {
        logger.info('[cron] Starting nightly venue sync...');
        // Replace with real implementation in Phase 5
        // const result = await venueService.syncFromPlacesApi();
        // logger.info(`[cron] Venue sync complete. Updated ${result.updated}, added ${result.added}.`);
        logger.info('[cron] Venue sync skipped — not yet implemented (Phase 5).');
      } catch (err) {
        logger.error('[cron] Venue sync failed', err);
      }
    },
    { timezone: 'UTC' }
  );
}
```

### 2. Register it in `src/jobs/index.ts`

```ts
import { scheduleVenueSync } from './sync-venues.js';

export function startJobs(): void {
  // ... existing jobs ...
  scheduleVenueSync(venueService, simpleLogger);

  simpleLogger.info('[jobs] Cron jobs scheduled: vote reset, score recalculation, venue sync.');
}
```

## Cron expression reference

| Expression     | Meaning                 |
| -------------- | ----------------------- |
| `0 0 * * *`    | Midnight UTC, every day |
| `0 * * * *`    | Top of every hour       |
| `0 3 * * *`    | 3:00 AM UTC, every day  |
| `*/15 * * * *` | Every 15 minutes        |
| `0 0 * * 1`    | Monday midnight UTC     |

## Conventions

- Jobs receive a `logger` argument matching `{ info, error }` — in production this is the Fastify logger, in `jobs/index.ts` it's a thin console wrapper. This avoids importing Fastify into job files.
- Never import repositories directly in a job. Call service methods — they already know how to talk to the repository.
- Keep the scheduled function async and always wrap the entire body in `try/catch`. A thrown error in a cron callback will silently terminate the task unless caught.
- Cron jobs are never started when `NODE_ENV === 'test'` (guarded in `src/index.ts`). Tests invoke service methods directly if they need to test job logic.
- Add a comment explaining the timezone, the schedule rationale, and any Phase 2 upgrade plan. Cron schedules are easy to misread; prose makes the intent clear.
