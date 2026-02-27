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
  });

  transaction();
}

export function clearAllData() {
  db!.exec(`
    DELETE FROM history;
    DELETE FROM bookmarks;
    DELETE FROM shortcuts;
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
