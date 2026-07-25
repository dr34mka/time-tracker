import { useRef, useState, type FormEvent } from 'react';
import { useAppDispatch, useAppState } from '../state';
import Modal from './Modal';
import Icon from './Icon';
import Select from './Select';
import { uid } from '../lib/storage';
import { formatMoney } from '../lib/money';
import {
  CURRENCIES,
  CURRENCY_LABELS,
  PROJECT_COLORS,
  type Client,
  type Currency,
  type Project,
  type ProjectStatus,
} from '../types';

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'активный',
  paused: 'на паузе',
  completed: 'завершён',
};

/** Файл изображения → data URL 128×128 (jpeg), обрезка по центру */
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const min = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('не удалось прочитать изображение'));
    };
    img.src = url;
  });
}

interface Props {
  initial?: Project;
  onClose: () => void;
}

export default function ProjectForm({ initial, onClose }: Props) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [name, setName] = useState(initial?.name ?? '');
  const initialClientMode = initial?.clientId ?? (initial?.client ? '__new' : '');
  const [clientId, setClientId] = useState(initialClientMode);
  const [newClientName, setNewClientName] = useState(initial?.clientId ? '' : initial?.client ?? '');
  const [color, setColor] = useState(initial?.color ?? PROJECT_COLORS[0]);
  const [avatar, setAvatar] = useState<string | undefined>(initial?.avatar);
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? 'active');
  const [useCustomRate, setUseCustomRate] = useState(initial?.rate !== undefined);
  const [rate, setRate] = useState(initial?.rate?.toString() ?? '');
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? state.settings.currency);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    try {
      setAvatar(await fileToAvatar(file));
    } catch {
      alert('Не удалось загрузить изображение');
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    let selectedClient: Client | undefined;
    if (clientId === '__new' && newClientName.trim()) {
      selectedClient = {
        id: uid(),
        name: newClientName.trim(),
        archived: false,
        createdAt: Date.now(),
      };
      dispatch({ type: 'addClient', client: selectedClient });
    } else if (clientId) {
      selectedClient = state.clients.find((client) => client.id === clientId);
    }
    const project: Project = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      clientId: selectedClient?.id,
      client: selectedClient?.name ?? '',
      color,
      avatar,
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
          <Select
            block
            value={clientId}
            onChange={setClientId}
            options={[
              { value: '', label: 'Без клиента' },
              ...state.clients
                .filter((client) => !client.archived || client.id === initial?.clientId)
                .map((client) => ({ value: client.id, label: client.name })),
              { value: '__new', label: '+ Новый клиент' },
            ]}
          />
          {clientId === '__new' && (
            <input
              style={{ marginTop: 8 }}
              value={newClientName}
              onChange={(event) => setNewClientName(event.target.value)}
              placeholder="Имя клиента или компании"
            />
          )}
        </div>
        <div className="field">
          <label>Аватарка</label>
          <div className="row">
            {avatar ? (
              <img className="avatar avatar-lg" src={avatar} alt="Аватарка проекта" />
            ) : (
              <span className="avatar avatar-lg avatar-empty" style={{ background: color }} />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => pickAvatar(e.target.files?.[0])}
            />
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="plus" size={14} /> Загрузить
            </button>
            {avatar && (
              <button type="button" className="btn btn-ghost btn-danger" onClick={() => setAvatar(undefined)}>
                Убрать
              </button>
            )}
          </div>
          <span className="hint">Если аватарки нет — используется цвет проекта</span>
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
          <Select
            block
            value={status}
            onChange={(v) => setStatus(v as ProjectStatus)}
            options={(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((s) => ({
              value: s,
              label: STATUS_LABEL[s],
            }))}
          />
        </div>
        <div className="field">
          <label className="row" style={{ gap: 8, textTransform: 'none', letterSpacing: 0, fontFamily: 'inherit', fontSize: 13 }}>
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
                <Select
                  block
                  value={currency}
                  onChange={(v) => setCurrency(v as Currency)}
                  options={CURRENCIES.map((c) => ({ value: c, label: CURRENCY_LABELS[c] }))}
                />
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
