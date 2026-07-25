import { describe, expect, it } from 'vitest';
import { amountFor, billedMinutes, computeEntry, resolveCurrency, resolveRate } from './money';
import type { Project, Settings, Task, TimeEntry } from '../types';

const settings: Settings = {
  globalRate: 100,
  currency: 'RUB',
  roundingMinutes: 15,
  theme: 'dark',
  dailyGoalHours: 8,
};

const project: Project = {
  id: 'project',
  name: 'Project',
  client: '',
  color: '#000000',
  rate: 200,
  currency: 'USD',
  status: 'active',
  archived: false,
  createdAt: 1,
};

const task: Task = {
  id: 'task',
  projectId: project.id,
  title: 'Task',
  rate: 300,
  createdAt: 1,
};

describe('money calculations', () => {
  it('rounds billable time upward to the selected interval', () => {
    expect(billedMinutes(23 * 60_000, 15)).toBe(30);
    expect(billedMinutes(30 * 60_000, 15)).toBe(30);
    expect(billedMinutes(0, 15)).toBe(0);
  });

  it('calculates the amount from billable minutes', () => {
    expect(amountFor(23 * 60_000, 120, 15)).toBe(60);
  });

  it('uses task, project and global rates in that order', () => {
    expect(resolveRate(task, project, settings)).toBe(300);
    expect(resolveRate({ ...task, rate: undefined }, project, settings)).toBe(200);
    expect(resolveRate({ ...task, rate: undefined }, { ...project, rate: undefined }, settings)).toBe(100);
  });

  it('uses the project currency before the global currency', () => {
    expect(resolveCurrency(project, settings)).toBe('USD');
    expect(resolveCurrency({ ...project, currency: undefined }, settings)).toBe('RUB');
  });

  it('computes an entry consistently', () => {
    const entry: TimeEntry = {
      id: 'entry',
      projectId: project.id,
      taskId: task.id,
      start: 1,
      end: 23 * 60_000 + 1,
      durationMs: 23 * 60_000,
    };
    expect(
      computeEntry(entry, new Map([[task.id, task]]), new Map([[project.id, project]]), settings),
    ).toEqual({
      durationMs: 23 * 60_000,
      billedMin: 30,
      amount: 150,
      currency: 'USD',
      rate: 300,
    });
  });
});
