import { scheduleVoteReset } from './reset-votes.js';
import { scheduleScoreRecalculation } from './recalculate-scores.js';
import { InMemoryVenueRepository } from '../repositories/venue.repository.js';
import { InMemoryVoteRepository } from '../repositories/vote.repository.js';
import { DrizzleVenueRepository } from '../repositories/drizzle-venue.repository.js';
import { DrizzleVoteRepository } from '../repositories/drizzle-vote.repository.js';
import { getDb } from '../db/index.js';
import { VenueService } from '../services/venue.service.js';
import { VoteService } from '../services/vote.service.js';

const simpleLogger = {
  info: (msg: string) => console.log(msg),
  error: (msg: string, err?: unknown) => console.error(msg, err),
};

export function startJobs(): void {
  const useRealDb = process.env.USE_REAL_DB === 'true';

  const venueRepo = useRealDb ? new DrizzleVenueRepository(getDb()) : new InMemoryVenueRepository();
  const voteRepo = useRealDb ? new DrizzleVoteRepository(getDb()) : new InMemoryVoteRepository();

  const venueService = new VenueService(venueRepo);
  const voteService = new VoteService(voteRepo, venueRepo);

  scheduleVoteReset(voteService, venueService, simpleLogger);
  scheduleScoreRecalculation(venueService, simpleLogger);

  simpleLogger.info(
    '[jobs] Cron jobs scheduled: vote reset (midnight UTC), score recalculation (hourly).'
  );
}
