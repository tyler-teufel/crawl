/**
 * Canonical "vote day" boundary shared by the API and the mobile client, so
 * the two can't drift out of sync on when the daily vote budget resets.
 *
 * Nightlife runs past midnight, so the boundary is 04:00 local time (not
 * the raw calendar date): a venue visit at 01:00 Saturday still counts
 * toward Friday night. "Local" means the timezone of the city the vote
 * day is being computed for — see DEFAULT_VOTE_DAY_TIMEZONE below and
 * docs/architecture/DESIGN_DECISIONS.md for how callers resolve which
 * city's timezone applies to a given user.
 */

/** Local hour at which a vote day rolls over. Day D runs 04:00 on D through 03:59:59 on D+1. */
export const VOTE_DAY_CUTOFF_HOUR = 4;

/**
 * Fallback timezone for contexts that don't (yet) resolve a specific
 * city's timezone. All four active cities (Charlotte NC, South End
 * Charlotte NC, Sayville NY, Patchogue NY) are `America/New_York` today,
 * so this is behaviorally correct until a non-Eastern city ships.
 */
export const DEFAULT_VOTE_DAY_TIMEZONE = 'America/New_York';

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const raw: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') raw[part.type] = Number(part.value);
  }
  return {
    year: raw.year,
    month: raw.month,
    day: raw.day,
    // Some ICU builds report midnight as hour 24 under hourCycle 'h23'.
    hour: raw.hour === 24 ? 0 : raw.hour,
    minute: raw.minute,
    second: raw.second,
  };
}

/** Offset (ms) such that `local wall-clock ms = utc ms + offset` for `timeZone` at `date`. */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const { year, month, day, hour, minute, second } = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUtc - date.getTime();
}

/**
 * Converts a wall-clock date/time in `timeZone` to the UTC instant it
 * represents. Two-pass offset resolution: the first pass guesses the
 * offset from the naive (wall-clock-as-UTC) instant, the second refines
 * it from that estimate, so results stay correct across a DST transition
 * that falls between the naive guess and the true instant.
 */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const wallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = getTimeZoneOffsetMs(new Date(wallAsUtcMs), timeZone);
  const refinedOffset = getTimeZoneOffsetMs(new Date(wallAsUtcMs - offset), timeZone);
  return new Date(wallAsUtcMs - refinedOffset);
}

/**
 * Returns the vote-day key (`YYYY-MM-DD`) that `date` falls into in
 * `timeZone`. Hours before the 04:00 cutoff belong to the previous day's
 * vote day.
 */
export function voteDayFor(date: Date, timeZone: string): string {
  const { year, month, day, hour } = getZonedParts(date, timeZone);
  const voteDay = new Date(Date.UTC(year, month - 1, day));
  if (hour < VOTE_DAY_CUTOFF_HOUR) {
    voteDay.setUTCDate(voteDay.getUTCDate() - 1);
  }
  return voteDay.toISOString().slice(0, 10);
}

/**
 * Returns the UTC instant at which the vote day containing `date` ends —
 * the next 04:00-local boundary. This is what a countdown should target
 * (e.g. `VoteState.resetAt`), not just "what day is it."
 */
export function voteDayResetAt(date: Date, timeZone: string): Date {
  const voteDay = voteDayFor(date, timeZone);
  const [year, month, day] = voteDay.split('-').map(Number);
  // Date.UTC normalizes day-of-month overflow (e.g. day 31 -> next month day 1).
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  return zonedTimeToUtc(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
    VOTE_DAY_CUTOFF_HOUR,
    0,
    0,
    timeZone
  );
}
