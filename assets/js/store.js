// Content loading and asset resolution, shared by the site and the admin portal.
// Live content comes from data/content.json. The admin keeps an unpublished draft in
// localStorage and its not-yet-uploaded images in IndexedDB, so the site can preview
// them with ?preview=1 before anything is committed.

export const DRAFT_KEY = 'portfolio.draft.v1';
const DB_NAME = 'portfolio-admin';
const STORE = 'uploads';

export const ROOT = (document.querySelector('meta[name="site-root"]')?.content || './').replace(/\/?$/, '/');

const blobUrls = new Map();

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    t.onerror = () => reject(t.error);
  });
}
export const pending = {
  put: (path, blob) => tx('readwrite', (s) => s.put(blob, path)),
  del: (path) => tx('readwrite', (s) => s.delete(path)),
  clear: () => tx('readwrite', (s) => s.clear()),
  async all() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const out = new Map();
      const req = db.transaction(STORE).objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) { out.set(c.key, c.value); c.continue(); } else resolve(out);
      };
      req.onerror = () => reject(req.error);
    });
  },
};

/** Register blobs for paths that are not uploaded yet, so asset() can show them. */
export function registerBlobs(map) {
  for (const [path, blob] of map) {
    if (!blobUrls.has(path)) blobUrls.set(path, URL.createObjectURL(blob));
  }
}
export function registerBlob(path, blob) {
  if (blobUrls.has(path)) URL.revokeObjectURL(blobUrls.get(path));
  blobUrls.set(path, URL.createObjectURL(blob));
  return blobUrls.get(path);
}

/** Resolve a content path (e.g. "assets/uploads/x.webp") to a usable URL. */
export function asset(path) {
  if (!path) return '';
  if (/^(https?:|data:|blob:|mailto:|tel:)/i.test(path)) return path;
  if (blobUrls.has(path)) return blobUrls.get(path);
  return ROOT + path.replace(/^\/+/, '');
}

export function readDraft() {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export const isPreview = new URLSearchParams(location.search).has('preview');

export async function loadContent() {
  if (isPreview) {
    const draft = readDraft();
    if (draft?.content) {
      try { registerBlobs(await pending.all()); } catch { /* IndexedDB unavailable: show what we can */ }
      return { content: draft.content, preview: true };
    }
  }
  // theme-init.js already started the request (fresh, no-store) while the page was loading
  const early = window.__content;
  window.__content = null;
  if (early) { try { const c = await early; if (c) return { content: c, preview: false }; } catch { /* fall through */ } }
  // Always fetch the latest published content. GitHub Pages lets browsers cache files for
  // 10 minutes, so a unique query + no-store makes new publishes show up immediately.
  const res = await fetch(`${ROOT}data/content.json?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load content (${res.status})`);
  return { content: await res.json(), preview: false };
}
