// ─────────────────────────────────────────────
// Core domain types for the Crawl application
// ─────────────────────────────────────────────

export type BarType = 'bar' | 'nightclub' | 'lounge' | 'sports_bar';

export type FilterType = 'all' | BarType;

export interface BarHours {
  open: string;  // e.g. "8:00 PM"
  close: string; // e.g. "2:00 AM"
  days: string;  // e.g. "Mon–Sun"
}

/**
 * Raw bar record as it would come from the API.
 * baseVoteCount seeds the popularity score before live voting data is available.
 */
export interface Bar {
  id: string;
  name: string;
  type: BarType;
  address: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  hours: BarHours;
  phone: string;
  description: string;
  tags: string[];
  coverCharge: number | null; // null = free entry
  priceRange: 1 | 2 | 3 | 4; // 1 = $, 4 = $$$$
  capacity: number;
  /** Seed vote count – will be replaced by live API data */
  baseVoteCount: number;
}

/**
 * Bar enriched with computed real-time scores and user state.
 * Created by the useBars hook; not stored anywhere.
 */
export interface BarWithScore extends Bar {
  voteCount: number;       // baseVoteCount + user-contributed votes
  popularityScore: number; // 0–100 normalised score
  isOpen: boolean;
  userVoted: boolean;      // true if the current user already voted here
}

/**
 * Persisted voting state stored in AsyncStorage.
 * Resets automatically when the calendar date changes.
 */
export interface VoteState {
  votesRemaining: number; // countdown from MAX_DAILY_VOTES
  lastResetDate: string;  // "YYYY-MM-DD" – the date of the last reset
  votedBarIds: string[];  // bars the user has already voted for today
}

export const MAX_DAILY_VOTES = 2;
