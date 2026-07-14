import { useMemo, useState, type FormEvent } from 'react';
import { useAppDispatch, useAppState } from '../state';
import Modal from '../components/Modal';
import { uid } from '../lib/storage';
import { computeEntry, formatMoney, formatMoneyByCurrency, resolveCurrency } from '../lib/money';
import { formatHours } from '../lib/time';
import { CURRENCIES, PROJECT_COLORS, type Currency, type Project, type ProjectStatus } from '../types';

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'активный',
  paused: 'на паузе',
  completed: 'завершён',
};

interface FormProps {
  initial?: Project;
  onClose: () => void;
}

function ProjectForm({ initial, onClose }: FormProps) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [name, setName] = useState(initial?.name ?? '');
  const [client, setClient] = useState(initial?.client ?? '');
  const [color, setColor] = useState(initial?.color ?? PROJECT_COLORS[0]);
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? 'active');
  const [useCustomRate, setUseCustomRate] = useState(initial?.rate !== undefined);
  const [rate, setRate] = useState(initial?.rate?.toString() ?? '');
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? state.settings.currency);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const project: Project = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      client: client.trim(),
      color,
      status,
      rate: useCustomRate && rate !== '' ? Math.max(0, Number(rate)) : undefined,
      currency: useCustomRate ? currency : initial?.currency,
      archived: initial?.archived ?? false,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    dispatch({ type: initial ? 'updateProject' : 'addProject', project });
    onClose();
  };

  return (
    <Modal title={initial ? 'Редактировать проект' : 'Новый проект'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>Название</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Например: Сайт для Acme" />
        </div>
        <div className="field">
          <label>Клиент</label>
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Имя клиента или компании" />
        </div>
        <div className="field">
          <label>Цвет</label>
          <div className="swatches">
            {PROJECT_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={'swatch' + (c === color ? ' selected' : '')}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Цвет ${c}`}
              />
            ))}
          </div>
        </div>
        <div className="field">
          <label>Статус</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={useCustomRate}
              onChange={(e) => setUseCustomRate(e.target.checked)}
            />
            Своя ставка для проекта
          </label>
          {useCustomRate ? (
            <div className="field-row" style={{ marginTop: 6 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="Ставка в час"
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <span className="hint">
              Используется глобальная: {formatMoney(state.settings.globalRate, state.settings.currency)}/ч
            </span>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            {initial ? 'Сохранить' : 'Создать проект'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProjectsScreen({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | undefined>();
  const [showArchived, setShowArchived] = useState(false);

  const taskById = useMemo(() => new Map(state.tasks.map((t) => [t.id, t])), [state.tasks]);
  const projectById = useMemo(() => new Map(state.projects.map((p) => [p.id, p])), [state.projects]);

  // сводка по каждому проекту
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

  const visible = state.projects.filter((p) => !p.archived);
  const archived = state.projects.filter((p) => p.archived);

  const renderCard = (p: Project) => {
    const t = totals.get(p.id);
    const currency = resolveCurrency(p, state.settings);
    return (
      <div className="project-card" key={p.id} onClick={() => onOpenProject(p.id)}>
        <div className="row">
          <span className="dot" style={{ background: p.color }} />
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
            <span className="value">
              {formatMoney(p.rate ?? state.settings.globalRate, currency)}
            </span>
            <span className="label">ставка/ч</span>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12, gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setEditing(p);
              setFormOpen(true);
            }}
          >
            Изменить
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => dispatch({ type: 'setProjectArchived', id: p.id, archived: !p.archived })}
          >
            {p.archived ? 'Восстановить' : 'В архив'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="screen-head">
        <h1>Проекты</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          + Новый проект
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="card empty">
          <div className="big">📁</div>
          Пока нет проектов. Создайте первый — укажите клиента, цвет и ставку.
        </div>
      ) : (
        <div className="project-grid">{visible.map(renderCard)}</div>
      )}

      {archived.length > 0 && (
        <div className="section">
          <button className="btn btn-ghost" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? '▾' : '▸'} Архив ({archived.length})
          </button>
          {showArchived && (
            <div className="project-grid" style={{ marginTop: 12, opacity: 0.7 }}>
              {archived.map(renderCard)}
            </div>
          )}
        </div>
      )}

      {formOpen && <ProjectForm initial={editing} onClose={() => setFormOpen(false)} />}
    </>
  );
}
