import { useEffect, useState } from 'react';
import Icon from './Icon';
import type { UpdateInfo } from '../desktop.d';

/** Плавающий баннер «Доступна новая версия» (только в десктопе, при наличии
    обновления на GitHub Releases). Кнопка «Скачать» открывает установщик
    под текущую платформу; установка — вручную. */
export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const d = window.desktop;
    if (!d?.getUpdate) return;
    d.getUpdate().then((u) => u && setInfo(u));
    return d.onUpdateAvailable?.((u) => {
      setInfo(u);
      setDismissed(false);
    });
  }, []);

  if (!info || dismissed) return null;

  return (
    <div className="update-banner">
      <span className="update-banner-badge">
        <Icon name="download" size={15} strokeWidth={2} />
      </span>
      <span className="update-banner-text">
        Доступна версия <b>{info.version}</b>
      </span>
      <button className="update-banner-btn" onClick={() => window.desktop?.downloadUpdate()}>
        Скачать
      </button>
      <button
        className="update-banner-x"
        onClick={() => setDismissed(true)}
        aria-label="Скрыть"
      >
        <Icon name="x" size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
