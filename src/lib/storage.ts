import type { AppState, Currency } from '../types';

const KEY = 'time-tracker-pro-v1';

export const DEFAULT_STATE: AppState = {
  settings: {
    globalRate: 1500,
    currency: 'RUB',
    roundingMinutes: 15,
    theme: 'dark',
    dailyGoalHours: 8,
  },
  projects: [],
  tasks: [],
  entries: [],
  timer: null,
};

function isCurrency(c: unknown): c is Currency {
  return c === 'RUB' || c === 'USD';
}

/** Разбор и мягкая миграция сериализованного состояния (бэкап, файл синка, localStorage) */
export function parseState(raw: string): AppState | null {
  try {
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || typeof parsed !== 'object' || !parsed.settings) return null;
    const merged: AppState = {
      ...DEFAULT_STATE,
      ...parsed,
      settings: { ...DEFAULT_STATE.settings, ...parsed.settings },
    };
    if (!isCurrency(merged.settings.currency)) merged.settings.currency = 'RUB';
    merged.projects = (merged.projects ?? []).map((p) =>
      p.currency === undefined || isCurrency(p.currency) ? p : { ...p, currency: 'RUB' as Currency },
    );
    merged.tasks = merged.tasks ?? [];
    merged.entries = merged.entries ?? [];
    return merged;
  } catch {
    return null;
  }
}

export function loadState(): AppState {
  const raw = localStorage.getItem(KEY);
  if (!raw) return DEFAULT_STATE;
  return parseState(raw) ?? DEFAULT_STATE;
}

let desktopSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveState(state: AppState): void {
  const raw = JSON.stringify(state);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // квота/приватный режим — молча пропускаем, данные останутся в памяти
  }
  // в десктопе пишем ещё и в файл данных (с дебаунсом — файл может лежать в облачной папке)
  const desktop = window.desktop;
  if (desktop) {
    if (desktopSaveTimer) clearTimeout(desktopSaveTimer);
    desktopSaveTimer = setTimeout(() => {
      desktop.saveData(raw);
    }, 400);
  }
}

export function clearState(): void {
  localStorage.removeItem(KEY);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
