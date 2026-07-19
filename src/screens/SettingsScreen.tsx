import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppState } from '../state';
import { clearState, DEFAULT_STATE, parseState } from '../lib/storage';
import { dayKey } from '../lib/time';
import { CURRENCIES, ROUNDING_OPTIONS, type AppState, type Currency, type Theme } from '../types';
import Icon from '../components/Icon';
import Select from '../components/Select';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

export default function SettingsScreen() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const s = state.settings;
  const desktop = window.desktop;

  const [dataDir, setDataDir] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<AppState | null>(null);
  const [foundInFolder, setFoundInFolder] = useState<AppState | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    desktop?.getInfo().then((i) => setDataDir(i.dir));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-tracker-backup_${dayKey(Date.now())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pickBackup = async (file: File | undefined) => {
    if (!file) return;
    const raw = await file.text();
    const parsed = parseState(raw);
    if (!parsed) {
      alert('Не удалось прочитать бэкап: файл повреждён или имеет другой формат.');
      return;
    }
    setPendingRestore(parsed);
    if (fileRef.current) fileRef.current.value = '';
  };

  const chooseSyncDir = async () => {
    if (!desktop) return;
    const res = await desktop.chooseDataDir();
    if (!res) return;
    setDataDir(res.path);
    if (res.hasFile && res.data) {
      const parsed = parseState(res.data);
      if (parsed) {
        // в папке уже есть файл данных (например, с другого компьютера)
        setFoundInFolder(parsed);
        return;
      }
    }
    // файла нет — кладём туда текущие данные
    desktop.saveData(JSON.stringify(state));
  };

  return (
    <>
      <div className="screen-head">
        <h1>Настройки</h1>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Ставка и биллинг</h2>
        <div className="field-row">
          <div className="field">
            <label>Глобальная ставка (в час)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={s.globalRate}
              onChange={(e) => dispatch({ type: 'updateSettings', settings: { globalRate: Math.max(0, Number(e.target.value)) } })}
            />
            <span className="hint">Используется, если у проекта или задачи нет своей ставки</span>
          </div>
          <div className="field">
            <label>Валюта по умолчанию</label>
            <Select
              block
              value={s.currency}
              onChange={(v) => dispatch({ type: 'updateSettings', settings: { currency: v as Currency } })}
              options={CURRENCIES.map((c) => ({
                value: c,
                label: c === 'RUB' ? '₽ Российский рубль' : '$ Доллар США',
              }))}
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Цель дня (часов)</label>
            <input
              type="number"
              min="1"
              max="16"
              step="0.5"
              value={s.dailyGoalHours}
              onChange={(e) =>
                dispatch({
                  type: 'updateSettings',
                  settings: { dailyGoalHours: Math.min(16, Math.max(1, Number(e.target.value) || 1)) },
                })
              }
            />
            <span className="hint">Для прогресса на главном экране и недельных чекпоинтов</span>
          </div>
          <div className="field" />
        </div>
        <div className="field">
          <label>Минимальный интервал биллинга</label>
          <Select
            block
            value={String(s.roundingMinutes)}
            onChange={(v) => dispatch({ type: 'updateSettings', settings: { roundingMinutes: Number(v) } })}
            options={ROUNDING_OPTIONS.map((m) => ({
              value: String(m),
              label: m === 1 ? 'Без округления (по минутам)' : `Округлять вверх до ${m} минут`,
            }))}
          />
          <span className="hint">Пример: при интервале 15 мин запись 23 мин будет оплачена как 30 мин</span>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Внешний вид</h2>
        <div className="field">
          <label>Тема</label>
          <div className="row">
            {(['light', 'dark'] as Theme[]).map((t) => (
              <button
                key={t}
                className={'btn' + (s.theme === t ? ' btn-primary' : '')}
                onClick={() => dispatch({ type: 'updateSettings', settings: { theme: t } })}
              >
                <Icon name={t === 'light' ? 'sun' : 'moon'} size={15} /> {t === 'light' ? 'Светлая' : 'Тёмная'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Данные и синхронизация</h2>

        <div className="field">
          <label>Бэкап</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn" onClick={downloadBackup}>
              <Icon name="download" size={15} /> Скачать бэкап
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="restore" size={15} /> Восстановить из бэкапа
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => pickBackup(e.target.files?.[0])}
            />
          </div>
          <span className="hint">JSON-файл со всеми проектами, задачами и записями времени</span>
        </div>

        {desktop ? (
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Папка данных (синхронизация)</label>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', wordBreak: 'break-all', lineHeight: 1.4 }}>
              {dataDir ?? '…'}
            </span>
            <div className="row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
              <button className="btn" onClick={chooseSyncDir}>
                <Icon name="folder" size={15} strokeWidth={1.8} /> Выбрать папку…
              </button>
              <button className="btn btn-ghost" onClick={() => desktop.openDataDir()}>
                Открыть папку
              </button>
            </div>
            <span className="hint">
              Чтобы синхронизировать Windows и Mac: укажите здесь одну и ту же папку облака
              (Dropbox, Google Drive, Яндекс.Диск) на обоих компьютерах. Изменения с другого
              устройства подхватываются автоматически.
            </span>
          </div>
        ) : (
          <span className="hint">
            Синхронизация между компьютерами доступна в десктоп-версии приложения (выбор общей папки
            Dropbox / Google Drive / Яндекс.Диск в этом разделе).
          </span>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 16 }}>Опасная зона</h2>
        <button className="btn btn-red" onClick={() => setConfirmClear(true)}>
          <Icon name="trash" size={15} /> Очистить все данные
        </button>
      </div>

      {pendingRestore && (
        <ConfirmModal
          title="Восстановить из бэкапа?"
          message={`Текущие данные будут заменены содержимым бэкапа: проектов — ${pendingRestore.projects.length}, записей времени — ${pendingRestore.entries.length}.`}
          confirmLabel="Восстановить"
          onConfirm={() => dispatch({ type: 'resetAll', state: pendingRestore })}
          onClose={() => setPendingRestore(null)}
        />
      )}

      {foundInFolder && (
        <Modal title="В папке уже есть данные" onClose={() => setFoundInFolder(null)}>
          <p className="hint" style={{ margin: '0 0 8px', fontSize: 13 }}>
            В выбранной папке найден файл Time Tracker (проектов — {foundInFolder.projects.length},
            записей — {foundInFolder.entries.length}). Скорее всего, он с другого вашего компьютера.
          </p>
          <div className="modal-actions">
            <button
              className="btn"
              onClick={() => {
                // оставить мои данные: перезаписываем файл текущим состоянием
                window.desktop?.saveData(JSON.stringify(state));
                setFoundInFolder(null);
              }}
            >
              Оставить мои
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                dispatch({ type: 'resetAll', state: foundInFolder });
                setFoundInFolder(null);
              }}
            >
              Загрузить из папки
            </button>
          </div>
        </Modal>
      )}

      {confirmClear && (
        <ConfirmModal
          title="Очистить все данные?"
          message="Все проекты, задачи и записи времени будут удалены безвозвратно. Перед этим стоит скачать бэкап."
          confirmLabel="Удалить всё"
          onConfirm={() => {
            clearState();
            dispatch({ type: 'resetAll', state: DEFAULT_STATE });
          }}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </>
  );
}
