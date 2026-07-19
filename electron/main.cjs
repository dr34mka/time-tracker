const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

/* ===== Файловое хранилище данных =====
   Данные лежат в JSON-файле. По умолчанию — в userData;
   пользователь может выбрать любую папку (например, Dropbox/Google Drive) —
   тогда файл синхронизируется между компьютерами силами облака. */

const DATA_FILE_NAME = 'time-tracker-data.json';

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}
function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return {};
  }
}
function writeConfig(c) {
  try {
    fs.writeFileSync(configPath(), JSON.stringify(c));
  } catch {}
}
function getDataDir() {
  const c = readConfig();
  if (c.dataDir && fs.existsSync(c.dataDir)) return c.dataDir;
  return app.getPath('userData');
}
function dataFilePath() {
  return path.join(getDataDir(), DATA_FILE_NAME);
}

let lastWritten = null; // чтобы не реагировать на собственные записи
let watcher = null;

function watchDataDir(win) {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  try {
    watcher = fs.watch(getDataDir(), (_event, filename) => {
      if (filename !== DATA_FILE_NAME) return;
      // небольшая задержка: облачные клиенты пишут файл не атомарно
      setTimeout(() => {
        try {
          const raw = fs.readFileSync(dataFilePath(), 'utf8');
          if (raw && raw !== lastWritten && !win.isDestroyed()) {
            lastWritten = raw;
            win.webContents.send('data:external-change', raw);
          }
        } catch {}
      }, 300);
    });
  } catch {}
}

function registerIpc(getWin) {
  ipcMain.handle('data:load', () => {
    try {
      return fs.readFileSync(dataFilePath(), 'utf8');
    } catch {
      return null;
    }
  });

  ipcMain.handle('data:save', (_e, raw) => {
    try {
      lastWritten = raw;
      fs.mkdirSync(getDataDir(), { recursive: true });
      fs.writeFileSync(dataFilePath(), raw);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('data:info', () => ({
    dir: getDataDir(),
    isDefault: getDataDir() === app.getPath('userData'),
  }));

  ipcMain.handle('data:open-dir', () => shell.openPath(getDataDir()));

  ipcMain.handle('data:choose-dir', async () => {
    const win = getWin();
    const res = await dialog.showOpenDialog(win, {
      title: 'Папка синхронизации данных',
      buttonLabel: 'Выбрать',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    const cfg = readConfig();
    cfg.dataDir = res.filePaths[0];
    writeConfig(cfg);
    let data = null;
    try {
      data = fs.readFileSync(dataFilePath(), 'utf8');
    } catch {}
    watchDataDir(win);
    return { path: res.filePaths[0], hasFile: data != null, data };
  });
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // внешние ссылки открываем в системном браузере, а не в окне приложения
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  watchDataDir(mainWindow);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpc(() => mainWindow);
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
