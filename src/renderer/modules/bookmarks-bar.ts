import type { BrowserState } from './types';

let isVisible = false;

export function setupBookmarksBar(state: BrowserState, callbacks: { navigate: (url: string) => void }) {
  const savedPref = state.profile?.bookmarks_bar_visible;
  isVisible = savedPref === 1;
  if (isVisible) showBar(state, callbacks);
}

export function toggleBookmarksBar(state: BrowserState, callbacks: { navigate: (url: string) => void }) {
  isVisible = !isVisible;
  if (isVisible) {
    showBar(state, callbacks);
  } else {
    hideBar();
  }
}

export function refreshBookmarksBar(state: BrowserState, callbacks: { navigate: (url: string) => void }) {
  if (isVisible) renderBar(state, callbacks);
}

function showBar(state: BrowserState, callbacks: { navigate: (url: string) => void }) {
  const bar = document.getElementById('bookmarks-bar');
  if (!bar) return;
  bar.classList.add('visible');
  renderBar(state, callbacks);
}

function hideBar() {
  document.getElementById('bookmarks-bar')?.classList.remove('visible');
}

function renderBar(state: BrowserState, callbacks: { navigate: (url: string) => void }) {
  const container = document.getElementById('bookmarks-bar-items');
  if (!container) return;
  container.innerHTML = '';

  state.bookmarks.forEach(bm => {
    const item = document.createElement('button');
    item.className = 'bookmarks-bar-item';
    item.title = bm.url;
    item.addEventListener('click', () => callbacks.navigate(bm.url));

    if (bm.favicon) {
      const img = document.createElement('img');
      img.src = bm.favicon;
      img.width = 14;
      img.height = 14;
      img.onerror = () => img.remove();
      item.appendChild(img);
    }

    const label = document.createElement('span');
    label.textContent = bm.title || new URL(bm.url).hostname;
    item.appendChild(label);

    container.appendChild(item);
  });

  if (state.bookmarks.length === 0) {
    container.innerHTML = '<span class="bookmarks-bar-empty">Bookmark pages to see them here</span>';
  }
}
