import { useMemo, useState } from 'react';
import { useAppDispatch, useAppState } from '../state';
import ProjectForm, { STATUS_LABEL } from '../components/ProjectForm';
import Icon from '../components/Icon';
import { computeEntry, formatMoney, formatMoneyByCurrency, resolveCurrency } from '../lib/money';
import { formatHours } from '../lib/time';
import type { Project } from '../types';

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
          {p.avatar ? (
            <img className="avatar" src={p.avatar} alt="" />
          ) : (
            <span className="avatar avatar-empty" style={{ background: p.color }} />
          )}
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
        <div className="card-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn btn-edit"
            onClick={() => {
              setEditing(p);
              setFormOpen(true);
            }}
          >
            <Icon name="edit" size={14} strokeWidth={1.8} /> Изменить
          </button>
          <button
            className="btn btn-archive"
            onClick={() => dispatch({ type: 'setProjectArchived', id: p.id, archived: !p.archived })}
          >
            <Icon name={p.archived ? 'restore' : 'archive'} size={14} strokeWidth={1.8} />{' '}
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
          <Icon name="plus" size={15} /> Новый проект
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
