// Venue opening hours parsing.
//
// `venue.hours` arrives as Google Places' `weekdayDescriptions` joined with
// newlines — one "Monday: 7:00 AM – 2:00 PM, 5:00 – 11:00 PM" line per day.
// Rendering that string as-is dumped the whole week into the detail screen's
// status row. Split it so the screen can show today inline and keep the rest
// behind a disclosure.

export interface DayHours {
  /** Day label ("Monday"), or '' for a single-line schedule with no day prefix. */
  day: string;
  /** The times for that day, e.g. "7:00 AM – 2:00 PM, 5:00 – 11:00 PM". */
  hours: string;
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function parseWeeklyHours(hours: string): DayHours[] {
  return hours
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(':');
      const day = separator === -1 ? '' : line.slice(0, separator).trim();
      // A ':' inside a time ("7:00 AM – 2:00 PM") is not a day separator —
      // only treat the prefix as a day when it actually names one.
      if (!DAY_NAMES.some((name) => name.toLowerCase() === day.toLowerCase())) {
        return { day: '', hours: line };
      }
      return { day, hours: line.slice(separator + 1).trim() };
    });
}

/**
 * Today's entry, or null when the schedule can't be resolved to a single day.
 * A one-line schedule (the mock data's "4pm - 2am") counts as today's hours.
 */
export function todayHours(hours: string, now: Date = new Date()): DayHours | null {
  const week = parseWeeklyHours(hours);
  if (week.length === 0) return null;
  if (week.length === 1) return week[0];
  const today = DAY_NAMES[now.getDay()].toLowerCase();
  return week.find((entry) => entry.day.toLowerCase() === today) ?? null;
}

/** Index of today's entry within `parseWeeklyHours`, or -1. */
export function todayIndex(week: DayHours[], now: Date = new Date()): number {
  const today = DAY_NAMES[now.getDay()].toLowerCase();
  return week.findIndex((entry) => entry.day.toLowerCase() === today);
}
