import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ai: {
    setApiKey: (key: string) => ipcRenderer.invoke('ai:set-api-key', key),
    getApiKey: () => ipcRenderer.invoke('ai:get-api-key'),
    setModel: (model: string) => ipcRenderer.invoke('ai:set-model', model),
    getModel: () => ipcRenderer.invoke('ai:get-model'),
    summarize: (html: string, url: string) => ipcRenderer.invoke('ai:summarize', html, url),
    chat: (message: string, pageContext: string, history: Array<{ role: string; content: string }>) =>
      ipcRenderer.invoke('ai:chat', message, pageContext, history),
    onStreamChunk: (callback: (chunk: string) => void) => {
      const listener = (_event: any, chunk: string) => callback(chunk);
      ipcRenderer.on('ai:stream-chunk', listener);
      return () => ipcRenderer.removeListener('ai:stream-chunk', listener);
    },
    onStreamEnd: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('ai:stream-end', listener);
      return () => ipcRenderer.removeListener('ai:stream-end', listener);
    },
    captureTab: () => ipcRenderer.invoke('ai:capture-tab'),
    chatWithImage: (message: string, imageBase64: string, pageContext: string, history: Array<{ role: string; content: string }>, memory: string) =>
      ipcRenderer.invoke('ai:chat-with-image', message, imageBase64, pageContext, history, memory),
  },
  db: {
    getProfile: () => ipcRenderer.invoke('db:get-profile'),
    updateProfile: (data: any) => ipcRenderer.invoke('db:update-profile', data),
    pickAvatar: () => ipcRenderer.invoke('db:pick-avatar'),
    getAvatarDataUrl: () => ipcRenderer.invoke('db:get-avatar-data-url'),
    getBookmarks: () => ipcRenderer.invoke('db:get-bookmarks'),
    addBookmark: (url: string, title: string, favicon: string) => ipcRenderer.invoke('db:add-bookmark', url, title, favicon),
    removeBookmark: (url: string) => ipcRenderer.invoke('db:remove-bookmark', url),
    isBookmarked: (url: string) => ipcRenderer.invoke('db:is-bookmarked', url),
    getHistory: (limit?: number) => ipcRenderer.invoke('db:get-history', limit),
    addHistory: (url: string, title: string, favicon: string) => ipcRenderer.invoke('db:add-history', url, title, favicon),
    clearHistory: () => ipcRenderer.invoke('db:clear-history'),
    searchHistory: (query: string, limit?: number) => ipcRenderer.invoke('db:search-history', query, limit),
    getShortcuts: () => ipcRenderer.invoke('db:get-shortcuts'),
    addShortcut: (url: string, title: string, favicon: string) => ipcRenderer.invoke('db:add-shortcut', url, title, favicon),
    removeShortcut: (url: string) => ipcRenderer.invoke('db:remove-shortcut', url),
    getZoomLevel: (domain: string) => ipcRenderer.invoke('db:get-zoom', domain),
    setZoomLevel: (domain: string, level: number) => ipcRenderer.invoke('db:set-zoom', domain, level),
    exportToFile: () => ipcRenderer.invoke('db:export-to-file'),
    importFromFile: () => ipcRenderer.invoke('db:import-from-file'),
    clearAll: () => ipcRenderer.invoke('db:clear-all'),
    migrateLocalStorage: (data: any) => ipcRenderer.invoke('db:migrate-localstorage', data),
    chatCreate: (title?: string) => ipcRenderer.invoke('db:chat-create', title),
    chatList: (limit?: number) => ipcRenderer.invoke('db:chat-list', limit),
    chatMessages: (conversationId: number) => ipcRenderer.invoke('db:chat-messages', conversationId),
    chatAddMessage: (conversationId: number, role: string, content: string) => ipcRenderer.invoke('db:chat-add-message', conversationId, role, content),
    chatUpdateTitle: (conversationId: number, title: string) => ipcRenderer.invoke('db:chat-update-title', conversationId, title),
    chatDelete: (conversationId: number) => ipcRenderer.invoke('db:chat-delete', conversationId),
    chatMemory: (excludeId?: number) => ipcRenderer.invoke('db:chat-memory', excludeId),
  },
  downloads: {
    openFile: (filePath: string) => ipcRenderer.invoke('download:open-file', filePath),
    openFolder: (filePath: string) => ipcRenderer.invoke('download:open-folder', filePath),
    onStarted: (callback: (item: any) => void) => {
      const listener = (_e: any, item: any) => callback(item);
      ipcRenderer.on('download:started', listener);
      return () => ipcRenderer.removeListener('download:started', listener);
    },
    onProgress: (callback: (item: any) => void) => {
      const listener = (_e: any, item: any) => callback(item);
      ipcRenderer.on('download:progress', listener);
      return () => ipcRenderer.removeListener('download:progress', listener);
    },
    onDone: (callback: (item: any) => void) => {
      const listener = (_e: any, item: any) => callback(item);
      ipcRenderer.on('download:done', listener);
      return () => ipcRenderer.removeListener('download:done', listener);
    },
  },
  permissions: {
    onRequest: (callback: (data: { permission: string; origin: string }) => void) => {
      ipcRenderer.on('permission:request', (_e, data) => callback(data));
    },
    respond: (data: { granted: boolean; remember: boolean }) => ipcRenderer.send('permission:response', data),
    getSitePermissions: (origin: string) => ipcRenderer.invoke('db:get-site-permissions', origin),
    setSitePermission: (origin: string, permission: string, allowed: boolean) => ipcRenderer.invoke('db:set-site-permission', origin, permission, allowed),
    clearSitePermissions: (origin?: string) => ipcRenderer.invoke('db:clear-site-permissions', origin),
  },
  certificate: {
    onError: (callback: (url: string) => void) => {
      ipcRenderer.on('certificate:error', (_e, url) => callback(url));
    },
    respond: (proceed: boolean) => ipcRenderer.send('certificate:response', proceed),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    installUpdate: () => ipcRenderer.invoke('updater:install'),
    onAvailable: (callback: (info: any) => void) => {
      const listener = (_e: any, info: any) => callback(info);
      ipcRenderer.on('updater:available', listener);
      return () => ipcRenderer.removeListener('updater:available', listener);
    },
    onNotAvailable: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('updater:not-available', listener);
      return () => ipcRenderer.removeListener('updater:not-available', listener);
    },
    onProgress: (callback: (progress: any) => void) => {
      const listener = (_e: any, progress: any) => callback(progress);
      ipcRenderer.on('updater:progress', listener);
      return () => ipcRenderer.removeListener('updater:progress', listener);
    },
    onDownloaded: (callback: (info: any) => void) => {
      const listener = (_e: any, info: any) => callback(info);
      ipcRenderer.on('updater:downloaded', listener);
      return () => ipcRenderer.removeListener('updater:downloaded', listener);
    },
    onError: (callback: (message: string) => void) => {
      const listener = (_e: any, message: string) => callback(message);
      ipcRenderer.on('updater:error', listener);
      return () => ipcRenderer.removeListener('updater:error', listener);
    },
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
  },
  onMenuAction: (callback: (action: string, ...args: any[]) => void) => {
    ipcRenderer.on('menu:action', (_event, action: string, ...args: any[]) => callback(action, ...args));
  },
});
