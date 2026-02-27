import { app, BrowserWindow, ipcMain, session, Menu, MenuItemConstructorOptions, dialog, shell, webContents, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AIService } from './ai-service';
import * as database from './database';
import { initAutoUpdater, checkForUpdates, installUpdate } from './auto-updater';

function sendToRenderer(channel: string, ...args: any[]) {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.webContents.send(channel, ...args);
}

function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: 'Oura',
      submenu: [
        { role: 'about' as const, label: 'About Oura' },
        { type: 'separator' as const },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendToRenderer('menu:action', 'settings'),
        },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const, label: 'Hide Oura' },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const, label: 'Quit Oura' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => sendToRenderer('menu:action', 'new-tab'),
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendToRenderer('menu:action', 'close-tab'),
        },
        {
          label: 'Reopen Closed Tab',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => sendToRenderer('menu:action', 'reopen-tab'),
        },
        { type: 'separator' as const },
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => createWindow(),
        },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
        { type: 'separator' as const },
        {
          label: 'Find on Page',
          accelerator: 'CmdOrCtrl+F',
          click: () => sendToRenderer('menu:action', 'find'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload Page',
          accelerator: 'CmdOrCtrl+R',
          click: () => sendToRenderer('menu:action', 'reload'),
        },
        {
          label: 'Hard Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => sendToRenderer('menu:action', 'hard-reload'),
        },
        { type: 'separator' as const },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => sendToRenderer('menu:action', 'zoom-in'),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => sendToRenderer('menu:action', 'zoom-out'),
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => sendToRenderer('menu:action', 'zoom-reset'),
        },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
        { type: 'separator' as const },
        {
          label: 'Developer Tools',
          accelerator: 'CmdOrCtrl+Alt+I',
          click: () => sendToRenderer('menu:action', 'toggle-devtools'),
        },
        { type: 'separator' as const },
        {
          label: 'Downloads',
          click: () => sendToRenderer('menu:action', 'show-downloads'),
        },
        {
          label: 'History',
          accelerator: 'CmdOrCtrl+Y',
          click: () => sendToRenderer('menu:action', 'show-history'),
        },
        { type: 'separator' as const },
        {
          label: 'Toggle AI Panel',
          accelerator: 'CmdOrCtrl+J',
          click: () => sendToRenderer('menu:action', 'toggle-ai'),
        },
        { type: 'separator' as const },
        {
          label: 'Toggle Bookmarks Bar',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => sendToRenderer('menu:action', 'toggle-bookmarks-bar'),
        },
        {
          label: 'Command Palette',
          accelerator: 'CmdOrCtrl+K',
          click: () => sendToRenderer('menu:action', 'command-palette'),
        },
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Back',
          accelerator: 'CmdOrCtrl+[',
          click: () => sendToRenderer('menu:action', 'go-back'),
        },
        {
          label: 'Forward',
          accelerator: 'CmdOrCtrl+]',
          click: () => sendToRenderer('menu:action', 'go-forward'),
        },
        { type: 'separator' as const },
        {
          label: 'Focus URL Bar',
          accelerator: 'CmdOrCtrl+L',
          click: () => sendToRenderer('menu:action', 'focus-url'),
        },
        { type: 'separator' as const },
        {
          label: 'Next Tab',
          accelerator: 'Ctrl+Tab',
          click: () => sendToRenderer('menu:action', 'next-tab'),
        },
        {
          label: 'Previous Tab',
          accelerator: 'Ctrl+Shift+Tab',
          click: () => sendToRenderer('menu:action', 'prev-tab'),
        },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
        ] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => checkForUpdates(),
        },
        { type: 'separator' as const },
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => sendToRenderer('menu:action', 'shortcuts-help'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

let mainWindow: BrowserWindow | null = null;
let aiService: AIService | null = null;

interface DownloadItem {
  id: string;
  filename: string;
  path: string;
  totalBytes: number;
  receivedBytes: number;
  state: string;
}
const activeDownloads = new Map<string, DownloadItem>();

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

function loadConfig(): { apiKey?: string } {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch { }
  return {};
}

function saveConfig(config: { apiKey?: string }) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function readAvatarAsDataUrl(filePath: string): string | null {
  try {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    const buffer = fs.readFileSync(filePath);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isOwnPage =
      details.url.startsWith('http://localhost:5173') ||
      details.url.startsWith('file://');

    if (isOwnPage) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https: http:; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "img-src 'self' data: file: https: http:;"
          ],
        },
      });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ['clipboard-read', 'clipboard-sanitized-write', 'pointerLock', 'fullscreen', 'hid', 'usb'];
    if (allowed.includes(permission)) { callback(true); return; }
    if (mainWindow) {
      mainWindow.webContents.send('permission:request', permission);
      ipcMain.once('permission:response', (_e, granted: boolean) => callback(granted));
    } else {
      callback(false);
    }
  });

  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    const allowed = ['hid', 'usb'];
    return allowed.includes(permission);
  });

  session.defaultSession.on('will-download', (_event, item) => {
    const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const filename = item.getFilename();
    const savePath = path.join(app.getPath('downloads'), filename);
    item.setSavePath(savePath);

    const dlItem: DownloadItem = { id, filename, path: savePath, totalBytes: item.getTotalBytes(), receivedBytes: 0, state: 'progressing' };
    activeDownloads.set(id, dlItem);
    sendToRenderer('download:started', dlItem);

    item.on('updated', (_e, state) => {
      dlItem.receivedBytes = item.getReceivedBytes();
      dlItem.totalBytes = item.getTotalBytes();
      dlItem.state = state;
      sendToRenderer('download:progress', dlItem);
    });

    item.once('done', (_e, state) => {
      dlItem.state = state;
      dlItem.receivedBytes = dlItem.totalBytes;
      sendToRenderer('download:done', dlItem);
      activeDownloads.delete(id);
    });
  });

  app.on('certificate-error', (event, _wc, url, _error, _cert, callback) => {
    event.preventDefault();
    if (mainWindow) {
      mainWindow.webContents.send('certificate:error', url);
      ipcMain.once('certificate:response', (_e, proceed: boolean) => callback(proceed));
    } else {
      callback(false);
    }
  });
}

