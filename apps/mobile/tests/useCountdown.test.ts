import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTimeUntilMidnight } from '@/hooks/useCountdown';

afterEach(() => {
  vi.useRealTimers();
});

describe('getTimeUntilMidnight', () => {
  it('returns a positive number of seconds', () => {
    expect(getTimeUntilMidnight()).toBeGreaterThan(0);
  });

  it('returns at most 86400 seconds', () => {
    expect(getTimeUntilMidnight()).toBeLessThanOrEqual(86400);
  });

  it('returns 30 seconds when 30 seconds before local midnight', () => {
    // setHours(24,0,0,0) computes midnight in local time, so we simulate
    // a local time that is 30 seconds before the next midnight.
    const fakeNow = new Date();
    fakeNow.setHours(23, 59, 30, 0);
    vi.useFakeTimers();
    vi.setSystemTime(fakeNow);
    expect(getTimeUntilMidnight()).toBe(30);
  });

  it('returns 86399 seconds just after local midnight', () => {
    const fakeNow = new Date();
    fakeNow.setHours(0, 0, 1, 0);
    vi.useFakeTimers();
    vi.setSystemTime(fakeNow);
    expect(getTimeUntilMidnight()).toBe(86399);
  });

  it('returns 0 at exactly midnight', () => {
    const fakeNow = new Date();
    fakeNow.setHours(0, 0, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(fakeNow);
    expect(getTimeUntilMidnight()).toBe(86400);
  });
});
