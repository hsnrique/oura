import type { BrowserState } from './types';
import { escapeHtml } from './utils';

export function toggleCommandPalette(state: BrowserState, renderFn: (query: string) => void) {
  const palette = document.getElementById('command-palette')!;
  if (palette.classList.contains('visible')) {
    hideCommandPalette();
  } else {
    palette.classList.add('visible');
    const input = document.getElementById('command-palette-input') as HTMLInputElement;
    input.value = '';
    input.focus();
    state.commandPaletteIndex = 0;
    renderFn('');
  }
}

export function hideCommandPalette() {
  document.getElementById('command-palette')!.classList.remove('visible');
}

export function renderCommandResults(
  state: BrowserState,
  query: string,
  callbacks: {
    switchTab: (id: string) => void;
    navigate: (url: string) => void;
    createTab: () => void;
    toggleAiPanel: () => void;
    toggleFindBar: () => void;
    toggleShortcutsModal: () => void;
    toggleDevTools: () => void;
    toggleDownloads: () => void;
    toggleHistory: () => void;
  },
) {
  const container = document.getElementById('command-palette-results')!;
  const q = query.toLowerCase().trim();

  const items: Array<{ icon: string; label: string; hint: string; action: () => void; shortcut?: string }> = [];

  state.tabs.forEach(tab => {
    if (!q || tab.title.toLowerCase().includes(q) || tab.url.toLowerCase().includes(q)) {
      items.push({
        icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
        label: tab.title,
        hint: tab.url || 'New Tab',
        action: () => { callbacks.switchTab(tab.id); hideCommandPalette(); },
      });
    }
  });

  state.bookmarks.forEach(b => {
    if (!q || b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)) {
      items.push({
        icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
        label: b.title,
        hint: b.url,
        action: () => { callbacks.navigate(b.url); hideCommandPalette(); },
      });
    }
  });

  const actions = [
    { label: 'New Tab', hint: 'Open a new empty tab', shortcut: '⌘T', action: () => { callbacks.createTab(); hideCommandPalette(); } },
    { label: 'Developer Tools', hint: 'Inspect the current page', shortcut: 'F12', action: () => { callbacks.toggleDevTools(); hideCommandPalette(); } },
    { label: 'Toggle AI Panel', hint: 'Open or close the AI assistant', shortcut: '⌘J', action: () => { callbacks.toggleAiPanel(); hideCommandPalette(); } },
    { label: 'Find on Page', hint: 'Search within the current page', shortcut: '⌘F', action: () => { callbacks.toggleFindBar(); hideCommandPalette(); } },
    { label: 'Downloads', hint: 'View downloads', shortcut: '', action: () => { callbacks.toggleDownloads(); hideCommandPalette(); } },
    { label: 'History', hint: 'View browsing history', shortcut: '⌘Y', action: () => { callbacks.toggleHistory(); hideCommandPalette(); } },
    { label: 'Keyboard Shortcuts', hint: 'View all shortcuts', shortcut: '⌘/', action: () => { callbacks.toggleShortcutsModal(); hideCommandPalette(); } },
  ];

  actions.forEach(a => {
    if (!q || a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q)) {
      items.push({
        icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
        ...a,
      });
    }
  });

  if (q && items.length === 0) {
    items.push({
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
      label: `Search for "${query}"`,
      hint: 'Open in search engine',
      action: () => { callbacks.navigate(query); hideCommandPalette(); },
    });
  }

  state.commandPaletteIndex = 0;
  container.innerHTML = '';

  items.slice(0, 10).forEach((item, i) => {
    const el = document.createElement('div');
    el.className = `command-item${i === 0 ? ' selected' : ''}`;
    el.addEventListener('click', item.action);
    el.addEventListener('mouseenter', () => { state.commandPaletteIndex = i; highlightCommand(state); });

    el.innerHTML = `
      <div class="command-item-icon">${item.icon}</div>
      <div class="command-item-text">
        <div class="command-item-label">${escapeHtml(item.label)}</div>
        <div class="command-item-hint">${escapeHtml(item.hint)}</div>
      </div>
      ${item.shortcut ? `<span class="command-item-shortcut">${item.shortcut}</span>` : ''}
    `;
    container.appendChild(el);
  });
}

export function navigateCommand(state: BrowserState, dir: number) {
  const items = document.querySelectorAll('#command-palette-results .command-item');
  if (!items.length) return;
  state.commandPaletteIndex = (state.commandPaletteIndex + dir + items.length) % items.length;
  highlightCommand(state);
}

function highlightCommand(state: BrowserState) {
  const items = document.querySelectorAll('#command-palette-results .command-item');
  items.forEach((item, i) => { item.classList.toggle('selected', i === state.commandPaletteIndex); });
}

export function executeCommand(state: BrowserState) {
  const items = document.querySelectorAll('#command-palette-results .command-item');
  if (items[state.commandPaletteIndex]) {
    (items[state.commandPaletteIndex] as HTMLElement).click();
  }
}

export function toggleShortcutsModal() {
  document.getElementById('shortcuts-modal')!.classList.toggle('visible');
}

export function hideShortcutsModal() {
  document.getElementById('shortcuts-modal')!.classList.remove('visible');
}
