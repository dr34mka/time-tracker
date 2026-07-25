import { useMemo, useState, type FormEvent } from 'react';
import { useAppDispatch, useAppState } from '../state';
import { computeEntry, formatMoneyByCurrency } from '../lib/money';
import { formatHours } from '../lib/time';
import { uid } from '../lib/storage';
import type { Client, Currency } from '../types';
import Icon from '../components/Icon';
import Modal from '../components/Modal';

function ClientForm({ initial, onClose }: { initial?: Client; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState(initial?.name ?? '');
  const [company, setCompany] = useState(initial?.company ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const client: Client = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      company: company.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
      archived: initial?.archived ?? false,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    dispatch({ type: initial ? 'updateClient' : 'addClient', client });
    onClose();
  };

  return (
    <Modal title={initial ? 'Редактировать клиента' : 'Новый клиент'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field-row">
          <div className="field">
            <label>Имя</label>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="field">
            <label>Компания</label>
            <input value={company} onChange={(event) => setCompany(event.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="field">
          <label>Заметки</label>
          <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ClientsScreen() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>();
  const [showArchived, setShowArchived] = useState(false);

  const taskById = useMemo(() => new Map(state.tasks.map((task) => [task.id, task])), [state.tasks]);
  const projectById = useMemo(
    () => new Map(state.projects.map((project) => [project.id, project])),
    [state.projects],
  );
  const totals = useMemo(() => {
    const result = new Map<string, { durationMs: number; money: Partial<Record<Currency, number>> }>();
    for (const entry of state.entries) {
      const project = projectById.get(entry.projectId);
      if (!project?.clientId) continue;
      const computed = computeEntry(entry, taskById, projectById, state.settings);
      const current = result.get(project.clientId) ?? { durationMs: 0, money: {} };
      current.durationMs += computed.durationMs;
      current.money[computed.currency] = (current.money[computed.currency] ?? 0) + computed.amount;
      result.set(project.clientId, current);
    }
    return result;
  }, [projectById, state.entries, state.settings, taskById]);

  const visible = state.clients.filter((client) => !client.archived);
  const archived = state.clients.filter((client) => client.archived);

  const renderClient = (client: Client) => {
    const projectCount = state.projects.filter(
      (project) => project.clientId === client.id && !project.archived,
    ).length;
    const total = totals.get(client.id);
    return (
      <div className="project-card" key={client.id}>
        <div className="row">
          <span className="client-avatar">{client.name.slice(0, 1).toLocaleUpperCase('ru-RU')}</span>
          <div className="grow">
            <b>{client.name}</b>
            {client.company && <div className="meta">{client.company}</div>}
          </div>
          <div className="card-actions">
            <button
              className="btn btn-icon btn-ghost"
              title="Редактировать клиента"
              onClick={() => setEditing(client)}
            >
              <Icon name="edit" size={15} />
            </button>
            <button
              className="btn btn-icon btn-ghost"
              title={client.archived ? 'Вернуть из архива' : 'Архивировать клиента'}
              onClick={() =>
                dispatch({ type: 'setClientArchived', id: client.id, archived: !client.archived })
              }
            >
              <Icon name={client.archived ? 'restore' : 'archive'} size={15} />
            </button>
          </div>
        </div>
        {client.email && <div className="client-contact">{client.email}</div>}
        <div className="stats">
          <div className="stat">
            <span className="value">{projectCount}</span>
            <span className="label">проектов</span>
          </div>
          <div className="stat">
            <span className="value">{formatHours(total?.durationMs ?? 0)}</span>
            <span className="label">отработано</span>
          </div>
          <div className="stat">
            <span className="value">{formatMoneyByCurrency(total?.money ?? {})}</span>
            <span className="label">заработано</span>
          </div>
        </div>
        {client.notes && <div className="client-notes">{client.notes}</div>}
      </div>
    );
  };

  return (
    <>
      <div className="screen-head">
        <h1>Клиенты</h1>
        <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
          <Icon name="plus" size={15} /> Клиент
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="card empty">Добавьте клиента, чтобы группировать проекты и отчёты.</div>
      ) : (
        <div className="project-grid">{visible.map(renderClient)}</div>
      )}

      {archived.length > 0 && (
        <div className="section">
          <button className="btn btn-ghost" onClick={() => setShowArchived((value) => !value)}>
            <Icon name="archive" size={15} /> Архив ({archived.length})
          </button>
          {showArchived && <div className="project-grid archived-grid">{archived.map(renderClient)}</div>}
        </div>
      )}

      {(formOpen || editing) && (
        <ClientForm
          initial={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(undefined);
          }}
        />
      )}
    </>
  );
}
