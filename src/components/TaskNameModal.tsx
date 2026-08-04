import { useState, type FormEvent } from 'react';
import { useAppDispatch } from '../state';
import { dayKey, startOfDay } from '../lib/time';
import type { Task } from '../types';
import DatePicker from './DatePicker';
import Modal from './Modal';

interface Props {
  task: Task;
  onClose: () => void;
  timerDate?: boolean;
}

export default function TaskNameModal({ task, onClose, timerDate = false }: Props) {
  const dispatch = useAppDispatch();
  const [title, setTitle] = useState(task.title === 'Новая задача' ? '' : task.title);
  const [dateTs, setDateTs] = useState(() => startOfDay(Date.now()));

  const save = (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) return;
    dispatch({ type: 'updateTask', task: { ...task, title: nextTitle } });
    if (timerDate && dayKey(dateTs) !== dayKey(Date.now())) {
      dispatch({ type: 'setTimerStartDate', dateTs });
    }
    onClose();
  };

  return (
    <Modal title={timerDate ? 'Над чем работаете?' : 'Переименовать задачу'} onClose={onClose}>
      <form onSubmit={save}>
        <div className={timerDate ? 'field-row' : undefined}>
          <div className="field" style={timerDate ? { flex: 2 } : undefined}>
            <label>Название задачи</label>
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: правки главного экрана"
            />
          </div>
          {timerDate && (
            <div className="field">
              <label>Дата</label>
              <DatePicker value={dateTs} onChange={setDateTs} />
            </div>
          )}
        </div>
        {timerDate && (
          <p className="hint" style={{ margin: '0 0 4px' }}>
            Таймер уже запущен. Запись уйдёт на выбранную дату.
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  );
}
