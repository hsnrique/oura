import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

let db: Database.Database | null = null;

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'oura.db');
}

export function initDatabase(): void {
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT '',
      avatar_path TEXT DEFAULT '',
      search_engine TEXT NOT NULL DEFAULT 'google',
      theme TEXT NOT NULL DEFAULT 'dark',
      onboarding_complete INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      favicon TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(url)
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      favicon TEXT DEFAULT '',
      visited_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shortcuts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      favicon TEXT DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      UNIQUE(url)
    );

    CREATE TABLE IF NOT EXISTS zoom_levels (
      domain TEXT PRIMARY KEY,
      level REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'New Chat',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS site_permissions (
      origin TEXT NOT NULL,
      permission TEXT NOT NULL,
      allowed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY(origin, permission)
    );

    INSERT OR IGNORE INTO user_profile (id) VALUES (1);
  `);
}

export function getProfile() {
  return db!.prepare('SELECT * FROM user_profile WHERE id = 1').get() as any;
}

export function updateProfile(data: { name?: string; avatar_path?: string; search_engine?: string; theme?: string; onboarding_complete?: number }) {
  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.avatar_path !== undefined) { fields.push('avatar_path = ?'); values.push(data.avatar_path); }
  if (data.search_engine !== undefined) { fields.push('search_engine = ?'); values.push(data.search_engine); }
  if (data.theme !== undefined) { fields.push('theme = ?'); values.push(data.theme); }
  if (data.onboarding_complete !== undefined) { fields.push('onboarding_complete = ?'); values.push(data.onboarding_complete); }

  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");

  db!.prepare(`UPDATE user_profile SET ${fields.join(', ')} WHERE id = 1`).run(...values);
}

export function saveAvatarFile(sourcePath: string): string {
  const avatarDir = path.join(app.getPath('userData'), 'avatars');
  if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

  const ext = path.extname(sourcePath);
  const dest = path.join(avatarDir, `avatar${ext}`);
  fs.copyFileSync(sourcePath, dest);
  return dest;
}

export function getBookmarks() {
  return db!.prepare('SELECT * FROM bookmarks ORDER BY created_at DESC').all();
}

export function addBookmark(url: string, title: string, favicon: string) {
  db!.prepare('INSERT OR REPLACE INTO bookmarks (url, title, favicon) VALUES (?, ?, ?)').run(url, title, favicon);
}

export function removeBookmark(url: string) {
  db!.prepare('DELETE FROM bookmarks WHERE url = ?').run(url);
}

export function isBookmarked(url: string): boolean {
  const row = db!.prepare('SELECT id FROM bookmarks WHERE url = ?').get(url);
  return !!row;
}

export function getHistory(limit = 200) {
  return db!.prepare('SELECT * FROM history ORDER BY visited_at DESC LIMIT ?').all(limit);
}

export function addHistory(url: string, title: string, favicon: string) {
  if (!url || url.startsWith('about:')) return;
  db!.prepare('INSERT INTO history (url, title, favicon) VALUES (?, ?, ?)').run(url, title, favicon);
}

export function clearHistory() {
  db!.prepare('DELETE FROM history').run();
}

export function searchHistory(query: string, limit = 10) {
  return db!.prepare('SELECT DISTINCT url, title, favicon, MAX(visited_at) as visited_at FROM history WHERE url LIKE ? OR title LIKE ? GROUP BY url ORDER BY visited_at DESC LIMIT ?')
    .all(`%${query}%`, `%${query}%`, limit);
}

export function getShortcuts() {
  return db!.prepare('SELECT * FROM shortcuts ORDER BY position ASC').all();
}

export function addShortcut(url: string, title: string, favicon: string) {
  const maxPos = db!.prepare('SELECT COALESCE(MAX(position), -1) + 1 as next FROM shortcuts').get() as any;
  db!.prepare('INSERT OR REPLACE INTO shortcuts (url, title, favicon, position) VALUES (?, ?, ?, ?)').run(url, title, favicon, maxPos.next);
}

export function removeShortcut(url: string) {
  db!.prepare('DELETE FROM shortcuts WHERE url = ?').run(url);
}

export function getPermission(origin: string, permission: string): boolean | null {
  const row = db!.prepare('SELECT allowed FROM site_permissions WHERE origin = ? AND permission = ?').get(origin, permission) as any;
  return row ? !!row.allowed : null;
}

export function setPermission(origin: string, permission: string, allowed: boolean) {
  db!.prepare('INSERT OR REPLACE INTO site_permissions (origin, permission, allowed) VALUES (?, ?, ?)').run(origin, permission, allowed ? 1 : 0);
}

export function clearPermissions(origin?: string) {
  if (origin) {
    db!.prepare('DELETE FROM site_permissions WHERE origin = ?').run(origin);
  } else {
    db!.prepare('DELETE FROM site_permissions').run();
  }
}

export function getSitePermissions(origin: string) {
  return db!.prepare('SELECT permission, allowed FROM site_permissions WHERE origin = ?').all(origin);
}

export function getZoomLevel(domain: string): number {
  const row = db!.prepare('SELECT level FROM zoom_levels WHERE domain = ?').get(domain) as any;
  return row ? row.level : 0;
}

export function setZoomLevel(domain: string, level: number) {
  db!.prepare('INSERT OR REPLACE INTO zoom_levels (domain, level) VALUES (?, ?)').run(domain, level);
}

export function exportData(): object {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    profile: getProfile(),
    bookmarks: getBookmarks(),
    history: getHistory(10000),
    shortcuts: getShortcuts(),
    permissions: db!.prepare('SELECT * FROM site_permissions').all(),
  };
}

export function importData(data: any) {
  if (!data || data.version !== 1) throw new Error('Invalid backup format');

  const transaction = db!.transaction(() => {
    if (data.profile) {
      updateProfile({
        name: data.profile.name,
        search_engine: data.profile.search_engine,
        theme: data.profile.theme,
        onboarding_complete: 1,
      });
    }

    if (data.bookmarks) {
      db!.prepare('DELETE FROM bookmarks').run();
      const insert = db!.prepare('INSERT OR IGNORE INTO bookmarks (url, title, favicon) VALUES (?, ?, ?)');
      for (const b of data.bookmarks) insert.run(b.url, b.title, b.favicon || '');
    }

    if (data.history) {
      db!.prepare('DELETE FROM history').run();
      const insert = db!.prepare('INSERT INTO history (url, title, favicon, visited_at) VALUES (?, ?, ?, ?)');
      for (const h of data.history) insert.run(h.url, h.title, h.favicon || '', h.visited_at || new Date().toISOString());
    }

    if (data.shortcuts) {
      db!.prepare('DELETE FROM shortcuts').run();
      const insert = db!.prepare('INSERT OR IGNORE INTO shortcuts (url, title, favicon, position) VALUES (?, ?, ?, ?)');
      data.shortcuts.forEach((s: any, i: number) => insert.run(s.url, s.title, s.favicon || '', i));
    }

    if (data.permissions) {
      db!.prepare('DELETE FROM site_permissions').run();
      const insert = db!.prepare('INSERT OR IGNORE INTO site_permissions (origin, permission, allowed) VALUES (?, ?, ?)');
      for (const p of data.permissions) insert.run(p.origin, p.permission, p.allowed);
    }
  });

  transaction();
}

export function clearAllData() {
  db!.exec(`
    DELETE FROM history;
    DELETE FROM bookmarks;
    DELETE FROM shortcuts;
    DELETE FROM site_permissions;
    UPDATE user_profile SET name = '', avatar_path = '', onboarding_complete = 0 WHERE id = 1;
  `);
}

export function migrateFromLocalStorage(data: { history?: any[]; bookmarks?: any[]; shortcuts?: any[] }) {
  const transaction = db!.transaction(() => {
    if (data.history) {
      const insert = db!.prepare('INSERT OR IGNORE INTO history (url, title, favicon, visited_at) VALUES (?, ?, ?, datetime(? / 1000, \'unixepoch\'))');
      for (const h of data.history) insert.run(h.url, h.title || '', h.favicon || '', h.timestamp || Date.now());
    }
    if (data.bookmarks) {
      const insert = db!.prepare('INSERT OR IGNORE INTO bookmarks (url, title, favicon) VALUES (?, ?, ?)');
      for (const b of data.bookmarks) insert.run(b.url, b.title || '', b.favicon || '');
    }
    if (data.shortcuts) {
      const insert = db!.prepare('INSERT OR IGNORE INTO shortcuts (url, title, favicon, position) VALUES (?, ?, ?, ?)');
      data.shortcuts.forEach((s: any, i: number) => insert.run(s.url, s.title || '', s.favicon || '', i));
    }
  });
  transaction();
}

export function createConversation(title = 'New Chat') {
  const result = db!.prepare('INSERT INTO chat_conversations (title) VALUES (?)').run(title);
  return db!.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(result.lastInsertRowid) as any;
}

export function getConversations(limit = 50) {
  return db!.prepare('SELECT * FROM chat_conversations ORDER BY updated_at DESC LIMIT ?').all(limit);
}

export function getConversationMessages(conversationId: number) {
  return db!.prepare('SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC').all(conversationId);
}

export function addChatMessage(conversationId: number, role: string, content: string) {
  db!.prepare('INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, ?, ?)').run(conversationId, role, content);
  db!.prepare("UPDATE chat_conversations SET updated_at = datetime('now') WHERE id = ?").run(conversationId);
}

export function updateConversationTitle(conversationId: number, title: string) {
  db!.prepare('UPDATE chat_conversations SET title = ? WHERE id = ?').run(title, conversationId);
}

export function deleteConversation(conversationId: number) {
  db!.prepare('DELETE FROM chat_messages WHERE conversation_id = ?').run(conversationId);
  db!.prepare('DELETE FROM chat_conversations WHERE id = ?').run(conversationId);
}

export function getRecentMemory(excludeConversationId?: number, limit = 5): string {
  const conversations = db!.prepare(
    'SELECT id, title FROM chat_conversations WHERE id != ? ORDER BY updated_at DESC LIMIT ?'
  ).all(excludeConversationId ?? -1, limit) as any[];

  if (conversations.length === 0) return '';

  const snippets: string[] = [];
  for (const conv of conversations) {
    const messages = db!.prepare(
      'SELECT role, content FROM chat_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 4'
    ).all(conv.id) as any[];
    if (messages.length === 0) continue;

    const lines = messages.reverse().map((m: any) =>
      `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.substring(0, 200)}`
    );
    snippets.push(`[${conv.title}]\n${lines.join('\n')}`);
  }
  return snippets.join('\n\n');
}
