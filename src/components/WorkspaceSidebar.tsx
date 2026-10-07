import { useState } from 'react';
import type { Route } from '../App';
import type { Project } from '../types';
import Icon, { type IconName } from './Icon';

interface Props {
  open: boolean;
  onClose: () => void;
  navigate: (route: Route) => void;
  items: { route: Route; label: string; icon: IconName }[];
  isActive: (route: Route) => boolean;
  projects: Project[];
}

export default function WorkspaceSidebar({
  open,
  onClose,
  navigate,
  items,
  isActive,
  projects,
}: Props) {
  const [query, setQuery] = useState('');

  const active = projects.filter(
    (project) => !project.archived && project.status === 'active',
  );
  const filtered = active.filter((project) =>
    `${project.name} ${project.client}`
      .toLocaleLowerCase('ru')
      .includes(query.trim().toLocaleLowerCase('ru')),
  );
  const contents = (
    <>
      <div className="workspace-brand">
        <span className="workspace-mark">
          <Icon name="timer" size={25} />
        </span>
        <span>Time Tracker</span>
        <button
          className="btn btn-icon btn-ghost sidebar-close"
          aria-label="Закрыть боковую панель"
          title="Закрыть боковую панель"
          onClick={onClose}
        >
          <Icon name="sidebar-close" size={22} />
        </button>
      </div>
      <nav className="workspace-nav" aria-label="Основная навигация">
        {items.map((item) => (
          <button
            key={item.route.name}
            aria-current={isActive(item.route) ? 'page' : undefined}
            className={
              'workspace-nav-item' + (isActive(item.route) ? ' active' : '')
            }
            onClick={() => navigate(item.route)}
          >
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
            {item.route.name === 'projects' && (
              <small>
                {projects.filter((project) => !project.archived).length}
              </small>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-projects">
        <div className="sidebar-label">
          Ваши проекты <span>{active.length}</span>
        </div>
        <div className="sidebar-search">
          <Icon name="search" size={20} />
          <input
            aria-label="Поиск проектов"
            placeholder="Найти проект"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="sidebar-project-list">
          {filtered.map((project) => (
            <button
              key={project.id}
              className="sidebar-project"
              onClick={() => navigate({ name: 'project', id: project.id })}
            >
              <span className="dot" style={{ background: project.color }} />
              <span>{project.name}</span>
            </button>
          ))}
          {!filtered.length && (
            <p className="hint">
              {query ? 'Проекты не найдены' : 'Здесь появятся ваши проекты'}
            </p>
          )}
        </div>
      </div>
      <div className="sidebar-footer">
        <span className="sidebar-storage-icon">
          <Icon name="storage" size={20} />
        </span>
        <span>
          Моё пространство
          <small>
            <span className="local-dot" />
            Локальные данные
          </small>
        </span>
      </div>
    </>
  );

  return (
    <aside
      id="workspace-sidebar"
      className="workspace-sidebar"
      hidden={!open}
      aria-label="Боковая панель"
    >
      {contents}
    </aside>
  );
}
