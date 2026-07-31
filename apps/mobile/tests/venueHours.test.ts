import { describe, it, expect } from 'vitest';
import { parseWeeklyHours, todayHours, todayIndex } from '@/lib/venueHours';

// Regression coverage for the v1.1.2 venue-detail report: `venue.hours` holds
// Google's seven `weekdayDescriptions` joined with newlines, and the detail
// screen rendered that whole blob inside its status row — seven wrapping,
// horizontally-overflowing lines. Splitting it is what lets the screen show
// today inline and keep the week behind a disclosure.

const GOOGLE_HOURS = [
  'Monday: 7:00 AM – 2:00 PM, 5:00 – 11:00 PM',
  'Tuesday: 7:00 AM – 2:00 PM',
  'Wednesday: 7:00 AM – 2:00 PM, 5:00 PM – 1:00 AM',
  'Thursday: 7:00 AM – 2:00 PM, 5:00 PM – 1:00 AM',
  'Friday: 7:00 AM – 2:00 PM, 5:00 PM – 1:00 AM',
  'Saturday: 8:00 AM – 2:00 PM, 5:00 PM – 1:00 AM',
  'Sunday: 8:00 AM – 2:00 PM, 5:00 – 11:00 PM',
].join('\n');

describe('parseWeeklyHours', () => {
  it('splits a weekday-description blob into day/hours pairs', () => {
    const week = parseWeeklyHours(GOOGLE_HOURS);

    expect(week).toHaveLength(7);
    expect(week[0]).toEqual({ day: 'Monday', hours: '7:00 AM – 2:00 PM, 5:00 – 11:00 PM' });
    // The ':' inside a time must not be mistaken for the day separator.
    expect(week[2].hours).toBe('7:00 AM – 2:00 PM, 5:00 PM – 1:00 AM');
  });

  it('keeps a schedule with no day prefix intact', () => {
    expect(parseWeeklyHours('4pm - 2am')).toEqual([{ day: '', hours: '4pm - 2am' }]);
  });

  it('returns nothing for an empty schedule', () => {
    expect(parseWeeklyHours('')).toEqual([]);
    expect(parseWeeklyHours('\n  \n')).toEqual([]);
  });
});

describe('todayHours', () => {
  it("picks the current day's entry", () => {
    // 2026-07-31 is a Friday.
    expect(todayHours(GOOGLE_HOURS, new Date('2026-07-31T20:00:00'))).toEqual({
      day: 'Friday',
      hours: '7:00 AM – 2:00 PM, 5:00 PM – 1:00 AM',
    });
  });

  it('treats a single-line schedule as today', () => {
    expect(todayHours('4pm - 2am', new Date('2026-07-31T20:00:00'))).toEqual({
      day: '',
      hours: '4pm - 2am',
    });
  });

  it('returns null when there is nothing to show', () => {
    expect(todayHours('', new Date('2026-07-31T20:00:00'))).toBeNull();
  });
});

describe('todayIndex', () => {
  it('locates today within the parsed week', () => {
    const week = parseWeeklyHours(GOOGLE_HOURS);
    expect(todayIndex(week, new Date('2026-07-31T20:00:00'))).toBe(4);
    expect(todayIndex(parseWeeklyHours('4pm - 2am'), new Date('2026-07-31T20:00:00'))).toBe(-1);
  });
});
