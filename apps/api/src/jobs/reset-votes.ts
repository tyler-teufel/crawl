/**
 * Vote-day-boundary cron: reset all daily votes and venue vote counts.
 *
 * Runs at the vote day's 04:00-local rollover (see
 * packages/shared-types/src/voteDay.ts), not UTC midnight — firing at UTC
 * midnight would zero out venue vote counts around 7-8pm Eastern, mid-way
 * through the current vote day. In Phase 2 this will issue a single
 * DELETE FROM votes WHERE voted_at < CURRENT_DATE and reset
 * venue.vote_count to 0, then snapshot scores for historical tracking.
 */
import cron, { type ScheduledTask } from 'node-cron';
import { VOTE_DAY_CUTOFF_HOUR, DEFAULT_VOTE_DAY_TIMEZONE } from '@crawl/shared-types';
import type { VoteService } from '../services/vote.service.js';
import type { VenueService } from '../services/venue.service.js';

export function scheduleVoteReset(
  voteService: VoteService,
  venueService: VenueService,
  logger: { info: (msg: string) => void; error: (msg: string, err?: unknown) => void }
): ScheduledTask {
  return cron.schedule(
    `0 ${VOTE_DAY_CUTOFF_HOUR} * * *`,
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
    { timezone: DEFAULT_VOTE_DAY_TIMEZONE }
  );
}
