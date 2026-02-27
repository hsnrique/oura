import type { BrowserState } from './types';
import { getActiveTab } from './tabs';

export function setupFindBar(state: BrowserState) {
  const input = document.getElementById('find-input') as HTMLInputElement;

  input.addEventListener('input', () => findInPage(state, input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFindBar(state);
    if (e.key === 'Enter') findNext(state, e.shiftKey);
  });

  document.getElementById('find-next')!.addEventListener('click', () => findNext(state, false));
  document.getElementById('find-prev')!.addEventListener('click', () => findNext(state, true));
  document.getElementById('find-close')!.addEventListener('click', () => closeFindBar(state));
}

export function toggleFindBar(state: BrowserState) {
  const bar = document.getElementById('find-bar')!;
  if (bar.classList.contains('visible')) {
    closeFindBar(state);
  } else {
    bar.classList.add('visible');
    const input = document.getElementById('find-input') as HTMLInputElement;
    input.focus();
    input.select();
  }
}

export function closeFindBar(state: BrowserState) {
  document.getElementById('find-bar')!.classList.remove('visible');
  const tab = getActiveTab(state);
  if (tab?.webview) {
    (tab.webview as any).stopFindInPage('clearSelection');
  }
  document.getElementById('find-count')!.textContent = '';
}

function findInPage(state: BrowserState, text: string) {
  const tab = getActiveTab(state);
  if (!tab?.webview) return;

  if (!text) {
    (tab.webview as any).stopFindInPage('clearSelection');
    document.getElementById('find-count')!.textContent = '';
    return;
  }

  const webview = tab.webview as any;
  webview.findInPage(text);
  webview.addEventListener('found-in-page', (e: any) => {
    if (e.result) {
      const { activeMatchOrdinal, matches } = e.result;
      document.getElementById('find-count')!.textContent = `${activeMatchOrdinal} / ${matches}`;
    }
  }, { once: true });
}

function findNext(state: BrowserState, backward: boolean) {
  const tab = getActiveTab(state);
  const input = document.getElementById('find-input') as HTMLInputElement;
  if (!tab?.webview || !input.value) return;
  (tab.webview as any).findInPage(input.value, { forward: !backward, findNext: true });
}
