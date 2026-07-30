import { useState, useEffect, useRef } from 'react';
import { DEFAULT_VOTE_DAY_TIMEZONE, voteDayResetAt } from '@crawl/shared-types';

export function useCountdown() {
  const [timeLeft, setTimeLeft] = useState(getTimeUntilVoteReset());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft(getTimeUntilVoteReset());
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  return {
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  };
}

// Targets the same 04:00-city-local vote day boundary the server resets the
// daily vote budget at (#64), rather than local midnight. Mobile doesn't
// resolve a per-city timezone yet, so this falls back to the same default
// the API uses.
export function getTimeUntilVoteReset(): number {
  const now = new Date();
  const resetAt = voteDayResetAt(now, DEFAULT_VOTE_DAY_TIMEZONE);
  return Math.max(0, Math.floor((resetAt.getTime() - now.getTime()) / 1000));
}
