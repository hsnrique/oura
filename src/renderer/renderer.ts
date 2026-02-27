import './modules/types';
import type { BrowserState } from './modules/types';
import * as tabs from './modules/tabs';
import * as nav from './modules/navigation';
import * as welcome from './modules/welcome';
import * as ai from './modules/ai-panel';
import * as cmd from './modules/command-palette';
import * as find from './modules/find-bar';
import * as onboarding from './modules/onboarding';
import * as settings from './modules/settings';
import * as downloads from './modules/downloads';
import * as history from './modules/history';
import * as bookmarksBar from './modules/bookmarks-bar';
import * as zoom from './modules/zoom';

const DEFAULT_SHORTCUTS = [
  { url: 'https://lirk.io', title: 'Lirk', favicon: 'https://lirk.io/assets/favicon.png' },
  { url: 'https://github.com', title: 'GitHub', favicon: 'https://github.com/favicon.ico' },
  { url: 'https://youtube.com', title: 'YouTube', favicon: 'https://www.youtube.com/favicon.ico' },
  { url: 'https://threads.com', title: 'Threads', favicon: 'https://www.threads.com/favicon.ico' },
];

class Browser {
  private s: BrowserState = {
    tabs: [],
    activeTabId: null,
    chatHistory: [],
    isStreaming: false,
    removeChunkListener: null,
    removeEndListener: null,
    history: [],
    shortcuts: [],
    bookmarks: [],
    commandPaletteIndex: 0,
    autocompleteIndex: -1,
    contextMenuTabId: null,
    animationFrame: null,
    profile: null,
    searchEngine: 'google',
    currentConversationId: null,
    screenCaptureEnabled: false,
  };

  private closedTabs: Array<{ url: string; title: string }> = [];

  constructor() {
    this.init();
  }

  private async init() {
    await this.loadPersisted();
    this.bindEvents();
    this.setupMenuActions();
    onboarding.setupOnboarding(this.s, () => this.updateGreeting());
    settings.setupSettings(this.s, {
      loadPersisted: () => this.loadPersisted(),
      renderShortcuts: () => this.renderShortcuts(),
      updateGreeting: () => this.updateGreeting(),
    });
    this.createTab();
    this.renderShortcuts();
    welcome.setupWelcomeCanvas(this.s);
    this.updateGreeting();
    find.setupFindBar(this.s);
    ai.setupAiResize();
    ai.initChatPanel(this.s);
    downloads.setupDownloads();
    downloads.setupPermissions();
    downloads.setupCertificateErrors();
    bookmarksBar.setupBookmarksBar(this.s, { navigate: (url) => this.navigate(url) });

    this.setupFullscreen();
    this.setupKeyboardShortcuts();
    this.setupExtraEvents();
    await onboarding.checkOnboarding(this.s);
    await ai.checkApiKey();
  }

  private async loadPersisted() {
    try {
      this.s.profile = await window.electronAPI.db.getProfile();
      this.s.searchEngine = this.s.profile?.search_engine || 'google';

      const dbShortcuts = await window.electronAPI.db.getShortcuts();
      if (dbShortcuts.length > 0) {
        this.s.shortcuts = dbShortcuts;
      } else {
        this.s.shortcuts = [...DEFAULT_SHORTCUTS];
        for (const sc of this.s.shortcuts) {
          await window.electronAPI.db.addShortcut(sc.url, sc.title, sc.favicon);
        }
      }

      this.s.bookmarks = await window.electronAPI.db.getBookmarks();
      const dbHistory = await window.electronAPI.db.getHistory(200);
      this.s.history = dbHistory.map((h: any) => ({
        url: h.url, title: h.title, favicon: h.favicon,
        timestamp: new Date(h.visited_at).getTime(),
      }));
    } catch (e) {
      console.error('Failed to load persisted data:', e);
    }
  }

  private addToHistory(url: string, title: string, favicon: string) {
    if (!url || url === '' || url.startsWith('about:')) return;
    this.s.history = this.s.history.filter(h => h.url !== url);
    this.s.history.unshift({ url, title, timestamp: Date.now(), favicon });
    window.electronAPI.db.addHistory(url, title, favicon);
  }

  private createTab(url?: string) {
    tabs.createTab(this.s, {
      renderTabs: () => this.renderTabs(),
      switchTab: (id) => this.switchTab(id),
      navigate: (u) => this.navigate(u),
    }, url);
  }

