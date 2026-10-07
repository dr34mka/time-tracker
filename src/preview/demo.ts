import type { AppState } from '../types';

/** Synthetic data for the standalone design preview only. */
export function createDemoState(): AppState {
  const now = Date.now();
  const day = new Date();
  day.setHours(9, 0, 0, 0);
  const projects: AppState['projects'] = [
    { id: 'demo-platform', name: 'Редизайн платформы', clientId: 'demo-north', client: 'North Studio', color: '#38bdf8', rate: 65, currency: 'USD', status: 'active', archived: false, createdAt: now },
    { id: 'demo-brand', name: 'Брендинг и айдентика', clientId: 'demo-forma', client: 'Forma', color: '#d5a4ff', rate: 50, currency: 'USD', status: 'active', archived: false, createdAt: now },
    { id: 'demo-system', name: 'Дизайн-система', clientId: 'demo-north', client: 'North Studio', color: '#ffc361', rate: 65, currency: 'USD', status: 'active', archived: false, createdAt: now },
  ];
  const tasks = [
    { id: 'demo-components', projectId: projects[0].id, title: 'Компоненты и состояния', createdAt: now },
    { id: 'demo-concept', projectId: projects[1].id, title: 'Визуальная концепция', createdAt: now },
    { id: 'demo-library', projectId: projects[2].id, title: 'Библиотека компонентов', createdAt: now },
  ];
  return {
    schemaVersion: 2,
    settings: { globalRate: 50, currency: 'USD', roundingMinutes: 15, theme: 'dark', dailyGoalHours: 6 },
    clients: [
      { id: 'demo-north', name: 'North Studio', archived: false, createdAt: now },
      { id: 'demo-forma', name: 'Forma', archived: false, createdAt: now },
    ],
    projects, tasks,
    entries: Array.from({ length: 9 }, (_, i) => {
      const task = tasks[i % tasks.length];
      const start = new Date(day);
      start.setDate(start.getDate() - Math.floor(i / 2));
      start.setHours(9 + (i % 2) * 4);
      const durationMs = (i % 3 + 1) * 2700000;
      return { id: `demo-entry-${i}`, projectId: task.projectId, taskId: task.id, start: +start, end: +start + durationMs, durationMs };
    }),
    timer: null,
  };
}
