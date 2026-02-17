import { useMemo } from 'react';
import { mockBars } from '../data/mockBars';
import { BarWithScore, FilterType, VoteState } from '../types';

// Normalisation ceiling – derived from seed data so scores are consistent.
const MAX_VOTE_COUNT = Math.max(...mockBars.map((b) => b.baseVoteCount));

/**
 * Returns an array of bars enriched with live scores and user-vote state,
 * filtered by the active filter, and sorted by popularity descending.
 *
 * TODO: Replace `mockBars` import with an API call:
 *   const { data: rawBars } = useQuery(['bars'], fetchBars);
 * The rest of the hook logic stays the same.
 */
export function useBars(voteState: VoteState, filter: FilterType): BarWithScore[] {
  return useMemo<BarWithScore[]>(() => {
    return mockBars
      .filter((bar) => filter === 'all' || bar.type === filter)
      .map((bar): BarWithScore => {
        const userVoted = voteState.votedBarIds.includes(bar.id);
        const voteCount = bar.baseVoteCount + (userVoted ? 1 : 0);
        const popularityScore = Math.min(
          Math.round((voteCount / MAX_VOTE_COUNT) * 100),
          100
        );

        return {
          ...bar,
          voteCount,
          popularityScore,
          isOpen: checkIsOpen(bar.hours.open, bar.hours.close),
          userVoted,
        };
      })
      .sort((a, b) => b.popularityScore - a.popularityScore);
  }, [voteState, filter]);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseHourMinute(timeStr: string): { h: number; m: number } {
  const [time, period] = timeStr.trim().split(' ');
  const [hourStr, minuteStr] = time.split(':');
  let h = parseInt(hourStr, 10);
  const m = parseInt(minuteStr ?? '0', 10);

  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;

  return { h, m };
}

function checkIsOpen(openStr: string, closeStr: string): boolean {
  try {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const open = parseHourMinute(openStr);
    const close = parseHourMinute(closeStr);

    const openMins = open.h * 60 + open.m;
    const closeMins = close.h * 60 + close.m;

    // Bars that close after midnight (close < open in same-day terms)
    if (closeMins < openMins) {
      return currentMins >= openMins || currentMins <= closeMins;
    }

    return currentMins >= openMins && currentMins <= closeMins;
  } catch {
    return true;
  }
}
