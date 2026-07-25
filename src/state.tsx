import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode, type Dispatch } from 'react';
import type { AppState, Client, Project, Settings, Task, TimeEntry } from './types';
import { loadState, parseState, saveState, setDesktopBaseRaw, uid } from './lib/storage';
import { resolveCurrency, resolveRate } from './lib/money';

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
  const durationMs = t.accumulatedMs + (t.running ? now - t.startedAt : 0);
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
        timer: { ...t, running: false, accumulatedMs: t.accumulatedMs + (now - t.startedAt) },
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // персистентность: каждое изменение — в localStorage (и в файл данных в десктопе)
  useEffect(() => {
    saveState(state);
  }, [state]);

  // десктоп: при старте подхватываем файл данных, дальше слушаем внешние
  // изменения файла (синхронизация через облачную папку с другого компьютера)
  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop) return;

    const applyExternal = (raw: string) => {
      const incoming = parseState(raw);
      if (!incoming) return;
      setDesktopBaseRaw(raw);
      const current = stateRef.current;
      // не теряем таймер, запущенный на этой машине
      const next = !incoming.timer && current.timer ? { ...incoming, timer: current.timer } : incoming;
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        dispatch({ type: 'resetAll', state: next });
      }
    };

    let cancelled = false;
    desktop.loadData().then((raw) => {
      if (cancelled) return;
      if (raw) {
        applyExternal(raw);
      } else {
        // файла ещё нет — экспортируем текущее состояние (миграция с localStorage)
        setDesktopBaseRaw(null);
        const currentRaw = JSON.stringify(stateRef.current);
        desktop.saveData(currentRaw, null).then((saved) => {
          if (saved) setDesktopBaseRaw(currentRaw);
        });
      }
    });
    const unsubscribe = desktop.onExternalChange(applyExternal);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

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
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
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
