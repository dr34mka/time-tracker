import { useMemo } from 'react';
import { useAppDispatch, useAppState } from '../state';
import { useNow, timerElapsed } from '../hooks';
import {
  addDays,
  currentStreak,
  dayKey,
  formatClock,
  formatDuration,
  formatTime,
  plural,
  startOfDay,
  startOfWeek,
} from '../lib/time';
import { computeEntry, formatMoneyByCurrency } from '../lib/money';
import type { Currency } from '../types';
import Icon from '../components/Icon';

const WEEK_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Кольцо прогресса сегодняшнего дня в недельной полосе */
function TodayRing({ progress }: { progress: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const filled = Math.min(1, Math.max(0, progress));
  return (
    <svg viewBox="0 0 34 34" width="34" height="34">
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

  const taskById = useMemo(() => new Map(state.tasks.map((t) => [t.id, t])), [state.tasks]);
  const projectById = useMemo(() => new Map(state.projects.map((p) => [p.id, p])), [state.projects]);

  const activeTask = timer ? taskById.get(timer.taskId) : undefined;
  const activeProject = timer ? projectById.get(timer.projectId) : undefined;
  const liveMs = timer ? timerElapsed(timer, now) : 0;

  // записи за сегодня
  const todayStart = startOfDay(now);
  const todayEntries = useMemo(
    () => state.entries.filter((e) => e.end >= todayStart).sort((a, b) => b.end - a.end),
    [state.entries, todayStart],
  );

  const todayTotals = useMemo(() => {
    let durationMs = 0;
    const money: Partial<Record<Currency, number>> = {};
    for (const e of todayEntries) {
      const c = computeEntry(e, taskById, projectById, state.settings);
      durationMs += c.durationMs;
      money[c.currency] = (money[c.currency] ?? 0) + c.amount;
    }
    return { durationMs, money };
  }, [todayEntries, taskById, projectById, state.settings]);

  // отслеженное время по дням (для стрика и недельной полосы); активный таймер учитываем в «сегодня»
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
      return { label, ts, isToday, done: ms >= goalMs, ms, future: ts > now };
    });
  }, [now, msByDay, liveMs, goalMs]);

  // быстрый старт: недавние задачи (по последней записи), затем новые задачи
  const recentTasks = useMemo(() => {
    const lastUse = new Map<string, number>();
    for (const e of state.entries) {
      lastUse.set(e.taskId, Math.max(lastUse.get(e.taskId) ?? 0, e.end));
    }
    return state.tasks
      .filter((t) => {
        const p = projectById.get(t.projectId);
        return p && !p.archived && p.status === 'active';
      })
      .sort((a, b) => (lastUse.get(b.id) ?? b.createdAt) - (lastUse.get(a.id) ?? a.createdAt))
      .slice(0, 6);
  }, [state.tasks, state.entries, projectById]);

  return (
    <>
      <div className="screen-head">
        <h1>Сегодня</h1>
        <span className="meta">
          {formatDuration(todayTotals.durationMs)} · <b className="money">{formatMoneyByCurrency(todayTotals.money)}</b>
        </span>
      </div>

      <div className={'timer-hero' + (timer?.running ? ' live' : '')}>
        {timer ? (
          <>
            <div className="timer-task">
              <span
                className="dot"
                style={{ background: activeProject?.color, display: 'inline-block', marginRight: 8 }}
              />
              {activeTask?.title ?? 'Задача'}
              <span className="meta"> · {activeProject?.name}</span>
            </div>
            <div className={'timer-clock' + (timer.running ? '' : ' paused')}>{formatClock(liveMs)}</div>
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
                <Icon name="stop" size={15} /> Стоп и сохранить
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
            <div className="timer-clock paused">0:00:00</div>
            <p className="meta" style={{ margin: '4px 0 0' }}>
              Таймер не запущен — выберите задачу ниже или нажмите <kbd>Space</kbd>, чтобы продолжить последнюю
            </p>
          </>
        )}
      </div>

      <div className="section">
        <div className="goal-card">
          <div className="streak-row">
            <div className="flame-badge">
              <Icon name="flame" size={24} />
            </div>
            <div>
              <span className="label-mono">Серия</span>
              <div className="streak-num">
                {streak}
                <small>{plural(streak, ['день', 'дня', 'дней'])}</small>
              </div>
            </div>
            <div className="streak-side">
              <Icon name="timer" size={22} strokeWidth={1.8} />
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
                  <div className="day-dot" style={d.ms > 0 ? { background: 'color-mix(in srgb, var(--accent) 22%, var(--surface-2))' } : undefined} />
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

      <div className="section">
        <span className="label-mono">Быстрый старт</span>
        {recentTasks.length === 0 ? (
          <div className="card empty">
            <div className="big">🚀</div>
            Создайте проект и добавьте первую задачу — таймер запускается одним кликом.
          </div>
        ) : (
          <div className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {recentTasks.map((task) => {
              const project = projectById.get(task.projectId)!;
              const isRunning = timer?.taskId === task.id && timer.running;
              return (
                <div className="list-row" key={task.id}>
                  <button
                    className={'btn btn-play' + (isRunning ? ' running' : '')}
                    title={isRunning ? 'Пауза' : 'Старт'}
                    onClick={() =>
                      isRunning
                        ? dispatch({ type: 'pauseTimer' })
                        : timer?.taskId === task.id
                          ? dispatch({ type: 'resumeTimer' })
                          : dispatch({ type: 'startTimer', taskId: task.id, projectId: task.projectId })
                    }
                  >
                    <Icon name={isRunning ? 'pause' : 'play'} size={15} />
                  </button>
                  <div className="grow">
                    <div>{task.title}</div>
                    <div className="meta row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <span className="dot" style={{ background: project.color, width: 7, height: 7 }} />
                      <span style={{ whiteSpace: 'nowrap' }}>{project.name}</span>
                      {task.tags.map((t) => (
                        <span className="tag" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => onOpenProject(project.id)}>
                    Открыть →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="section">
        <span className="label-mono">Записи за сегодня</span>
        {todayEntries.length === 0 ? (
          <div className="card empty">Сегодня время ещё не отслеживалось.</div>
        ) : (
          <div className="card" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {todayEntries.map((e) => {
              const task = taskById.get(e.taskId);
              const project = projectById.get(e.projectId);
              const c = computeEntry(e, taskById, projectById, state.settings);
              return (
                <div className="list-row" key={e.id}>
                  <span className="dot" style={{ background: project?.color ?? 'var(--muted)' }} />
                  <div className="grow">
                    <div>
                      {task?.title ?? 'Удалённая задача'} <span className="meta">· {project?.name}</span>
                    </div>
                    <div className="meta">
                      {formatTime(e.start)}–{formatTime(e.end)}
                      {e.note ? ` · ${e.note}` : ''}
                    </div>
                  </div>
                  <span className="mono">{formatDuration(e.durationMs)}</span>
                  <span className="money">{formatMoneyByCurrency({ [c.currency]: c.amount })}</span>
                  <button
                    className="btn btn-ghost btn-icon btn-danger"
                    title="Удалить запись"
                    onClick={() => {
                      if (confirm('Удалить запись времени?')) dispatch({ type: 'deleteEntry', id: e.id });
                    }}
                  >
                    <Icon name="x" size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
