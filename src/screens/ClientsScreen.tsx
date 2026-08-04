import { useMemo, useState, type FormEvent } from 'react';
import { useAppDispatch, useAppState } from '../state';
import { formatMoneyByCurrency } from '../lib/money';
import { formatHours } from '../lib/time';
import { uid } from '../lib/storage';
import { getClientWorkSummary } from '../lib/client';
import type { Client } from '../types';
import Icon from '../components/Icon';
import Modal from '../components/Modal';

function ClientForm({ initial, onClose }: { initial?: Client; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState(initial?.name ?? '');
  const [company, setCompany] = useState(initial?.company ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const client: Client = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      company: company.trim() || undefined,
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

export default function ClientsScreen({ onOpenClient }: { onOpenClient: (id: string) => void }) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | undefined>();
  const [showArchived, setShowArchived] = useState(false);

  const summaries = useMemo(
    () => new Map(state.clients.map((client) => [client.id, getClientWorkSummary(state, client.id)])),
    [state],
  );

  const visible = state.clients.filter((client) => !client.archived);
  const archived = state.clients.filter((client) => client.archived);

  const renderClient = (client: Client) => {
    const total = summaries.get(client.id);
    const projectCount = total?.projects.filter(({ project }) => !project.archived).length ?? 0;
    return (
      <div className="project-card client-card" key={client.id} onClick={() => onOpenClient(client.id)}>
        <div className="row">
          <span className="client-avatar">{client.name.slice(0, 1).toLocaleUpperCase('ru-RU')}</span>
          <div className="grow">
            <b>{client.name}</b>
            {client.company && <div className="meta">{client.company}</div>}
          </div>
        </div>
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
        <div className="card-actions" onClick={(event) => event.stopPropagation()}>
          <button className="btn btn-edit" onClick={() => setEditing(client)}>
            <Icon name="edit" size={14} strokeWidth={1.8} /> Изменить
          </button>
          <button
            className="btn btn-archive"
            onClick={() =>
              dispatch({ type: 'setClientArchived', id: client.id, archived: !client.archived })
            }
          >
            <Icon name={client.archived ? 'restore' : 'archive'} size={14} strokeWidth={1.8} />{' '}
            {client.archived ? 'Восстановить' : 'В архив'}
          </button>
        </div>
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
