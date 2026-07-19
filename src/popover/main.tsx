import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import Icon from '../components/Icon';
import { formatClock } from '../lib/time';
import { amountFor, formatMoney } from '../lib/money';
import type { TraySnapshot } from '../desktop.d';
import './popover.css';

/** Popover меню-бара: компактный пульт таймера под чёлкой */
function Popover() {
  const [snap, setSnap] = useState<TraySnapshot>({ theme: 'dark', timer: null });
  const [now, setNow] = useState(() => Date.now());
  const [entered, setEntered] = useState(0); // ключ для перезапуска анимации появления
  const rootRef = useRef<HTMLDivElement>(null);

  // снапшот таймера из главного процесса + повторная анимация при каждом показе
  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop?.getTrayState) return;
    desktop.getTrayState().then(setSnap);
    const offState = desktop.onTrayState(setSnap);
    const offShown = desktop.onPopoverShown(() => {
      desktop.getTrayState().then(setSnap);
      setNow(Date.now());
      setEntered((n) => n + 1);
    });
    return () => {
      offState();
      offShown();
    };
  }, []);

  // тикаем, пока таймер идёт
  useEffect(() => {
    if (!snap.timer?.running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [snap.timer?.running]);

  // Esc — спрятать popover
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.desktop?.popoverHide();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // окно подстраивается под фактическую высоту контента
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || !window.desktop?.popoverResize) return;
    const ro = new ResizeObserver(() => {
      window.desktop?.popoverResize(el.offsetHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  useEffect(() => {
    document.documentElement.dataset.theme = snap.theme;
  }, [snap.theme]);

  const t = snap.timer;
  const elapsed = t ? t.accumulatedMs + (t.running ? Math.max(0, now - t.startedAt) : 0) : 0;

  return (
    <div ref={rootRef} key={entered} className="popover">
      {t ? (
        <>
          <div className="popover-project">
            <span className="popover-dot" style={{ background: t.projectColor }} />
            <span className="popover-project-name">{t.projectName}</span>
            <span className="popover-task">{t.taskTitle}</span>
          </div>

          <div className={`popover-clock${t.running ? '' : ' is-paused'}`}>
            {formatClock(elapsed)}
          </div>
          <div className="popover-money">
            {formatMoney(amountFor(elapsed, t.rate, t.roundingMinutes), t.currency)}
            {!t.running && <span className="popover-paused-label">пауза</span>}
          </div>

          <div className="popover-actions">
            {t.running ? (
              <button
                className="popover-btn primary"
                onClick={() => window.desktop?.popoverCommand('pause')}
                title="Пауза"
              >
                <Icon name="pause" size={16} />
              </button>
            ) : (
              <button
                className="popover-btn primary"
                onClick={() => window.desktop?.popoverCommand('resume')}
                title="Продолжить"
              >
                <Icon name="play" size={16} />
              </button>
            )}
            <button
              className="popover-btn danger"
              onClick={() => {
                window.desktop?.popoverCommand('stop');
                window.desktop?.popoverHide();
              }}
              title="Стоп — сохранить запись"
            >
              <Icon name="stop" size={16} />
            </button>
            <button className="popover-open" onClick={() => window.desktop?.openApp()}>
              Открыть
            </button>
          </div>
        </>
      ) : (
        <div className="popover-idle">
          <div className="popover-idle-icon">
            <Icon name="timer" size={20} strokeWidth={1.8} />
          </div>
          <div className="popover-idle-text">Таймер не запущен</div>
          <button className="popover-open wide" onClick={() => window.desktop?.openApp()}>
            Открыть Time Tracker
          </button>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popover />
  </React.StrictMode>,
);