function setupIPC() {
  ipcMain.handle('ai:set-api-key', async (_event, apiKey: string) => {
    saveConfig({ apiKey });
    aiService = new AIService(apiKey);
    return true;
  });

  ipcMain.handle('ai:get-api-key', async () => {
    const config = loadConfig();
    if (config.apiKey) {
      aiService = new AIService(config.apiKey);
    }
    return config.apiKey || null;
  });

  ipcMain.handle('ai:summarize', async (event, html: string, url: string) => {
    if (!aiService) return { error: 'API key not set' };
    try {
      let result = '';
      for await (const chunk of aiService.summarizePage(html, url)) {
        result += chunk;
        event.sender.send('ai:stream-chunk', chunk);
      }
      event.sender.send('ai:stream-end');
      return { result };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('ai:chat', async (event, message: string, pageContext: string, history: Array<{ role: string; content: string }>) => {
    if (!aiService) return { error: 'API key not set' };
    try {
      let result = '';
      for await (const chunk of aiService.chat(message, pageContext, history)) {
        result += chunk;
        event.sender.send('ai:stream-chunk', chunk);
      }
      event.sender.send('ai:stream-end');
      return { result };
    } catch (err: any) {
      return { error: err.message };
    }
  });

  ipcMain.handle('db:get-profile', () => database.getProfile());
  ipcMain.handle('db:update-profile', (_e, data) => database.updateProfile(data));

  ipcMain.handle('db:pick-avatar', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const saved = database.saveAvatarFile(result.filePaths[0]);
    database.updateProfile({ avatar_path: saved });
    return readAvatarAsDataUrl(saved);
  });

  ipcMain.handle('db:get-avatar-data-url', () => {
    const profile = database.getProfile() as any;
    if (!profile?.avatar_path) return null;
    return readAvatarAsDataUrl(profile.avatar_path);
  });

  ipcMain.handle('db:get-bookmarks', () => database.getBookmarks());
  ipcMain.handle('db:add-bookmark', (_e, url, title, favicon) => database.addBookmark(url, title, favicon));
  ipcMain.handle('db:remove-bookmark', (_e, url) => database.removeBookmark(url));
  ipcMain.handle('db:is-bookmarked', (_e, url) => database.isBookmarked(url));

  ipcMain.handle('db:get-history', (_e, limit) => database.getHistory(limit));
  ipcMain.handle('db:add-history', (_e, url, title, favicon) => database.addHistory(url, title, favicon));
  ipcMain.handle('db:clear-history', () => database.clearHistory());
  ipcMain.handle('db:search-history', (_e, query, limit) => database.searchHistory(query, limit));

  ipcMain.handle('db:get-shortcuts', () => database.getShortcuts());
  ipcMain.handle('db:add-shortcut', (_e, url, title, favicon) => database.addShortcut(url, title, favicon));
  ipcMain.handle('db:remove-shortcut', (_e, url) => database.removeShortcut(url));

  ipcMain.handle('db:get-zoom', (_e, domain) => database.getZoomLevel(domain));
  ipcMain.handle('db:set-zoom', (_e, domain, level) => database.setZoomLevel(domain, level));

  ipcMain.handle('db:export-data', () => database.exportData());
  ipcMain.handle('db:import-data', (_e, data) => database.importData(data));
  ipcMain.handle('db:clear-all', () => database.clearAllData());
  ipcMain.handle('db:migrate-localstorage', (_e, data) => database.migrateFromLocalStorage(data));

  ipcMain.handle('db:export-to-file', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return false;
    const result = await dialog.showSaveDialog(win, {
      defaultPath: `oura-backup-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return false;
    const data = database.exportData();
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
    return true;
  });

  ipcMain.handle('db:import-from-file', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return false;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths[0]) return false;
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    database.importData(JSON.parse(raw));
    return true;
  });

  ipcMain.handle('download:open-file', (_e, filePath: string) => {
    shell.openPath(filePath);
  });

  ipcMain.handle('download:open-folder', (_e, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle('shell:open-external', (_e, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.handle('updater:check', () => checkForUpdates());
  ipcMain.handle('updater:install', () => installUpdate());
  ipcMain.handle('app:get-version', () => app.getVersion());
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const iconCandidates = [
      path.join(__dirname, '..', '..', 'src', 'renderer', 'assets', 'logo.png'),
      path.join(__dirname, '..', '..', 'build', 'icon.png'),
      path.join(__dirname, '..', 'renderer', 'assets', 'logo.png'),
    ];
    const iconPath = iconCandidates.find(p => fs.existsSync(p));
    if (iconPath) {
      app.dock.setIcon(nativeImage.createFromPath(iconPath));
    }
  }

  database.initDatabase();
  app.name = 'Oura';
  buildMenu();
  setupIPC();
  createWindow();

  if (app.isPackaged) {
    initAutoUpdater();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
