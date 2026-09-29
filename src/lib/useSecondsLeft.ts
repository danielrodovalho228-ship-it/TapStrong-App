import { useEffect, useState } from 'react';

/**
 * A countdown read from `read()`, re-rendered once a second while it is
 * above 0, so a button can stay disabled for exactly as long as a wait or
 * lock lasts (security round 2, S2-P2-5). `key` restarts the ticking (e.g.
 * the last send time).
 */
export function useSecondsLeft(read: () => number, key: unknown): number {
  const [, setTick] = useState(0);
  const left = read();
  const running = left > 0;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [key, running]);
  return left;
}
