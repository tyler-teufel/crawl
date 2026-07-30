import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTimeUntilVoteReset } from '@/hooks/useCountdown';

afterEach(() => {
  vi.useRealTimers();
});

// The vote day boundary is 04:00 America/New_York (#64), not local midnight.
// In July, America/New_York is UTC-4 (EDT), so 04:00 local is 08:00 UTC.
describe('getTimeUntilVoteReset', () => {
  it('returns a positive number of seconds', () => {
    expect(getTimeUntilVoteReset()).toBeGreaterThan(0);
  });

  it('returns at most 86400 seconds', () => {
    expect(getTimeUntilVoteReset()).toBeLessThanOrEqual(86400);
  });

  it('returns 30 seconds when 30 seconds before the 04:00-local boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T07:59:30Z')); // 03:59:30 EDT
    expect(getTimeUntilVoteReset()).toBe(30);
  });

  it('returns 86399 seconds just after the 04:00-local boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T08:00:01Z')); // 04:00:01 EDT
    expect(getTimeUntilVoteReset()).toBe(86399);
  });

  it('returns 86400 at exactly the boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T08:00:00Z')); // 04:00:00 EDT
    expect(getTimeUntilVoteReset()).toBe(86400);
  });
});
