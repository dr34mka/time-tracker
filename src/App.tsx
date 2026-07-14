import { useEffect, useState } from 'react';
import { useAppDispatch, useAppState } from './state';
import TimerBar from './components/TimerBar';
import Icon, { type IconName } from './components/Icon';
import TodayScreen from './screens/TodayScreen';
import ProjectsScreen from './screens/ProjectsScreen';
import ProjectDetailScreen from './screens/ProjectDetailScreen';
import ReportsScreen from './screens/ReportsScreen';
import SettingsScreen from './screens/SettingsScreen';

export type Route =
  | { name: 'today' }
  | { name: 'projects' }
  | { name: 'project'; id: string }
  | { name: 'reports' }
  | { name: 'settings' };

const NAV: { route: Route; label: string; icon: IconName }[] = [
  { route: { name: 'today' }, label: 'Таймер', icon: 'timer' },
  { route: { name: 'projects' }, label: 'Проекты', icon: 'folder' },
  { route: { name: 'reports' }, label: 'Отчёты', icon: 'chart' },
  { route: { name: 'settings' }, label: 'Настройки', icon: 'sliders' },
];

export default function App() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [route, setRoute] = useState<Route>({ name: 'today' });

  // Глобальный шорткат: Space — старт/пауза/продолжить таймер
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'BUTTON' ||
        target.isContentEditable
      )
        return;
      e.preventDefault();
      if (state.timer) {
        dispatch({ type: state.timer.running ? 'pauseTimer' : 'resumeTimer' });
      } else {
        // старт последней активной задачи
        const lastEntry = [...state.entries].sort((a, b) => b.end - a.end)[0];
        const task = lastEntry && state.tasks.find((t) => t.id === lastEntry.taskId);
        if (task) dispatch({ type: 'startTimer', taskId: task.id, projectId: task.projectId });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.timer, state.entries, state.tasks, dispatch]);

  const isActive = (r: Route) =>
    r.name === route.name || (r.name === 'projects' && route.name === 'project');

  const navButtons = NAV.map((item) => (
    <button
      key={item.route.name}
      className={'nav-item' + (isActive(item.route) ? ' active' : '')}
      onClick={() => setRoute(item.route)}
      aria-label={item.label}
    >
      <span className="nav-icon">
        <Icon name={item.icon} size={19} strokeWidth={1.9} />
      </span>
      <span className="nav-label">{item.label}</span>
    </button>
  ));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot" />
          Time Tracker Pro
        </div>
        {navButtons}
        <div className="sidebar-footer">
          <kbd>Space</kbd> — старт/пауза
        </div>
      </aside>

      <div className="main">
        {route.name !== 'today' && <TimerBar onOpenToday={() => setRoute({ name: 'today' })} />}
        <div className="content">
          {route.name === 'today' && <TodayScreen onOpenProject={(id) => setRoute({ name: 'project', id })} />}
          {route.name === 'projects' && <ProjectsScreen onOpenProject={(id) => setRoute({ name: 'project', id })} />}
          {route.name === 'project' && (
            <ProjectDetailScreen projectId={route.id} onBack={() => setRoute({ name: 'projects' })} />
          )}
          {route.name === 'reports' && <ReportsScreen />}
          {route.name === 'settings' && <SettingsScreen />}
        </div>
      </div>

      <nav className="mobile-nav">{navButtons}</nav>
    </div>
  );
}
