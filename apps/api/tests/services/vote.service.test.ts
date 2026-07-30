import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  describe('resetDailyVotes', () => {
    it('returns 0 when no votes exist', async () => {
      const count = await service.resetDailyVotes();
      expect(count).toBe(0);
    });

    it('returns the count of today\'s votes deleted', async () => {
      await service.castVote(USER_ID, VENUE_ID);
      await service.castVote(USER_ID, VENUE_ID_2);
      await service.castVote(USER_ID, VENUE_ID_3);
      const count = await service.resetDailyVotes();
      expect(count).toBe(3);
    });

    it('restores full vote allowance after reset', async () => {
      await service.castVote(USER_ID, VENUE_ID);
      await service.castVote(USER_ID, VENUE_ID_2);
      await service.resetDailyVotes();
      const state = await service.getVoteState(USER_ID);
      expect(state.remainingVotes).toBe(3);
      expect(state.votedVenueIds).toHaveLength(0);
    });
  });

  describe('vote day boundary (04:00 America/New_York, not UTC midnight)', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not roll the vote day over at UTC midnight', async () => {
      // 2026-07-15T00:30:00Z = 2026-07-14 20:30 EDT — well within Monday
      // night's vote day, hours before the old UTC-midnight boundary would
      // have reset it (and squarely inside the 7-8pm ET "mid-evening"
      // window the ticket describes).
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-15T00:30:00Z'));
      await service.castVote(USER_ID, VENUE_ID);

      // Advance past UTC midnight but still before the 04:00 ET cutoff.
      vi.setSystemTime(new Date('2026-07-15T03:00:00Z')); // 2026-07-14 23:00 EDT
      const state = await service.getVoteState(USER_ID);
      expect(state.remainingVotes).toBe(2);
      expect(state.votedVenueIds).toContain(VENUE_ID);
    });

    it('treats a vote cast one second before the cutoff as a different vote day than one second after', async () => {
      vi.useFakeTimers();
      // 2026-07-15T07:59:59Z = 2026-07-15 03:59:59 EDT (one second before cutoff)
      vi.setSystemTime(new Date('2026-07-15T07:59:59Z'));
      await service.castVote(USER_ID, VENUE_ID);
      await expect(service.getVoteState(USER_ID)).resolves.toMatchObject({ remainingVotes: 2 });

      // 2026-07-15T08:00:01Z = 2026-07-15 04:00:01 EDT (one second after
      // cutoff) — a new vote day, so the prior vote no longer counts.
      vi.setSystemTime(new Date('2026-07-15T08:00:01Z'));
      const state = await service.getVoteState(USER_ID);
      expect(state.remainingVotes).toBe(3);
      expect(state.votedVenueIds).not.toContain(VENUE_ID);
    });

    it('resets the budget once the 04:00 local cutoff is crossed', async () => {
      vi.useFakeTimers();
      // Cast 3 votes just before the cutoff, exhausting the budget.
      vi.setSystemTime(new Date('2026-07-15T07:59:00Z')); // 2026-07-15 03:59 EDT
      await service.castVote(USER_ID, VENUE_ID);
      await service.castVote(USER_ID, VENUE_ID_2);
      await service.castVote(USER_ID, VENUE_ID_3);
      await expect(service.getVoteState(USER_ID)).resolves.toMatchObject({ remainingVotes: 0 });

      // Cross the cutoff into the new vote day — budget should be full
      // again without needing the reset cron to have run.
      vi.setSystemTime(new Date('2026-07-15T08:00:00Z')); // 2026-07-15 04:00 EDT
      const state = await service.getVoteState(USER_ID);
      expect(state.remainingVotes).toBe(3);
      expect(state.votedVenueIds).toHaveLength(0);
    });

    it('still rolls the vote day over at exactly 04:00 local on the spring-forward DST date', async () => {
      vi.useFakeTimers();
      // 2026-03-08 is the US spring-forward date (EST -> EDT at 02:00 local,
      // i.e. 07:00Z). By the 04:00-local cutoff, EDT (UTC-4) is in effect —
      // a fixed-UTC-offset implementation would get this boundary wrong by
      // an hour on this specific date.
      // 2026-03-08T07:59:00Z = 2026-03-08 03:59 EDT (just before cutoff).
      vi.setSystemTime(new Date('2026-03-08T07:59:00Z'));
      await service.castVote(USER_ID, VENUE_ID);
      await expect(service.getVoteState(USER_ID)).resolves.toMatchObject({ remainingVotes: 2 });

      // 2026-03-08T08:00:00Z = 2026-03-08 04:00 EDT (just after cutoff) —
      // a new vote day, so the budget is back to full.
      vi.setSystemTime(new Date('2026-03-08T08:00:00Z'));
      const state = await service.getVoteState(USER_ID);
      expect(state.remainingVotes).toBe(3);
      expect(state.votedVenueIds).toHaveLength(0);
    });
  });
});
