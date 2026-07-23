const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  nativeTheme,
  screen,
  shell,
  ipcMain,
  dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');

/* ===== Файловое хранилище данных =====
   Данные лежат в JSON-файле. По умолчанию — в userData;
   пользователь может выбрать любую папку (например, Dropbox/Google Drive) —
   тогда файл синхронизируется между компьютерами силами облака. */

const DATA_FILE_NAME = 'time-tracker-data.json';

/* Пакет переименован time-tracker-pro → time-tracker, а от имени пакета
   зависит папка userData. Однократно перетаскиваем данные из старой папки. */
function migrateLegacyUserData() {
  try {
    const dir = app.getPath('userData');
    const legacy = path.join(path.dirname(dir), 'time-tracker-pro');
    if (!fs.existsSync(legacy)) return;
    fs.mkdirSync(dir, { recursive: true });
    for (const name of ['config.json', DATA_FILE_NAME]) {
      const from = path.join(legacy, name);
      const to = path.join(dir, name);
      if (fs.existsSync(from) && !fs.existsSync(to)) fs.copyFileSync(from, to);
    }
  } catch {}
}

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

/** Путь в папке загрузок без перезаписи: report.pdf, report (1).pdf, ... */
function uniqueDownloadPath(dir, base, ext) {
  let candidate = path.join(dir, `${base}${ext}`);
  for (let n = 1; fs.existsSync(candidate); n++) {
    candidate = path.join(dir, `${base} (${n})${ext}`);
  }
  return candidate;
}

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

  // рендер HTML-отчёта в PDF и сохранение в Загрузки — без диалога печати
  // и без диалога сохранения, как обычная скачанная ссылка (a[download])
  ipcMain.handle('pdf:save', async (_e, html, filename) => {
    const win = new BrowserWindow({ show: false });
    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        pageSize: 'A4',
      });
      const dir = app.getPath('downloads');
      const base = filename.replace(/\.pdf$/i, '');
      const dest = uniqueDownloadPath(dir, base, '.pdf');
      fs.writeFileSync(dest, pdf);
      return { ok: true, path: dest };
    } catch (err) {
      return { ok: false, error: String(err) };
    } finally {
      win.destroy();
    }
  });
}

let mainWindow = null;
let isQuitting = false;

/* ===== Меню-бар: иконка с таймером и popover =====
   Рендерер главного окна шлёт снапшот таймера ('tray:state'), главный процесс
   сам тикает раз в секунду и обновляет текст рядом с иконкой. Клик по иконке —
   компактный popover под меню-баром с паузой/стопом и переходом в приложение. */

const POPOVER_WIDTH = 300;

let tray = null;
let popover = null;
let traySnapshot = { theme: 'dark', timer: null };
let trayTick = null;
let lastPopoverHide = 0;
let popoverFade = null;

/** Плавная смена прозрачности окна popover'а (ease-out cubic) */
function fadePopover(to, ms, done) {
  if (!popover || popover.isDestroyed()) return;
  if (popoverFade) clearInterval(popoverFade);
  const from = popover.getOpacity();
  const start = Date.now();
  popoverFade = setInterval(() => {
    if (!popover || popover.isDestroyed()) {
      clearInterval(popoverFade);
      popoverFade = null;
      return;
    }
    const t = Math.min(1, (Date.now() - start) / ms);
    popover.setOpacity(from + (to - from) * (1 - (1 - t) ** 3));
    if (t >= 1) {
      clearInterval(popoverFade);
      popoverFade = null;
      if (done) done();
    }
  }, 16);
}

function hidePopover() {
  if (!popover || popover.isDestroyed() || !popover.isVisible()) return;
  lastPopoverHide = Date.now();
  fadePopover(0, 120, () => {
    if (popover && !popover.isDestroyed()) popover.hide();
  });
}

function trayIcon(name) {
  return nativeImage.createFromPath(path.join(__dirname, 'assets', `tray${name}Template.png`));
}

