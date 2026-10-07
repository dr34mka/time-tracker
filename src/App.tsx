import { useEffect, useRef, useState } from 'react';
import WorkspaceSidebar from './components/WorkspaceSidebar';
import TimerBar from './components/TimerBar';
import Icon, { type IconName } from './components/Icon';
import UpdateBanner from './components/UpdateBanner';
import SyncConflictBanner from './components/SyncConflictBanner';
import TodayScreen from './screens/TodayScreen';
import ProjectsScreen from './screens/ProjectsScreen';
import ProjectDetailScreen from './screens/ProjectDetailScreen';
import ReportsScreen from './screens/ReportsScreen';
import SettingsScreen from './screens/SettingsScreen';
import ClientsScreen from './screens/ClientsScreen';
import ClientDetailScreen from './screens/ClientDetailScreen';
import { useAppDispatch, useAppState } from './state';

export type Route =
  | { name: 'today' }
  | { name: 'projects' }
  | { name: 'clients' }
  | { name: 'client'; id: string }
  | { name: 'project'; id: string; clientId?: string }
  | { name: 'reports' }
  | { name: 'settings' };

const NAV: { route: Route; label: string; icon: IconName }[] = [
  { route: { name: 'today' }, label: 'Таймер', icon: 'timer' },
  { route: { name: 'projects' }, label: 'Проекты', icon: 'folder' },
  { route: { name: 'clients' }, label: 'Клиенты', icon: 'users' },
  { route: { name: 'reports' }, label: 'Отчёты', icon: 'chart' },
  { route: { name: 'settings' }, label: 'Настройки', icon: 'sliders' },
];

export default function App() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [route, setRoute] = useState<Route>({ name: 'today' });

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem('time-tracker-sidebar-open') !== 'false';
    } catch {
      return true;
    }
  });
  const sidebarToggleRef = useRef<HTMLButtonElement>(null);
  const closeSidebar = () => {
    setSidebarOpen(false);
    requestAnimationFrame(() => sidebarToggleRef.current?.focus());
  };
  useEffect(() => {
    try {
      localStorage.setItem('time-tracker-sidebar-open', String(sidebarOpen));
    } catch {
      /* In-memory preference still works. */
    }
  }, [sidebarOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== 'Space' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (event.repeat || document.querySelector('dialog[open]')) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.matches('input, textarea, select, button, [role="button"]')
      ) {
        return;
      }
      if (state.timer) {
        event.preventDefault();
        dispatch({ type: state.timer.running ? 'pauseTimer' : 'resumeTimer' });
        return;
      }
      const lastEntry = [...state.entries].sort((a, b) => b.start - a.start)[0];
      const task =
        lastEntry && state.tasks.find((item) => item.id === lastEntry.taskId);
      const project =
        task && state.projects.find((item) => item.id === task.projectId);
      if (task && project && !project.archived && project.status === 'active') {
        event.preventDefault();
        dispatch({
          type: 'startTimer',
          taskId: task.id,
          projectId: project.id,
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, state.entries, state.projects, state.tasks, state.timer]);

  const isActive = (r: Route) =>
    r.name === route.name ||
    (r.name === 'projects' && route.name === 'project' && !route.clientId) ||
    (r.name === 'clients' &&
      (route.name === 'client' ||
        (route.name === 'project' && Boolean(route.clientId))));

  return (
    <div className={'app' + (sidebarOpen ? ' sidebar-expanded' : '')}>
      <UpdateBanner />
      <SyncConflictBanner />
      <WorkspaceSidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        navigate={setRoute}
        items={NAV}
        isActive={isActive}
        projects={state.projects}
      />
      <main className="main">
        <header className="workspace-toolbar">
          <button
            ref={sidebarToggleRef}
            className="btn btn-icon btn-ghost sidebar-toggle"
            aria-label={
              sidebarOpen ? 'Закрыть боковую панель' : 'Открыть боковую панель'
            }
            aria-expanded={sidebarOpen}
            aria-controls="workspace-sidebar"
            title={
              sidebarOpen ? 'Закрыть боковую панель' : 'Открыть боковую панель'
            }
            onClick={() => {
              setSidebarOpen(true);
              requestAnimationFrame(() =>
                document
                  .querySelector<HTMLButtonElement>('.sidebar-close')
                  ?.focus(),
              );
            }}
          >
            <Icon
              name={sidebarOpen ? 'sidebar-close' : 'sidebar-open'}
              size={22}
            />
          </button>
          <div className="workspace-breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <b>{NAV.find((item) => isActive(item.route))?.label}</b>
          </div>
          <span className="preview-badge">Дизайн · preview</span>
          <button
            className="btn btn-icon btn-ghost"
            aria-label={
              state.settings.theme === 'dark'
                ? 'Включить светлую тему'
                : 'Включить тёмную тему'
            }
            onClick={() =>
              dispatch({
                type: 'updateSettings',
                settings: {
                  theme: state.settings.theme === 'dark' ? 'light' : 'dark',
                },
              })
            }
          >
            <Icon
              name={state.settings.theme === 'dark' ? 'sun' : 'moon'}
              size={16}
            />
          </button>
        </header>
        {route.name !== 'today' && (
          <TimerBar onOpenToday={() => setRoute({ name: 'today' })} />
        )}
        <div className="content">
          {route.name === 'today' && (
            <TodayScreen
              onOpenProject={(id) => setRoute({ name: 'project', id })}
            />
          )}
          {route.name === 'projects' && (
            <ProjectsScreen
              onOpenProject={(id) => setRoute({ name: 'project', id })}
            />
          )}
          {route.name === 'clients' && (
            <ClientsScreen
              onOpenClient={(id) => setRoute({ name: 'client', id })}
            />
          )}
          {route.name === 'client' && (
            <ClientDetailScreen
              clientId={route.id}
              onBack={() => setRoute({ name: 'clients' })}
              onOpenProject={(id) =>
                setRoute({ name: 'project', id, clientId: route.id })
              }
            />
          )}
          {route.name === 'project' && (
            <ProjectDetailScreen
              projectId={route.id}
              backTitle={route.clientId ? 'К клиенту' : 'К проектам'}
              onBack={() =>
                setRoute(
                  route.clientId
                    ? { name: 'client', id: route.clientId }
                    : { name: 'projects' },
                )
              }
            />
          )}
          {route.name === 'reports' && <ReportsScreen />}
          {route.name === 'settings' && <SettingsScreen />}
        </div>
      </main>
    </div>
  );
}
