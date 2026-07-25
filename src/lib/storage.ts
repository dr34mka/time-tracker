import type {
  ActiveTimer,
  AppState,
  Client,
  Currency,
  Project,
  ProjectStatus,
  Settings,
  Task,
  Theme,
  TimeEntry,
} from '../types';

const KEY = 'time-tracker-v1';
/** Прежний ключ (до переименования пакета) — читаем один раз для миграции */
const LEGACY_KEY = 'time-tracker-pro-v1';

export const DEFAULT_STATE: AppState = {
  schemaVersion: 2,
  settings: {
    globalRate: 1500,
    currency: 'RUB',
    roundingMinutes: 15,
    theme: 'dark',
    dailyGoalHours: 8,
  },
  clients: [],
  projects: [],
  tasks: [],
  entries: [],
  timer: null,
};

function isCurrency(c: unknown): c is Currency {
  return c === 'RUB' || c === 'USD';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function optionalString(value: unknown): string | undefined {
  const result = stringValue(value).trim();
  return result || undefined;
}

function isStatus(value: unknown): value is ProjectStatus {
  return value === 'active' || value === 'paused' || value === 'completed';
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

function legacyClientId(name: string): string {
  let hash = 2166136261;
  for (const char of name.trim().toLocaleLowerCase('ru-RU')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `client-${(hash >>> 0).toString(36)}`;
}

function parseSettings(value: unknown): Settings {
  const source = isRecord(value) ? value : {};
  return {
    globalRate: Math.max(0, finiteNumber(source.globalRate, DEFAULT_STATE.settings.globalRate)),
    currency: isCurrency(source.currency) ? source.currency : DEFAULT_STATE.settings.currency,
    roundingMinutes: [1, 5, 15, 30, 60].includes(finiteNumber(source.roundingMinutes, 15))
      ? finiteNumber(source.roundingMinutes, 15)
      : 15,
    theme: isTheme(source.theme) ? source.theme : DEFAULT_STATE.settings.theme,
    dailyGoalHours: Math.min(16, Math.max(1, finiteNumber(source.dailyGoalHours, 8))),
  };
}

function parseClient(value: unknown): Client | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id).trim();
  const name = stringValue(value.name).trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    company: optionalString(value.company),
    email: optionalString(value.email),
    notes: optionalString(value.notes),
    archived: value.archived === true,
    createdAt: finiteNumber(value.createdAt, Date.now()),
  };
}

function parseProject(value: unknown): Project | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id).trim();
  const name = stringValue(value.name).trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    clientId: optionalString(value.clientId),
    client: stringValue(value.client).trim(),
    color: stringValue(value.color, '#2a78d6'),
    avatar: optionalString(value.avatar),
    rate: value.rate === undefined ? undefined : Math.max(0, finiteNumber(value.rate, 0)),
    currency: value.currency === undefined ? undefined : isCurrency(value.currency) ? value.currency : 'RUB',
    status: isStatus(value.status) ? value.status : 'active',
    archived: value.archived === true,
    createdAt: finiteNumber(value.createdAt, Date.now()),
  };
}

function parseTask(value: unknown, projectIds: Set<string>): Task | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id).trim();
  const projectId = stringValue(value.projectId).trim();
  const title = stringValue(value.title).trim();
  if (!id || !projectId || !projectIds.has(projectId) || !title) return null;
  return {
    id,
    projectId,
    title,
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
    rate: value.rate === undefined ? undefined : Math.max(0, finiteNumber(value.rate, 0)),
    createdAt: finiteNumber(value.createdAt, Date.now()),
  };
}

function parseEntry(value: unknown, projectIds: Set<string>, taskIds: Set<string>): TimeEntry | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id).trim();
  const projectId = stringValue(value.projectId).trim();
  const taskId = stringValue(value.taskId).trim();
  const start = finiteNumber(value.start, NaN);
  const durationMs = finiteNumber(value.durationMs, NaN);
  if (
    !id ||
    !projectIds.has(projectId) ||
    !taskIds.has(taskId) ||
    !Number.isFinite(start) ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0
  ) {
    return null;
  }
  return {
    id,
    projectId,
    taskId,
    start,
    end: finiteNumber(value.end, start + durationMs),
    durationMs,
    note: optionalString(value.note),
    manual: value.manual === true || undefined,
  };
}

