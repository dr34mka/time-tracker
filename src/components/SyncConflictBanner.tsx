import { useSyncExternalStore } from 'react';
import { useAppState, useSyncControls } from '../state';
import { getPersistenceStatus, subscribePersistence } from '../lib/storage';
import { downloadBackup } from '../lib/backup';

export default function SyncConflictBanner() {
  const state = useAppState();
  const sync = useSyncControls();
  const status = useSyncExternalStore(subscribePersistence, getPersistenceStatus);
  if (sync.conflict) {
    return (
      <section className="persistence-notice" role="alert" aria-label="Конфликт синхронизации">
        <div>
          <strong>В файле другая версия данных</strong>
          <p>Текущая работа и таймер сохранены в окне. Выберите версию для продолжения. Перед заменой другая версия скачается как JSON-копия.</p>
        </div>
        <div className="persistence-actions">
          <button className="btn" onClick={() => sync.resolve('local')}>Скачать файл и оставить мои</button>
          <button className="btn" onClick={() => sync.resolve('external')}>Скачать мою копию и загрузить файл</button>
        </div>
      </section>
    );
  }
  if (!status.localError && !status.desktopError) return null;
  return (
    <section className="persistence-notice" role="alert" aria-label="Ошибка сохранения">
      <div>
        <strong>Не удалось сохранить данные</strong>
        <p>{status.localError ? 'Локальное хранилище недоступно или заполнено. ' : ''}
          {status.desktopError ? 'Не удалось прочитать или записать файл данных. ' : ''}
          Текущая работа остаётся в окне. Скачайте копию перед закрытием приложения.</p>
      </div>
      <div className="persistence-actions">
        <button className="btn" onClick={sync.retry}>Повторить сохранение</button>
        <button className="btn btn-primary" onClick={() => downloadBackup(state)}>Скачать копию JSON</button>
      </div>
    </section>
  );
}
