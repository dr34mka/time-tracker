import type { Currency, Project, Settings, Task, TimeEntry } from '../types';

/** Ставка записи: задача → проект → глобальная */
export function resolveRate(
  task: Task | undefined,
  project: Project | undefined,
  settings: Settings,
): number {
  if (task?.rate !== undefined) return task.rate;
  if (project?.rate !== undefined) return project.rate;
  return settings.globalRate;
}

export function resolveCurrency(project: Project | undefined, settings: Settings): Currency {
  return project?.currency ?? settings.currency;
}

/** Оплачиваемые минуты: округление вверх до интервала биллинга */
export function billedMinutes(durationMs: number, roundingMinutes: number): number {
  if (durationMs <= 0) return 0;
  const minutes = durationMs / 60000;
  const step = Math.max(1, roundingMinutes);
  return Math.ceil(minutes / step) * step;
}

/** Заработок по длительности: округлённые часы × ставка */
export function amountFor(durationMs: number, rate: number, roundingMinutes: number): number {
  return (billedMinutes(durationMs, roundingMinutes) / 60) * rate;
}

export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

export interface EntryComputed {
  durationMs: number;
  billedMin: number;
  amount: number;
  currency: Currency;
  rate: number;
}

/** Полный расчёт по записи времени с учётом наследования ставок */
export function computeEntry(
  entry: TimeEntry,
  taskById: Map<string, Task>,
  projectById: Map<string, Project>,
  settings: Settings,
): EntryComputed {
  const task = taskById.get(entry.taskId);
  const project = projectById.get(entry.projectId);
  const rate = resolveRate(task, project, settings);
  const currency = resolveCurrency(project, settings);
  const billedMin = billedMinutes(entry.durationMs, settings.roundingMinutes);
  return {
    durationMs: entry.durationMs,
    billedMin,
    amount: (billedMin / 60) * rate,
    currency,
    rate,
  };
}

/** Суммы по валютам: {USD: 120, EUR: 40} → строка «120 $ · 40 €» */
export function formatMoneyByCurrency(totals: Partial<Record<Currency, number>>): string {
  const entries = Object.entries(totals).filter(([, v]) => v !== undefined) as [Currency, number][];
  const nonZero = entries.filter(([, v]) => v > 0);
  const shown = nonZero.length > 0 ? nonZero : entries.slice(0, 1);
  if (shown.length === 0) return formatMoney(0, 'USD');
  return shown.map(([c, v]) => formatMoney(v, c)).join(' · ');
}
