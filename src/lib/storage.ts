import type { AppState } from '../types';

const KEY = 'time-tracker-pro-v1';

export const DEFAULT_STATE: AppState = {
  settings: {
    globalRate: 25,
    currency: 'USD',
    roundingMinutes: 15,
    theme: 'dark',
    dailyGoalHours: 6,
  },
  projects: [],
  tasks: [],
  entries: [],
  timer: null,
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as AppState;
    // мягкая миграция: недостающие поля берём из дефолтов
    return {
      ...DEFAULT_STATE,
      ...parsed,
      settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // квота/приватный режим — молча пропускаем, данные останутся в памяти
  }
}

export function clearState(): void {
  localStorage.removeItem(KEY);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
