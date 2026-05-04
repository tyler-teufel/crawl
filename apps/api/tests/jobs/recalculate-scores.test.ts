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

import { scheduleScoreRecalculation } from '../../src/jobs/recalculate-scores.js';

function makeServices() {
  return {
    venueService: { recalculateHotspotScores: vi.fn().mockResolvedValue(undefined) },
    logger: { info: vi.fn(), error: vi.fn() },
  };
}

describe('scheduleScoreRecalculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('schedules a cron job with expression "0 * * * *"', () => {
    const { venueService, logger } = makeServices();
    scheduleScoreRecalculation(venueService as never, logger);
    expect(mockSchedule).toHaveBeenCalledWith(
      '0 * * * *',
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('callback calls recalculateHotspotScores', async () => {
    const { venueService, logger } = makeServices();
    scheduleScoreRecalculation(venueService as never, logger);
    await getCronCallback()!();
    expect(venueService.recalculateHotspotScores).toHaveBeenCalledOnce();
  });

  it('callback logs completion after successful recalculation', async () => {
    const { venueService, logger } = makeServices();
    scheduleScoreRecalculation(venueService as never, logger);
    await getCronCallback()!();
    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  it('callback catches errors and calls logger.error without throwing', async () => {
    const { venueService, logger } = makeServices();
    venueService.recalculateHotspotScores.mockRejectedValue(new Error('fail'));
    scheduleScoreRecalculation(venueService as never, logger);
    await expect(getCronCallback()!()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
