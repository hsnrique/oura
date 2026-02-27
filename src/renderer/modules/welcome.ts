import type { BrowserState } from './types';
import { getActiveTab } from './tabs';

export function setupWelcomeCanvas(state: BrowserState) {
  const canvas = document.getElementById('welcome-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;

  const particles: Array<{ x: number; y: number; vx: number; vy: number; r: number; alpha: number; color: string }> = [];
  const colors = ['rgba(129, 140, 248, A)', 'rgba(165, 180, 252, A)', 'rgba(99, 102, 241, A)'];

  const resize = () => {
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  };
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 40; i++) {
    particles.push({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 1,
      alpha: Math.random() * 0.4 + 0.1,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  const animate = () => {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    ctx.clearRect(0, 0, w, h);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color.replace('A', String(p.alpha));
      ctx.fill();
    }

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(129, 140, 248, ${0.06 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    state.animationFrame = requestAnimationFrame(animate);
  };

  animate();
}

export function updateGreeting(state: BrowserState) {
  const el = document.getElementById('welcome-greeting');
  if (!el) return;
  const hour = new Date().getHours();
  let timeGreeting = '';
  if (hour < 12) timeGreeting = 'Good morning';
  else if (hour < 18) timeGreeting = 'Good afternoon';
  else timeGreeting = 'Good evening';

  const name = state.profile?.name;
  el.textContent = name ? `${timeGreeting}, ${name}` : timeGreeting;
}

export function renderShortcuts(
  state: BrowserState,
  callbacks: { navigate: (url: string) => void; showShortcutContextMenu: (e: MouseEvent, index: number) => void; addShortcutFromCurrent: () => void },
) {
  const grid = document.getElementById('shortcuts-grid');
  if (!grid) return;
  grid.innerHTML = '';

  state.shortcuts.forEach((shortcut, index) => {
    const item = document.createElement('div');
    item.className = 'shortcut-item';
    item.addEventListener('click', () => callbacks.navigate(shortcut.url));
    item.addEventListener('contextmenu', (e) => { e.preventDefault(); callbacks.showShortcutContextMenu(e, index); });

    const icon = document.createElement('div');
    icon.className = 'shortcut-icon';
    if (shortcut.favicon) {
      const img = document.createElement('img');
      img.src = shortcut.favicon;
      img.onerror = () => {
        img.remove();
        icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>`;
      };
      icon.appendChild(img);
    } else {
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>`;
    }

    const label = document.createElement('span');
    label.className = 'shortcut-label';
    label.textContent = shortcut.title;

    item.appendChild(icon);
    item.appendChild(label);
    grid.appendChild(item);
  });

  if (state.shortcuts.length < 8) {
    const addItem = document.createElement('div');
    addItem.className = 'shortcut-item shortcut-add';
    addItem.addEventListener('click', () => callbacks.addShortcutFromCurrent());
    addItem.innerHTML = `
      <div class="shortcut-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </div>
      <span class="shortcut-label">Add</span>
    `;
    grid.appendChild(addItem);
  }

  renderBookmarks(state, callbacks.navigate);
}

export function renderBookmarks(state: BrowserState, navigateFn: (url: string) => void) {
  const container = document.getElementById('welcome-bookmarks');
  if (!container) return;

  if (state.bookmarks.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'welcome-bookmarks-title';
  title.textContent = 'Bookmarks';
  container.appendChild(title);

  const list = document.createElement('div');
  list.className = 'welcome-bookmarks-list';

  state.bookmarks.slice(0, 6).forEach(bookmark => {
    const item = document.createElement('a');
    item.className = 'welcome-bookmark-item';
    item.addEventListener('click', (e) => { e.preventDefault(); navigateFn(bookmark.url); });

    let domain = '';
    try { domain = new URL(bookmark.url).hostname.replace('www.', ''); } catch { domain = bookmark.url; }

    const faviconHtml = bookmark.favicon
      ? `<img src="${bookmark.favicon}" class="welcome-bookmark-favicon" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const fallbackIcon = `<div class="welcome-bookmark-favicon-fallback" ${bookmark.favicon ? 'style="display:none"' : ''}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>
    </div>`;

    item.innerHTML = `
      ${faviconHtml}${fallbackIcon}
      <div class="welcome-bookmark-text">
        <span class="welcome-bookmark-name">${bookmark.title}</span>
        <span class="welcome-bookmark-url">${domain}</span>
      </div>
    `;
    list.appendChild(item);
  });

  container.appendChild(list);
}

export function addShortcutFromCurrent(state: BrowserState, renderShortcutsFn: () => void) {
  const tab = getActiveTab(state);
  const prefillUrl = tab?.url || '';
  const prefillTitle = tab?.title || '';

  const existing = document.getElementById('add-shortcut-dialog');
  if (existing) { existing.remove(); return; }

  const dialog = document.createElement('div');
  dialog.id = 'add-shortcut-dialog';

  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.placeholder = 'URL (e.g. https://github.com)';
  urlInput.value = prefillUrl;
  urlInput.spellcheck = false;

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.placeholder = 'Name';
  titleInput.value = prefillTitle;
  titleInput.spellcheck = false;

  const btnRow = document.createElement('div');
  btnRow.className = 'add-shortcut-btns';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-secondary btn-sm';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => dialog.remove());

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary btn-sm';
  saveBtn.textContent = 'Add';
  saveBtn.addEventListener('click', () => {
    let url = urlInput.value.trim();
    const title = titleInput.value.trim() || url;
    if (!url) return;
    if (!url.startsWith('http')) url = 'https://' + url;

    let favicon = '';
    try { favicon = new URL(url).origin + '/favicon.ico'; } catch { /* skip */ }

    state.shortcuts.push({ url, title, favicon });
    window.electronAPI.db.addShortcut(url, title, favicon);
    dialog.remove();
    renderShortcutsFn();
  });

  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') titleInput.focus(); if (e.key === 'Escape') dialog.remove(); });
  titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBtn.click(); if (e.key === 'Escape') dialog.remove(); });

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  dialog.appendChild(urlInput);
  dialog.appendChild(titleInput);
  dialog.appendChild(btnRow);

  const grid = document.getElementById('shortcuts-grid');
  if (grid) grid.parentElement?.insertBefore(dialog, grid.nextSibling);
  urlInput.focus();
}

export function showShortcutContextMenu(
  state: BrowserState,
  e: MouseEvent,
  index: number,
  callbacks: { hideContextMenu: () => void; renderShortcuts: () => void },
) {
  callbacks.hideContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;

  const remove = document.createElement('button');
  remove.className = 'context-menu-item danger';
  remove.textContent = 'Remove shortcut';
  remove.addEventListener('click', () => {
    const shortcut = state.shortcuts[index];
    state.shortcuts.splice(index, 1);
    if (shortcut) window.electronAPI.db.removeShortcut(shortcut.url);
    callbacks.renderShortcuts();
  });

  menu.appendChild(remove);
  document.body.appendChild(menu);
}
