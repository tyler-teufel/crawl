import { describe, it, expect } from 'vitest';
import { voteDayFor, voteDayResetAt, VOTE_DAY_CUTOFF_HOUR } from '@crawl/shared-types';

const NY = 'America/New_York';

describe('voteDayFor', () => {
  it('has a 04:00 local cutoff', () => {
    expect(VOTE_DAY_CUTOFF_HOUR).toBe(4);
  });

  it('assigns a vote cast just before the 04:00 cutoff to the previous vote day (EST)', () => {
    // 2026-01-15T08:59:59Z = 2026-01-15 03:59:59 EST
    expect(voteDayFor(new Date('2026-01-15T08:59:59Z'), NY)).toBe('2026-01-14');
  });

  it('assigns a vote cast just after the 04:00 cutoff to the new vote day (EST)', () => {
    // 2026-01-15T09:00:00Z = 2026-01-15 04:00:00 EST
    expect(voteDayFor(new Date('2026-01-15T09:00:00Z'), NY)).toBe('2026-01-15');
  });

  it('assigns a vote cast just before the 04:00 cutoff to the previous vote day (EDT)', () => {
    // 2026-07-15T07:59:59Z = 2026-07-15 03:59:59 EDT
    expect(voteDayFor(new Date('2026-07-15T07:59:59Z'), NY)).toBe('2026-07-14');
  });

  it('assigns a vote cast just after the 04:00 cutoff to the new vote day (EDT)', () => {
    // 2026-07-15T08:00:00Z = 2026-07-15 04:00:00 EDT
    expect(voteDayFor(new Date('2026-07-15T08:00:00Z'), NY)).toBe('2026-07-15');
  });

  it('carries a 01:00 local vote (e.g. after last call) into the prior night, not the new calendar date', () => {
    // Friday-night activity at 01:00 Saturday local should count toward Friday.
    expect(voteDayFor(new Date('2026-07-11T05:00:00Z'), NY)).toBe('2026-07-10');
  });

  describe('DST transitions', () => {
    it('lands on the correct side of spring-forward (2026-03-08, EST -> EDT at 02:00 local)', () => {
      // 2026-03-08T06:59:00Z = 2026-03-08 01:59 EST (pre-transition, before cutoff)
      expect(voteDayFor(new Date('2026-03-08T06:59:00Z'), NY)).toBe('2026-03-07');
      // 2026-03-08T08:00:00Z = 2026-03-08 04:00 EDT (post-transition, at cutoff)
      expect(voteDayFor(new Date('2026-03-08T08:00:00Z'), NY)).toBe('2026-03-08');
    });

    it('lands on the correct side of fall-back (2026-11-01, EDT -> EST at 02:00 local)', () => {
      // 2026-11-01T08:59:00Z = 2026-11-01 03:59 EST (post-transition, before cutoff)
      expect(voteDayFor(new Date('2026-11-01T08:59:00Z'), NY)).toBe('2026-10-31');
      // 2026-11-01T09:00:00Z = 2026-11-01 04:00 EST (post-transition, at cutoff)
      expect(voteDayFor(new Date('2026-11-01T09:00:00Z'), NY)).toBe('2026-11-01');
    });
  });
});

describe('voteDayResetAt', () => {
  it('targets the next 04:00 local instant, in UTC (EST)', () => {
    const resetAt = voteDayResetAt(new Date('2026-01-15T12:00:00Z'), NY); // 2026-01-15 07:00 EST
    expect(resetAt.toISOString()).toBe('2026-01-16T09:00:00.000Z'); // 2026-01-16 04:00 EST
  });

  it('targets the next 04:00 local instant, in UTC (EDT)', () => {
    const resetAt = voteDayResetAt(new Date('2026-07-15T12:00:00Z'), NY); // 2026-07-15 08:00 EDT
    expect(resetAt.toISOString()).toBe('2026-07-16T08:00:00.000Z'); // 2026-07-16 04:00 EDT
  });

  it('shifts an hour earlier in UTC across the spring-forward boundary', () => {
    // Cast the evening before spring-forward (2026-03-07, still EST); the
    // following 04:00 local boundary falls in EDT, an hour "earlier" in UTC
    // than a non-DST week would produce.
    const resetAt = voteDayResetAt(new Date('2026-03-07T20:00:00Z'), NY); // 2026-03-07 15:00 EST
    expect(resetAt.toISOString()).toBe('2026-03-08T08:00:00.000Z'); // 2026-03-08 04:00 EDT
  });

  it('shifts an hour later in UTC across the fall-back boundary', () => {
    // Cast the evening before fall-back (2026-10-31, still EDT); the
    // following 04:00 local boundary falls in EST, an hour "later" in UTC.
    const resetAt = voteDayResetAt(new Date('2026-10-31T20:00:00Z'), NY); // 2026-10-31 16:00 EDT
    expect(resetAt.toISOString()).toBe('2026-11-01T09:00:00.000Z'); // 2026-11-01 04:00 EST
  });
});
