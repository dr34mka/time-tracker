/** Мост в главный процесс Electron (electron/preload.cjs). В браузере отсутствует. */
export interface DesktopBridge {
  loadData(): Promise<string | null>;
  saveData(raw: string): Promise<boolean>;
  getInfo(): Promise<{ dir: string; isDefault: boolean }>;
  openDataDir(): Promise<void>;
  chooseDataDir(): Promise<{ path: string; hasFile: boolean; data: string | null } | null>;
  onExternalChange(cb: (raw: string) => void): void;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export {};
