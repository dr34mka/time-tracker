import { useEffect, useState } from 'react';
import type { ActiveTimer } from './types';

/** Текущее время, тикающее раз в секунду (когда active) */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/** Сколько прошло у активного таймера с учётом пауз */
export function timerElapsed(timer: ActiveTimer, now: number): number {
  return timer.accumulatedMs + (timer.running ? Math.max(0, now - timer.startedAt) : 0);
}
