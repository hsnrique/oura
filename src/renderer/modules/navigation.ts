import type { BrowserState } from './types';
import { SEARCH_URLS } from './types';
import { getActiveTab } from './tabs';
import { escapeHtml } from './utils';
import { applyZoomForUrl } from './zoom';

export function navigate(
  state: BrowserState,
  input: string,
  callbacks: {
    renderTabs: () => void;
    updateNavButtons: () => void;
    updateSecurityIndicator: () => void;
    updateBookmarkButton: () => void;
    addToHistory: (url: string, title: string, favicon: string) => void;
    hideAutocomplete: () => void;
    showLoadingBar: () => void;
    hideLoadingBar: () => void;
  },
) {
  const tab = getActiveTab(state);
  if (!tab) return;

  let url = input.trim();
  if (!url) return;

  if (url.includes('.') && !url.includes(' ') && !url.startsWith('http')) {
    url = 'https://' + url;
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const searchBase = SEARCH_URLS[state.searchEngine] || SEARCH_URLS.google;
    url = `${searchBase}${encodeURIComponent(url)}`;
  }

  tab.url = url;
  const urlBar = document.getElementById('url-bar') as HTMLInputElement;
  urlBar.value = url;
  document.getElementById('welcome-page')!.classList.add('hidden');

  if (!tab.webview) {
    const webview = document.createElement('webview') as any;
    webview.setAttribute('src', url);
    webview.setAttribute('allowpopups', '');
    webview.classList.add('active');
    document.getElementById('webview-container')!.appendChild(webview);
    tab.webview = webview;

    webview.addEventListener('did-navigate', (e: any) => {
      tab.url = e.url;
      if (state.activeTabId === tab.id) {
        urlBar.value = e.url;
        callbacks.updateSecurityIndicator();
        callbacks.updateBookmarkButton();
      }
      callbacks.updateNavButtons();
      callbacks.addToHistory(e.url, tab.title, tab.favicon);
      applyZoomForUrl(webview, e.url);
    });

    webview.addEventListener('did-navigate-in-page', (e: any) => {
      tab.url = e.url;
      if (state.activeTabId === tab.id) {
        urlBar.value = e.url;
        callbacks.updateSecurityIndicator();
      }
      callbacks.updateNavButtons();
    });

    webview.addEventListener('page-title-updated', (e: any) => {
      tab.title = e.title || 'Untitled';
      callbacks.renderTabs();
      callbacks.addToHistory(tab.url, tab.title, tab.favicon);
    });

    webview.addEventListener('page-favicon-updated', (e: any) => {
      if (e.favicons && e.favicons.length > 0) {
        tab.favicon = e.favicons[0];
        callbacks.renderTabs();
      }
    });

    webview.addEventListener('did-start-loading', () => { tab.isLoading = true; callbacks.showLoadingBar(); });
    webview.addEventListener('did-stop-loading', () => { tab.isLoading = false; callbacks.hideLoadingBar(); });

    webview.addEventListener('dom-ready', () => {
      injectPipSupport(webview);
    });
  } else {
    (tab.webview as any).loadURL(url);
  }

  urlBar.blur();
  callbacks.hideAutocomplete();
  callbacks.renderTabs();
}

export function goBack(state: BrowserState) {
  const tab = getActiveTab(state);
  if (tab?.webview) (tab.webview as any).goBack();
}

export function goForward(state: BrowserState) {
  const tab = getActiveTab(state);
  if (tab?.webview) (tab.webview as any).goForward();
}

export function reload(state: BrowserState) {
  const tab = getActiveTab(state);
  if (tab?.webview) (tab.webview as any).reload();
}

export function updateNavButtons(state: BrowserState) {
  const tab = getActiveTab(state);
  const webview = tab?.webview as any;
  const btnBack = document.getElementById('btn-back') as HTMLButtonElement;
  const btnForward = document.getElementById('btn-forward') as HTMLButtonElement;

  if (webview) {
    try {
      btnBack.disabled = !webview.canGoBack();
      btnForward.disabled = !webview.canGoForward();
    } catch {
      btnBack.disabled = true;
      btnForward.disabled = true;
    }
  } else {
    btnBack.disabled = true;
    btnForward.disabled = true;
  }
}

export function updateSecurityIndicator(state: BrowserState) {
  const tab = getActiveTab(state);
  const el = document.getElementById('url-security')!;

  if (tab?.url?.startsWith('https://')) {
    el.className = 'secure';
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
  } else if (tab?.url) {
    el.className = 'insecure';
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  } else {
    el.className = 'insecure';
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
  }
}

export function showLoadingBar() {
  const bar = document.getElementById('loading-bar')!;
  bar.classList.add('active');
  bar.style.width = '0%';
  requestAnimationFrame(() => { bar.style.width = '70%'; });
}

export function hideLoadingBar() {
  const bar = document.getElementById('loading-bar')!;
  bar.style.width = '100%';
  setTimeout(() => { bar.classList.remove('active'); bar.style.width = '0%'; }, 300);
}

