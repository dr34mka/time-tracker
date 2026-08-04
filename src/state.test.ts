import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STATE } from './lib/storage';
import { reducer } from './state';
import type { AppState, Client, Project, Task, TimeEntry } from './types';

function stateWithProject(): AppState {
  const client: Client = {
    id: 'client',
    name: 'Acme',
    archived: false,
    createdAt: 1,
  };
  const project: Project = {
    id: 'project',
    name: 'Project',
    clientId: client.id,
    client: client.name,
    color: '#000000',
    status: 'active',
    archived: false,
    createdAt: 1,
  };
  const task: Task = {
    id: 'task',
    projectId: project.id,
    title: 'Task',
    createdAt: 1,
  };
  return {
    ...structuredClone(DEFAULT_STATE),
    clients: [client],
    projects: [project],
    tasks: [task],
  };
}

afterEach(() => vi.useRealTimers());

describe('state reducer', () => {
  it('saves the previous timer when another task starts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let state = stateWithProject();
    state = reducer(state, { type: 'startTimer', taskId: 'task', projectId: 'project' });
    vi.setSystemTime(62_000);
    state = reducer(state, { type: 'startTimer', taskId: 'task', projectId: 'project' });
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].durationMs).toBe(61_000);
    expect(state.timer?.startedAt).toBe(62_000);
  });

  it('updates an existing time entry', () => {
    const entry: TimeEntry = {
      id: 'entry',
      projectId: 'project',
      taskId: 'task',
      start: 1,
      end: 2,
      durationMs: 1,
    };
    let state = { ...stateWithProject(), entries: [entry] };
    state = reducer(state, {
      type: 'updateEntry',
      entry: { ...entry, durationMs: 60_000, end: 60_001, note: 'Fixed' },
    });
    expect(state.entries[0]).toMatchObject({ durationMs: 60_000, note: 'Fixed' });
  });

  it('renames a task without disconnecting its timer or entries', () => {
    const base = stateWithProject();
    const entry: TimeEntry = {
      id: 'entry',
      projectId: 'project',
      taskId: 'task',
      start: 1,
      end: 60_001,
      durationMs: 60_000,
    };
    const state: AppState = {
      ...base,
      entries: [entry],
      timer: {
        taskId: 'task',
        projectId: 'project',
        startedAt: 1,
        firstStartedAt: 1,
        accumulatedMs: 0,
        running: true,
      },
    };

    const next = reducer(state, {
      type: 'updateTask',
      task: { ...state.tasks[0], title: 'Renamed task' },
    });

    expect(next.tasks[0].title).toBe('Renamed task');
    expect(next.entries[0].taskId).toBe('task');
    expect(next.timer?.taskId).toBe('task');
  });

  it('keeps project client snapshots in sync after a client rename', () => {
    const state = stateWithProject();
    const next = reducer(state, {
      type: 'updateClient',
      client: { ...state.clients[0], name: 'Acme Group' },
    });
    expect(next.projects[0].client).toBe('Acme Group');
  });
});
