import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // App info
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  getPlatform: (): Promise<string> => ipcRenderer.invoke('app:platform'),

  // Theme
  getNativeTheme: (): Promise<'light' | 'dark'> => ipcRenderer.invoke('theme:get'),

  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Auto updater
  onUpdateAvailable: (cb: () => void) => {
    ipcRenderer.on('updater:update-available', cb);
    return () => ipcRenderer.removeListener('updater:update-available', cb);
  },
  onUpdateDownloaded: (cb: () => void) => {
    ipcRenderer.on('updater:update-downloaded', cb);
    return () => ipcRenderer.removeListener('updater:update-downloaded', cb);
  },
  installUpdate: () => ipcRenderer.send('updater:install'),
});
