import { useState } from 'react';
import { useAppDispatch, useAppState } from '../state';
import { useNow, timerElapsed } from '../hooks';
import { formatClock } from '../lib/time';
import Icon from './Icon';
import TaskNameModal from './TaskNameModal';

/** Компактная плашка активного таймера, видимая на всех экранах кроме «Сегодня» */
export default function TimerBar({ onOpenToday }: { onOpenToday: () => void }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [renaming, setRenaming] = useState(false);
  const timer = state.timer;
  const now = useNow(!!timer?.running);
  if (!timer) return null;

  const task = state.tasks.find((t) => t.id === timer.taskId);
  const project = state.projects.find((p) => p.id === timer.projectId);
  const elapsed = timerElapsed(timer, now);

  return (
    <>
      <div className="timerbar">
        <span className="dot" style={{ background: project?.color ?? 'var(--accent)' }} />
        <button
          className="btn-ghost btn grow"
          style={{ justifyContent: 'flex-start', minWidth: 0 }}
          onClick={onOpenToday}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {task?.title ?? 'Задача'} · {project?.name ?? ''}
          </span>
        </button>
        {task && (
          <button className="btn btn-icon btn-edit" title="Переименовать задачу" onClick={() => setRenaming(true)}>
            <Icon name="edit" size={14} />
          </button>
        )}
        <span className={'clock' + (timer.running ? '' : ' paused')}>{formatClock(elapsed)}</span>
        {timer.running ? (
          <button className="btn btn-icon" title="Пауза" onClick={() => dispatch({ type: 'pauseTimer' })}>
            <Icon name="pause" size={15} />
          </button>
        ) : (
          <button className="btn btn-icon" title="Продолжить" onClick={() => dispatch({ type: 'resumeTimer' })}>
            <Icon name="play" size={15} />
          </button>
        )}
        <button className="btn btn-icon" title="Стоп и сохранить" onClick={() => dispatch({ type: 'stopTimer' })}>
          <Icon name="stop" size={15} />
        </button>
      </div>
      {renaming && task && <TaskNameModal task={task} onClose={() => setRenaming(false)} />}
    </>
  );
}
