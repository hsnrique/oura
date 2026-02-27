export { };

declare global {
  interface Window {
    electronAPI: {
      ai: {
        setApiKey: (key: string) => Promise<boolean>;
        getApiKey: () => Promise<string | null>;
        summarize: (html: string, url: string) => Promise<{ result?: string; error?: string }>;
        chat: (message: string, pageContext: string, history: Array<{ role: string; content: string }>) => Promise<{ result?: string; error?: string }>;
        onStreamChunk: (callback: (chunk: string) => void) => () => void;
        onStreamEnd: (callback: () => void) => () => void;
      };
      db: {
        getProfile: () => Promise<any>;
        updateProfile: (data: any) => Promise<void>;
        pickAvatar: () => Promise<string | null>;
        getAvatarDataUrl: () => Promise<string | null>;
        getBookmarks: () => Promise<any[]>;
        addBookmark: (url: string, title: string, favicon: string) => Promise<void>;
        removeBookmark: (url: string) => Promise<void>;
        isBookmarked: (url: string) => Promise<boolean>;
        getHistory: (limit?: number) => Promise<any[]>;
        addHistory: (url: string, title: string, favicon: string) => Promise<void>;
        clearHistory: () => Promise<void>;
        searchHistory: (query: string, limit?: number) => Promise<any[]>;
        getShortcuts: () => Promise<any[]>;
        addShortcut: (url: string, title: string, favicon: string) => Promise<void>;
        removeShortcut: (url: string) => Promise<void>;
        getZoomLevel: (domain: string) => Promise<number>;
        setZoomLevel: (domain: string, level: number) => Promise<void>;
        exportToFile: () => Promise<boolean>;
        importFromFile: () => Promise<boolean>;
        clearAll: () => Promise<void>;
        migrateLocalStorage: (data: any) => Promise<void>;
      };
      downloads: {
        openFile: (filePath: string) => Promise<void>;
        openFolder: (filePath: string) => Promise<void>;
        onStarted: (callback: (item: DownloadInfo) => void) => () => void;
        onProgress: (callback: (item: DownloadInfo) => void) => () => void;
        onDone: (callback: (item: DownloadInfo) => void) => () => void;
      };
      permissions: {
        onRequest: (callback: (permission: string) => void) => void;
        respond: (granted: boolean) => void;
      };
      certificate: {
        onError: (callback: (url: string) => void) => void;
        respond: (proceed: boolean) => void;
      };
      shell: {
        openExternal: (url: string) => Promise<void>;
      };
      updater: {
        checkForUpdates: () => Promise<void>;
        installUpdate: () => Promise<void>;
        onAvailable: (callback: (info: { version: string; releaseDate: string }) => void) => () => void;
        onNotAvailable: (callback: () => void) => () => void;
        onProgress: (callback: (progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => void) => () => void;
        onDownloaded: (callback: (info: { version: string; releaseDate: string }) => void) => () => void;
        onError: (callback: (message: string) => void) => () => void;
      };
      app: {
        getVersion: () => Promise<string>;
      };
      onMenuAction: (callback: (action: string) => void) => void;
    };
  }
}

export interface DownloadInfo {
  id: string;
  filename: string;
  path: string;
  totalBytes: number;
  receivedBytes: number;
  state: string;
}

export interface Tab {
  id: string;
  title: string;
  url: string;
  webview: HTMLElement | null;
  isLoading: boolean;
  favicon: string;
  pinned: boolean;
}

export interface HistoryEntry {
  url: string;
  title: string;
  timestamp: number;
  favicon: string;
}

export interface Shortcut {
  url: string;
  title: string;
  favicon: string;
}

export interface Bookmark {
  url: string;
  title: string;
  favicon: string;
}

export const SEARCH_URLS: Record<string, string> = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  bing: 'https://www.bing.com/search?q=',
  brave: 'https://search.brave.com/search?q=',
};

export interface BrowserState {
  tabs: Tab[];
  activeTabId: string | null;
  chatHistory: Array<{ role: string; content: string }>;
  isStreaming: boolean;
  removeChunkListener: (() => void) | null;
  removeEndListener: (() => void) | null;
  history: HistoryEntry[];
  shortcuts: Shortcut[];
  bookmarks: Bookmark[];
  commandPaletteIndex: number;
  autocompleteIndex: number;
  contextMenuTabId: string | null;
  animationFrame: number | null;
  profile: any;
  searchEngine: string;
}
