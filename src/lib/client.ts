import type { AppState, Currency, Project, Task } from '../types';
import { computeEntry } from './money';

export interface ClientTaskWork {
  task: Task;
  entriesCount: number;
  durationMs: number;
  money: Partial<Record<Currency, number>>;
  lastWorkedAt: number;
}

export interface ClientProjectWork {
  project: Project;
  tasks: ClientTaskWork[];
  durationMs: number;
  money: Partial<Record<Currency, number>>;
}

export interface ClientWorkSummary {
  projects: ClientProjectWork[];
  workedTasks: number;
  entriesCount: number;
  durationMs: number;
  money: Partial<Record<Currency, number>>;
}

function addMoney(target: Partial<Record<Currency, number>>, source: Partial<Record<Currency, number>>) {
  for (const currency of Object.keys(source) as Currency[]) {
    target[currency] = (target[currency] ?? 0) + (source[currency] ?? 0);
  }
}

export function getClientWorkSummary(state: AppState, clientId: string): ClientWorkSummary {
  const projectById = new Map(state.projects.map((project) => [project.id, project]));
  const taskById = new Map(state.tasks.map((task) => [task.id, task]));
  const clientProjects = state.projects
    .filter((project) => project.clientId === clientId)
    .sort((a, b) => Number(a.archived) - Number(b.archived) || b.createdAt - a.createdAt);
  const clientProjectIds = new Set(clientProjects.map((project) => project.id));
  const taskWork = new Map<string, ClientTaskWork>();

  let entriesCount = 0;
  let durationMs = 0;
  const money: Partial<Record<Currency, number>> = {};

  for (const entry of state.entries) {
    if (!clientProjectIds.has(entry.projectId)) continue;
    const task = taskById.get(entry.taskId);
    if (!task) continue;
    const computed = computeEntry(entry, taskById, projectById, state.settings);
    const work = taskWork.get(task.id) ?? {
      task,
      entriesCount: 0,
      durationMs: 0,
      money: {},
      lastWorkedAt: entry.start,
    };
    work.entriesCount += 1;
    work.durationMs += computed.durationMs;
    work.money[computed.currency] = (work.money[computed.currency] ?? 0) + computed.amount;
    work.lastWorkedAt = Math.max(work.lastWorkedAt, entry.start);
    taskWork.set(task.id, work);

    entriesCount += 1;
    durationMs += computed.durationMs;
    money[computed.currency] = (money[computed.currency] ?? 0) + computed.amount;
  }

  const projects = clientProjects.map((project) => {
    const tasks = [...taskWork.values()]
      .filter((work) => work.task.projectId === project.id)
      .sort((a, b) => b.lastWorkedAt - a.lastWorkedAt);
    const projectMoney: Partial<Record<Currency, number>> = {};
    let projectDuration = 0;
    for (const task of tasks) {
      projectDuration += task.durationMs;
      addMoney(projectMoney, task.money);
    }
    return { project, tasks, durationMs: projectDuration, money: projectMoney };
  });

  return {
    projects,
    workedTasks: taskWork.size,
    entriesCount,
    durationMs,
    money,
  };
}
