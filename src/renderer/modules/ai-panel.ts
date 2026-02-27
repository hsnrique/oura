import type { BrowserState } from './types';
import { getActiveTab } from './tabs';
import { escapeHtml } from './utils';

export function renderMarkdown(text: string): string {
  if (!text) return '';

  let html = escapeHtml(text);

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<ul') || p.startsWith('<ol') || p.startsWith('<blockquote') || p.startsWith('<li')) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

export function setupAiResize() {
  const handle = document.getElementById('ai-resize-handle')!;
  const panel = document.getElementById('ai-panel')!;
  let startX = 0;
  let startWidth = 0;

  const onMouseMove = (e: MouseEvent) => {
    const delta = startX - e.clientX;
    const newWidth = Math.max(300, Math.min(700, startWidth + delta));
    panel.style.width = `${newWidth}px`;
  };

  const onMouseUp = () => {
    handle.classList.remove('active');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX = e.clientX;
    startWidth = panel.offsetWidth;
    handle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

export function toggleAiPanel() {
  const panel = document.getElementById('ai-panel')!;
  const btn = document.getElementById('btn-ai')!;
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  btn.classList.toggle('active', isHidden);
}

async function getPageContent(state: BrowserState): Promise<{ html: string; url: string }> {
  const tab = getActiveTab(state);
  if (!tab?.webview) return { html: '', url: '' };
  try {
    const html = await (tab.webview as any).executeJavaScript('document.body.innerText');
    return { html: html || '', url: tab.url };
  } catch {
    return { html: '', url: tab.url };
  }
}

function addMessage(role: 'user' | 'ai', content: string): HTMLElement {
  const container = document.getElementById('ai-messages')!;
  const wrapper = document.createElement('div');
  wrapper.className = 'ai-message-wrapper';

  const messageEl = document.createElement('div');
  messageEl.className = 'ai-message';

  const roleEl = document.createElement('div');
  roleEl.className = `ai-message-role${role === 'ai' ? ' role-ai' : ''}`;
  roleEl.textContent = role === 'ai' ? 'AI' : 'You';
  messageEl.appendChild(roleEl);

  const contentEl = document.createElement('div');
  contentEl.className = 'ai-message-content';
  if (role === 'ai') {
    contentEl.innerHTML = renderMarkdown(content);
  } else {
    contentEl.textContent = content;
  }
  messageEl.appendChild(contentEl);
  wrapper.appendChild(messageEl);

  if (role === 'ai' && content) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'ai-copy-btn';
    copyBtn.title = 'Copy';
    copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(contentEl.textContent || '');
      copyBtn.classList.add('copied');
      copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
      }, 2000);
    });
    wrapper.appendChild(copyBtn);
  }

  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
  return contentEl;
}

function addLoadingIndicator(): HTMLElement {
  const container = document.getElementById('ai-messages')!;
  const loader = document.createElement('div');
  loader.className = 'ai-loading';
  loader.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(loader);
  container.scrollTop = container.scrollHeight;
  return loader;
}

export async function aiAction(state: BrowserState, prompt: string) {
  if (state.isStreaming) return;

  const panel = document.getElementById('ai-panel')!;
  if (panel.classList.contains('hidden')) toggleAiPanel();

  const { html, url } = await getPageContent(state);
  if (!html) { addMessage('ai', 'No page content available.'); return; }

  addMessage('user', prompt);
  const loader = addLoadingIndicator();
  state.isStreaming = true;
  let contentEl: HTMLElement | null = null;
  let rawContent = '';

  state.removeChunkListener?.();
  state.removeEndListener?.();

  state.removeChunkListener = window.electronAPI.ai.onStreamChunk((chunk) => {
    if (!contentEl) { loader.remove(); contentEl = addMessage('ai', ''); }
    rawContent += chunk;
    contentEl.innerHTML = renderMarkdown(rawContent);
    document.getElementById('ai-messages')!.scrollTop = document.getElementById('ai-messages')!.scrollHeight;
  });

  state.removeEndListener = window.electronAPI.ai.onStreamEnd(() => {
    state.isStreaming = false;
    state.removeChunkListener?.();
    state.removeEndListener?.();
    if (contentEl) {
      state.chatHistory.push({ role: 'user', content: prompt });
      state.chatHistory.push({ role: 'model', content: rawContent });
    }
  });

  const result = await window.electronAPI.ai.summarize(html, url);
  if (result.error) { loader.remove(); addMessage('ai', `Error: ${result.error}`); state.isStreaming = false; }
}

export async function sendChatMessage(state: BrowserState) {
  const input = document.getElementById('ai-input') as HTMLInputElement;
  const message = input.value.trim();
  if (!message || state.isStreaming) return;

  input.value = '';
  addMessage('user', message);
  const loader = addLoadingIndicator();

  const { html } = await getPageContent(state);
  state.isStreaming = true;
  let contentEl: HTMLElement | null = null;
  let rawContent = '';

  state.removeChunkListener?.();
  state.removeEndListener?.();

  state.removeChunkListener = window.electronAPI.ai.onStreamChunk((chunk) => {
    if (!contentEl) { loader.remove(); contentEl = addMessage('ai', ''); }
    rawContent += chunk;
    contentEl.innerHTML = renderMarkdown(rawContent);
    document.getElementById('ai-messages')!.scrollTop = document.getElementById('ai-messages')!.scrollHeight;
  });

  state.removeEndListener = window.electronAPI.ai.onStreamEnd(() => {
    state.isStreaming = false;
    state.removeChunkListener?.();
    state.removeEndListener?.();
    if (contentEl) {
      state.chatHistory.push({ role: 'user', content: message });
      state.chatHistory.push({ role: 'model', content: rawContent });
    }
  });

  const result = await window.electronAPI.ai.chat(message, html, state.chatHistory);
  if (result.error) { loader.remove(); addMessage('ai', `Error: ${result.error}`); state.isStreaming = false; }
}

export function clearChat(state: BrowserState) {
  state.chatHistory = [];
  document.getElementById('ai-messages')!.innerHTML = '';
}

export async function checkApiKey() {
  const onboarding = document.getElementById('onboarding');
  if (onboarding && !onboarding.classList.contains('hidden')) return;

  const key = await window.electronAPI.ai.getApiKey();
  if (!key) document.getElementById('api-key-modal')!.classList.remove('hidden');
}

export async function saveApiKey() {
  const input = document.getElementById('api-key-input') as HTMLInputElement;
  const key = input.value.trim();
  if (!key) return;
  await window.electronAPI.ai.setApiKey(key);
  hideModal();
}

export function hideModal() {
  document.getElementById('api-key-modal')!.classList.add('hidden');
}
