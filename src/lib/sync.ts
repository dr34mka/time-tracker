import type { AppState } from '../types';

/** A snapshot may replace local work only after an explicit conflict decision. */
export function needsSyncDecision(current: AppState, incoming: AppState, dirty: boolean): boolean {
  if (JSON.stringify(current) === JSON.stringify(incoming)) return false;
  return dirty || Boolean(current.timer && JSON.stringify(current.timer) !== JSON.stringify(incoming.timer));
}
