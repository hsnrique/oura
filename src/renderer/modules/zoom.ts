const zoomCache = new Map<string, number>();

function getDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export async function applyZoomForUrl(webview: any, url: string) {
  const domain = getDomain(url);
  if (!domain) return;

  let level = zoomCache.get(domain);
  if (level === undefined) {
    level = await window.electronAPI.db.getZoomLevel(domain);
    zoomCache.set(domain, level);
  }

  try { webview.setZoomLevel(level); } catch { }
}

export async function saveZoom(webview: any, url: string) {
  const domain = getDomain(url);
  if (!domain) return;

  try {
    const level = webview.getZoomLevel();
    if (level === 0) return;
    zoomCache.set(domain, level);
    await window.electronAPI.db.setZoomLevel(domain, level);
  } catch { }
}

export function getZoomActions(webview: any, url: string): {
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
} {
  return {
    zoomIn: () => {
      const level = (webview.getZoomLevel() || 0) + 0.5;
      webview.setZoomLevel(level);
      saveZoom(webview, url);
    },
    zoomOut: () => {
      const level = (webview.getZoomLevel() || 0) - 0.5;
      webview.setZoomLevel(level);
      saveZoom(webview, url);
    },
    zoomReset: () => {
      webview.setZoomLevel(0);
      const domain = getDomain(url);
      if (domain) {
        zoomCache.set(domain, 0);
        window.electronAPI.db.setZoomLevel(domain, 0);
      }
    },
  };
}
