import { BrowserState } from './types';
import { getActiveTab } from './tabs';

const PERMISSION_LABELS: Record<string, { label: string; icon: string }> = {
  media: {
    label: 'Camera & Microphone',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>',
  },
  geolocation: {
    label: 'Location',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
  },
  notifications: {
    label: 'Notifications',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
  },
  midi: {
    label: 'MIDI Devices',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>',
  },
  mediaKeySystem: {
    label: 'Protected Content',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
  },
};

const DEFAULT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';

const MANAGEABLE_PERMISSIONS = ['media', 'geolocation', 'notifications', 'midi', 'mediaKeySystem'];

function getPermissionInfo(permission: string) {
  return PERMISSION_LABELS[permission] || { label: permission, icon: DEFAULT_ICON };
}

function getHostname(origin: string): string {
  try { return new URL(origin).hostname; } catch { return origin || 'This site'; }
}

export function setupPermissions() {
  window.electronAPI.permissions.onRequest(({ permission, origin }) => {
    const info = getPermissionInfo(permission);
    const hostname = getHostname(origin);
    showPermissionBar(hostname, info.label, info.icon, (granted, remember) => {
      window.electronAPI.permissions.respond({ granted, remember });
    });
  });
}

export function setupPermissionsPopup(state: BrowserState) {
  const securityIcon = document.getElementById('url-security')!;
  securityIcon.style.cursor = 'pointer';
  securityIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    const tab = getActiveTab(state);
    if (!tab?.url || !tab.url.startsWith('http')) return;
    togglePermissionsPopup(tab.url);
  });

  document.addEventListener('click', (e) => {
    const popup = document.getElementById('permissions-popup');
    if (popup && !popup.contains(e.target as Node)) {
      popup.remove();
    }
  });
}

async function togglePermissionsPopup(url: string) {
  const existing = document.getElementById('permissions-popup');
  if (existing) { existing.remove(); return; }

  let origin = '';
  try { origin = new URL(url).origin; } catch { return; }
  const hostname = getHostname(origin);

  const saved = await window.electronAPI.permissions.getSitePermissions(origin);
  const savedMap = new Map(saved.map((p) => [p.permission, !!p.allowed]));

  const popup = document.createElement('div');
  popup.id = 'permissions-popup';

  const header = `
    <div class="perm-popup-header">
      <span class="perm-popup-hostname">${hostname}</span>
      <span class="perm-popup-label">Permissions</span>
    </div>
  `;

  const rows = MANAGEABLE_PERMISSIONS.map((perm) => {
    const info = getPermissionInfo(perm);
    const isAllowed = savedMap.get(perm);
    const statusClass = isAllowed === true ? 'allowed' : isAllowed === false ? 'denied' : 'default';
    return `
      <div class="perm-popup-row" data-permission="${perm}">
        <div class="perm-popup-row-info">
          <span class="perm-popup-row-icon">${info.icon}</span>
          <span>${info.label}</span>
        </div>
        <select class="perm-popup-select ${statusClass}" data-perm="${perm}">
          <option value="ask" ${isAllowed === undefined ? 'selected' : ''}>Ask</option>
          <option value="allow" ${isAllowed === true ? 'selected' : ''}>Allow</option>
          <option value="deny" ${isAllowed === false ? 'selected' : ''}>Deny</option>
        </select>
      </div>
    `;
  }).join('');

  const footer = `
    <div class="perm-popup-footer">
      <button class="btn-secondary btn-sm" id="perm-popup-reset">Reset All</button>
    </div>
  `;

  popup.innerHTML = header + '<div class="perm-popup-list">' + rows + '</div>' + footer;
  document.getElementById('url-bar-container')!.appendChild(popup);

  popup.querySelectorAll('.perm-popup-select').forEach((select) => {
    select.addEventListener('change', async (e) => {
      const el = e.target as HTMLSelectElement;
      const perm = el.dataset.perm!;
      const val = el.value;
      el.className = 'perm-popup-select ' + (val === 'allow' ? 'allowed' : val === 'deny' ? 'denied' : 'default');

      if (val === 'ask') {
        await window.electronAPI.permissions.clearSitePermissions(origin);
        const freshSaved = await window.electronAPI.permissions.getSitePermissions(origin);
        const freshMap = new Map(freshSaved.map((p) => [p.permission, !!p.allowed]));
        popup.querySelectorAll('.perm-popup-select').forEach((s) => {
          const sel = s as HTMLSelectElement;
          const p = sel.dataset.perm!;
          if (p === perm) return;
          const sv = freshMap.get(p);
          sel.value = sv === true ? 'allow' : sv === false ? 'deny' : 'ask';
          sel.className = 'perm-popup-select ' + (sv === true ? 'allowed' : sv === false ? 'denied' : 'default');
        });
      } else {
        await window.electronAPI.permissions.setSitePermission(origin, perm, val === 'allow');
      }
    });
  });

  popup.querySelector('#perm-popup-reset')!.addEventListener('click', async () => {
    await window.electronAPI.permissions.clearSitePermissions(origin);
    popup.querySelectorAll('.perm-popup-select').forEach((s) => {
      const el = s as HTMLSelectElement;
      el.value = 'ask';
      el.className = 'perm-popup-select default';
    });
  });
}

function showPermissionBar(
  hostname: string,
  label: string,
  icon: string,
  callback: (granted: boolean, remember: boolean) => void,
) {
  const existing = document.getElementById('permission-bar');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'permission-bar';
  bar.innerHTML = `
    <div class="permission-info">
      <div class="permission-icon">${icon}</div>
      <span><strong>${hostname}</strong> wants to access <strong>${label}</strong></span>
    </div>
    <div class="permission-controls">
      <label class="permission-remember">
        <input type="checkbox" id="perm-remember" checked />
        <span>Remember</span>
      </label>
      <div class="permission-actions">
        <button class="btn-secondary btn-sm" id="perm-deny">Deny</button>
        <button class="btn-primary btn-sm" id="perm-allow">Allow</button>
      </div>
    </div>
  `;

  document.getElementById('content-area')!.prepend(bar);
  requestAnimationFrame(() => bar.classList.add('visible'));

  const getRemember = () => (document.getElementById('perm-remember') as HTMLInputElement).checked;

  const dismiss = (granted: boolean) => {
    bar.classList.remove('visible');
    setTimeout(() => bar.remove(), 200);
    callback(granted, getRemember());
  };

  bar.querySelector('#perm-allow')!.addEventListener('click', () => dismiss(true));
  bar.querySelector('#perm-deny')!.addEventListener('click', () => dismiss(false));

  setTimeout(() => {
    if (bar.parentNode) dismiss(false);
  }, 30000);
}
