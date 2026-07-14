import { useMemo, useState, type FormEvent } from 'react';
import { useAppDispatch, useAppState } from '../state';
import Modal from '../components/Modal';
import { uid } from '../lib/storage';
import { computeEntry, formatMoney, formatMoneyByCurrency, resolveCurrency, resolveRate } from '../lib/money';
import {
  formatDay,
  formatDuration,
  formatHours,
  formatTime,
  fromDateInputValue,
  toDateInputValue,
} from '../lib/time';
import type { Task, TimeEntry } from '../types';
import Icon from '../components/Icon';

/** Модалка ручного добавления времени */
function ManualEntryModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [date, setDate] = useState(toDateInputValue(Date.now()));
  const [startTime, setStartTime] = useState('10:00');
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const [note, setNote] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const durationMs = (Number(hours) * 60 + Number(minutes)) * 60000;
    if (durationMs <= 0) return;
    const [h, m] = startTime.split(':').map(Number);
    const start = fromDateInputValue(date) + (h * 60 + m) * 60000;
    const entry: TimeEntry = {
      id: uid(),
      taskId: task.id,
      projectId: task.projectId,
      start,
      end: start + durationMs,
      durationMs,
      note: note.trim() || undefined,
      manual: true,
    };
    dispatch({ type: 'addEntry', entry });
    onClose();
  };

  return (
    <Modal title={`Добавить время — ${task.title}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label>Дата</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Начало</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Часы</label>
            <input type="number" min="0" max="24" value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div className="field">
            <label>Минуты</label>
            <input type="number" min="0" max="59" step="5" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Заметка</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Что было сделано" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary">
            Добавить
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface Props {
  projectId: string;
  onBack: () => void;
}

export default function ProjectDetailScreen({ projectId, onBack }: Props) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [newTitle, setNewTitle] = useState('');
  const [newTags, setNewTags] = useState('');
  const [manualTask, setManualTask] = useState<Task | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const project = state.projects.find((p) => p.id === projectId);
  const taskById = useMemo(() => new Map(state.tasks.map((t) => [t.id, t])), [state.tasks]);
  const projectById = useMemo(() => new Map(state.projects.map((p) => [p.id, p])), [state.projects]);

  const tasks = useMemo(
    () => state.tasks.filter((t) => t.projectId === projectId).sort((a, b) => b.createdAt - a.createdAt),
    [state.tasks, projectId],
  );

  const entriesByTask = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const e of state.entries) {
      if (e.projectId !== projectId) continue;
      const list = map.get(e.taskId) ?? [];
      list.push(e);
      map.set(e.taskId, list);
    }
    for (const list of map.values()) list.sort((a, b) => b.start - a.start);
    return map;
  }, [state.entries, projectId]);

  const projectTotals = useMemo(() => {
    let durationMs = 0;
    let amount = 0;
    for (const list of entriesByTask.values()) {
      for (const e of list) {
        const c = computeEntry(e, taskById, projectById, state.settings);
        durationMs += c.durationMs;
        amount += c.amount;
      }
    }
    return { durationMs, amount };
  }, [entriesByTask, taskById, projectById, state.settings]);

  if (!project) {
    return (
      <div className="card empty">
        Проект не найден. <button className="btn btn-ghost" onClick={onBack}>← Назад</button>
      </div>
    );
  }

  const currency = resolveCurrency(project, state.settings);

  const addTask = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const task: Task = {
      id: uid(),
      projectId,
      title: newTitle.trim(),
      tags: newTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      createdAt: Date.now(),
    };
    dispatch({ type: 'addTask', task });
    setNewTitle('');
    setNewTags('');
  };

  return (
    <>
      <div className="screen-head">
        <div className="row">
          <button className="btn btn-ghost btn-icon" onClick={onBack} title="К проектам">
            <Icon name="back" size={18} />
          </button>
          <span className="dot" style={{ background: project.color, width: 14, height: 14 }} />
          <div>
            <h1>{project.name}</h1>
            {project.client && <span className="meta">{project.client}</span>}
          </div>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="value">{formatHours(projectTotals.durationMs)}</div>
          <div className="label">всего отработано</div>
        </div>
        <div className="tile">
          <div className="value">{formatMoneyByCurrency({ [currency]: projectTotals.amount })}</div>
          <div className="label">заработано</div>
        </div>
        <div className="tile">
          <div className="value">{formatMoney(project.rate ?? state.settings.globalRate, currency)}</div>
          <div className="label">ставка/ч</div>
        </div>
      </div>

      <div className="section">
        <h2>Задачи</h2>
        <form className="card row" onSubmit={addTask} style={{ flexWrap: 'wrap' }}>
          <input
            className="grow"
            style={{ minWidth: 180, flex: 2 }}
            placeholder="Новая задача…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <input
            style={{ minWidth: 140, flex: 1, width: 'auto' }}
            placeholder="Тэги через запятую"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={!newTitle.trim()}>
            Добавить
          </button>
        </form>

        {tasks.length === 0 ? (
          <div className="card empty" style={{ marginTop: 12 }}>
            Задач пока нет — добавьте первую, чтобы запустить таймер.
          </div>
        ) : (
          <div className="card" style={{ marginTop: 12, paddingTop: 4, paddingBottom: 4 }}>
            {tasks.map((task) => {
              const entries = entriesByTask.get(task.id) ?? [];
              let durationMs = 0;
              let amount = 0;
              for (const e of entries) {
                const c = computeEntry(e, taskById, projectById, state.settings);
                durationMs += c.durationMs;
                amount += c.amount;
              }
              const isCurrent = state.timer?.taskId === task.id;
              const isRunning = isCurrent && state.timer!.running;
              const rate = resolveRate(task, project, state.settings);
              const expanded = expandedTask === task.id;
              return (
                <div key={task.id}>
                  <div className="list-row">
                    <button
                      className={'btn btn-play' + (isRunning ? ' running' : '')}
                      title={isRunning ? 'Пауза' : 'Старт таймера'}
                      onClick={() =>
                        isRunning
                          ? dispatch({ type: 'pauseTimer' })
                          : isCurrent
                            ? dispatch({ type: 'resumeTimer' })
                            : dispatch({ type: 'startTimer', taskId: task.id, projectId })
                      }
                    >
                      <Icon name={isRunning ? 'pause' : 'play'} size={15} />
                    </button>
                    <div className="grow" style={{ cursor: 'pointer' }} onClick={() => setExpandedTask(expanded ? null : task.id)}>
                      <div>
                        {task.title}{' '}
                        {task.tags.map((t) => (
                          <span className="tag" key={t} style={{ marginLeft: 4 }}>
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="meta">
                        {entries.length > 0
                          ? `${entries.length} запис. · ставка ${formatMoney(rate, currency)}/ч`
                          : `ставка ${formatMoney(rate, currency)}/ч`}
                      </div>
                    </div>
                    <span className="mono">{formatDuration(durationMs)}</span>
                    <span className="money">{formatMoneyByCurrency({ [currency]: amount })}</span>
                    <button className="btn btn-ghost btn-icon" title="Добавить время вручную" onClick={() => setManualTask(task)}>
                      <Icon name="plus" size={16} />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-danger"
                      title="Удалить задачу"
                      onClick={() => {
                        if (confirm(`Удалить задачу «${task.title}» и все её записи времени?`))
                          dispatch({ type: 'deleteTask', id: task.id });
                      }}
                    >
                      <Icon name="x" size={15} />
                    </button>
                  </div>
                  {expanded && entries.length > 0 && (
                    <div style={{ padding: '0 4px 10px 46px' }}>
                      {entries.map((e) => {
                        const c = computeEntry(e, taskById, projectById, state.settings);
                        return (
                          <div className="row" key={e.id} style={{ padding: '4px 0', borderBottom: '1px dashed var(--hairline)' }}>
                            <span className="meta grow">
                              {formatDay(e.start)}, {formatTime(e.start)}–{formatTime(e.end)}
                              {e.manual ? ' · вручную' : ''}
                              {e.note ? ` · ${e.note}` : ''}
                            </span>
                            <span className="mono meta">{formatDuration(e.durationMs)}</span>
                            <span className="money" style={{ fontSize: 12 }}>
                              {formatMoneyByCurrency({ [c.currency]: c.amount })}
                            </span>
                            <button
                              className="btn btn-ghost btn-icon btn-danger"
                              style={{ padding: '2px 6px' }}
                              onClick={() => {
                                if (confirm('Удалить запись времени?')) dispatch({ type: 'deleteEntry', id: e.id });
                              }}
                            >
                              <Icon name="x" size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {manualTask && <ManualEntryModal task={manualTask} onClose={() => setManualTask(null)} />}
    </>
  );
}
