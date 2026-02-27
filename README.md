# Oura Browser

The browser, reimagined with AI.

Oura is a modern, privacy-focused browser built with Electron, featuring a built-in AI assistant powered by Google Gemini.

## Features

- **AI Assistant** — Chat with any webpage. Summarize, explain, extract key facts, or translate content instantly
- **Smart Search** — Command palette (⌘K) for quick navigation, tab switching, and actions
- **Tab Management** — Drag, pin, duplicate, and manage tabs with a sleek interface
- **Bookmarks Bar** — Quick-access bookmarks with favicon display
- **Download Manager** — Built-in download tracking with progress indicators
- **History Search** — Full-text search across your browsing history
- **Persistent Zoom** — Per-domain zoom level memory
- **Find in Page** — Fast in-page text search
- **Picture-in-Picture** — Watch videos while browsing
- **Themes** — Dark and light mode support
- **Customizable** — Choose your search engine, set your profile, and personalize the experience

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (v18 or later)
- npm

### Install

```bash
git clone https://github.com/hsnrique/oura.git
cd oura-browser
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run dist
```

The packaged app will be in the `release/` directory.

## Tech Stack

- **Electron** — Cross-platform desktop app framework
- **TypeScript** — Type-safe codebase
- **Vite** — Fast build tooling
- **Google Gemini** — AI-powered assistant
- **SQLite** — Local data persistence

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘T | New tab |
| ⌘W | Close tab |
| ⌘L | Focus URL bar |
| ⌘K | Command palette |
| ⌘J | Toggle AI panel |
| ⌘F | Find in page |
| ⌘Y | History |
| ⌘⇧B | Toggle bookmarks bar |
| ⌘, | Settings |
| ⌘/ | Keyboard shortcuts |

## License

[MIT](LICENSE) — Free to use, modify, and distribute with attribution.

Made with ♥ by [Henrique Braga](https://github.com/hsnrique)