function parseTimer(value: unknown, projectIds: Set<string>, taskIds: Set<string>): ActiveTimer | null {
  if (!isRecord(value)) return null;
  const projectId = stringValue(value.projectId).trim();
  const taskId = stringValue(value.taskId).trim();
  if (!projectIds.has(projectId) || !taskIds.has(taskId)) return null;
  const startedAt = finiteNumber(value.startedAt, NaN);
  const firstStartedAt = finiteNumber(value.firstStartedAt, startedAt);
  const accumulatedMs = Math.max(0, finiteNumber(value.accumulatedMs, 0));
  if (!Number.isFinite(startedAt) || !Number.isFinite(firstStartedAt)) return null;
  return {
    projectId,
    taskId,
    startedAt,
    firstStartedAt,
    accumulatedMs,
    running: value.running === true,
    note: optionalString(value.note),
  };
}

/** Разбор и мягкая миграция сериализованного состояния (бэкап, файл синка, localStorage) */
export function parseState(raw: string): AppState | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !parsed.settings) return null;

    const clients = (Array.isArray(parsed.clients) ? parsed.clients : [])
      .map(parseClient)
      .filter((client): client is Client => client !== null);
    const clientByName = new Map(clients.map((client) => [client.name.toLocaleLowerCase('ru-RU'), client]));
    const projects = (Array.isArray(parsed.projects) ? parsed.projects : [])
      .map(parseProject)
      .filter((project): project is Project => project !== null);

    for (const project of projects) {
      if (project.clientId || !project.client) continue;
      const key = project.client.toLocaleLowerCase('ru-RU');
      let client = clientByName.get(key);
      if (!client) {
        client = {
          id: legacyClientId(project.client),
          name: project.client,
          archived: false,
          createdAt: project.createdAt,
        };
        clients.push(client);
        clientByName.set(key, client);
      }
      project.clientId = client.id;
    }

    const clientById = new Map(clients.map((client) => [client.id, client]));
    for (const project of projects) {
      const client = project.clientId ? clientById.get(project.clientId) : undefined;
      if (client) project.client = client.name;
      else if (project.clientId) project.clientId = undefined;
    }

    const projectIds = new Set(projects.map((project) => project.id));
    const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks : [])
      .map((task) => parseTask(task, projectIds))
      .filter((task): task is Task => task !== null);
    const taskIds = new Set(tasks.map((task) => task.id));
    const entries = (Array.isArray(parsed.entries) ? parsed.entries : [])
      .map((entry) => parseEntry(entry, projectIds, taskIds))
      .filter((entry): entry is TimeEntry => entry !== null);

    return {
      schemaVersion: 2,
      settings: parseSettings(parsed.settings),
      clients,
      projects,
      tasks,
      entries,
      timer: parseTimer(parsed.timer, projectIds, taskIds),
    };
  } catch {
    return null;
  }
}

export function loadState(): AppState {
  const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
  if (!raw) return DEFAULT_STATE;
  return parseState(raw) ?? DEFAULT_STATE;
}

let desktopSaveTimer: ReturnType<typeof setTimeout> | null = null;
let desktopBaseRaw: string | null | undefined;

export function setDesktopBaseRaw(raw: string | null): void {
  desktopBaseRaw = raw;
  if (desktopSaveTimer) {
    clearTimeout(desktopSaveTimer);
    desktopSaveTimer = null;
  }
}

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
    const expectedRaw = desktopBaseRaw;
    desktopSaveTimer = setTimeout(() => {
      desktopSaveTimer = null;
      desktop.saveData(raw, expectedRaw).then((saved) => {
        if (saved && desktopBaseRaw === expectedRaw) desktopBaseRaw = raw;
      });
    }, 400);
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
