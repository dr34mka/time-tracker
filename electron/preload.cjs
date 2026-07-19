const { contextBridge, ipcRenderer } = require('electron');

// Мост между рендерером и файловым хранилищем в главном процессе
contextBridge.exposeInMainWorld('desktop', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (raw) => ipcRenderer.invoke('data:save', raw),
  getInfo: () => ipcRenderer.invoke('data:info'),
  openDataDir: () => ipcRenderer.invoke('data:open-dir'),
  chooseDataDir: () => ipcRenderer.invoke('data:choose-dir'),
  onExternalChange: (cb) => {
    ipcRenderer.on('data:external-change', (_event, raw) => cb(raw));
  },
});
