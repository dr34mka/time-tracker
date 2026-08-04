import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE } from './storage';
import { getClientWorkSummary } from './client';
import type { AppState } from '../types';

describe('getClientWorkSummary', () => {
  it('groups completed work by the selected client and project', () => {
    const state: AppState = {
      ...structuredClone(DEFAULT_STATE),
      settings: { ...DEFAULT_STATE.settings, globalRate: 100, currency: 'USD', roundingMinutes: 1 },
      clients: [
        { id: 'c1', name: 'Acme', archived: false, createdAt: 1 },
        { id: 'c2', name: 'Other', archived: false, createdAt: 1 },
      ],
      projects: [
        {
          id: 'p1',
          name: 'Website',
          clientId: 'c1',
          client: 'Acme',
          color: '#000',
          status: 'active',
          archived: false,
          createdAt: 1,
        },
        {
          id: 'p2',
          name: 'Unused',
          clientId: 'c1',
          client: 'Acme',
          color: '#000',
          status: 'active',
          archived: false,
          createdAt: 2,
        },
        {
          id: 'p3',
          name: 'Other work',
          clientId: 'c2',
          client: 'Other',
          color: '#000',
          status: 'active',
          archived: false,
          createdAt: 3,
        },
      ],
      tasks: [
        { id: 't1', projectId: 'p1', title: 'Design', createdAt: 1 },
        { id: 't2', projectId: 'p2', title: 'No work', createdAt: 2 },
        { id: 't3', projectId: 'p3', title: 'Ignore', createdAt: 3 },
      ],
      entries: [
        { id: 'e1', projectId: 'p1', taskId: 't1', start: 100, end: 3_600_100, durationMs: 3_600_000 },
        { id: 'e2', projectId: 'p3', taskId: 't3', start: 200, end: 1_800_200, durationMs: 1_800_000 },
      ],
    };

    const summary = getClientWorkSummary(state, 'c1');

    expect(summary.projects).toHaveLength(2);
    expect(summary.workedTasks).toBe(1);
    expect(summary.entriesCount).toBe(1);
    expect(summary.durationMs).toBe(3_600_000);
    expect(summary.money).toEqual({ USD: 100 });
    expect(summary.projects.find(({ project }) => project.id === 'p1')?.tasks[0].task.title).toBe('Design');
    expect(summary.projects.find(({ project }) => project.id === 'p2')?.tasks).toHaveLength(0);
  });
});
