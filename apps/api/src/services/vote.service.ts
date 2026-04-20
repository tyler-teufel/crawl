import type { VoteRepository } from '../repositories/vote.repository.js';
import type { VenueRepository } from '../repositories/venue.repository.js';
import type { VoteState } from '../schemas/vote.schema.js';

const MAX_DAILY_VOTES = 3;
const today = () => new Date().toISOString().slice(0, 10);

function nextMidnightUtc(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

export class VoteService {
  constructor(
    private readonly voteRepo: VoteRepository,
    private readonly venueRepo: VenueRepository,
  ) {}

  async getVoteState(userId: string): Promise<VoteState> {
    const votes = await this.voteRepo.findByUserAndDate(userId, today());
    return {
      remainingVotes: Math.max(0, MAX_DAILY_VOTES - votes.length),
      maxVotes: MAX_DAILY_VOTES,
      votedVenueIds: votes.map((v) => v.venueId),
      resetAt: nextMidnightUtc(),
    };
  }

  async castVote(userId: string, venueId: string): Promise<VoteState> {
    const state = await this.getVoteState(userId);

    if (state.remainingVotes <= 0) {
      throw new VoteError('NO_VOTES_REMAINING', 'You have used all your votes for today.');
    }

    const existing = await this.voteRepo.findByUserVenueDate(userId, venueId, today());
    if (existing) {
      throw new VoteError('ALREADY_VOTED', 'You have already voted for this venue today.');
    }

    const venue = await this.venueRepo.findById(venueId);
    if (!venue) {
      throw new VoteError('VENUE_NOT_FOUND', 'Venue not found.');
    }

    await this.voteRepo.create(userId, venueId);
    await this.venueRepo.incrementVoteCount(venueId);

    return this.getVoteState(userId);
  }

  async removeVote(userId: string, venueId: string): Promise<VoteState> {
    const deleted = await this.voteRepo.delete(userId, venueId);
    if (!deleted) {
      throw new VoteError('VOTE_NOT_FOUND', 'No vote found for this venue today.');
    }
    await this.venueRepo.decrementVoteCount(venueId);
    return this.getVoteState(userId);
  }

  async resetDailyVotes(): Promise<number> {
    return this.voteRepo.resetByDate(today());
  }
}

export class VoteError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'VoteError';
  }
}
