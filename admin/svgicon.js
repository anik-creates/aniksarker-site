// Turns an uploaded or pasted SVG into the safe shape tree stored in content.iconLibrary.
// The SVG is parsed with DOMParser (never inserted into the page), and only plain shapes with
// an allow-list of attributes are kept. The site re-checks everything again when rendering.

const TAGS = new Set(['g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);
const PASS = new Set(['svg', 'a', 'switch']); // containers whose children are kept
const ATTRS = ['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'transform'];
const PAINT = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity'];
const SAFE = /^[a-z0-9#.,\s\-+()%]*$/i;
const ok = (v) => v != null && String(v).length < 50000 && SAFE.test(String(v)) && !/url|script|expression|javascript/i.test(String(v));

function parseStyle(text) {
  const out = {};
  String(text || '').split(';').forEach((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim().toLowerCase(), v = decl.slice(i + 1).trim();
    if (PAINT.includes(k) && ok(v)) out[k] = v;
  });
  return out;
}

/** @returns {{ vb: string, els: object[], warnings: string[], colours: number }} */
export function parseSvgIcon(text) {
  text = String(text || '').trim();
  if (!text) throw new Error('No SVG code found');
  if (text.length > 300000) throw new Error('This SVG is larger than 300 KB. Simplify it or export it as an icon.');
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  if (doc.querySelector('parsererror') || svg?.localName !== 'svg') throw new Error('That is not a valid SVG file');
  const warnings = new Set();

  // viewBox (fallback to width/height)
  let vb = String(svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || vb[2] <= 0 || vb[3] <= 0) {
    const w = parseFloat(svg.getAttribute('width')) || 24, h = parseFloat(svg.getAttribute('height')) || 24;
    vb = [0, 0, w, h];
  }

  // Simple ".class { fill: … }" rules from <style> blocks (common in Illustrator exports)
  const classRules = {};
  doc.querySelectorAll('style').forEach((st) => {
    st.textContent.replace(/([^{}]+)\{([^}]*)\}/g, (_, sel, body) => {
      sel.split(',').forEach((one) => {
        const m = one.trim().match(/^\.([\w-]+)$/);
        if (m) classRules[m[1]] = { ...(classRules[m[1]] || {}), ...parseStyle(body) };
      });
    });
  });
  const paintOf = (node) => {
    const a = {};
    PAINT.forEach((k) => { const v = node.getAttribute(k); if (v != null && ok(v)) a[k] = v.trim(); else if (v != null) warnings.add('Gradients and patterns were replaced with a solid colour'); });
    String(node.getAttribute('class') || '').split(/\s+/).forEach((c) => Object.assign(a, classRules[c] || {}));
    Object.assign(a, parseStyle(node.getAttribute('style')));
    return a;
  };

  let count = 0;
  const colours = new Set();
  const walk = (node, depth) => {
    const out = [];
    for (const ch of node.children) {
      const t = ch.localName;
      if (++count > 3000) throw new Error('This SVG is too complex for an icon (over 3000 shapes)');
      if (PASS.has(t)) { out.push(...walk(ch, depth + 1)); continue; }
      if (!TAGS.has(t)) {
        if (['text', 'image', 'use', 'foreignObject'].includes(t)) warnings.add(`Unsupported <${t}> elements were left out`);
        continue;
      }
      const a = paintOf(ch);
      ATTRS.forEach((k) => { const v = ch.getAttribute(k); if (v != null && ok(v)) a[k] = v.trim(); });
      ['fill', 'stroke'].forEach((k) => { if (a[k] && a[k] !== 'none' && a[k] !== 'currentColor') colours.add(a[k].toLowerCase()); });
      const el = { t, a };
      if (t === 'g') { if (depth > 7) continue; el.c = walk(ch, depth + 1); if (!el.c.length) continue; }
      out.push(el);
    }
    return out;
  };
  const children = walk(svg, 0);
  if (!children.length) throw new Error('No shapes found in this SVG');

  // Root group: carries the svg element's own paint, and paints unfilled shapes with the theme colour
  const root = paintOf(svg);
  if (!root.fill) root.fill = 'currentColor';
  if (!root.stroke) root.stroke = 'none';
  if (root.stroke !== 'none') {
    root['stroke-width'] ||= '1';
    root['stroke-linecap'] ||= 'butt';
    root['stroke-linejoin'] ||= 'miter';
  }
  ['fill', 'stroke'].forEach((k) => { if (root[k] !== 'none' && root[k] !== 'currentColor') colours.add(root[k].toLowerCase()); });
  return { vb: vb.map((n) => +n.toFixed(3)).join(' '), els: [{ t: 'g', a: root, c: children }], warnings: [...warnings], colours: colours.size };
}

/** "My Logo.svg" -> "cu-my-logo" (unique within the library). */
export function iconIdFor(name, lib) {
  const base = 'cu-' + (String(name || 'icon').toLowerCase().replace(/\.svg$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'icon');
  let id = base, k = 2;
  while ((lib || []).some((x) => x.id === id)) id = `${base}-${k++}`;
  return id;
}
