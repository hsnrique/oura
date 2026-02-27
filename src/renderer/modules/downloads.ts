import type { BrowserState, DownloadInfo } from './types';

const downloads: DownloadInfo[] = [];
let isVisible = false;

export function setupDownloads() {
  window.electronAPI.downloads.onStarted((item) => {
    downloads.unshift(item);
    showPanel();
    renderDownloads();
  });

  window.electronAPI.downloads.onProgress((item) => {
    const idx = downloads.findIndex(d => d.id === item.id);
    if (idx >= 0) downloads[idx] = item;
    renderDownloads();
  });

  window.electronAPI.downloads.onDone((item) => {
    const idx = downloads.findIndex(d => d.id === item.id);
    if (idx >= 0) downloads[idx] = item;
    renderDownloads();
  });
}

export function toggleDownloadsPanel() {
  isVisible ? hidePanel() : showPanel();
}

function showPanel() {
  isVisible = true;
  document.getElementById('downloads-panel')?.classList.add('visible');
  renderDownloads();
}

function hidePanel() {
  isVisible = false;
  document.getElementById('downloads-panel')?.classList.remove('visible');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function renderDownloads() {
  const list = document.getElementById('downloads-list');
  if (!list) return;
  list.innerHTML = '';

  if (downloads.length === 0) {
    list.innerHTML = '<div class="downloads-empty">No downloads yet</div>';
    return;
  }

  downloads.slice(0, 20).forEach(dl => {
    const item = document.createElement('div');
    item.className = `download-item ${dl.state}`;

    const percent = dl.totalBytes > 0 ? Math.round((dl.receivedBytes / dl.totalBytes) * 100) : 0;
    const isDone = dl.state === 'completed';
    const isFailed = dl.state === 'cancelled' || dl.state === 'interrupted';

    item.innerHTML = `
      <div class="download-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      </div>
      <div class="download-info">
        <div class="download-name">${dl.filename}</div>
        <div class="download-status">${isDone ? formatBytes(dl.totalBytes) + ' — Done'
        : isFailed ? 'Failed'
          : `${formatBytes(dl.receivedBytes)} / ${formatBytes(dl.totalBytes)} — ${percent}%`
      }</div>
        ${!isDone && !isFailed ? `<div class="download-progress"><div class="download-progress-bar" style="width:${percent}%"></div></div>` : ''}
      </div>
      <div class="download-actions">
        ${isDone ? `<button class="download-action-btn" data-action="open" title="Open file">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </button>
        <button class="download-action-btn" data-action="folder" title="Show in Finder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        </button>` : ''}
      </div>
    `;

    item.querySelectorAll('.download-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).dataset.action;
        if (action === 'open') window.electronAPI.downloads.openFile(dl.path);
        if (action === 'folder') window.electronAPI.downloads.openFolder(dl.path);
      });
    });

    list.appendChild(item);
  });
}

export function setupPermissions() {
  window.electronAPI.permissions.onRequest((permission) => {
    const label = formatPermission(permission);
    showPermissionBar(label, (granted) => {
      window.electronAPI.permissions.respond(granted);
    });
  });
}

function formatPermission(perm: string): string {
  const map: Record<string, string> = {
    'media': 'camera and microphone',
    'geolocation': 'your location',
    'notifications': 'send notifications',
    'midi': 'MIDI devices',
    'mediaKeySystem': 'protected content',
  };
  return map[perm] || perm;
}

function showPermissionBar(label: string, callback: (granted: boolean) => void) {
  const existing = document.getElementById('permission-bar');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'permission-bar';
  bar.innerHTML = `
    <span>This site wants to access <strong>${label}</strong></span>
    <div class="permission-actions">
      <button class="btn-secondary btn-sm" id="perm-deny">Deny</button>
      <button class="btn-primary btn-sm" id="perm-allow">Allow</button>
    </div>
  `;
  document.getElementById('content-area')!.prepend(bar);

  bar.querySelector('#perm-allow')!.addEventListener('click', () => { callback(true); bar.remove(); });
  bar.querySelector('#perm-deny')!.addEventListener('click', () => { callback(false); bar.remove(); });
  setTimeout(() => { if (bar.parentNode) { callback(false); bar.remove(); } }, 30000);
}

export function setupCertificateErrors() {
  window.electronAPI.certificate.onError((url) => {
    showCertificateWarning(url, (proceed) => {
      window.electronAPI.certificate.respond(proceed);
    });
  });
}

function showCertificateWarning(url: string, callback: (proceed: boolean) => void) {
  const existing = document.getElementById('permission-bar');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'permission-bar';
  bar.className = 'warning';
  bar.innerHTML = `
    <span>⚠️ Certificate error for <strong>${new URL(url).hostname}</strong></span>
    <div class="permission-actions">
      <button class="btn-secondary btn-sm" id="cert-back">Go back</button>
      <button class="btn-secondary btn-sm btn-danger" id="cert-proceed">Proceed anyway</button>
    </div>
  `;
  document.getElementById('content-area')!.prepend(bar);

  bar.querySelector('#cert-back')!.addEventListener('click', () => { callback(false); bar.remove(); });
  bar.querySelector('#cert-proceed')!.addEventListener('click', () => { callback(true); bar.remove(); });
}
