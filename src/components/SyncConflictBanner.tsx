import { useEffect, useState } from 'react';
import type { DataConflictInfo } from '../desktop';
import Icon from './Icon';

export default function SyncConflictBanner() {
  const [info, setInfo] = useState<DataConflictInfo | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => window.desktop?.onDataConflict(setInfo), []);

  if (!info) return null;

  const resolve = async (choice: 'external' | 'local') => {
    setResolving(true);
    await window.desktop?.resolveDataConflict(choice);
    setInfo(null);
    setResolving(false);
  };

  return (
    <div className="update-banner sync-conflict-banner" role="status">
      <span className="update-banner-badge">
        <Icon name="archive" size={15} strokeWidth={2} />
      </span>
      <span className="update-banner-text">
        Обнаружены параллельные изменения. Локальная версия сохранена отдельно.
      </span>
      <div className="sync-conflict-actions">
        <button
          className="update-banner-btn secondary"
          disabled={resolving}
          onClick={() => resolve('external')}
        >
          Загрузить из файла
        </button>
        <button className="update-banner-btn" disabled={resolving} onClick={() => resolve('local')}>
          Оставить мои
        </button>
      </div>
      <button className="update-banner-x" onClick={() => setInfo(null)} aria-label="Скрыть">
        <Icon name="x" size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
