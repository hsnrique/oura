import type { BrowserState, Tab } from './types';

export function generateId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export function getActiveTab(state: BrowserState): Tab | undefined {
  return state.tabs.find(t => t.id === state.activeTabId);
}

export function createTab(
  state: BrowserState,
  callbacks: { renderTabs: () => void; switchTab: (id: string) => void; navigate: (url: string) => void },
  url?: string,
) {
  const id = generateId();
  const tab: Tab = { id, title: 'New Tab', url: url || '', webview: null, isLoading: false, favicon: '', pinned: false };
  state.tabs.push(tab);
  callbacks.renderTabs();
  callbacks.switchTab(id);
  if (url) callbacks.navigate(url);
}

export function closeTab(
  state: BrowserState,
  id: string,
  callbacks: { createTab: () => void; switchTab: (id: string) => void; renderTabs: () => void },
) {
  const index = state.tabs.findIndex(t => t.id === id);
  if (index === -1) return;

  const tab = state.tabs[index];
  if (tab.pinned) return;
  if (tab.webview) tab.webview.remove();
  state.tabs.splice(index, 1);

  if (state.tabs.length === 0) {
    callbacks.createTab();
    return;
  }

  if (state.activeTabId === id) {
    const newIndex = Math.min(index, state.tabs.length - 1);
    callbacks.switchTab(state.tabs[newIndex].id);
  }
  callbacks.renderTabs();
}

export function switchTab(
  state: BrowserState,
  id: string,
  callbacks: { renderTabs: () => void; updateNavButtons: () => void; updateSecurityIndicator: () => void; updateBookmarkButton: () => void; updateGreeting: () => void },
) {
  state.activeTabId = id;
  const tab = getActiveTab(state);

  state.tabs.forEach(t => {
    if (t.webview) {
      (t.webview as HTMLElement).classList.remove('active');
      (t.webview as HTMLElement).blur();
    }
  });
  if (tab?.webview) (tab.webview as HTMLElement).classList.add('active');

  const urlBar = document.getElementById('url-bar') as HTMLInputElement;
  urlBar.value = tab?.url || '';

  const welcomePage = document.getElementById('welcome-page')!;
  if (!tab?.url) {
    welcomePage.classList.remove('hidden');
    callbacks.updateGreeting();
  } else {
    welcomePage.classList.add('hidden');
  }

  if (!tab?.webview) {
    window.focus();
  }

  callbacks.renderTabs();
  callbacks.updateNavButtons();
  callbacks.updateSecurityIndicator();
  callbacks.updateBookmarkButton();
}

export function cycleTab(state: BrowserState, direction: number, switchFn: (id: string) => void) {
  if (state.tabs.length <= 1) return;
  const currentIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
  const next = (currentIndex + direction + state.tabs.length) % state.tabs.length;
  switchFn(state.tabs[next].id);
}

export function renderTabs(
  state: BrowserState,
  callbacks: { switchTab: (id: string) => void; closeTab: (id: string) => void; showTabContextMenu: (e: MouseEvent, tabId: string) => void },
) {
  const container = document.getElementById('tabs-container')!;
  container.innerHTML = '';

  state.tabs.forEach((tab, tabIndex) => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab${tab.id === state.activeTabId ? ' active' : ''}${tab.pinned ? ' pinned' : ''}`;
    tabEl.addEventListener('click', () => callbacks.switchTab(tab.id));
    tabEl.addEventListener('contextmenu', (e) => { e.preventDefault(); callbacks.showTabContextMenu(e, tab.id); });

    tabEl.draggable = true;
    tabEl.dataset.tabIndex = String(tabIndex);
    tabEl.addEventListener('dragstart', (e) => {
      tabEl.classList.add('dragging');
      e.dataTransfer!.setData('text/plain', String(tabIndex));
      e.dataTransfer!.effectAllowed = 'move';
    });
    tabEl.addEventListener('dragend', () => tabEl.classList.remove('dragging'));
    tabEl.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer!.dropEffect = 'move'; });
    tabEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer!.getData('text/plain'), 10);
      const toIndex = tabIndex;
      if (fromIndex !== toIndex) {
        const [moved] = state.tabs.splice(fromIndex, 1);
        state.tabs.splice(toIndex, 0, moved);
        callbacks.switchTab(state.activeTabId!);
      }
    });

    if (tab.favicon) {
      const img = document.createElement('img');
      img.className = 'tab-favicon';
      img.src = tab.favicon;
      img.onerror = () => {
        img.remove();
        const placeholder = document.createElement('div');
        placeholder.className = 'tab-favicon-placeholder';
        placeholder.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>`;
        tabEl.insertBefore(placeholder, tabEl.firstChild);
      };
      tabEl.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'tab-favicon-placeholder';
      placeholder.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>`;
      tabEl.appendChild(placeholder);
    }

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title;
    tabEl.appendChild(title);

    if (!tab.pinned) {
      const close = document.createElement('button');
      close.className = 'tab-close';
      close.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      close.addEventListener('click', (e) => { e.stopPropagation(); callbacks.closeTab(tab.id); });
      tabEl.appendChild(close);
    }

    container.appendChild(tabEl);
  });
}

export function showTabContextMenu(
  state: BrowserState,
  e: MouseEvent,
  tabId: string,
  callbacks: { renderTabs: () => void; createTab: (url: string) => void; closeTab: (id: string) => void; switchTab: (id: string) => void; renderShortcuts: () => void; hideContextMenu: () => void },
) {
  callbacks.hideContextMenu();
  state.contextMenuTabId = tabId;
  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return;

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;

  const items: Array<{ label: string; action: () => void; danger?: boolean; shortcut?: string }> = [
    { label: tab.pinned ? 'Unpin tab' : 'Pin tab', action: () => { tab.pinned = !tab.pinned; callbacks.renderTabs(); } },
    { label: 'Duplicate tab', action: () => callbacks.createTab(tab.url) },
    {
      label: 'Add to shortcuts',
      action: () => {
        if (tab.url) {
          state.shortcuts.push({ url: tab.url, title: tab.title, favicon: tab.favicon });
          window.electronAPI.db.addShortcut(tab.url, tab.title, tab.favicon);
          callbacks.renderShortcuts();
        }
      },
    },
  ];

  if (state.tabs.length > 1) {
    items.push({ label: '', action: () => { } });
    items.push({
      label: 'Close other tabs',
      action: () => {
        const others = state.tabs.filter(t => t.id !== tabId && !t.pinned);
        others.forEach(t => { if (t.webview) t.webview.remove(); });
        state.tabs = state.tabs.filter(t => t.id === tabId || t.pinned);
        callbacks.switchTab(tabId);
        callbacks.renderTabs();
      },
      danger: true,
    });
  }

  if (!tab.pinned) {
    items.push({ label: 'Close tab', action: () => callbacks.closeTab(tabId), danger: true, shortcut: '⌘W' });
  }

  items.forEach(item => {
    if (!item.label) {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);
      return;
    }
    const btn = document.createElement('button');
    btn.className = `context-menu-item${item.danger ? ' danger' : ''}`;
    btn.innerHTML = item.label;
    if (item.shortcut) {
      const shortcut = document.createElement('span');
      shortcut.className = 'context-menu-shortcut';
      shortcut.textContent = item.shortcut;
      btn.appendChild(shortcut);
    }
    btn.addEventListener('click', item.action);
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 8}px`;
  if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 8}px`;
}

export function hideContextMenu() {
  document.querySelectorAll('.context-menu').forEach(m => m.remove());
}
