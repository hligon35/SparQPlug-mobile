import { app, BrowserWindow, ipcMain, shell, nativeTheme, Menu, type MenuItemConstructorOptions } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';

const isDev = process.env['NODE_ENV'] === 'development' || !!process.env['VITE_DEV_SERVER_URL'];
const DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'] ?? 'http://localhost:5173';

let mainWindow: BrowserWindow | null = null;

function navigateInApp(pathname: string) {
  if (!mainWindow) return;

  const escapedPath = JSON.stringify(pathname);
  const script = `
    (() => {
      if (window.location.pathname !== ${escapedPath}) {
        window.history.pushState({}, '', ${escapedPath});
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    })();
  `;

  void mainWindow.webContents.executeJavaScript(script, true);
}

function setupMenu() {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'View',
      submenu: [
        {
          label: 'Network Ops',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => navigateInApp('/network-ops'),
        },
        {
          label: 'Network Ops Guide',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => navigateInApp('/network-ops/guide'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    backgroundColor: '#0a0f1e',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../web/index.html'));
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  setupMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('app:platform', () => process.platform);

ipcMain.handle('theme:get', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

// ─── Auto updater ─────────────────────────────────────────────────────────────

autoUpdater.on('update-available', () => {
  mainWindow?.webContents.send('updater:update-available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('updater:update-downloaded');
});

ipcMain.on('updater:install', () => {
  autoUpdater.quitAndInstall();
});
