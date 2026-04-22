/**
 * Midnight cron: reset all daily votes and venue vote counts.
 *
 * Runs at 00:00 UTC every day. In Phase 2 this will issue a single
 * DELETE FROM votes WHERE voted_at < CURRENT_DATE and reset
 * venue.vote_count to 0, then snapshot scores for historical tracking.
 */
import cron from 'node-cron';
import type { VoteService } from '../services/vote.service.js';
import type { VenueService } from '../services/venue.service.js';

export function scheduleVoteReset(
  voteService: VoteService,
  venueService: VenueService,
  logger: { info: (msg: string) => void; error: (msg: string, err?: unknown) => void },
): cron.ScheduledTask {
  // Run at midnight UTC: '0 0 * * *'
  return cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        logger.info('[cron] Starting daily vote reset...');
        const count = await voteService.resetDailyVotes();
        await venueService.resetDailyMetrics();
        logger.info(`[cron] Vote reset complete. Removed ${count} votes.`);
      } catch (err) {
        logger.error('[cron] Vote reset failed', err);
      }
    },
    { timezone: 'UTC' },
  );
}
