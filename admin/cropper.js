// Zoom & crop for every upload. Photos are cropped to the exact shape they are shown in on the
// site (card 16:10, project 16:9, gallery 4:3, icon 1:1, portrait 3:4, logos trimmed). SVGs are
// "cropped" by changing their viewBox, so they stay sharp vectors.
import { icon, customSvgBody } from '../assets/js/icons.js?v=1793732009798';

export const FRAMES = {
  card: { a: 16 / 10, label: 'Card photo · 16:10' },
  project: { a: 16 / 9, label: 'Project cover · 16:9' },
  gallery: { a: 4 / 3, label: 'Gallery / text image · 4:3' },
  square: { a: 1, label: 'Icon / logo · square' },
  portrait: { a: 3 / 4, label: 'Portrait · 3:4' },
  wide: { a: 21 / 9, label: 'Banner · 21:9' },
  logo: { a: null, label: 'Logo · trimmed to fill the strip height', trim: true },
  wideLogo: { a: 3, label: 'Wide logo · 3:1' },
  free: { a: null, label: 'Free crop · drag the corners' },
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read that image')); i.src = url; });

/* ---------- SVG helpers ---------- */
const vbOf = (it) => String(it.vb).trim().split(/\s+/).map(Number);
export function svgDataUrl(it, colour = '#5b8def', maxSide = 900) {
  const [, , w, h] = vbOf(it);
  const k = maxSide / Math.max(w, h);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${esc(it.vb)}" width="${Math.round(w * k)}" height="${Math.round(h * k)}" color="${colour}">${customSvgBody(it.els, it.mono !== false)}</svg>`;
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, w: Math.round(w * k), h: Math.round(h * k) };
}
/** Tight box around the drawn shapes (in viewBox units), including stroke width. */
export function svgContentBox(it) {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-9999px;top:0;width:400px;height:400px;visibility:hidden';
  host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${esc(it.vb)}" width="400" height="400">${customSvgBody(it.els, true)}</svg>`;
  document.body.appendChild(host);
  try {
    const g = host.querySelector('svg > *');
    const b = g?.getBBox?.();
    if (!b || !b.width || !b.height) return null;
    let sw = 0;
    host.querySelectorAll('[stroke-width]').forEach((n) => { sw = Math.max(sw, parseFloat(n.getAttribute('stroke-width')) || 0); });
    if ([...host.querySelectorAll('[stroke]')].some((n) => n.getAttribute('stroke') !== 'none') && !sw) sw = 1;
    return { x: b.x - sw / 2, y: b.y - sw / 2, w: b.width + sw, h: b.height + sw };
  } finally { host.remove(); }
}
/** New viewBox that fits the content with a margin; square = pad the short side (for icons). */
export function fitViewBox(it, { pad = 0.06, square = false } = {}) {
  const b = svgContentBox(it);
  if (!b) return it.vb;
  let { x, y, w, h } = b;
  const m = Math.max(w, h) * pad;
  x -= m; y -= m; w += 2 * m; h += 2 * m;
  if (square) { const s = Math.max(w, h); x -= (s - w) / 2; y -= (s - h) / 2; w = h = s; }
  return [x, y, w, h].map((n) => +n.toFixed(3)).join(' ');
}

