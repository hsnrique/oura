import type { BrowserState } from './types';
import { escapeHtml } from './utils';

let isVisible = false;

export function toggleHistory(
  state: BrowserState,
  callbacks: { navigate: (url: string) => void },
) {
  isVisible ? hideHistory() : showHistory(state, callbacks);
}

async function showHistory(
  state: BrowserState,
  callbacks: { navigate: (url: string) => void },
) {
  isVisible = true;
  const overlay = document.getElementById('history-overlay')!;
  overlay.classList.add('visible');

  const history = await window.electronAPI.db.getHistory(500);
  renderHistory(history, state, callbacks);

  const input = overlay.querySelector('.history-search input') as HTMLInputElement;
  input.value = '';
  input.focus();

  input.oninput = async () => {
    const q = input.value.trim();
    const results = q
      ? await window.electronAPI.db.searchHistory(q, 100)
      : await window.electronAPI.db.getHistory(500);
    renderHistory(results, state, callbacks);
  };
}

export function hideHistory() {
  isVisible = false;
  document.getElementById('history-overlay')?.classList.remove('visible');
}

function renderHistory(
  history: any[],
  state: BrowserState,
  callbacks: { navigate: (url: string) => void },
) {
  const list = document.querySelector('.history-list');
  if (!list) return;
  list.innerHTML = '';

  if (history.length === 0) {
    list.innerHTML = '<div class="history-empty">No history</div>';
    return;
  }

  let lastDate = '';
  history.forEach(h => {
    const date = new Date(h.visited_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    if (date !== lastDate) {
      lastDate = date;
      const dateEl = document.createElement('div');
      dateEl.className = 'history-date';
      dateEl.textContent = date;
      list.appendChild(dateEl);
    }

    const item = document.createElement('div');
    item.className = 'history-item';
    item.addEventListener('click', () => { callbacks.navigate(h.url); hideHistory(); });

    const favicon = h.favicon ? `<img class="history-item-favicon" src="${h.favicon}" onerror="this.style.display='none'">` : '';

    item.innerHTML = `
      ${favicon}
      <div class="history-item-text">
        <div class="history-item-title">${escapeHtml(h.title || h.url)}</div>
        <div class="history-item-url">${escapeHtml(h.url)}</div>
      </div>
      <button class="history-item-delete" title="Remove">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    item.querySelector('.history-item-delete')!.addEventListener('click', (e) => {
      e.stopPropagation();
      state.history = state.history.filter(x => x.url !== h.url);
      item.remove();
    });

    list.appendChild(item);
  });
}
