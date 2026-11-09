// Colour tools: pull a palette out of a photo and turn one base colour into accent schemes.

export const hexToRgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** Dominant colours of an image (ignores transparent, near-white and near-black pixels). */
export async function extractPalette(src, count = 8) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not read the image'));
    i.src = src;
  });
  const size = 96;
  const scale = size / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const [, s, l] = rgbToHsl(r, g, b);
    if (l > 0.93 || l < 0.07) continue;
    const key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4);
    const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0, s: 0 };
    e.r += r; e.g += g; e.b += b; e.n++; e.s += s;
    buckets.set(key, e);
  }
  const ranked = [...buckets.values()]
    .map((e) => ({ hex: rgbToHex(e.r / e.n, e.g / e.n, e.b / e.n), n: e.n, s: e.s / e.n }))
    .sort((a, b) => b.n * (0.35 + b.s) - a.n * (0.35 + a.s));
  const out = [];
  for (const c2 of ranked) {
    const [h1, s1, l1] = rgbToHsl(...hexToRgb(c2.hex));
    const close = out.some((o) => {
      const [h2, s2, l2] = rgbToHsl(...hexToRgb(o));
      const dh = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2));
      return dh < 18 && Math.abs(l1 - l2) < 0.18 && Math.abs(s1 - s2) < 0.3;
    });
    if (!close) out.push(c2.hex);
    if (out.length >= count) break;
  }
  return out;
}

/** Accent schemes from one base colour, tuned to look good on the site's dark and light themes. */
export function schemesFor(hex) {
  const [h, s0] = rgbToHsl(...hexToRgb(hex));
  const s = s0 < 0.12 ? 0.55 : Math.min(0.92, Math.max(0.62, s0 + 0.2));
  const c = (dh, ds = 0, l = 0.64) => hslToHex(h + dh, Math.min(0.95, Math.max(0.35, s + ds)), l);
  return [
    { name: 'Analogous', desc: 'Neighbouring hues, calm and cohesive', a: [c(0), c(32), c(64)] },
    { name: 'Monochrome', desc: 'One hue in three shades', a: [c(0, 0, 0.6), c(8, -0.12, 0.72), c(-10, 0.05, 0.54)] },
    { name: 'Complementary', desc: 'Base plus its opposite for contrast', a: [c(0), c(30, -0.05), c(180)] },
    { name: 'Split', desc: 'Base with two soft contrasts', a: [c(0), c(150), c(210)] },
    { name: 'Triad', desc: 'Three evenly spaced, vibrant', a: [c(0), c(120), c(240)] },
  ];
}
