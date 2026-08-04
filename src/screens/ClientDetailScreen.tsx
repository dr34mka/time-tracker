import { useMemo, useState } from 'react';
import Icon from '../components/Icon';
import TaskNameModal from '../components/TaskNameModal';
import { getClientWorkSummary } from '../lib/client';
import { formatMoneyByCurrency } from '../lib/money';
import { formatDay, formatDuration, formatHours, plural } from '../lib/time';
import { useAppState } from '../state';
import type { Task } from '../types';
import { STATUS_LABEL } from '../components/ProjectForm';

interface Props {
  clientId: string;
  onBack: () => void;
  onOpenProject: (id: string) => void;
}

export default function ClientDetailScreen({ clientId, onBack, onOpenProject }: Props) {
  const state = useAppState();
  const [renamingTask, setRenamingTask] = useState<Task | null>(null);
  const client = state.clients.find((item) => item.id === clientId);
  const summary = useMemo(() => getClientWorkSummary(state, clientId), [clientId, state]);

  if (!client) {
    return (
      <div className="card empty">
        Клиент не найден.{' '}
        <button className="btn btn-ghost" onClick={onBack}>
          <Icon name="back" size={15} /> Назад
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="screen-head client-detail-head">
        <div className="row">
          <button className="btn btn-ghost btn-icon" onClick={onBack} title="К клиентам">
            <Icon name="back" size={18} />
          </button>
          <span className="client-avatar client-avatar-lg">
            {client.name.slice(0, 1).toLocaleUpperCase('ru-RU')}
          </span>
          <div>
            <h1>{client.name}</h1>
            {client.company && <span className="meta">{client.company}</span>}
          </div>
        </div>
      </div>

      {client.notes && <div className="client-detail-notes">{client.notes}</div>}

      <div className="tiles client-summary-tiles">
        <div className="tile">
          <div className="value">{summary.projects.length}</div>
          <div className="label">проектов</div>
        </div>
        <div className="tile">
          <div className="value">{summary.workedTasks}</div>
          <div className="label">выполнено задач</div>
        </div>
        <div className="tile">
          <div className="value">{formatHours(summary.durationMs)}</div>
          <div className="label">отработано</div>
        </div>
        <div className="tile">
          <div className="value">{formatMoneyByCurrency(summary.money)}</div>
          <div className="label">заработано</div>
        </div>
      </div>

      <div className="section client-work-section">
        <div className="row client-work-title">
          <h2 className="grow">Проекты и выполненные задачи</h2>
          <span className="meta">
            {summary.entriesCount} {plural(summary.entriesCount, ['запись', 'записи', 'записей'])}
          </span>
        </div>

        {summary.projects.length === 0 ? (
          <div className="card empty">
            У клиента пока нет проектов. Назначьте клиента в настройках проекта.
          </div>
        ) : (
          <div className="client-projects">
            {summary.projects.map(({ project, tasks, durationMs, money }) => (
              <div className="client-project-work" key={project.id}>
                <div className="client-project-head">
                  {project.avatar ? (
                    <img className="avatar" src={project.avatar} alt="" />
                  ) : (
                    <span className="avatar avatar-empty" style={{ background: project.color }} />
                  )}
                  <div className="grow">
                    <b>{project.name}</b>
                    <div className="meta">
                      {formatHours(durationMs)} · {formatMoneyByCurrency(money)}
                    </div>
                  </div>
                  <span className={'badge' + (project.status === 'active' ? ' active' : '')}>
                    {STATUS_LABEL[project.status]}
                  </span>
                  <button className="btn btn-quiet" onClick={() => onOpenProject(project.id)}>
                    Открыть проект <Icon name="chevron-right" size={14} />
                  </button>
                </div>

                {tasks.length === 0 ? (
                  <div className="client-project-empty">По проекту пока нет записей времени.</div>
                ) : (
                  <div className="client-task-list">
                    {tasks.map((work) => (
                      <div className="client-task-row" key={work.task.id}>
                        <span className="client-task-check" title="Есть выполненная работа">
                          <Icon name="check" size={14} strokeWidth={2.5} />
                        </span>
                        <div className="client-task-name">
                          <b>{work.task.title}</b>
                          <span className="meta">
                            {work.entriesCount} {plural(work.entriesCount, ['запись', 'записи', 'записей'])} · последняя{' '}
                            {formatDay(work.lastWorkedAt)}
                          </span>
                        </div>
                        <div className="client-task-metrics">
                          <span className="mono">{formatDuration(work.durationMs)}</span>
                          <span className="money">{formatMoneyByCurrency(work.money)}</span>
                        </div>
                        <button
                          className="btn btn-icon btn-edit"
                          title="Переименовать задачу"
                          onClick={() => setRenamingTask(work.task)}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {renamingTask && <TaskNameModal task={renamingTask} onClose={() => setRenamingTask(null)} />}
    </>
  );
}
