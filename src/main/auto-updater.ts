import { autoUpdater, UpdateInfo } from 'electron-updater';
import { app, BrowserWindow } from 'electron';

let mainWindow: BrowserWindow | null = null;

function sendToAllWindows(channel: string, ...args: any[]) {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send(channel, ...args);
  });
}

export function initAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
    sendToAllWindows('updater:checking');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log(`[AutoUpdater] Update available: ${info.version}`);
    sendToAllWindows('updater:available', {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] No updates available.');
    sendToAllWindows('updater:not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[AutoUpdater] Download: ${Math.round(progress.percent)}%`);
    sendToAllWindows('updater:progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log(`[AutoUpdater] Update downloaded: ${info.version}`);
    sendToAllWindows('updater:downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('[AutoUpdater] Error:', err.message);
    sendToAllWindows('updater:error', err.message);
  });

  setTimeout(() => {
    checkForUpdates();
  }, 10_000);
}

export function checkForUpdates() {
  autoUpdater.checkForUpdates().catch((err: Error) => {
    console.error('[AutoUpdater] Check failed:', err.message);
  });
}

export function installUpdate() {
  autoUpdater.autoInstallOnAppQuit = true;
  setImmediate(() => {
    app.removeAllListeners('window-all-closed');
    BrowserWindow.getAllWindows().forEach(w => w.destroy());
    autoUpdater.quitAndInstall(false, true);
  });
}
