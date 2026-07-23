const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, cb) {
  const handler = (_event, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// Мост между рендерером и главным процессом
contextBridge.exposeInMainWorld('desktop', {
  // файловое хранилище
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (raw) => ipcRenderer.invoke('data:save', raw),
  getInfo: () => ipcRenderer.invoke('data:info'),
  openDataDir: () => ipcRenderer.invoke('data:open-dir'),
  chooseDataDir: () => ipcRenderer.invoke('data:choose-dir'),
  savePdf: (html, filename) => ipcRenderer.invoke('pdf:save', html, filename),
  onExternalChange: (cb) => {
    ipcRenderer.on('data:external-change', (_event, raw) => cb(raw));
  },

  // трей (главное окно → меню-бар)
  setTrayState: (snapshot) => ipcRenderer.send('tray:state', snapshot),
  onTimerCommand: (cb) => subscribe('timer:command', cb),

  // popover меню-бара
  getTrayState: () => ipcRenderer.invoke('tray:get-state'),
  onTrayState: (cb) => subscribe('tray:state-push', cb),
  onPopoverShown: (cb) => subscribe('popover:shown', cb),
  popoverCommand: (cmd) => ipcRenderer.send('popover:command', cmd),
  popoverResize: (height) => ipcRenderer.send('popover:resize', height),
  popoverHide: () => ipcRenderer.send('popover:hide'),
  openApp: () => ipcRenderer.send('popover:open-app'),

  // обновления (уведомление + ссылка на скачивание)
  getUpdate: () => ipcRenderer.invoke('update:get'),
  onUpdateAvailable: (cb) => subscribe('update:available', cb),
  downloadUpdate: () => ipcRenderer.send('update:download'),
  appVersion: () => ipcRenderer.invoke('app:version'),
});
