// Email + password login for a static site.
//
// GitHub Pages has no server, so the GitHub token that publishes changes is encrypted with a
// key derived from the owner's email + password (PBKDF2-SHA256, 600k iterations → AES-256-GCM)
// and stored in the repo as admin/vault.json. Logging in = downloading that file and decrypting
// it in the browser. Without the right email and password the file is useless, so its strength
// rests on the password: the setup form requires a long, mixed one.
//
// "Remember me" keeps the session on one device: the token is re-encrypted with a random,
// non-extractable AES key that lives in IndexedDB, so the raw key can never be read back out.

import { ROOT } from '../assets/js/store.js?v=1794224494992';

const ITER = 600000;
const VAULT_PATH = 'admin/vault.json';
const CACHE_KEY = 'portfolio.admin.vaultcache';
const SESSION_KEY = 'portfolio.admin.session';
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const norm = (email) => String(email || '').trim().toLowerCase();

async function deriveKey(email, password, salt, iter = ITER) {
  const base = await crypto.subtle.importKey('raw', enc.encode(`${password}\u0000${norm(email)}`), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export const VAULT_FILE = VAULT_PATH;

/** Rates a password; returns { ok, score 0-4, hint }. */
export function passwordStrength(pw) {
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  let score = 0;
  if (pw.length >= 12) score++;
  if (pw.length >= 14) score++;
  if (kinds >= 3) score++;
  if (kinds === 4 || pw.length >= 20) score++;
  const ok = pw.length >= 12 && kinds >= 3;
  const hint = pw.length < 12 ? 'Use at least 12 characters' : kinds < 3 ? 'Mix upper & lower case, numbers and symbols' : score < 3 ? 'Good. Longer is even better' : 'Strong password';
  return { ok, score, hint };
}

export async function createVault({ token, owner, repo, branch }, email, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(email, password, salt);
  const payload = enc.encode(JSON.stringify({ token, email: norm(email) }));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
  const [local, domain = ''] = norm(email).split('@');
  const masked = `${local[0] || ''}${'•'.repeat(Math.max(3, Math.min(local.length - 1, 8)))}@${domain}`;
  return { v: 2, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct), owner, repo, branch, hint: masked, updated: new Date().toISOString() };
}

export async function openVault(vault, email, password) {
  try {
    const key = await deriveKey(email, password, unb64(vault.salt), vault.iter || ITER);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, key, unb64(vault.ct));
    const data = JSON.parse(dec.decode(pt));
    if (data.email !== norm(email)) throw new Error('mismatch');
    return { token: data.token, email: data.email, owner: vault.owner, repo: vault.repo, branch: vault.branch || 'main' };
  } catch {
    throw new Error('Incorrect email or password');
  }
}

/** Loads the published vault (falls back to a local copy made during setup, before Pages redeploys). */
export async function loadVault() {
  try {
    const res = await fetch(`${ROOT}${VAULT_PATH}?v=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) { const v = await res.json(); if (v?.ct) return v; }
  } catch {}
  try { const c = JSON.parse(localStorage.getItem(CACHE_KEY)); if (c?.ct) return c; } catch {}
  return null;
}
export function cacheVault(v) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch {} }

/* ---------- remember me (device-bound session) ---------- */
function keyDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('portfolio-admin-keys', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('k');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function kv(mode, fn) {
  const db = await keyDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('k', mode);
    const req = fn(t.objectStore('k'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const session = {
  async save(cfg, days = 7) {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await kv('readwrite', (s) => s.put(key, 'session'));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(cfg)));
    localStorage.setItem(SESSION_KEY, JSON.stringify({ iv: b64(iv), ct: b64(ct), exp: Date.now() + days * 864e5 }));
  },
  async resume() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (!s || s.exp < Date.now()) { await this.clear(); return null; }
      const key = await kv('readonly', (st) => st.get('session'));
      if (!key) return null;
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, key, unb64(s.ct));
      return JSON.parse(dec.decode(pt));
    } catch { await this.clear(); return null; }
  },
  async clear() {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    try { await kv('readwrite', (s) => s.delete('session')); } catch {}
  },
};
