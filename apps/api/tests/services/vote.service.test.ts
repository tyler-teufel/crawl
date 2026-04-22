import { describe, it, expect, beforeEach } from 'vitest';
import { VoteService, VoteError } from '../../src/services/vote.service.js';
import { InMemoryVoteRepository } from '../../src/repositories/vote.repository.js';
import { InMemoryVenueRepository } from '../../src/repositories/venue.repository.js';

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const VENUE_ID = '11111111-1111-1111-1111-111111111111';
const VENUE_ID_2 = '22222222-2222-2222-2222-222222222222';
const VENUE_ID_3 = '33333333-3333-3333-3333-333333333333';
const UNKNOWN_VENUE = '00000000-0000-0000-0000-000000000000';

describe('VoteService', () => {
  let service: VoteService;
  let venueRepo: InMemoryVenueRepository;

  beforeEach(() => {
    venueRepo = new InMemoryVenueRepository();
    service = new VoteService(new InMemoryVoteRepository(), venueRepo);
  });

  describe('getVoteState', () => {
    it('returns 3 remaining votes initially', async () => {
      const state = await service.getVoteState(USER_ID);
      expect(state.remainingVotes).toBe(3);
      expect(state.maxVotes).toBe(3);
      expect(state.votedVenueIds).toHaveLength(0);
    });
  });

  describe('castVote', () => {
    it('casts a vote and decrements remaining', async () => {
      const state = await service.castVote(USER_ID, VENUE_ID);
      expect(state.remainingVotes).toBe(2);
      expect(state.votedVenueIds).toContain(VENUE_ID);
    });

    it('increments venue vote count', async () => {
      const before = await venueRepo.findById(VENUE_ID);
      await service.castVote(USER_ID, VENUE_ID);
      const after = await venueRepo.findById(VENUE_ID);
      expect(after!.voteCount).toBe(before!.voteCount + 1);
    });

    it('throws ALREADY_VOTED on duplicate vote for same venue', async () => {
      await service.castVote(USER_ID, VENUE_ID);
      await expect(service.castVote(USER_ID, VENUE_ID)).rejects.toMatchObject({
        code: 'ALREADY_VOTED',
      });
    });

    it('throws NO_VOTES_REMAINING after 3 votes', async () => {
      await service.castVote(USER_ID, VENUE_ID);
      await service.castVote(USER_ID, VENUE_ID_2);
      await service.castVote(USER_ID, VENUE_ID_3);
      await expect(service.castVote(USER_ID, VENUE_ID)).rejects.toMatchObject({
        code: 'NO_VOTES_REMAINING',
      });
    });

    it('throws VENUE_NOT_FOUND for unknown venue', async () => {
      await expect(service.castVote(USER_ID, UNKNOWN_VENUE)).rejects.toMatchObject({
        code: 'VENUE_NOT_FOUND',
      });
    });

    it('all vote errors are VoteError instances', async () => {
      await service.castVote(USER_ID, VENUE_ID);
      const err = await service.castVote(USER_ID, VENUE_ID).catch((e) => e);
      expect(err).toBeInstanceOf(VoteError);
    });
  });

  describe('removeVote', () => {
    it('removes a vote and increments remaining', async () => {
      await service.castVote(USER_ID, VENUE_ID);
      const state = await service.removeVote(USER_ID, VENUE_ID);
      expect(state.remainingVotes).toBe(3);
      expect(state.votedVenueIds).not.toContain(VENUE_ID);
    });

    it('decrements venue vote count', async () => {
      await service.castVote(USER_ID, VENUE_ID);
      const before = await venueRepo.findById(VENUE_ID);
      await service.removeVote(USER_ID, VENUE_ID);
      const after = await venueRepo.findById(VENUE_ID);
      expect(after!.voteCount).toBe(before!.voteCount - 1);
    });

    it('throws VOTE_NOT_FOUND if no vote exists', async () => {
      await expect(service.removeVote(USER_ID, VENUE_ID)).rejects.toMatchObject({
        code: 'VOTE_NOT_FOUND',
      });
    });
  });
});
