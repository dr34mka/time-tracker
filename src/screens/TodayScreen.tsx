import { useMemo, useState } from 'react';
import { useAppDispatch, useAppState } from '../state';
import { useNow, timerElapsed } from '../hooks';
import { uid } from '../lib/storage';
import Select from '../components/Select';
import {
  addDays,
  currentStreak,
  dayKey,
  formatClock,
  formatDuration,
  formatHours,
  plural,
  startOfDay,
  startOfWeek,
} from '../lib/time';
import {
  amountFor,
  computeEntry,
  formatMoney,
  formatMoneyByCurrency,
  resolveCurrency,
  resolveRate,
} from '../lib/money';
import type { Currency, Project, Task } from '../types';
import Icon from '../components/Icon';
import { AnimateDigits } from '../components/AnimateDigits';
import ProjectForm, { STATUS_LABEL } from '../components/ProjectForm';
import TaskNameModal from '../components/TaskNameModal';

const WEEK_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const PLACEHOLDER_TITLE = 'Новая задача';

/** Кольцо прогресса сегодняшнего дня в недельной полосе */
function TodayRing({ progress }: { progress: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const filled = Math.min(1, Math.max(0, progress));
  return (
    <svg viewBox="0 0 34 34" width="100%" height="100%">
      <circle cx="17" cy="17" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="3" />
      {filled > 0 && (
        <circle
          cx="17"
          cy="17"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${c * filled} ${c}`}
          transform="rotate(-90 17 17)"
        />
      )}
    </svg>
  );
}

export default function TodayScreen({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const timer = state.timer;
  const now = useNow(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [formOpen, setFormOpen] = useState(false);
  const [startProjectId, setStartProjectId] = useState('');
  const [startTaskId, setStartTaskId] = useState('');
  const [namingTaskId, setNamingTaskId] = useState<string | null>(null);

  const taskById = useMemo(() => new Map(state.tasks.map((t) => [t.id, t])), [state.tasks]);
  const projectById = useMemo(() => new Map(state.projects.map((p) => [p.id, p])), [state.projects]);

  const activeTask = timer ? taskById.get(timer.taskId) : undefined;
  const activeProject = timer ? projectById.get(timer.projectId) : undefined;
  const liveMs = timer ? timerElapsed(timer, now) : 0;

  const todayStart = startOfDay(now);
  const todayTotals = useMemo(() => {
    let durationMs = 0;
    const money: Partial<Record<Currency, number>> = {};
    for (const e of state.entries) {
      if (dayKey(e.start) !== dayKey(todayStart)) continue;
      const c = computeEntry(e, taskById, projectById, state.settings);
      durationMs += c.durationMs;
      money[c.currency] = (money[c.currency] ?? 0) + c.amount;
    }
    return { durationMs, money };
  }, [state.entries, todayStart, taskById, projectById, state.settings]);
  const todayTotalsWithTimer = useMemo(() => {
    if (!timer || dayKey(timer.firstStartedAt) !== dayKey(todayStart)) return todayTotals;
    const currency = resolveCurrency(activeProject, state.settings);
    const money = { ...todayTotals.money };
    money[currency] =
      (money[currency] ?? 0) +
      amountFor(
        liveMs,
        resolveRate(activeTask, activeProject, state.settings),
        state.settings.roundingMinutes,
      );
    return { durationMs: todayTotals.durationMs + liveMs, money };
  }, [
    activeProject,
    activeTask,
    liveMs,
    state.settings,
    timer,
    todayStart,
    todayTotals,
  ]);

  // отслеженное время по дням (для стрика и недельной полосы)
  const msByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of state.entries) {
      const key = dayKey(e.start);
      map.set(key, (map.get(key) ?? 0) + e.durationMs);
    }
    return map;
  }, [state.entries]);

  const todayMs = (msByDay.get(dayKey(now)) ?? 0) + liveMs;
  const goalMs = Math.max(1, state.settings.dailyGoalHours) * 3600000;
  const goalPct = Math.min(100, Math.round((todayMs / goalMs) * 100));

  const streak = useMemo(() => {
    const tracked = new Set([...msByDay.keys()]);
    if (todayMs > 0) tracked.add(dayKey(now));
    return currentStreak(tracked, now);
  }, [msByDay, todayMs, now]);

  const weekDays = useMemo(() => {
    const monday = startOfWeek(now);
    return WEEK_LABELS.map((label, i) => {
      const ts = addDays(monday, i);
      const isToday = dayKey(ts) === dayKey(now);
      const ms = (msByDay.get(dayKey(ts)) ?? 0) + (isToday ? liveMs : 0);
      return { label, ts, isToday, done: ms >= goalMs, ms };
    });
  }, [now, msByDay, liveMs, goalMs]);

  // сводка по проектам для карточек
  const totals = useMemo(() => {
    const map = new Map<string, { durationMs: number; amount: number }>();
    for (const e of state.entries) {
      const c = computeEntry(e, taskById, projectById, state.settings);
      const t = map.get(e.projectId) ?? { durationMs: 0, amount: 0 };
      t.durationMs += c.durationMs;
      t.amount += c.amount;
      map.set(e.projectId, t);
    }
    return map;
  }, [state.entries, taskById, projectById, state.settings]);

  const projects = state.projects.filter((p) => !p.archived && p.status === 'active');
  const selectedStartProject = projects.find((project) => project.id === startProjectId) ?? projects[0];
  const taskLastUsed = useMemo(() => {
    const result = new Map<string, number>();
    for (const entry of state.entries) {
      result.set(entry.taskId, Math.max(result.get(entry.taskId) ?? 0, entry.start));
    }
    return result;
  }, [state.entries]);
  const quickTasks = useMemo(
    () =>
      state.tasks
        .filter((task) => task.projectId === selectedStartProject?.id)
        .sort(
          (a, b) =>
            (taskLastUsed.get(b.id) ?? b.createdAt) - (taskLastUsed.get(a.id) ?? a.createdAt),
        ),
    [selectedStartProject?.id, state.tasks, taskLastUsed],
  );
  const selectedStartTask = quickTasks.find((task) => task.id === startTaskId) ?? quickTasks[0];

  const startNew = () => {
    const project = selectedStartProject;
    if (!project) return;
    const task: Task = {
      id: uid(),
      projectId: project.id,
      title: PLACEHOLDER_TITLE,
      createdAt: Date.now(),
    };
    dispatch({ type: 'addTask', task });
    dispatch({ type: 'startTimer', taskId: task.id, projectId: project.id });
    setNamingTaskId(task.id);
  };

  const startQuick = () => {
    if (!selectedStartProject) return;
    if (!selectedStartTask) {
      startNew();
      return;
    }
    dispatch({
      type: 'startTimer',
      taskId: selectedStartTask.id,
      projectId: selectedStartProject.id,
    });
  };

  const renderAvatar = (p: Project, size = 48) =>
    p.avatar ? (
      <img className="avatar" src={p.avatar} alt="" style={{ width: size, height: size }} />
    ) : (
      <span className="avatar avatar-empty" style={{ background: p.color, width: size, height: size }} />
    );

  return (
    <>
      <div className="screen-head">
        <h1>Time Tracker</h1>
        <div className="day-totals">
          <span className="value">{formatDuration(todayTotalsWithTimer.durationMs)}</span>
          <span className="sep">·</span>
          <span className="value">{formatMoneyByCurrency(todayTotalsWithTimer.money)}</span>
        </div>
      </div>

      <div className={'timer-hero' + (timer?.running ? ' live' : '')}>
        {timer ? (
          <>
            <div className="timer-task">
              <span
                className="dot"
                style={{ background: activeProject?.color, display: 'inline-block', marginRight: 8 }}
              />
              <button
                className="task-name-button"
                disabled={!activeTask}
                title="Переименовать задачу"
                onClick={() => activeTask && setNamingTaskId(activeTask.id)}
              >
                <span>{activeTask?.title ?? 'Задача'}</span>
                <Icon name="edit" size={13} />
              </button>
              <span className="meta"> · {activeProject?.name}</span>
            </div>
            <div className={'timer-clock' + (timer.running ? '' : ' paused')}>
              <AnimateDigits value={formatClock(liveMs)} gap={0} digitClassName="clock-digit" />
            </div>
            {!timer.running && <span className="badge">на паузе</span>}
            <div className="timer-controls">
              {timer.running ? (
                <button className="btn" onClick={() => dispatch({ type: 'pauseTimer' })}>
                  <Icon name="pause" size={15} /> Пауза
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => dispatch({ type: 'resumeTimer' })}>
                  <Icon name="play" size={15} /> Продолжить
                </button>
              )}
              <button className="btn btn-primary" onClick={() => dispatch({ type: 'stopTimer' })}>
                <Icon name="stop" size={15} /> Остановить
              </button>
              <button
                className="btn btn-ghost btn-danger"
                onClick={() => {
                  if (confirm('Отменить таймер без сохранения времени?')) dispatch({ type: 'discardTimer' });
                }}
              >
                Отменить
              </button>
            </div>
            <div className="timer-note">
              <input
                placeholder="Заметка к записи (что делали?)"
                value={timer.note ?? ''}
                onChange={(e) => dispatch({ type: 'setTimerNote', note: e.target.value })}
              />
            </div>
          </>
        ) : (
          <>
            <div className="timer-clock paused">
              <AnimateDigits value="00:00" gap={0} digitClassName="clock-digit" />
            </div>
            {projects.length > 0 ? (
              <div className="quick-row">
                <Select
                  value={selectedStartProject?.id ?? ''}
                  onChange={(value) => {
                    setStartProjectId(value);
                    setStartTaskId('');
                  }}
                  minWidth={200}
                  options={projects.map((p) => ({ value: p.id, label: p.name }))}
                />
                {quickTasks.length > 0 && (
                  <>
                    <Select
                      value={selectedStartTask?.id ?? ''}
                      onChange={setStartTaskId}
                      minWidth={220}
                      options={quickTasks.map((task) => ({ value: task.id, label: task.title }))}
                    />
                    <button
                      className="btn btn-icon btn-edit"
                      title="Переименовать выбранную задачу"
                      onClick={() => selectedStartTask && setNamingTaskId(selectedStartTask.id)}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                  </>
                )}
                <button className="btn btn-primary" onClick={startQuick}>
                  <Icon name="play" size={15} /> Старт
                </button>
                {quickTasks.length > 0 && (
                  <button className="btn btn-icon" title="Новая задача" onClick={startNew}>
                    <Icon name="plus" size={15} />
                  </button>
                )}
              </div>
            ) : (
              <div className="quick-row">
                <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
                  <Icon name="plus" size={14} /> Создать первый проект
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="section">
        <div className="row" style={{ marginBottom: 16 }}>
          <h2 className="grow">Проекты</h2>
          <div className="view-toggle">
            <button
              className={'btn btn-icon btn-ghost' + (view === 'grid' ? ' selected' : '')}
              title="Карточки"
              onClick={() => setView('grid')}
            >
              <Icon name="grid" size={16} />
            </button>
            <button
              className={'btn btn-icon btn-ghost' + (view === 'list' ? ' selected' : '')}
              title="Список"
              onClick={() => setView('list')}
            >
              <Icon name="list" size={16} />
            </button>
          </div>
          <button className="btn" onClick={() => setFormOpen(true)}>
            <Icon name="plus" size={14} /> Проект
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="card empty">
            <div className="empty-icon">
              <Icon name="folder" size={24} strokeWidth={1.6} />
            </div>
            Создайте первый проект — внутри добавите задачи и запустите таймер.
          </div>
        ) : view === 'grid' ? (
          <div className="project-grid">
            {projects.map((p) => {
              const t = totals.get(p.id);
              const currency = resolveCurrency(p, state.settings);
              return (
                <div className="project-card" key={p.id} onClick={() => onOpenProject(p.id)}>
                  <div className="row">
                    {renderAvatar(p)}
                    <div className="grow">
                      <b>{p.name}</b>
                      {p.client && <div className="meta">{p.client}</div>}
                    </div>
                    <span className={'badge' + (p.status === 'active' ? ' active' : '')}>{STATUS_LABEL[p.status]}</span>
                  </div>
                  <div className="stats">
                    <div className="stat">
                      <span className="value">{formatHours(t?.durationMs ?? 0)}</span>
                      <span className="label">отработано</span>
                    </div>
                    <div className="stat">
                      <span className="value">{formatMoneyByCurrency({ [currency]: t?.amount ?? 0 })}</span>
                      <span className="label">заработано</span>
                    </div>
                    <div className="stat">
                      <span className="value">{formatMoney(p.rate ?? state.settings.globalRate, currency)}</span>
                      <span className="label">ставка/ч</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {projects.map((p) => {
              const t = totals.get(p.id);
              const currency = resolveCurrency(p, state.settings);
              return (
                <div className="list-row" key={p.id} style={{ cursor: 'pointer' }} onClick={() => onOpenProject(p.id)}>
                  {renderAvatar(p, 40)}
                  <div className="grow">
                    <div>{p.name}</div>
                    {p.client && <div className="meta">{p.client}</div>}
                  </div>
                  <span className={'badge' + (p.status === 'active' ? ' active' : '')}>{STATUS_LABEL[p.status]}</span>
                  <span className="mono">{formatHours(t?.durationMs ?? 0)}</span>
                  <span className="money">{formatMoneyByCurrency({ [currency]: t?.amount ?? 0 })}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="section">
        <h2 style={{ marginBottom: 16 }}>Серия проектов</h2>
        <div className="goal-card">
          <div className="streak-row">
            <div className="flame-badge">
              <Icon name="flame" size={20} />
            </div>
            <div>
              <div className="streak-num">
                {streak}
                <small>{plural(streak, ['день', 'дня', 'дней'])}</small>
              </div>
            </div>
            <div className="streak-side">
              <Icon name="timer" size={18} strokeWidth={1.8} />
            </div>
          </div>

          <div className="week-strip">
            {weekDays.map((d) => (
              <div className="week-day" key={d.label}>
                {d.done ? (
                  <div className="day-dot done">
                    <Icon name="check" size={16} strokeWidth={3} />
                  </div>
                ) : d.isToday ? (
                  <div className="day-dot today-ring">
                    <TodayRing progress={d.ms / goalMs} />
                  </div>
                ) : (
                  <div
                    className="day-dot"
                    style={d.ms > 0 ? { background: 'color-mix(in srgb, var(--accent) 22%, var(--surface-2))' } : undefined}
                  />
                )}
                <span className="label-mono" style={d.isToday ? { color: 'var(--ink)' } : undefined}>
                  {d.label}
                </span>
              </div>
            ))}
          </div>

          <div className="goal-progress">
            <span className="label-mono">Цель дня</span>
            <div className="goal-numbers">
              <span className="big">{formatDuration(todayMs)}</span>
              <span className="of">/ {state.settings.dailyGoalHours}ч</span>
              <span className="pct">{goalPct}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${goalPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {formOpen && <ProjectForm onClose={() => setFormOpen(false)} />}
      {namingTaskId && taskById.get(namingTaskId) && (
        <TaskNameModal
          task={taskById.get(namingTaskId)!}
          timerDate={taskById.get(namingTaskId)?.title === PLACEHOLDER_TITLE}
          onClose={() => setNamingTaskId(null)}
        />
      )}
    </>
  );
}
