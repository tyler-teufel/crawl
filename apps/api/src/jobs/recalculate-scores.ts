/**
 * Hourly cron: recalculate hotspot scores for all venues.
 *
 * Hotspot score algorithm (Phase 1 — simple):
 *   score = min(100, voteCount * 2)
 *
 * Phase 2 plan (when DB is available):
 *   - Input signals: today's vote count, hourly velocity (votes in last 60min),
 *     7-day rolling average, external rating (Yelp/Google).
 *   - Formula: score = (velocity * 0.4) + (dailyCount * 0.3) + (historicalAvg * 0.2) + (externalRating * 0.1)
 *   - Scores are normalized 0-100. Venues with score ≥ 80 are marked isTrending.
 *   - Scores are snapshotted hourly for trend direction (rising/falling).
 */
import cron from 'node-cron';
import type { VenueService } from '../services/venue.service.js';

export function scheduleScoreRecalculation(
  venueService: VenueService,
  logger: { info: (msg: string) => void; error: (msg: string, err?: unknown) => void },
): cron.ScheduledTask {
  // Run at the top of every hour: '0 * * * *'
  return cron.schedule(
    '0 * * * *',
    async () => {
      try {
        logger.info('[cron] Recalculating hotspot scores...');
        await venueService.recalculateHotspotScores();
        logger.info('[cron] Hotspot score recalculation complete.');
      } catch (err) {
        logger.error('[cron] Score recalculation failed', err);
      }
    },
    { timezone: 'UTC' },
  );
}