  private closeTab(id: string) {
    const tab = this.s.tabs.find(t => t.id === id);
    if (tab?.url) this.closedTabs.push({ url: tab.url, title: tab.title });
    tabs.closeTab(this.s, id, {
      createTab: () => this.createTab(),
      switchTab: (tid) => this.switchTab(tid),
      renderTabs: () => this.renderTabs(),
    });
  }

  private reopenClosedTab() {
    const last = this.closedTabs.pop();
    if (last) this.createTab(last.url);
  }

  private switchTab(id: string) {
    tabs.switchTab(this.s, id, {
      renderTabs: () => this.renderTabs(),
      updateNavButtons: () => nav.updateNavButtons(this.s),
      updateSecurityIndicator: () => nav.updateSecurityIndicator(this.s),
      updateBookmarkButton: () => nav.updateBookmarkButton(this.s),
      updateGreeting: () => this.updateGreeting(),
    });
  }

  private renderTabs() {
    tabs.renderTabs(this.s, {
      switchTab: (id) => this.switchTab(id),
      closeTab: (id) => this.closeTab(id),
      showTabContextMenu: (e, id) => this.showTabContextMenu(e, id),
    });
  }

  private showTabContextMenu(e: MouseEvent, tabId: string) {
    tabs.showTabContextMenu(this.s, e, tabId, {
      renderTabs: () => this.renderTabs(),
      createTab: (url) => this.createTab(url),
      closeTab: (id) => this.closeTab(id),
      switchTab: (id) => this.switchTab(id),
      renderShortcuts: () => this.renderShortcuts(),
      hideContextMenu: () => tabs.hideContextMenu(),
    });
  }

  private navigate(input: string) {
    nav.navigate(this.s, input, {
      renderTabs: () => this.renderTabs(),
      updateNavButtons: () => nav.updateNavButtons(this.s),
      updateSecurityIndicator: () => nav.updateSecurityIndicator(this.s),
      updateBookmarkButton: () => nav.updateBookmarkButton(this.s),
      addToHistory: (url, title, favicon) => this.addToHistory(url, title, favicon),
      hideAutocomplete: () => nav.hideAutocomplete(this.s),
      showLoadingBar: () => nav.showLoadingBar(),
      hideLoadingBar: () => nav.hideLoadingBar(),
    });
  }

  private updateGreeting() { welcome.updateGreeting(this.s); }

  private renderShortcuts() {
    welcome.renderShortcuts(this.s, {
      navigate: (url) => this.navigate(url),
      showShortcutContextMenu: (e, i) => welcome.showShortcutContextMenu(this.s, e, i, {
        hideContextMenu: () => tabs.hideContextMenu(),
        renderShortcuts: () => this.renderShortcuts(),
      }),
      addShortcutFromCurrent: () => welcome.addShortcutFromCurrent(this.s, () => this.renderShortcuts()),
    });
  }

  private renderCommandResults(query: string) {
    cmd.renderCommandResults(this.s, query, {
      switchTab: (id) => this.switchTab(id),
      navigate: (url) => this.navigate(url),
      createTab: () => this.createTab(),
      toggleAiPanel: () => ai.toggleAiPanel(),
      toggleFindBar: () => find.toggleFindBar(this.s),
      toggleShortcutsModal: () => cmd.toggleShortcutsModal(),
      toggleDevTools: () => this.toggleDevTools(),
      toggleDownloads: () => downloads.toggleDownloadsPanel(),
      toggleHistory: () => history.toggleHistory(this.s, { navigate: (url) => this.navigate(url) }),
    });
  }

