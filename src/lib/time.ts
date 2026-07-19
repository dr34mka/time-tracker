/** Форматирование таймера: до часа — ММ:СС, дальше — Ч:ММ:СС */
export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Короткое форматирование: «2ч 15м», «45м», «0м» */
export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}м`;
  if (m === 0) return `${h}ч`;
  return `${h}ч ${m}м`;
}

/** Часы с десятичной частью: «12,5 ч» */
export function formatHours(ms: number): string {
  const hours = ms / 3600000;
  return `${hours.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ч`;
}

/** Локальный ключ дня YYYY-MM-DD */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const dow = (d.getDay() + 6) % 7; // понедельник = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

export function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** «12 июля» */
export function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/** «12.07» */
export function formatDayShort(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

/** «14:35» */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Значение для <input type="date"> */
export function toDateInputValue(ts: number): string {
  return dayKey(ts);
}

/** Парсинг YYYY-MM-DD как локальной даты */
export function fromDateInputValue(value: string): number {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Русская плюрализация: plural(3, ['день', 'дня', 'дней']) → «дня» */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/** Стрик: сколько дней подряд (заканчивая сегодня или вчера) есть отслеженное время */
export function currentStreak(trackedDays: Set<string>, now: number): number {
  let cursor = startOfDay(now);
  // сегодняшний день ещё не закончился — пустое «сегодня» стрик не рвёт
  if (!trackedDays.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (trackedDays.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
