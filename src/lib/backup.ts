import type { AppState } from '../types';
import { dayKey } from './time';

export function downloadBackup(state: AppState, label = 'backup') {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `time-tracker-${label}_${dayKey(Date.now())}.json`;
  a.click();
  // Keep the object URL alive until the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
