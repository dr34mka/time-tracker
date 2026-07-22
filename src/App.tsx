import { useState } from 'react';
import TimerBar from './components/TimerBar';
import Icon, { type IconName } from './components/Icon';
import { Dock } from './components/Dock';
import UpdateBanner from './components/UpdateBanner';
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
  const [route, setRoute] = useState<Route>({ name: 'today' });

  const isActive = (r: Route) =>
    r.name === route.name || (r.name === 'projects' && route.name === 'project');

  return (
    <div className="app">
      <UpdateBanner />
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

      <div className="dock-wrap">
        <Dock
          items={NAV.map((item) => ({
            icon: <Icon name={item.icon} size={20} strokeWidth={1.9} />,
            label: item.label,
            active: isActive(item.route),
            onClick: () => setRoute(item.route),
          }))}
        />
      </div>
    </div>
  );
}
