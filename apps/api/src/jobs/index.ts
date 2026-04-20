import { scheduleVoteReset } from './reset-votes.js';
import { scheduleScoreRecalculation } from './recalculate-scores.js';
import { InMemoryVenueRepository } from '../repositories/venue.repository.js';
import { InMemoryVoteRepository } from '../repositories/vote.repository.js';
import { VenueService } from '../services/venue.service.js';
import { VoteService } from '../services/vote.service.js';

const simpleLogger = {
  info: (msg: string) => console.log(msg),
  error: (msg: string, err?: unknown) => console.error(msg, err),
};

export function startJobs(): void {
  // In Phase 2, these will receive Drizzle-backed repositories.
  const venueRepo = new InMemoryVenueRepository();
  const voteRepo = new InMemoryVoteRepository();
  const venueService = new VenueService(venueRepo);
  const voteService = new VoteService(voteRepo, venueRepo);

  scheduleVoteReset(voteService, venueService, simpleLogger);
  scheduleScoreRecalculation(venueService, simpleLogger);

  simpleLogger.info('[jobs] Cron jobs scheduled: vote reset (midnight UTC), score recalculation (hourly).');
}
