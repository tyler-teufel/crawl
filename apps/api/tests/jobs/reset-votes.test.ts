import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSchedule, getCronCallback } = vi.hoisted(() => {
  let capturedCallback: (() => Promise<void>) | null = null;
  return {
    mockSchedule: vi.fn((_expr: string, cb: () => Promise<void>) => {
      capturedCallback = cb;
    }),
    getCronCallback: () => capturedCallback,
  };
});

vi.mock('node-cron', () => ({ default: { schedule: mockSchedule } }));

import { scheduleVoteReset } from '../../src/jobs/reset-votes.js';

function makeServices() {
  return {
    voteService: { resetDailyVotes: vi.fn().mockResolvedValue(0) },
    venueService: { resetDailyMetrics: vi.fn().mockResolvedValue(undefined) },
    logger: { info: vi.fn(), error: vi.fn() },
  };
}

describe('scheduleVoteReset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('schedules a cron job with expression "0 0 * * *"', () => {
    const { voteService, venueService, logger } = makeServices();
    scheduleVoteReset(
      voteService as never,
      venueService as never,
      logger
    );
    expect(mockSchedule).toHaveBeenCalledWith(
      '0 0 * * *',
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('callback calls resetDailyVotes then resetDailyMetrics', async () => {
    const { voteService, venueService, logger } = makeServices();
    scheduleVoteReset(voteService as never, venueService as never, logger);
    await getCronCallback()!();
    expect(voteService.resetDailyVotes).toHaveBeenCalledOnce();
    expect(venueService.resetDailyMetrics).toHaveBeenCalledOnce();
  });

  it('callback logs the deleted vote count', async () => {
    const { voteService, venueService, logger } = makeServices();
    voteService.resetDailyVotes.mockResolvedValue(7);
    scheduleVoteReset(voteService as never, venueService as never, logger);
    await getCronCallback()!();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('7'));
  });

  it('callback catches errors and calls logger.error without throwing', async () => {
    const { voteService, venueService, logger } = makeServices();
    voteService.resetDailyVotes.mockRejectedValue(new Error('DB down'));
    scheduleVoteReset(voteService as never, venueService as never, logger);
    await expect(getCronCallback()!()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });

  it('callback does not call resetDailyMetrics when resetDailyVotes throws', async () => {
    const { voteService, venueService, logger } = makeServices();
    voteService.resetDailyVotes.mockRejectedValue(new Error('fail'));
    scheduleVoteReset(voteService as never, venueService as never, logger);
    await getCronCallback()!();
    expect(venueService.resetDailyMetrics).not.toHaveBeenCalled();
  });
});
