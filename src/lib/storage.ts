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

import { DESIGN_PREVIEW, STORAGE_KEY } from './runtime';
const KEY = STORAGE_KEY;
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

function parseEntry(value: unknown, projectIds: Set<string>, taskProjects: Map<string, string>): TimeEntry | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id).trim();
  const projectId = stringValue(value.projectId).trim();
  const taskId = stringValue(value.taskId).trim();
  const start = finiteNumber(value.start, NaN);
  const durationMs = finiteNumber(value.durationMs, NaN);
  if (
    !id ||
    !projectIds.has(projectId) ||
    taskProjects.get(taskId) !== projectId ||
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

function parseTimer(value: unknown, projectIds: Set<string>, taskProjects: Map<string, string>): ActiveTimer | null {
  if (!isRecord(value)) return null;
  const projectId = stringValue(value.projectId).trim();
  const taskId = stringValue(value.taskId).trim();
  if (!projectIds.has(projectId) || taskProjects.get(taskId) !== projectId) return null;
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
    const taskProjects = new Map(tasks.map((task) => [task.id, task.projectId]));
    const entries = (Array.isArray(parsed.entries) ? parsed.entries : [])
      .map((entry) => parseEntry(entry, projectIds, taskProjects))
      .filter((entry): entry is TimeEntry => entry !== null);

    return {
      schemaVersion: 2,
      settings: parseSettings(parsed.settings),
      clients,
      projects,
      tasks,
      entries,
      timer: parseTimer(parsed.timer, projectIds, taskProjects),
    };
  } catch {
    return null;
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY) ?? (DESIGN_PREVIEW ? null : localStorage.getItem(LEGACY_KEY));
    return raw ? parseState(raw) ?? DEFAULT_STATE : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export interface PersistenceStatus {
  localError: boolean;
  desktopError: boolean;
  pending: boolean;
}
let status: PersistenceStatus = { localError: false, desktopError: false, pending: false };
const listeners = new Set<() => void>();
export const getPersistenceStatus = () => status;
export function subscribePersistence(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function publish(patch: Partial<PersistenceStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((listener) => listener());
}

let desktopSaveTimer: ReturnType<typeof setTimeout> | null = null;
let desktopBaseRaw: string | null | undefined;
let pendingRaw: string | null = null;
let saving = false;
let paused = false;
let epoch = 0;

/** Cancel queued writes before loading or resolving an external snapshot. */
export function pauseDesktopSaves(): void {
  paused = true;
  epoch++;
  pendingRaw = null;
  if (desktopSaveTimer) clearTimeout(desktopSaveTimer);
  desktopSaveTimer = null;
  publish({ pending: false });
}
export function resumeDesktopSaves(): void { paused = false; }
export function setDesktopBaseRaw(raw: string | null): void {
  pauseDesktopSaves();
  desktopBaseRaw = raw;
  paused = false;
  publish({ desktopError: false });
}
export function desktopLoadFailed(): void {
  pauseDesktopSaves();
  publish({ desktopError: true });
}
export function hasLocalDesktopChanges(state: AppState): boolean {
  return desktopBaseRaw === undefined || desktopBaseRaw === null ||
    JSON.stringify(state) !== JSON.stringify(parseState(desktopBaseRaw));
}

async function writePending(): Promise<void> {
  desktopSaveTimer = null;
  const desktop = DESIGN_PREVIEW ? undefined : window.desktop;
  if (!desktop || saving || paused || desktopBaseRaw === undefined || !pendingRaw) return;
  const raw = pendingRaw;
  pendingRaw = null;
  const expectedRaw = desktopBaseRaw;
  const writeEpoch = epoch;
  saving = true;
  let saved = false;
  try {
    saved = await desktop.saveData(raw, expectedRaw);
  } catch {
    // IPC rejection is a visible save failure, not an unhandled promise.
  } finally {
    saving = false;
  }
  if (writeEpoch === epoch) {
    if (saved) desktopBaseRaw = raw;
    publish({ desktopError: !saved, pending: Boolean(pendingRaw) });
    // A failed write needs an explicit retry or conflict decision.
    if (!saved) {
      pendingRaw = null;
      publish({ pending: false });
      return;
    }
  }
  // Serialize IPC calls so the next write uses the acknowledged file version.
  if (pendingRaw && !paused) void writePending();
}

export function saveState(state: AppState): void {
  const raw = JSON.stringify(state);
  let localError = false;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    localError = true;
  }
  publish({ localError });
  if (!DESIGN_PREVIEW && window.desktop && !paused) {
    pendingRaw = raw;
    publish({ pending: true });
    if (desktopSaveTimer) clearTimeout(desktopSaveTimer);
    desktopSaveTimer = setTimeout(() => { void writePending(); }, 400);
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
