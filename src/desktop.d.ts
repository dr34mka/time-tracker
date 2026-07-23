import type { Currency, Theme } from './types';

/** Снапшот активного таймера для меню-бара (трей + popover) */
export interface TrayTimerSnapshot {
  running: boolean;
  /** Начало текущего непрерывного отрезка, epoch ms */
  startedAt: number;
  /** Накоплено до текущего отрезка (паузы), ms */
  accumulatedMs: number;
  projectName: string;
  projectColor: string;
  taskTitle: string;
  rate: number;
  currency: Currency;
  roundingMinutes: number;
}

export interface TraySnapshot {
  theme: Theme;
  timer: TrayTimerSnapshot | null;
}

export type TimerCommand = 'pause' | 'resume' | 'stop';

/** Доступное обновление (GitHub Releases) */
export interface UpdateInfo {
  version: string;
  notesUrl: string;
  downloadUrl: string;
}

/** Мост в главный процесс Electron (electron/preload.cjs). В браузере отсутствует. */
export interface DesktopBridge {
  loadData(): Promise<string | null>;
  saveData(raw: string): Promise<boolean>;
  getInfo(): Promise<{ dir: string; isDefault: boolean }>;
  openDataDir(): Promise<void>;
  chooseDataDir(): Promise<{ path: string; hasFile: boolean; data: string | null } | null>;
  onExternalChange(cb: (raw: string) => void): void;
  /** Рендерит HTML в PDF и сохраняет в папку загрузок (без диалогов) */
  savePdf(html: string, filename: string): Promise<{ ok: boolean; path?: string; error?: string }>;

  /** Главное окно → трей: снапшот таймера при каждом изменении */
  setTrayState(snapshot: TraySnapshot): void;
  /** Команды из popover'а меню-бара; возвращает отписку */
  onTimerCommand(cb: (cmd: TimerCommand) => void): () => void;

  /** Popover меню-бара */
  getTrayState(): Promise<TraySnapshot>;
  onTrayState(cb: (snapshot: TraySnapshot) => void): () => void;
  onPopoverShown(cb: () => void): () => void;
  popoverCommand(cmd: TimerCommand): void;
  popoverResize(height: number): void;
  popoverHide(): void;
  openApp(): void;

  /** Обновления: уведомление и ссылка на скачивание */
  getUpdate(): Promise<UpdateInfo | null>;
  onUpdateAvailable(cb: (info: UpdateInfo) => void): () => void;
  downloadUpdate(): void;
  appVersion(): Promise<string>;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export {};
