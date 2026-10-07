import { createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode, type Dispatch } from 'react';
import type { AppState, Client, Project, Settings, Task, TimeEntry } from './types';
import { DEFAULT_STATE, loadState, parseState, saveState, setDesktopBaseRaw, pauseDesktopSaves, resumeDesktopSaves, desktopLoadFailed, hasLocalDesktopChanges, uid } from './lib/storage';
import { resolveCurrency, resolveRate } from './lib/money';
import { timerElapsed } from './hooks';
import { needsSyncDecision } from './lib/sync';
import { downloadBackup } from './lib/backup';

export type Action =
  | { type: 'addProject'; project: Project }
  | { type: 'updateProject'; project: Project }
  | { type: 'setProjectArchived'; id: string; archived: boolean }
  | { type: 'addClient'; client: Client }
  | { type: 'updateClient'; client: Client }
  | { type: 'setClientArchived'; id: string; archived: boolean }
  | { type: 'addTask'; task: Task }
  | { type: 'updateTask'; task: Task }
  | { type: 'deleteTask'; id: string }
  | { type: 'addEntry'; entry: TimeEntry }
  | { type: 'updateEntry'; entry: TimeEntry }
  | { type: 'deleteEntry'; id: string }
  | { type: 'startTimer'; taskId: string; projectId: string }
  | { type: 'pauseTimer' }
  | { type: 'resumeTimer' }
  | { type: 'stopTimer'; note?: string }
  | { type: 'discardTimer' }
  | { type: 'setTimerNote'; note: string }
  | { type: 'setTimerStartDate'; dateTs: number }
  | { type: 'updateSettings'; settings: Partial<Settings> }
  | { type: 'resetAll'; state: AppState };

/** Собрать запись времени из активного таймера */
export function entryFromTimer(state: AppState, now: number, note?: string): TimeEntry | null {
  const t = state.timer;
  if (!t) return null;
  const durationMs = timerElapsed(t, now);
  if (durationMs < 1000) return null; // случайные клики не сохраняем
  return {
    id: uid(),
    taskId: t.taskId,
    projectId: t.projectId,
    start: t.firstStartedAt,
    end: now,
    durationMs,
    note: note ?? t.note,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addProject':
      return { ...state, projects: [...state.projects, action.project] };
    case 'updateProject':
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.project.id ? action.project : p)),
      };
    case 'setProjectArchived':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id ? { ...p, archived: action.archived } : p,
        ),
      };
    case 'addClient':
      return { ...state, clients: [...state.clients, action.client] };
    case 'updateClient':
      return {
        ...state,
        clients: state.clients.map((client) => (client.id === action.client.id ? action.client : client)),
        projects: state.projects.map((project) =>
          project.clientId === action.client.id ? { ...project, client: action.client.name } : project,
        ),
      };
    case 'setClientArchived':
      return {
        ...state,
        clients: state.clients.map((client) =>
          client.id === action.id ? { ...client, archived: action.archived } : client,
        ),
      };
    case 'addTask':
      return { ...state, tasks: [...state.tasks, action.task] };
    case 'updateTask':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.task.id ? action.task : t)) };
    case 'deleteTask': {
      const timer = state.timer?.taskId === action.id ? null : state.timer;
      return {
        ...state,
        timer,
        tasks: state.tasks.filter((t) => t.id !== action.id),
        entries: state.entries.filter((e) => e.taskId !== action.id),
      };
    }
    case 'addEntry':
      return { ...state, entries: [...state.entries, action.entry] };
    case 'updateEntry':
      return {
        ...state,
        entries: state.entries.map((entry) => (entry.id === action.entry.id ? action.entry : entry)),
      };
    case 'deleteEntry':
      return { ...state, entries: state.entries.filter((e) => e.id !== action.id) };

    case 'startTimer': {
      const now = Date.now();
      // если другой таймер уже идёт — сохраняем его как запись
      const finished = entryFromTimer(state, now);
      return {
        ...state,
        entries: finished ? [...state.entries, finished] : state.entries,
        timer: {
          taskId: action.taskId,
          projectId: action.projectId,
          startedAt: now,
          firstStartedAt: now,
          accumulatedMs: 0,
          running: true,
        },
      };
    }
    case 'pauseTimer': {
      const t = state.timer;
      if (!t || !t.running) return state;
      const now = Date.now();
      return {
        ...state,
        timer: { ...t, running: false, accumulatedMs: timerElapsed(t, now) },
      };
    }
    case 'resumeTimer': {
      const t = state.timer;
      if (!t || t.running) return state;
      return { ...state, timer: { ...t, running: true, startedAt: Date.now() } };
    }
    case 'stopTimer': {
      const finished = entryFromTimer(state, Date.now(), action.note);
      return {
        ...state,
        entries: finished ? [...state.entries, finished] : state.entries,
        timer: null,
      };
    }
    case 'discardTimer':
      return { ...state, timer: null };
    case 'setTimerNote':
      return state.timer ? { ...state, timer: { ...state.timer, note: action.note } } : state;
    case 'setTimerStartDate': {
      // запись уйдёт на выбранную дату: переносим день старта, сохраняя время суток
      const t = state.timer;
      if (!t) return state;
      const orig = new Date(t.firstStartedAt);
      const d = new Date(action.dateTs);
      d.setHours(orig.getHours(), orig.getMinutes(), orig.getSeconds(), 0);
      return { ...state, timer: { ...t, firstStartedAt: d.getTime() } };
    }

    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'resetAll':
      return action.state;
    default:
      return state;
  }
}

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

