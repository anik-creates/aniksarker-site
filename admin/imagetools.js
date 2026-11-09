// Client-side image handling for the admin portal: resize, compress, optional background removal.

const supportsWebpEncode = (() => {
  try { return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp'); } catch { return false; }
})();

const loadImage = (blob) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a readable image')); };
  img.src = url;
});

/** Resize to fit maxSize and re-encode. Keeps transparency when keepAlpha is set. */
export async function processImage(file, { maxSize = 1600, keepAlpha = false, quality = 0.85 } = {}) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
  if (file.size > 25 * 1024 * 1024) throw new Error('Image is larger than 25 MB');
  const img = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const type = supportsWebpEncode ? 'image/webp' : keepAlpha ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((r) => canvas.toBlob(r, type, quality));
  return { blob, ext: type.split('/')[1].replace('jpeg', 'jpg'), width: w, height: h };
}

/** Builds a unique repo path for an upload. */
export function uploadPath(name, ext, dir = 'assets/uploads') {
  const slug = String(name || 'image').toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image';
  const rand = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  const y = new Date().getFullYear();
  return `${dir}/${y}/${slug}-${rand}.${ext}`;
}

/**
 * Removes the background from a photo in the browser (model downloads once, ~40 MB).
 * Runs @imgly/background-removal inside a sandboxed iframe (opaque origin) so the library
 * never shares a context with the GitHub token. Returns a transparent PNG blob.
 */
let frame = null, frameReady = null, seq = 0;
function bgFrame() {
  if (frameReady) return frameReady;
  frameReady = new Promise((resolve, reject) => {
    frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
    frame.src = new URL('bg-remove.html', import.meta.url).href;
    const onMsg = (e) => {
      if (e.source !== frame.contentWindow || e.data?.type !== 'ready') return;
      removeEventListener('message', onMsg);
      resolve(frame.contentWindow);
    };
    addEventListener('message', onMsg);
    setTimeout(() => reject(new Error('Background removal helper did not start')), 20000);
    document.body.appendChild(frame);
  });
  frameReady.catch(() => { frameReady = null; frame?.remove(); });
  return frameReady;
}

export async function removeBackground(blob, onProgress = () => {}) {
  const win = await bgFrame();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const onMsg = (e) => {
      if (e.source !== win || e.data?.id !== id) return;
      if (e.data.type === 'progress') return onProgress(e.data.key, e.data.value);
      removeEventListener('message', onMsg);
      if (e.data.type === 'done') resolve(e.data.blob);
      else reject(new Error(e.data.message || 'Background removal failed'));
    };
    addEventListener('message', onMsg);
    win.postMessage({ type: 'remove', id, blob }, '*');
  });
}

/**
 * Removes a flat background (white, or any single colour) from a logo, right in the browser and
 * instantly. The colour is read from the image border; everything connected to the border with that
 * colour becomes transparent, with soft anti-aliased edges. Colours enclosed by the logo (the white
 * inside a ring, for example) are kept. Returns null when the image has no flat background.
 */
export async function removeFlatBackground(blob, { tolerance = 34 } = {}) {
  const img = await loadImage(blob);
  const W = img.naturalWidth, H = img.naturalHeight;
  if (!W || !H) return null;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, W, H), d = id.data;
  // border pixels: already transparent? then there is nothing to remove
  const border = [];
  for (let x = 0; x < W; x++) border.push(x, (H - 1) * W + x);
  for (let y = 1; y < H - 1; y++) border.push(y * W, y * W + W - 1);
  const opaque = border.filter((p) => d[p * 4 + 3] > 200);
  if (opaque.length < border.length * 0.5) return null;
  // most common border colour (quantised), then its exact average
  const buckets = new Map();
  for (const p of opaque) { const k = ((d[p * 4] >> 4) << 8) | ((d[p * 4 + 1] >> 4) << 4) | (d[p * 4 + 2] >> 4); buckets.set(k, (buckets.get(k) || 0) + 1); }
  let best = 0, bestN = 0;
  buckets.forEach((v, k) => { if (v > bestN) { bestN = v; best = k; } });
  if (bestN < opaque.length * 0.35) return null; // busy border: a photo, not a flat background
  const bg = [0, 0, 0];
  let cnt = 0;
  for (const p of opaque) {
    const k = ((d[p * 4] >> 4) << 8) | ((d[p * 4 + 1] >> 4) << 4) | (d[p * 4 + 2] >> 4);
    if (k === best) { bg[0] += d[p * 4]; bg[1] += d[p * 4 + 1]; bg[2] += d[p * 4 + 2]; cnt++; }
  }
  bg[0] /= cnt; bg[1] /= cnt; bg[2] /= cnt;
  const dist = (i) => Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2]));
  // flood fill from the border
  const seen = new Uint8Array(W * H);
  const stack = [];
  for (const p of border) if (dist(p * 4) <= tolerance) { seen[p] = 1; stack.push(p); }
  let removed = 0;
  while (stack.length) {
    const p = stack.pop();
    removed++;
    const x = p % W, y = (p / W) | 0;
    const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
    for (const q of nb) if (q >= 0 && !seen[q] && dist(q * 4) <= tolerance) { seen[q] = 1; stack.push(q); }
  }
  if (removed < W * H * 0.03) return null;
  for (let p = 0; p < W * H; p++) if (seen[p]) d[p * 4 + 3] = 0;
  // soften the edge: pixels next to the removed area fade by how close they are to the background
  // colour, and lose the background tint (so no white halo on a dark site)
  const soft = tolerance * 3;
  for (let p = 0; p < W * H; p++) {
    if (seen[p]) continue;
    const x = p % W, y = (p / W) | 0;
    if (!((x > 0 && seen[p - 1]) || (x < W - 1 && seen[p + 1]) || (y > 0 && seen[p - W]) || (y < H - 1 && seen[p + W]))) continue;
    const i = p * 4, dd = dist(i);
    if (dd >= soft) continue;
    const a = Math.max(0.08, (dd - tolerance) / (soft - tolerance));
    for (let ch = 0; ch < 3; ch++) d[i + ch] = Math.max(0, Math.min(255, Math.round((d[i + ch] - bg[ch] * (1 - a)) / a)));
    d[i + 3] = Math.round(d[i + 3] * a);
  }
  ctx.putImageData(id, 0, 0);
  const out = await new Promise((r) => c.toBlob(r, 'image/png'));
  return { blob: out, colour: `rgb(${bg.map(Math.round).join(',')})`, share: removed / (W * H) };
}