  private bindEvents() {
    document.getElementById('btn-new-tab')!.addEventListener('click', () => this.createTab());

    const urlBar = document.getElementById('url-bar') as HTMLInputElement;
    urlBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const dropdown = document.getElementById('autocomplete-dropdown')!;
        if (dropdown.classList.contains('visible') && this.s.autocompleteIndex >= 0) {
          const items = dropdown.querySelectorAll('.autocomplete-item');
          if (items[this.s.autocompleteIndex]) { (items[this.s.autocompleteIndex] as HTMLElement).click(); return; }
        }
        this.navigate(urlBar.value);
        nav.hideAutocomplete(this.s);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        nav.navigateAutocomplete(this.s, e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Escape') {
        nav.hideAutocomplete(this.s);
        urlBar.blur();
      }
    });

    urlBar.addEventListener('input', () => nav.showAutocomplete(this.s, urlBar.value, (url) => this.navigate(url)));
    urlBar.addEventListener('focus', () => { urlBar.select(); if (urlBar.value) nav.showAutocomplete(this.s, urlBar.value, (url) => this.navigate(url)); });
    urlBar.addEventListener('blur', () => { setTimeout(() => nav.hideAutocomplete(this.s), 200); });

    document.getElementById('welcome-url-input')!.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.navigate((e.target as HTMLInputElement).value);
    });

    document.getElementById('btn-back')!.addEventListener('click', () => nav.goBack(this.s));
    document.getElementById('btn-forward')!.addEventListener('click', () => nav.goForward(this.s));
    document.getElementById('btn-reload')!.addEventListener('click', () => nav.reload(this.s));
    document.getElementById('btn-ai')!.addEventListener('click', () => ai.toggleAiPanel());
    document.getElementById('btn-settings')!.addEventListener('click', () => settings.showSettings(this.s));
    document.getElementById('btn-close-ai')!.addEventListener('click', () => ai.toggleAiPanel());
    document.getElementById('btn-bookmark')!.addEventListener('click', () => {
      nav.toggleBookmark(this.s, () => bookmarksBar.refreshBookmarksBar(this.s, { navigate: (url) => this.navigate(url) }));
    });

    document.querySelectorAll('.ai-action-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        if (action === 'summarize') ai.aiAction(this.s, 'Summarize this page concisely');
        if (action === 'explain') ai.aiAction(this.s, 'Explain this page in simple terms');
        if (action === 'key-facts') ai.aiAction(this.s, 'Extract the key facts and important data points from this page as a bullet list');
        if (action === 'translate') ai.aiAction(this.s, 'Translate the main content of this page to English');
        if (action === 'clear') ai.clearChat(this.s);
      });
    });

    const aiInput = document.getElementById('ai-input') as HTMLTextAreaElement;
    aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !this.s.isStreaming) {
        e.preventDefault();
        ai.sendChatMessage(this.s);
        aiInput.style.height = 'auto';
      }
    });
    aiInput.addEventListener('input', () => {
      aiInput.style.height = 'auto';
      aiInput.style.height = `${Math.min(aiInput.scrollHeight, 120)}px`;
    });
    document.getElementById('btn-send-ai')!.addEventListener('click', () => { if (!this.s.isStreaming) ai.sendChatMessage(this.s); });
    document.getElementById('btn-save-key')!.addEventListener('click', () => ai.saveApiKey());
    document.getElementById('btn-skip-key')!.addEventListener('click', () => ai.hideModal());
    document.getElementById('api-key-input')!.addEventListener('keydown', (e) => { if (e.key === 'Enter') ai.saveApiKey(); });

    document.getElementById('command-palette-backdrop')!.addEventListener('click', () => cmd.hideCommandPalette());
    document.getElementById('command-palette-input')!.addEventListener('input', (e) => this.renderCommandResults((e.target as HTMLInputElement).value));
    document.getElementById('command-palette-input')!.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cmd.hideCommandPalette();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); cmd.navigateCommand(this.s, e.key === 'ArrowDown' ? 1 : -1); }
      else if (e.key === 'Enter') cmd.executeCommand(this.s);
    });

    document.getElementById('shortcuts-modal-backdrop')!.addEventListener('click', () => cmd.hideShortcutsModal());
    document.addEventListener('click', () => tabs.hideContextMenu());
  }

  private setupExtraEvents() {
    document.getElementById('btn-close-downloads')?.addEventListener('click', () => downloads.toggleDownloadsPanel());
    document.getElementById('btn-close-history')?.addEventListener('click', () => history.hideHistory());
    document.getElementById('history-backdrop')?.addEventListener('click', () => history.hideHistory());
  }



  private setupFullscreen() {
    const container = document.getElementById('webview-container');
    const app = document.getElementById('app');
    if (!container || !app) return;

    container.addEventListener('enter-html-full-screen', () => {
      app.classList.add('fullscreen');
    });
    container.addEventListener('leave-html-full-screen', () => {
      app.classList.remove('fullscreen');
    });
  }

  private setupMenuActions() {
    window.electronAPI.onMenuAction((action: string, ...args: any[]) => {
      const urlBar = document.getElementById('url-bar') as HTMLInputElement;
      const tab = tabs.getActiveTab(this.s);

      switch (action) {
        case 'new-tab': this.createTab(); break;
        case 'close-tab': if (this.s.activeTabId) this.closeTab(this.s.activeTabId); break;
        case 'reopen-tab': this.reopenClosedTab(); break;
        case 'find': find.toggleFindBar(this.s); break;
        case 'reload': nav.reload(this.s); break;
        case 'hard-reload': if (tab?.webview) (tab.webview as any).reloadIgnoringCache(); break;
        case 'toggle-ai': ai.toggleAiPanel(); break;
        case 'toggle-devtools': this.toggleDevTools(); break;
        case 'show-downloads': downloads.toggleDownloadsPanel(); break;
        case 'show-history': history.toggleHistory(this.s, { navigate: (url) => this.navigate(url) }); break;
        case 'command-palette': cmd.toggleCommandPalette(this.s, (q) => this.renderCommandResults(q)); break;
        case 'go-back': nav.goBack(this.s); break;
        case 'go-forward': nav.goForward(this.s); break;
        case 'focus-url': urlBar.focus(); urlBar.select(); break;
        case 'next-tab': tabs.cycleTab(this.s, 1, (id) => this.switchTab(id)); break;
        case 'prev-tab': tabs.cycleTab(this.s, -1, (id) => this.switchTab(id)); break;
        case 'shortcuts-help': cmd.toggleShortcutsModal(); break;
        case 'settings': settings.showSettings(this.s); break;
        case 'toggle-bookmarks-bar': bookmarksBar.toggleBookmarksBar(this.s, { navigate: (url) => this.navigate(url) }); break;
        case 'zoom-in': if (tab?.webview) { zoom.getZoomActions(tab.webview, tab.url).zoomIn(); } break;
        case 'zoom-out': if (tab?.webview) { zoom.getZoomActions(tab.webview, tab.url).zoomOut(); } break;
        case 'zoom-reset': if (tab?.webview) { zoom.getZoomActions(tab.webview, tab.url).zoomReset(); } break;
        case 'open-url': if (args[0]) this.createTab(args[0]); break;
      }
    });
  }

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === 't') { e.preventDefault(); this.createTab(); }
      if (meta && e.key === 'w') { e.preventDefault(); if (this.s.activeTabId) this.closeTab(this.s.activeTabId); }
      if (meta && e.shiftKey && e.key === 'T') { e.preventDefault(); this.reopenClosedTab(); }
      if (meta && e.key === 'l') { e.preventDefault(); const bar = document.getElementById('url-bar') as HTMLInputElement; bar.focus(); bar.select(); }
      if (meta && e.key === 'k') { e.preventDefault(); cmd.toggleCommandPalette(this.s, (q) => this.renderCommandResults(q)); }
      if (meta && e.key === 'f') { e.preventDefault(); find.toggleFindBar(this.s); }
      if (meta && e.key === 'j') { e.preventDefault(); ai.toggleAiPanel(); }
      if (meta && e.key === 'r') { e.preventDefault(); nav.reload(this.s); }
      if (meta && e.key === 'y') { e.preventDefault(); history.toggleHistory(this.s, { navigate: (url) => this.navigate(url) }); }
      if (meta && e.shiftKey && e.key === 'B') { e.preventDefault(); bookmarksBar.toggleBookmarksBar(this.s, { navigate: (url) => this.navigate(url) }); }
      if (meta && e.key === '/') { e.preventDefault(); cmd.toggleShortcutsModal(); }
      if (e.ctrlKey && e.key === 'Tab') { e.preventDefault(); tabs.cycleTab(this.s, e.shiftKey ? -1 : 1, (id) => this.switchTab(id)); }
      if (meta && e.key === ',') { e.preventDefault(); settings.showSettings(this.s); }
      if (e.key === 'F12') { e.preventDefault(); this.toggleDevTools(); }
    });
  }

  private toggleDevTools() {
    const tab = tabs.getActiveTab(this.s);
    if (!tab?.webview) return;
    const wv = tab.webview as any;
    if (wv.isDevToolsOpened()) {
      wv.closeDevTools();
    } else {
      wv.openDevTools();
    }
  }
}

new Browser();
