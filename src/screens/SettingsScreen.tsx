import { useAppDispatch, useAppState } from '../state';
import { clearState, DEFAULT_STATE } from '../lib/storage';
import { CURRENCIES, ROUNDING_OPTIONS, type Currency, type Theme } from '../types';
import Icon from '../components/Icon';

export default function SettingsScreen() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const s = state.settings;

  return (
    <>
      <div className="screen-head">
        <h1>Настройки</h1>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 14 }}>Ставка и биллинг</h2>
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
            <select
              value={s.currency}
              onChange={(e) => dispatch({ type: 'updateSettings', settings: { currency: e.target.value as Currency } })}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c === 'MDL' ? 'MDL (молдавский лей)' : c === 'RON' ? 'RON (румынский лей)' : c}
                </option>
              ))}
            </select>
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
          <select
            value={s.roundingMinutes}
            onChange={(e) => dispatch({ type: 'updateSettings', settings: { roundingMinutes: Number(e.target.value) } })}
          >
            {ROUNDING_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === 1 ? 'Без округления (по минутам)' : `Округлять вверх до ${m} минут`}
              </option>
            ))}
          </select>
          <span className="hint">Пример: при интервале 15 мин запись 23 мин будет оплачена как 30 мин</span>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 14 }}>Внешний вид</h2>
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
        <h2 style={{ marginBottom: 14 }}>Клавиатурные шорткаты</h2>
        <p className="meta">
          <kbd>Space</kbd> — пауза/продолжить активный таймер; если таймера нет — запустить последнюю задачу.
          <br />
          <kbd>Esc</kbd> — закрыть диалог.
        </p>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 14 }}>Данные</h2>
        <p className="meta" style={{ marginTop: 0 }}>
          Все данные хранятся локально в браузере (localStorage) — таймер переживает закрытие вкладки.
        </p>
        <button
          className="btn btn-danger"
          onClick={() => {
            if (confirm('Удалить ВСЕ данные (проекты, задачи, записи времени)? Это действие необратимо.')) {
              clearState();
              dispatch({ type: 'resetAll', state: DEFAULT_STATE });
            }
          }}
        >
          Очистить все данные
        </button>
      </div>
    </>
  );
}
