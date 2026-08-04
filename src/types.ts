export type Currency = 'RUB' | 'USD';

export type ProjectStatus = 'active' | 'paused' | 'completed';

export type Theme = 'light' | 'dark';

export interface Settings {
  globalRate: number;
  currency: Currency;
  /** Минимальный интервал биллинга в минутах: 1 / 5 / 15 / 30 / 60 */
  roundingMinutes: number;
  theme: Theme;
  /** Цель по отслеженным часам в день (для прогресса и недельных чекпоинтов) */
  dailyGoalHours: number;
}

export interface Project {
  id: string;
  name: string;
  /** Ссылка на клиента; поле client остаётся снимком имени для старых бэкапов */
  clientId?: string;
  client: string;
  color: string;
  /** Аватарка проекта — data URL (jpeg 128×128), опционально */
  avatar?: string;
  /** Переопределение глобальной ставки; undefined — используется глобальная */
  rate?: number;
  /** Переопределение валюты; undefined — используется глобальная */
  currency?: Currency;
  status: ProjectStatus;
  archived: boolean;
  createdAt: number;
}

export interface Client {
  id: string;
  name: string;
  company?: string;
  notes?: string;
  archived: boolean;
  createdAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  /** @deprecated тэги убраны из интерфейса; поле осталось для совместимости старых данных */
  tags?: string[];
  /** Переопределение ставки проекта/глобальной; undefined — наследуется */
  rate?: number;
  createdAt: number;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  projectId: string;
  /** Начало работы, epoch ms (для ручных записей — выбранное время) */
  start: number;
  /** Конец работы, epoch ms */
  end: number;
  /** Фактическая длительность; авторитетное поле (учитывает паузы) */
  durationMs: number;
  note?: string;
  manual?: boolean;
}

export interface ActiveTimer {
  taskId: string;
  projectId: string;
  /** Начало текущего непрерывного отрезка, epoch ms */
  startedAt: number;
  /** Момент первого запуска (для поля start будущей записи) */
  firstStartedAt: number;
  /** Накоплено до текущего отрезка (паузы), ms */
  accumulatedMs: number;
  running: boolean;
  note?: string;
}

export interface AppState {
  schemaVersion: 2;
  settings: Settings;
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  entries: TimeEntry[];
  timer: ActiveTimer | null;
}

export const CURRENCIES: Currency[] = ['RUB', 'USD'];

export const CURRENCY_LABELS: Record<Currency, string> = {
  RUB: '₽ Российский рубль',
  USD: '$ Доллар США',
};

export const ROUNDING_OPTIONS = [1, 5, 15, 30, 60];

/** Валидированная категориальная палитра (light) — цвета проектов */
export const PROJECT_COLORS = [
  '#2a78d6', // синий
  '#1baf7a', // аква
  '#eda100', // жёлтый
  '#008300', // зелёный
  '#4a3aa7', // фиолетовый
  '#e34948', // красный
  '#e87ba4', // маджента
  '#eb6834', // оранжевый
];