export function toggleBookmark(state: BrowserState, onChanged?: () => void) {
  const tab = getActiveTab(state);
  if (!tab || !tab.url) return;

  const existing = state.bookmarks.findIndex(b => b.url === tab.url);
  if (existing >= 0) {
    state.bookmarks.splice(existing, 1);
    window.electronAPI.db.removeBookmark(tab.url);
  } else {
    state.bookmarks.push({ url: tab.url, title: tab.title, favicon: tab.favicon });
    window.electronAPI.db.addBookmark(tab.url, tab.title, tab.favicon);
  }
  updateBookmarkButton(state);
  if (onChanged) onChanged();
}

export function updateBookmarkButton(state: BrowserState) {
  const tab = getActiveTab(state);
  const btn = document.getElementById('btn-bookmark')!;
  const isBookmarked = tab && state.bookmarks.some(b => b.url === tab.url);

  if (isBookmarked) {
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
    btn.style.color = 'var(--accent)';
  } else {
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
    btn.style.color = '';
  }
}

export function showAutocomplete(state: BrowserState, query: string, navigateFn: (url: string) => void) {
  const dropdown = document.getElementById('autocomplete-dropdown')!;
  if (!query.trim()) { hideAutocomplete(state); return; }

  const q = query.toLowerCase();
  const matches: Array<{ url: string; title: string; favicon: string; type: string }> = [];

  state.bookmarks.forEach(b => {
    if (b.url.toLowerCase().includes(q) || b.title.toLowerCase().includes(q)) {
      matches.push({ ...b, type: 'bookmark' });
    }
  });

  state.history.forEach(h => {
    if (!matches.some(m => m.url === h.url) && (h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q))) {
      matches.push({ url: h.url, title: h.title, favicon: h.favicon, type: 'history' });
    }
  });

  if (matches.length === 0) { hideAutocomplete(state); return; }

  state.autocompleteIndex = -1;
  dropdown.innerHTML = '';

  matches.slice(0, 8).forEach((match, i) => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.addEventListener('click', () => { navigateFn(match.url); hideAutocomplete(state); });
    item.addEventListener('mouseenter', () => { state.autocompleteIndex = i; highlightAutocomplete(state); });

    const iconSvg = match.type === 'bookmark'
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

    item.innerHTML = `
      <div class="autocomplete-item-icon">${iconSvg}</div>
      <div class="autocomplete-item-text">
        <div class="autocomplete-item-title">${escapeHtml(match.title)}</div>
        <div class="autocomplete-item-url">${escapeHtml(match.url)}</div>
      </div>
    `;
    dropdown.appendChild(item);
  });

  dropdown.classList.add('visible');
}

export function hideAutocomplete(state: BrowserState) {
  document.getElementById('autocomplete-dropdown')!.classList.remove('visible');
  state.autocompleteIndex = -1;
}

export function navigateAutocomplete(state: BrowserState, dir: number) {
  const dropdown = document.getElementById('autocomplete-dropdown')!;
  const items = dropdown.querySelectorAll('.autocomplete-item');
  if (!items.length) return;
  state.autocompleteIndex = (state.autocompleteIndex + dir + items.length) % items.length;
  highlightAutocomplete(state);
}

function highlightAutocomplete(state: BrowserState) {
  const dropdown = document.getElementById('autocomplete-dropdown')!;
  const items = dropdown.querySelectorAll('.autocomplete-item');
  items.forEach((item, i) => { item.classList.toggle('selected', i === state.autocompleteIndex); });
}

function injectPipSupport(webview: any) {
  try {
    webview.executeJavaScript(`
      (function() {
        if (window.__oura_pip_injected) return;
        window.__oura_pip_injected = true;

        function addPipBtn(video) {
          if (video.dataset.ouraPip) return;
          video.dataset.ouraPip = '1';
          const parent = video.parentElement;
          if (!parent) return;
          if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

          const btn = document.createElement('button');
          btn.textContent = 'PiP';
          btn.style.cssText = 'position:absolute;top:8px;right:8px;z-index:99999;padding:4px 10px;' +
            'background:rgba(0,0,0,0.7);color:#fff;border:none;border-radius:6px;font-size:11px;' +
            'cursor:pointer;opacity:0;transition:opacity .2s;font-family:system-ui;backdrop-filter:blur(4px)';
          parent.appendChild(btn);

          parent.addEventListener('mouseenter', () => btn.style.opacity = '1');
          parent.addEventListener('mouseleave', () => btn.style.opacity = '0');
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (document.pictureInPictureElement) {
              document.exitPictureInPicture();
            } else {
              video.requestPictureInPicture().catch(() => {});
            }
          });
        }

        document.querySelectorAll('video').forEach(addPipBtn);
        const obs = new MutationObserver(() => document.querySelectorAll('video').forEach(addPipBtn));
        obs.observe(document.body, { childList: true, subtree: true });
      })();
    `);
  } catch { }
}