/* ---------- raster trim: bounding box of the "content" ---------- */
function rasterContentBox(img) {
  const k = Math.min(1, 500 / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.max(1, Math.round(img.naturalWidth * k)), H = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const px = (x, y) => (y * W + x) * 4;
  const corners = [px(0, 0), px(W - 1, 0), px(0, H - 1), px(W - 1, H - 1)];
  const alpha = corners.some((i) => d[i + 3] < 250);
  const bg = [0, 1, 2].map((ch) => corners.reduce((s, i) => s + d[i + ch], 0) / 4);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = px(x, y);
    const on = alpha ? d[i + 3] > 14 : Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 48;
    if (on) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  return { x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k };
}

/**
 * Opens the zoom & crop dialog.
 * @param {object} o  { url | svg, frame: key of FRAMES, title, batch: {n, total} }
 * @returns {Promise<null | {mode:'original'|'original-all'} | {mode:'crop', x,y,w,h, natW,natH, vb?}>}
 */
export function openCropper({ url = '', svg = null, frame = 'card', title = '', batch = null } = {}) {
  return new Promise(async (resolve) => {
    let src = url, natW = 0, natH = 0;
    if (svg) { const r = svgDataUrl(svg); src = r.url; }
    let img;
    try { img = await loadImg(src); } catch (e) { resolve(null); return; }
    natW = img.naturalWidth; natH = img.naturalHeight;
    const startFrame = FRAMES[frame] ? frame : 'card';
    const m = document.createElement('div');
    m.className = 'a-modal crop-modal';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Zoom and crop');
    m.innerHTML = `<div class="a-modal-backdrop"></div>
      <div class="a-modal-panel glass wide">
        <div class="a-modal-head"><span class="a-modal-icon">${icon('crop')}</span><div><h2>Zoom & crop${batch ? ` <small class="muted">${batch.n} of ${batch.total}</small>` : ''}</h2>
          <p class="muted small crop-sub">${esc(title || 'Drag to move, scroll or use the slider to zoom.')}</p></div></div>
        <div class="crop-presets">${Object.entries(FRAMES).map(([k, f]) => `<button type="button" class="tchip link-chip ${k === startFrame ? 'on' : ''}" data-frame="${k}">${esc(f.label)}${k === frame ? ' · fits the site' : ''}</button>`).join('')}</div>
        <div class="crop-stage ${svg ? 'is-svg' : ''}"><img class="crop-img" alt="" draggable="false" /><div class="crop-frame"><i></i><i></i>${['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'].map((k) => `<b data-h="${k}"></b>`).join('')}</div></div>
        <div class="crop-tools">
          <label class="crop-zoom">${icon('search')}<input type="range" min="1" max="8" step="0.01" value="1" aria-label="Zoom" /></label>
          <button type="button" class="btn btn-neu sm" data-act="trim">${icon('target')} Trim empty edges</button>
          <span class="crop-hint muted small">${icon('crop')} Drag the corners or edges to crop freely</span>
          <button type="button" class="btn btn-neu sm" data-act="reset">${icon('refresh')} Reset</button>
        </div>
        <div class="a-modal-foot">
          <button type="button" class="btn btn-neu" data-act="cancel">Cancel</button>
          <button type="button" class="btn btn-neu" data-act="original">Use as uploaded</button>
          ${batch && batch.total - batch.n > 0 ? `<button type="button" class="btn btn-neu" data-act="original-all">Use the rest as uploaded</button>` : ''}
          <button type="button" class="btn btn-primary" data-act="apply">${icon('check')} Apply crop</button>
        </div>
      </div>`;
    document.body.appendChild(m);
    requestAnimationFrame(() => m.classList.add('show'));
    const stage = $('.crop-stage', m), view = $('.crop-img', m), box = $('.crop-frame', m), zoomEl = $('input[type=range]', m);
    view.src = src;
    Object.assign(view.style, { width: `${natW}px`, height: `${natH}px` });
    let aspect = 1, fw = 0, fh = 0, fx = 0, fy = 0, s0 = 1, zoom = 1, ox = 0, oy = 0;
    const scale = () => s0 * zoom;
    const clampPos = () => {
      const s = scale();
      ox = Math.min(0, Math.max(fw - natW * s, ox));
      oy = Math.min(0, Math.max(fh - natH * s, oy));
    };
    let raf = 0;
    const paint = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintNow(); }); };
    const paintNow = () => {
      const s = scale();
      Object.assign(box.style, { left: `${fx}px`, top: `${fy}px`, width: `${fw}px`, height: `${fh}px` });
      view.style.transform = `translate3d(${(fx + ox).toFixed(2)}px, ${(fy + oy).toFixed(2)}px, 0) scale(${s.toFixed(5)})`;
    };
    const layout = (keepCentre = true) => {
      const sw = stage.clientWidth, sh = stage.clientHeight, pad = 28;
      const cx = keepCentre && fw ? (-ox + fw / 2) / scale() : natW / 2, cy = keepCentre && fh ? (-oy + fh / 2) / scale() : natH / 2;
      fw = Math.min(sw - pad * 2, (sh - pad * 2) * aspect); fh = fw / aspect;
      fx = (sw - fw) / 2; fy = (sh - fh) / 2;
      s0 = Math.max(fw / natW, fh / natH);
      ox = fw / 2 - cx * scale(); oy = fh / 2 - cy * scale();
      clampPos(); paint();
    };
    const setFrame = (k) => {
      const f = FRAMES[k];
      $$('[data-frame]', m).forEach((b) => b.classList.toggle('on', b.dataset.frame === k));
      aspect = f.a || natW / natH;
      m.classList.toggle('free-mode', !f.a);
      zoom = 1; zoomEl.value = '1';
      fw = 0; layout(false);
      if (f.trim) trim();
    };
    const zoomTo = (z, px = fw / 2, py = fh / 2, fromSlider = false) => {
      const s1 = scale();
      zoom = Math.max(1, Math.min(8, z));
      const s2 = scale();
      ox = px - (px - ox) * (s2 / s1); oy = py - (py - oy) * (s2 / s1);
      if (!fromSlider) zoomEl.value = String(zoom);
      clampPos(); paint();
    };
    function trim() {
      let b = null;
      if (svg) {
        const cb = svgContentBox(svg);
        if (cb) { const [vx, vy, vw, vh] = vbOf(svg); const k = natW / vw; b = { x: (cb.x - vx) * k, y: (cb.y - vy) * k, w: cb.w * (natH / vh), h: cb.h * (natH / vh) }; }
      } else b = rasterContentBox(img);
      if (!b) return;
      const mgn = Math.max(b.w, b.h) * 0.04;
      b = { x: Math.max(0, b.x - mgn), y: Math.max(0, b.y - mgn), w: Math.min(natW, b.w + 2 * mgn), h: Math.min(natH, b.h + 2 * mgn) };
      const active = $('[data-frame].on', m)?.dataset.frame;
      if (!FRAMES[active]?.a) aspect = b.w / b.h; // free shapes follow the content
      fw = 0; layout(false);
      // zoom so the content fills the frame, centred
      const s = Math.min(fw / b.w, fh / b.h);
      zoom = Math.max(1, s / s0); zoomEl.value = String(zoom);
      ox = fw / 2 - (b.x + b.w / 2) * scale(); oy = fh / 2 - (b.y + b.h / 2) * scale();
      clampPos(); paint();
    }
    // free crop: drag a corner or edge; the photo stays still and the frame changes shape
    $$('[data-h]', box).forEach((hd) => hd.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      hd.setPointerCapture(e.pointerId);
      const k = hd.dataset.h, s = scale();
      const imgX = fx + ox, imgY = fy + oy, imgW = natW * s, imgH = natH * s;
      const sw = stage.clientWidth, sh = stage.clientHeight;
      const minX = Math.max(0, imgX), minY = Math.max(0, imgY), maxX = Math.min(sw, imgX + imgW), maxY = Math.min(sh, imgY + imgH);
      const st = { x: e.clientX, y: e.clientY, l: fx, t: fy, r: fx + fw, b: fy + fh };
      const mv = (ev) => {
        const dx = ev.clientX - st.x, dy = ev.clientY - st.y, MIN = 24;
        let { l, t, r, b } = st;
        if (k.includes('w')) l = Math.min(r - MIN, Math.max(minX, l + dx));
        if (k.includes('e')) r = Math.max(l + MIN, Math.min(maxX, r + dx));
        if (k.includes('n')) t = Math.min(b - MIN, Math.max(minY, t + dy));
        if (k.includes('s')) b = Math.max(t + MIN, Math.min(maxY, b + dy));
        fx = l; fy = t; fw = r - l; fh = b - t; aspect = fw / fh;
        ox = imgX - fx; oy = imgY - fy;
        paint();
      };
      const up = () => {
        hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up);
        const cur = scale();
        s0 = Math.max(fw / natW, fh / natH); zoom = Math.max(1, cur / s0); zoomEl.value = String(zoom);
        clampPos(); paint();
      };
      hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
    }));
    // interactions
    let drag = null;
    const pts = new Map();
    let pinch = null;
    const local = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left - fx, e.clientY - r.top - fy]; };
    stage.addEventListener('pointerdown', (e) => {
      e.preventDefault(); stage.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, ox, oy };
      if (pts.size === 2) { const [a, b2] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b2[0], a[1] - b2[1]), z: zoom }; drag = null; }
      stage.classList.add('dragging');
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pts.size >= 2) {
        const [a, b2] = [...pts.values()];
        const r = stage.getBoundingClientRect();
        zoomTo(pinch.z * Math.hypot(a[0] - b2[0], a[1] - b2[1]) / pinch.d, (a[0] + b2[0]) / 2 - r.left - fx, (a[1] + b2[1]) / 2 - r.top - fy);
      } else if (drag) { ox = drag.ox + e.clientX - drag.x; oy = drag.oy + e.clientY - drag.y; clampPos(); paint(); }
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) { const [p0] = [...pts.values()]; drag = { x: p0[0], y: p0[1], ox, oy }; } else if (!pts.size) { drag = null; stage.classList.remove('dragging'); }
    };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      const [px, py] = local(e);
      zoomTo(zoom * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), px, py);
    }, { passive: false });
    zoomEl.addEventListener('input', () => zoomTo(Number(zoomEl.value), fw / 2, fh / 2, true));
    m.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 20 : 5;
      if (e.key === 'ArrowLeft') ox += step; else if (e.key === 'ArrowRight') ox -= step; else if (e.key === 'ArrowUp') oy += step; else if (e.key === 'ArrowDown') oy -= step;
      else if (e.key === '+' || e.key === '=') return zoomTo(zoom * 1.1); else if (e.key === '-') return zoomTo(zoom / 1.1);
      else if (e.key === 'Escape') return done(null); else return;
      e.preventDefault(); clampPos(); paint();
    });
    $$('[data-frame]', m).forEach((b) => b.addEventListener('click', () => setFrame(b.dataset.frame)));
    $('[data-act=trim]', m).addEventListener('click', trim);
    $('[data-act=reset]', m).addEventListener('click', () => setFrame($('[data-frame].on', m).dataset.frame));
    const ro = new ResizeObserver(() => layout(true));
    function done(v) { ro.disconnect(); m.classList.remove('show'); setTimeout(() => m.remove(), 250); resolve(v); }
    $('.a-modal-backdrop', m).addEventListener('click', () => done(null));
    $('[data-act=cancel]', m).addEventListener('click', () => done(null));
    $('[data-act=original]', m).addEventListener('click', () => done({ mode: 'original' }));
    $('[data-act=original-all]', m)?.addEventListener('click', () => done({ mode: 'original-all' }));
    $('[data-act=apply]', m).addEventListener('click', () => {
      const s = scale();
      const r = { x: -ox / s, y: -oy / s, w: fw / s, h: fh / s };
      const out = { mode: 'crop', ...r, natW, natH };
      if (svg) {
        const [vx, vy, vw, vh] = vbOf(svg);
        out.vb = [vx + r.x * vw / natW, vy + r.y * vh / natH, r.w * vw / natW, r.h * vh / natH].map((n) => +n.toFixed(3)).join(' ');
      }
      done(out);
    });
    requestAnimationFrame(() => { aspect = FRAMES[startFrame].a || natW / natH; m.classList.toggle('free-mode', !FRAMES[startFrame].a); layout(false); if (FRAMES[startFrame].trim) trim(); ro.observe(stage); setTimeout(() => $('[data-act=apply]', m).focus(), 60); });
  });
}

/** Crops a raster image to the chosen rectangle and returns a PNG blob (alpha kept). */
export async function cropToBlob(url, r, maxSize = 1600) {
  const img = await loadImg(url);
  const k = Math.min(1, maxSize / Math.max(r.w, r.h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.w * k)); c.height = Math.max(1, Math.round(r.h * k));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/png'));
}
