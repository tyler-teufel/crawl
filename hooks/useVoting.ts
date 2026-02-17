import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VoteState, MAX_DAILY_VOTES } from '../types';

const STORAGE_KEY = '@crawl_vote_state_v1';

const getTodayDate = (): string => new Date().toISOString().split('T')[0];

const defaultState = (): VoteState => ({
  votesRemaining: MAX_DAILY_VOTES,
  lastResetDate: getTodayDate(),
  votedBarIds: [],
});

/**
 * Manages the user's anonymous voting state.
 *
 * Rules:
 *  - Each user may cast up to MAX_DAILY_VOTES (2) votes per calendar day.
 *  - A user cannot vote for the same bar more than once per day.
 *  - Vote state is persisted in AsyncStorage and resets automatically on a new day.
 *
 * TODO: Replace AsyncStorage persistence with a server-side session
 *       when the API is available. The `vote()` function's return value
 *       and the VoteState shape can remain unchanged.
 */
export function useVoting() {
  const [voteState, setVoteState] = useState<VoteState>(defaultState());
  const [isLoading, setIsLoading] = useState(true);

  // ── Load persisted state on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: VoteState = JSON.parse(raw);
          const today = getTodayDate();

          if (parsed.lastResetDate !== today) {
            // New day – reset votes
            const fresh = defaultState();
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
            setVoteState(fresh);
          } else {
            setVoteState(parsed);
          }
        }
      } catch (err) {
        console.warn('[useVoting] Failed to load vote state:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── Persist helper ──────────────────────────────────────────────────────────
  const persist = async (state: VoteState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('[useVoting] Failed to persist vote state:', err);
    }
  };

  /**
   * Cast a vote for the given bar.
   * @returns `true` if the vote was accepted, `false` otherwise.
   *
   * TODO: Call `POST /api/votes` here once the backend is ready.
   *       On success, update local state. On failure, revert.
   */
  const vote = useCallback(
    async (barId: string): Promise<boolean> => {
      if (voteState.votesRemaining <= 0) return false;
      if (voteState.votedBarIds.includes(barId)) return false;

      const next: VoteState = {
        ...voteState,
        votesRemaining: voteState.votesRemaining - 1,
        votedBarIds: [...voteState.votedBarIds, barId],
      };

      setVoteState(next);
      await persist(next);
      return true;
    },
    [voteState]
  );

  return { voteState, vote, isLoading };
}