interface SyncControls {
  conflict: boolean;
  retry: () => void;
  resolve: (choice: 'external' | 'local') => void;
  chooseDirectory: () => Promise<string | null>;
}
const SyncContext = createContext<SyncControls | null>(null);
export function useSyncControls() {
  return useContext(SyncContext)!;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [conflictRaw, setConflictRaw] = useState<string | null>(null);
  const conflictRef = useRef<string | null>(null);
  const retryRef = useRef(() => saveState(stateRef.current));
  const acceptRef = useRef<(raw: string) => void>(() => {});
  const chooseDirectoryRef = useRef<() => Promise<string | null>>(async () => null);

  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;
    let cancelled = false;
    let externalRevision = 0;
    let loaded = false;
    let choosingDirectory = false;
    pauseDesktopSaves();

    const accept = (raw: string) => {
      const incoming = parseState(raw);
      if (!incoming) { desktopLoadFailed(); return; }
      conflictRef.current = null;
      setConflictRaw(null);
      setDesktopBaseRaw(raw);
      stateRef.current = incoming;
      dispatch({ type: 'resetAll', state: incoming });
    };
    acceptRef.current = accept;
    const receive = (raw: string, startup = false, forceDecision = false) => {
      if (cancelled) return;
      const incoming = parseState(raw);
      if (!incoming) { loaded = false; desktopLoadFailed(); return; }
      const current = stateRef.current;
      // On startup a differing local cache may contain a write interrupted at exit.
      const dirty = startup
        ? JSON.stringify(current) !== JSON.stringify(DEFAULT_STATE)
        : hasLocalDesktopChanges(current);
      if (forceDecision || conflictRef.current || needsSyncDecision(current, incoming, dirty)) {
        pauseDesktopSaves();
        conflictRef.current = raw;
        setConflictRaw(raw);
      } else {
        accept(raw);
      }
    };
    const load = async (forceDecision = false) => {
      const revision = ++externalRevision;
      try {
        const raw = await desktop.loadData();
        if (cancelled || revision !== externalRevision) return;
        if (raw !== null && !parseState(raw)) throw new Error('Invalid data file');
        if (raw !== null) receive(raw, !loaded, forceDecision);
        else {
          setDesktopBaseRaw(null);
          saveState(stateRef.current);
        }
        loaded = true;
      } catch {
        if (!cancelled && revision === externalRevision) { loaded = false; desktopLoadFailed(); }
      }
    };
    retryRef.current = () => {
      if (!loaded) void load();
      else saveState(stateRef.current);
    };
    const unsubscribe = desktop.onExternalChange((raw) => {
      externalRevision++;
      if (choosingDirectory) return;
      receive(raw, !loaded);
      loaded = Boolean(parseState(raw));
    });
    chooseDirectoryRef.current = async () => {
      if (choosingDirectory) return null;
      choosingDirectory = true;
      externalRevision++;
      pauseDesktopSaves();
      try {
        const result = await desktop.chooseDataDir();
        if (cancelled) return null;
        choosingDirectory = false;
        if (!result) {
          if (!conflictRef.current && loaded) { resumeDesktopSaves(); saveState(stateRef.current); }
          else void load(Boolean(conflictRef.current));
          return null;
        }
        externalRevision++;
        if (result.data) receive(result.data, false, true);
        else {
          conflictRef.current = null;
          setConflictRaw(null);
          setDesktopBaseRaw(null);
          saveState(stateRef.current);
        }
        return result.path;
      } catch {
        choosingDirectory = false;
        loaded = false;
        desktopLoadFailed();
        return null;
      }
    };
    const unsubscribeConflict = desktop.onDataConflict(() => { void load(true); });
    void load();
    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeConflict();
      pauseDesktopSaves();
    };
  }, []);

  // Save the in-memory version, including while a sync decision is pending.
  useEffect(() => { saveState(state); }, [state]);

  const resolve = (choice: 'external' | 'local') => {
    const raw = conflictRef.current;
    const incoming = raw ? parseState(raw) : null;
    if (!raw || !incoming) return;
    if (choice === 'external') {
      downloadBackup(stateRef.current, 'local-before-sync');
      acceptRef.current(raw);
    } else {
      downloadBackup(incoming, 'external-before-sync');
      conflictRef.current = null;
      setConflictRaw(null);
      setDesktopBaseRaw(raw);
      saveState(stateRef.current);
    }
  };

  // применение темы
  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);

  // десктоп: снапшот таймера для меню-бара (иконка трея + popover)
  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop?.setTrayState) return;
    const t = state.timer;
    const project = t ? state.projects.find((p) => p.id === t.projectId) : undefined;
    const task = t ? state.tasks.find((k) => k.id === t.taskId) : undefined;
    desktop.setTrayState({
      theme: state.settings.theme,
      timer: t
        ? {
            running: t.running,
            startedAt: t.startedAt,
            accumulatedMs: t.accumulatedMs,
            projectName: project?.name ?? 'Проект',
            projectColor: project?.color ?? '#30d158',
            taskTitle: task?.title ?? 'Задача',
            rate: resolveRate(task, project, state.settings),
            currency: resolveCurrency(project, state.settings),
            roundingMinutes: state.settings.roundingMinutes,
          }
        : null,
    });
  }, [state.timer, state.projects, state.tasks, state.settings]);

  // десктоп: команды таймера из popover'а меню-бара
  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop?.onTimerCommand) return;
    return desktop.onTimerCommand((cmd) => {
      if (cmd === 'pause') dispatch({ type: 'pauseTimer' });
      else if (cmd === 'resume') dispatch({ type: 'resumeTimer' });
      else if (cmd === 'stop') dispatch({ type: 'stopTimer' });
    });
  }, []);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        <SyncContext.Provider value={{ conflict: conflictRaw !== null, retry: () => retryRef.current(), resolve, chooseDirectory: () => chooseDirectoryRef.current() }}>
          {children}
        </SyncContext.Provider>
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  const s = useContext(StateContext);
  if (!s) throw new Error('useAppState вне AppProvider');
  return s;
}

export function useAppDispatch(): Dispatch<Action> {
  const d = useContext(DispatchContext);
  if (!d) throw new Error('useAppDispatch вне AppProvider');
  return d;
}
