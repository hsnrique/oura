import type { BrowserState } from './types';

export function setupSettings(
  state: BrowserState,
  callbacks: {
    loadPersisted: () => Promise<void>;
    renderShortcuts: () => void;
    updateGreeting: () => void;
  },
) {
  document.getElementById('btn-close-settings')!.addEventListener('click', () => hideSettings());
  document.getElementById('settings-backdrop')!.addEventListener('click', () => hideSettings());

  document.getElementById('btn-change-avatar')!.addEventListener('click', async () => {
    const dataUrl = await window.electronAPI.db.pickAvatar();
    if (dataUrl) {
      renderAvatarFromDataUrl(dataUrl);
    }
  });

  const nameInput = document.getElementById('settings-name') as HTMLInputElement;
  let nameTimer: ReturnType<typeof setTimeout>;
  nameInput.addEventListener('input', () => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(async () => {
      await window.electronAPI.db.updateProfile({ name: nameInput.value.trim() });
      state.profile.name = nameInput.value.trim();
      callbacks.updateGreeting();
    }, 500);
  });

  const engineSelect = document.getElementById('settings-search-engine') as HTMLSelectElement;
  engineSelect.addEventListener('change', async () => {
    state.searchEngine = engineSelect.value;
    await window.electronAPI.db.updateProfile({ search_engine: engineSelect.value });
  });

  const themeSelect = document.getElementById('settings-theme') as HTMLSelectElement;
  if (state.profile?.theme) {
    document.documentElement.setAttribute('data-theme', state.profile.theme);
  }
  themeSelect.addEventListener('change', async () => {
    const theme = themeSelect.value;
    document.documentElement.setAttribute('data-theme', theme);
    await window.electronAPI.db.updateProfile({ theme });
  });

  document.getElementById('btn-save-api-key-settings')!.addEventListener('click', async () => {
    const key = (document.getElementById('settings-api-key') as HTMLInputElement).value.trim();
    if (key) {
      await window.electronAPI.ai.setApiKey(key);
      (document.getElementById('settings-api-key') as HTMLInputElement).value = '';
      (document.getElementById('settings-api-key') as HTMLInputElement).placeholder = 'Key saved!';
      setTimeout(() => {
        (document.getElementById('settings-api-key') as HTMLInputElement).placeholder = 'Enter API key';
      }, 2000);
    }
  });

  document.getElementById('btn-export-data')!.addEventListener('click', () => window.electronAPI.db.exportToFile());
  document.getElementById('btn-import-data')!.addEventListener('click', async () => {
    const ok = await window.electronAPI.db.importFromFile();
    if (ok) {
      await callbacks.loadPersisted();
      callbacks.renderShortcuts();
      callbacks.updateGreeting();
    }
  });

  document.getElementById('btn-clear-history-settings')!.addEventListener('click', async () => {
    await window.electronAPI.db.clearHistory();
    state.history = [];
  });

  document.getElementById('btn-clear-all-data')!.addEventListener('click', async () => {
    if (confirm('This will erase all your data. Are you sure?')) {
      await window.electronAPI.db.clearAll();
      state.history = [];
      state.bookmarks = [];
      state.shortcuts = [];
      state.profile = await window.electronAPI.db.getProfile();
      callbacks.renderShortcuts();
      callbacks.updateGreeting();
      hideSettings();
    }
  });
}

export async function showSettings(state: BrowserState) {
  const overlay = document.getElementById('settings-overlay')!;
  overlay.classList.remove('hidden');
  (document.getElementById('settings-name') as HTMLInputElement).value = state.profile?.name || '';
  (document.getElementById('settings-search-engine') as HTMLSelectElement).value = state.searchEngine;
  (document.getElementById('settings-theme') as HTMLSelectElement).value = state.profile?.theme || 'dark';
  renderSettingsAvatar(state);

  const apiKeyInput = document.getElementById('settings-api-key') as HTMLInputElement;
  const existingKey = await window.electronAPI.ai.getApiKey();
  apiKeyInput.placeholder = existingKey ? 'Key saved — enter new key to replace' : 'Enter API key';
  apiKeyInput.value = '';
}

export function hideSettings() {
  document.getElementById('settings-overlay')!.classList.add('hidden');
}

async function renderSettingsAvatar(_state: BrowserState) {
  const dataUrl = await window.electronAPI.db.getAvatarDataUrl();
  if (dataUrl) {
    renderAvatarFromDataUrl(dataUrl);
  }
}

function renderAvatarFromDataUrl(dataUrl: string) {
  const container = document.getElementById('settings-avatar')!;
  container.innerHTML = `<img src="${dataUrl}" alt="" />`;
}