function formatTrayClock(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function timerElapsedMs(t, now) {
  return t.accumulatedMs + (t.running ? Math.max(0, now - t.startedAt) : 0);
}

function updateTray() {
  if (!tray) return;
  const t = traySnapshot.timer;
  if (!t) {
    tray.setImage(trayIcon('Idle'));
    tray.setTitle('');
    tray.setToolTip('Time Tracker — таймер не запущен');
    return;
  }
  tray.setImage(trayIcon(t.running ? 'Run' : 'Pause'));
  tray.setTitle(` ${formatTrayClock(timerElapsedMs(t, Date.now()))}`, {
    fontType: 'monospacedDigit',
  });
  tray.setToolTip(`${t.projectName} — ${t.taskTitle}`);
}

function syncTrayTick() {
  const shouldTick = Boolean(traySnapshot.timer?.running);
  if (shouldTick && !trayTick) trayTick = setInterval(updateTray, 1000);
  if (!shouldTick && trayTick) {
    clearInterval(trayTick);
    trayTick = null;
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

function createPopover() {
  popover = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: 178,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    roundedCorners: true,
    vibrancy: 'popover',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    hiddenInMissionControl: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // поверх всего и во всех рабочих пространствах, включая fullscreen-приложения
  popover.setAlwaysOnTop(true, 'pop-up-menu');
  popover.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  popover.on('blur', hidePopover);

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    popover.loadURL(new URL('popover.html', devUrl).toString());
  } else {
    popover.loadFile(path.join(__dirname, '../dist/popover.html'));
  }
}

function togglePopover(trayBounds) {
  if (!popover || popover.isDestroyed()) createPopover();
  if (popover.isVisible()) {
    hidePopover();
    return;
  }
  // клик по иконке при открытом popover'е: blur уже спрятал окно —
  // не открываем его тут же заново
  if (Date.now() - lastPopoverHide < 300) return;
  // по центру под иконкой трея, не вылезая за край экрана
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const work = display.workArea;
  const [w] = popover.getSize();
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - w / 2);
  x = Math.min(Math.max(x, work.x + 8), work.x + work.width - w - 8);
  const y = Math.round(trayBounds.y + trayBounds.height + 5);
  popover.setPosition(x, y, false);
  // мягкое появление: окно показываем прозрачным и растворяем внутрь
  popover.setOpacity(0);
  popover.show();
  popover.webContents.send('popover:shown');
  fadePopover(1, 180);
}

function createTray() {
  tray = new Tray(trayIcon('Idle'));
  tray.setIgnoreDoubleClickEvents(true);
  tray.on('click', (_event, bounds) => togglePopover(bounds));
  tray.on('right-click', () => {
    tray.popUpContextMenu(
      Menu.buildFromTemplate([
        { label: 'Открыть Time Tracker', click: showMainWindow },
        { type: 'separator' },
        { label: 'Завершить', role: 'quit' },
      ]),
    );
  });
  updateTray();
}

function registerTrayIpc() {
  ipcMain.on('tray:state', (_e, snapshot) => {
    traySnapshot = snapshot;
    nativeTheme.themeSource = snapshot.theme; // vibrancy popover'а следует теме приложения
    updateTray();
    syncTrayTick();
    if (popover && !popover.isDestroyed()) {
      popover.webContents.send('tray:state-push', snapshot);
    }
  });

  ipcMain.handle('tray:get-state', () => traySnapshot);

  // команды из popover'а исполняет рендерер главного окна (там живёт стор)
  ipcMain.on('popover:command', (_e, cmd) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer:command', cmd);
    }
  });

  ipcMain.on('popover:open-app', () => {
    hidePopover();
    showMainWindow();
  });

  ipcMain.on('popover:hide', hidePopover);

  ipcMain.on('popover:resize', (_e, height) => {
    if (popover && !popover.isDestroyed()) {
      const [x, y] = popover.getPosition();
      popover.setBounds({ x, y, width: POPOVER_WIDTH, height: Math.round(height) });
    }
  });
}

/* ===== Проверка обновлений (уведомление, без авто-установки) =====
   Раз за запуск смотрим последний релиз на GitHub. Если версия новее —
   показываем баннер в окне; «Скачать» открывает нужный файл (dmg/exe)
   в браузере, установка вручную. Полное авто-обновление на macOS
   потребовало бы подписи Apple Developer ID — здесь сознательно проще. */

// ВАЖНО: укажите ваш реальный GitHub-логин и имя репозитория.
// Пусто — проверка обновлений выключена (ошибок не будет).
const UPDATE_OWNER = 'dr34mka';
const UPDATE_REPO = 'time-tracker';

let latestUpdate = null;

function parseVer(v) {
  return String(v)
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}
function isNewerVersion(remote, local) {
  const a = parseVer(remote);
  const b = parseVer(local);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

/** Выбрать подходящий установщик под текущую платформу/архитектуру */
function pickUpdateAsset(assets) {
  const ext = process.platform === 'darwin' ? '.dmg' : '.exe';
  const matches = assets.filter((a) => a.name.toLowerCase().endsWith(ext));
  if (process.platform === 'darwin') {
    const arm = matches.find((a) => a.name.toLowerCase().includes('arm64'));
    const x64 = matches.find((a) => !a.name.toLowerCase().includes('arm64'));
    return (process.arch === 'arm64' ? arm : x64) || matches[0] || null;
  }
  return matches[0] || null;
}

function checkForUpdates() {
  if (!UPDATE_OWNER || !UPDATE_REPO) return;
  require('https')
    .get(
      {
        host: 'api.github.com',
        path: `/repos/${UPDATE_OWNER}/${UPDATE_REPO}/releases/latest`,
        headers: { 'User-Agent': 'time-tracker', Accept: 'application/vnd.github+json' },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return;
        }
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const rel = JSON.parse(body);
            const tag = rel.tag_name || rel.name;
            if (!tag || !isNewerVersion(tag, app.getVersion())) return;
            const asset = pickUpdateAsset(rel.assets || []);
            latestUpdate = {
              version: String(tag).replace(/^v/, ''),
              notesUrl: rel.html_url,
              downloadUrl: asset ? asset.browser_download_url : rel.html_url,
            };
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('update:available', latestUpdate);
            }
          } catch {}
        });
      },
    )
    .on('error', () => {});
}

function registerUpdateIpc() {
  ipcMain.handle('update:get', () => latestUpdate);
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.on('update:download', () => {
    if (latestUpdate) shell.openExternal(latestUpdate.downloadUrl);
  });
}

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

  // macOS: закрытие окна прячет его — приложение (таймер, трей) живёт дальше
  mainWindow.on('close', (e) => {
    if (process.platform === 'darwin' && !isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  watchDataDir(mainWindow);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    migrateLegacyUserData();
    registerIpc(() => mainWindow);
    registerTrayIpc();
    registerUpdateIpc();
    createWindow();
    if (process.platform === 'darwin') createTray();
    // не мешаем старту: проверяем обновления чуть погодя
    setTimeout(checkForUpdates, 4000);
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    showMainWindow();
  });
}
