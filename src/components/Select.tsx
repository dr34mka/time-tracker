import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** растянуть на всю ширину контейнера (по умолчанию — по контенту) */
  block?: boolean;
  minWidth?: number;
}

/** Кастомный дропдаун вместо нативного select — в стилистике проекта */
export default function Select({ value, options, onChange, block, minWidth }: Props) {
  const [open, setOpen] = useState(false);
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

  const current = options.find((o) => o.value === value);

  return (
    <div className={'select' + (block ? ' block' : '')} ref={rootRef} style={minWidth ? { minWidth } : undefined}>
      <button
        type="button"
        className="select-btn"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="select-value">{current?.label ?? '—'}</span>
        <Icon name="chevron-down" size={14} strokeWidth={2} className={'select-chev' + (open ? ' open' : '')} />
      </button>
      {open && (
        <div className="select-menu" role="listbox">
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={'select-item' + (o.value === value ? ' selected' : '')}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="select-check">{o.value === value && <Icon name="check" size={13} strokeWidth={2.5} />}</span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
