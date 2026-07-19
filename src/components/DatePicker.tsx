import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { dayKey, startOfDay } from '../lib/time';

const WEEK_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

interface Props {
  /** выбранный день, epoch ms (начало дня) */
  value: number;
  onChange: (ts: number) => void;
}

/** Кастомный дейтпикер в стилистике проекта (вместо нативного input[type=date]) */
export default function DatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const view = new Date(viewMonth);
  const monthLabel = view.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const shiftMonth = (delta: number) =>
    setViewMonth(new Date(view.getFullYear(), view.getMonth() + delta, 1).getTime());

  // сетка месяца: пустые ячейки до первого дня + числа
  const lead = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const todayKey = dayKey(Date.now());
  const selectedKey = dayKey(value);

  const label = new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  return (
    <div className="select datepicker" ref={rootRef}>
      <button type="button" className="select-btn" onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open}>
        <Icon name="calendar" size={14} strokeWidth={1.8} className="dp-cal-icon" />
        <span className="select-value">{label}</span>
        <Icon name="chevron-down" size={14} className={'select-chev' + (open ? ' open' : '')} />
      </button>
      {open && (
        <div className="select-menu dp-menu">
          <div className="dp-head">
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
              <Icon name="chevron-left" size={15} />
            </button>
            <span className="dp-month">{monthLabel.replace(' г.', '')}</span>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
              <Icon name="chevron-right" size={15} />
            </button>
          </div>
          <div className="dp-grid">
            {WEEK_LABELS.map((w) => (
              <span className="dp-wd" key={w}>
                {w}
              </span>
            ))}
            {Array.from({ length: lead }).map((_, i) => (
              <span key={'l' + i} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const ts = startOfDay(new Date(view.getFullYear(), view.getMonth(), i + 1).getTime());
              const k = dayKey(ts);
              return (
                <button
                  type="button"
                  key={k}
                  className={
                    'dp-day' + (k === selectedKey ? ' selected' : '') + (k === todayKey ? ' today' : '')
                  }
                  onClick={() => {
                    onChange(ts);
                    setOpen(false);
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
