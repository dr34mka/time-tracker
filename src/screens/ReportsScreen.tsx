import { Fragment, useMemo, useRef, useState } from 'react';
import { useAppState } from '../state';
import { computeEntry, formatMoneyByCurrency, formatMoney } from '../lib/money';
import {
  addDays,
  dayKey,
  formatDayShort,
  formatDuration,
  formatHours,
  fromDateInputValue,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateInputValue,
} from '../lib/time';
import { downloadCsv } from '../lib/csv';
import type { Currency } from '../types';
import Icon from '../components/Icon';

type Period = 'today' | 'week' | 'month' | '30d' | 'all' | 'custom';

const PERIOD_LABEL: Record<Period, string> = {
  today: 'Сегодня',
  week: 'Эта неделя',
  month: 'Этот месяц',
  '30d': 'Последние 30 дней',
  all: 'Всё время',
  custom: 'Свой период',
};

/** Столбчатый график: часы по дням (одна серия — легенда не нужна) */
function HoursChart({ days }: { days: { ts: number; ms: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const W = 800;
  const H = 220;
  const pad = { top: 14, right: 8, bottom: 26, left: 36 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxHours = Math.max(1, ...days.map((d) => d.ms / 3600000));
  // «красивый» потолок оси
  const niceSteps = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];
  const yMax = niceSteps.find((s) => s >= maxHours) ?? Math.ceil(maxHours / 4) * 4;
  const ticks = [0.25, 0.5, 0.75, 1].map((f) => f * yMax);

  const n = days.length;
  const band = plotW / Math.max(1, n);
  const barW = Math.max(3, Math.min(band * 0.6, 28));
  const labelEvery = Math.ceil(n / 10);

  const yFor = (hours: number) => pad.top + plotH * (1 - hours / yMax);

  return (
    <div className="chart-card" ref={wrapRef}>
      <h3 style={{ marginBottom: 10 }}>Часы по дням</h3>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label="Часы по дням">
        {/* сетка */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={yFor(t)} y2={yFor(t)} stroke="var(--hairline)" strokeWidth="1" />
            <text x={pad.left - 6} y={yFor(t) + 4} textAnchor="end" fontSize="10" fill="var(--muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t % 1 === 0 ? t : t.toFixed(1)}
            </text>
          </g>
        ))}
        {/* базовая линия */}
        <line x1={pad.left} x2={W - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="var(--border)" strokeWidth="1" />

        {days.map((d, i) => {
          const hours = d.ms / 3600000;
          const x = pad.left + i * band + (band - barW) / 2;
          const h = (hours / yMax) * plotH;
          const y = pad.top + plotH - h;
          const r = Math.min(4, h / 2, barW / 2);
          // столбик с закруглённым верхом, плоским основанием
          const path =
            h > 0
              ? `M ${x} ${y + h} L ${x} ${y + r} Q ${x} ${y} ${x + r} ${y} L ${x + barW - r} ${y} Q ${x + barW} ${y} ${x + barW} ${y + r} L ${x + barW} ${y + h} Z`
              : '';
          return (
            <g key={d.ts}>
              {path && <path d={path} fill="var(--chart-series)" opacity={hover === null || hover === i ? 1 : 0.45} />}
              {/* увеличенная зона наведения — вся колонка */}
              <rect
                x={pad.left + i * band}
                y={pad.top}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
                  {formatDayShort(d.ts)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && days[hover] && (
        <div
          className="chart-tooltip"
          style={{
            left: `${((pad.left + hover * band + band / 2) / W) * 100}%`,
            top: 40,
          }}
        >
          {formatDayShort(days[hover].ts)} · {formatDuration(days[hover].ms)}
        </div>
      )}
    </div>
  );
}

export default function ReportsScreen() {
  const state = useAppState();
  const [period, setPeriod] = useState<Period>('week');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [customFrom, setCustomFrom] = useState(toDateInputValue(addDays(Date.now(), -7)));
  const [customTo, setCustomTo] = useState(toDateInputValue(Date.now()));

  const taskById = useMemo(() => new Map(state.tasks.map((t) => [t.id, t])), [state.tasks]);
  const projectById = useMemo(() => new Map(state.projects.map((p) => [p.id, p])), [state.projects]);

  const now = Date.now();
  const [from, to] = useMemo((): [number, number] => {
    switch (period) {
      case 'today':
        return [startOfDay(now), addDays(startOfDay(now), 1)];
      case 'week':
        return [startOfWeek(now), addDays(startOfWeek(now), 7)];
      case 'month':
        return [startOfMonth(now), addDays(now, 1)];
      case '30d':
        return [addDays(startOfDay(now), -29), addDays(startOfDay(now), 1)];
      case 'all': {
        const first = state.entries.length > 0 ? Math.min(...state.entries.map((e) => e.start)) : now;
        return [startOfDay(first), addDays(startOfDay(now), 1)];
      }
      case 'custom':
        return [fromDateInputValue(customFrom), addDays(fromDateInputValue(customTo), 1)];
    }
  }, [period, now, customFrom, customTo, state.entries]);

  const filtered = useMemo(
    () =>
      state.entries.filter(
        (e) => e.start >= from && e.start < to && (projectFilter === 'all' || e.projectId === projectFilter),
      ),
    [state.entries, from, to, projectFilter],
  );

  // сводка
  const summary = useMemo(() => {
    let durationMs = 0;
    let billedMin = 0;
    const money: Partial<Record<Currency, number>> = {};
    for (const e of filtered) {
      const c = computeEntry(e, taskById, projectById, state.settings);
      durationMs += c.durationMs;
      billedMin += c.billedMin;
      money[c.currency] = (money[c.currency] ?? 0) + c.amount;
    }
    return { durationMs, billedMin, money };
  }, [filtered, taskById, projectById, state.settings]);

  // часы по дням для графика
  const chartDays = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of filtered) {
      const key = dayKey(e.start);
      byDay.set(key, (byDay.get(key) ?? 0) + e.durationMs);
    }
    const days: { ts: number; ms: number }[] = [];
    const limitFrom = Math.max(from, addDays(startOfDay(now), -89)); // максимум 90 колонок
    for (let ts = startOfDay(limitFrom); ts < to; ts = addDays(ts, 1)) {
      days.push({ ts, ms: byDay.get(dayKey(ts)) ?? 0 });
    }
    return days;
  }, [filtered, from, to, now]);

  // группировка проект → задача
  const groups = useMemo(() => {
    interface Agg {
      durationMs: number;
      billedMin: number;
      money: Partial<Record<Currency, number>>;
    }
    const emptyAgg = (): Agg => ({ durationMs: 0, billedMin: 0, money: {} });
    const add = (agg: Agg, durationMs: number, billedMin: number, currency: Currency, amount: number) => {
      agg.durationMs += durationMs;
      agg.billedMin += billedMin;
      agg.money[currency] = (agg.money[currency] ?? 0) + amount;
    };
    const byProject = new Map<string, { agg: Agg; tasks: Map<string, Agg> }>();
    for (const e of filtered) {
      const c = computeEntry(e, taskById, projectById, state.settings);
      let g = byProject.get(e.projectId);
      if (!g) {
        g = { agg: emptyAgg(), tasks: new Map() };
        byProject.set(e.projectId, g);
      }
      add(g.agg, c.durationMs, c.billedMin, c.currency, c.amount);
      let t = g.tasks.get(e.taskId);
      if (!t) {
        t = emptyAgg();
        g.tasks.set(e.taskId, t);
      }
      add(t, c.durationMs, c.billedMin, c.currency, c.amount);
    }
    return byProject;
  }, [filtered, taskById, projectById, state.settings]);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['Дата', 'Проект', 'Клиент', 'Задача', 'Тэги', 'Начало', 'Конец', 'Длительность (ч)', 'Оплач. мин', 'Ставка', 'Валюта', 'Сумма', 'Заметка'],
    ];
    const sorted = [...filtered].sort((a, b) => a.start - b.start);
    for (const e of sorted) {
      const task = taskById.get(e.taskId);
      const project = projectById.get(e.projectId);
      const c = computeEntry(e, taskById, projectById, state.settings);
      rows.push([
        dayKey(e.start),
        project?.name ?? '',
        project?.client ?? '',
        task?.title ?? '',
        task?.tags.join(', ') ?? '',
        new Date(e.start).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        new Date(e.end).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        (e.durationMs / 3600000).toFixed(2).replace('.', ','),
        c.billedMin,
        c.rate,
        c.currency,
        c.amount.toFixed(2).replace('.', ','),
        e.note ?? '',
      ]);
    }
    downloadCsv(`report_${dayKey(from)}_${dayKey(addDays(to, -1))}.csv`, rows);
  };

  return (
    <>
      <div className="screen-head">
        <h1>Отчёты</h1>
        <button className="btn" onClick={exportCsv} disabled={filtered.length === 0}>
          <Icon name="download" size={15} /> Экспорт CSV
        </button>
      </div>

      <div className="filters">
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABEL[p]}
            </option>
          ))}
        </select>
        {period === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </>
        )}
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="all">Все проекты</option>
          {state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="value">{formatHours(summary.durationMs)}</div>
          <div className="label">отработано</div>
        </div>
        <div className="tile">
          <div className="value">{formatHours(summary.billedMin * 60000)}</div>
          <div className="label">оплачиваемых (окр. до {state.settings.roundingMinutes} мин)</div>
        </div>
        <div className="tile">
          <div className="value">{formatMoneyByCurrency(summary.money)}</div>
          <div className="label">заработок</div>
        </div>
      </div>

      <HoursChart days={chartDays} />

      <div className="section">
        <h2>По проектам и задачам</h2>
        {filtered.length === 0 ? (
          <div className="card empty">Нет записей за выбранный период.</div>
        ) : (
          <div className="card table-wrap" style={{ padding: 8 }}>
            <table className="report">
              <thead>
                <tr>
                  <th>Проект / задача</th>
                  <th className="num">Часы</th>
                  <th className="num">Оплач. часы</th>
                  <th className="num">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {[...groups.entries()].map(([projectId, g]) => {
                  const project = projectById.get(projectId);
                  return (
                    <Fragment key={projectId}>
                      <tr className="group-row">
                        <td>
                          <span className="dot" style={{ background: project?.color, display: 'inline-block', marginRight: 8 }} />
                          {project?.name ?? 'Удалённый проект'}
                          {project?.client && <span className="meta"> · {project.client}</span>}
                        </td>
                        <td className="num">{(g.agg.durationMs / 3600000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}</td>
                        <td className="num">{(g.agg.billedMin / 60).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}</td>
                        <td className="num money">{formatMoneyByCurrency(g.agg.money)}</td>
                      </tr>
                      {[...g.tasks.entries()].map(([taskId, agg]) => {
                        const task = taskById.get(taskId);
                        return (
                          <tr key={taskId}>
                            <td style={{ paddingLeft: 32 }}>
                              {task?.title ?? 'Удалённая задача'}
                              {task && task.tags.length > 0 && (
                                <span className="meta"> · {task.tags.join(', ')}</span>
                              )}
                            </td>
                            <td className="num">{(agg.durationMs / 3600000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}</td>
                            <td className="num">{(agg.billedMin / 60).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}</td>
                            <td className="num">{formatMoneyByCurrency(agg.money)}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
                <tr className="total-row">
                  <td>Итого</td>
                  <td className="num">{(summary.durationMs / 3600000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}</td>
                  <td className="num">{(summary.billedMin / 60).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}</td>
                  <td className="num money">{formatMoneyByCurrency(summary.money)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
