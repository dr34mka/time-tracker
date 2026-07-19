import { useMemo, useState, type FormEvent } from 'react';
import { useAppDispatch, useAppState } from '../state';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import DatePicker from '../components/DatePicker';
import Select from '../components/Select';
import Icon from '../components/Icon';
import { uid } from '../lib/storage';
import { computeEntry, formatMoney, formatMoneyByCurrency, resolveCurrency, resolveRate } from '../lib/money';
import { formatDay, formatDuration, formatHours, formatTime, startOfDay } from '../lib/time';
import type { Task, TimeEntry } from '../types';

/** Варианты времени начала с шагом 15 минут */
const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { value: v, label: v };
});

/** Модалка ручного добавления времени */
function ManualEntryModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [dateTs, setDateTs] = useState(() => startOfDay(Date.now()));
  const [startTime, setStartTime] = useState('10:00');
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const [note, setNote] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const durationMs = (Number(hours) * 60 + Number(minutes)) * 60000;
    if (durationMs <= 0) return;
    const [h, m] = startTime.split(':').map(Number);
    const start = dateTs + (h * 60 + m) * 60000;
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
            <DatePicker value={dateTs} onChange={setDateTs} />
          </div>
          <div className="field">
            <label>Начало</label>
            <Select block value={startTime} onChange={setStartTime} options={TIME_OPTIONS} />
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

type PendingDelete = { kind: 'task'; id: string; title: string } | { kind: 'entry'; id: string } | null;

interface Props {
  projectId: string;
  onBack: () => void;
}

export default function ProjectDetailScreen({ projectId, onBack }: Props) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [newTitle, setNewTitle] = useState('');
  const [manualTask, setManualTask] = useState<Task | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

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
        Проект не найден.{' '}
        <button className="btn btn-ghost" onClick={onBack}>
          <Icon name="back" size={15} /> Назад
        </button>
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
      createdAt: Date.now(),
    };
    dispatch({ type: 'addTask', task });
    setNewTitle('');
  };

  return (
    <>
      <div className="screen-head">
        <div className="row">
          <button className="btn btn-ghost btn-icon" onClick={onBack} title="К проектам">
            <Icon name="back" size={18} />
          </button>
          {project.avatar ? (
            <img className="avatar" src={project.avatar} alt="" />
          ) : (
            <span className="avatar avatar-empty" style={{ background: project.color }} />
          )}
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
            style={{ minWidth: 176 }}
            placeholder="Новая задача…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={!newTitle.trim()}>
            <Icon name="plus" size={15} /> Добавить
          </button>
        </form>

        {tasks.length === 0 ? (
          <div className="card empty" style={{ marginTop: 16 }}>
            Задач пока нет — добавьте первую, чтобы запустить таймер.
          </div>
        ) : (
          <div className="card task-list" style={{ marginTop: 16, paddingTop: 8, paddingBottom: 8 }}>
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
                  <div className="task-row">
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
                    <div className="task-title">
                      <div className="t">{task.title}</div>
                      <div className="meta">
                        {entries.length > 0
                          ? `${entries.length} запис. · ставка ${formatMoney(rate, currency)}/ч`
                          : `ставка ${formatMoney(rate, currency)}/ч`}
                      </div>
                    </div>
                    <span className="task-cell-num mono">{formatDuration(durationMs)}</span>
                    <span className="task-cell-num money">{formatMoneyByCurrency({ [currency]: amount })}</span>
                    <button
                      className="btn btn-quiet"
                      disabled={entries.length === 0}
                      onClick={() => setExpandedTask(expanded ? null : task.id)}
                    >
                      Подробнее{' '}
                      <Icon name="chevron-down" size={14} className={expanded ? 'select-chev open' : 'select-chev'} />
                    </button>
                    <div className="task-actions">
                      <button className="btn btn-icon btn-warn" title="Добавить время вручную" onClick={() => setManualTask(task)}>
                        <Icon name="plus" size={15} />
                      </button>
                      <button
                        className="btn btn-icon btn-red"
                        title="Удалить задачу"
                        onClick={() => setPendingDelete({ kind: 'task', id: task.id, title: task.title })}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>
                  {expanded && entries.length > 0 && (
                    <div className="task-entries">
                      {entries.map((e) => {
                        const c = computeEntry(e, taskById, projectById, state.settings);
                        return (
                          <div
                            className="row"
                            key={e.id}
                            style={{ padding: '4px 0', borderBottom: '1px dashed var(--hairline)' }}
                          >
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
                              style={{ padding: '2px 4px' }}
                              title="Удалить запись"
                              onClick={() => setPendingDelete({ kind: 'entry', id: e.id })}
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
      {pendingDelete && (
        <ConfirmModal
          title={pendingDelete.kind === 'task' ? 'Удалить задачу?' : 'Удалить запись?'}
          message={
            pendingDelete.kind === 'task'
              ? `Задача «${pendingDelete.title}» и все её записи времени будут удалены безвозвратно.`
              : 'Запись времени будет удалена безвозвратно.'
          }
          onConfirm={() =>
            pendingDelete.kind === 'task'
              ? dispatch({ type: 'deleteTask', id: pendingDelete.id })
              : dispatch({ type: 'deleteEntry', id: pendingDelete.id })
          }
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
