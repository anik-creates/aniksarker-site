// Runs before first paint (loaded synchronously in <head>) so the page never flashes the
// wrong theme or accent colour. Values are cached by app.js from the published content.
(function () {
  // Clickjacking guard: if another website frames this page, hide it and break out.
  // (Same-site frames, like the admin's visual builder preview, are allowed.)
  if (window.top !== window.self) {
    var same = false;
    try { same = window.top.location.origin === window.location.origin; } catch (e) { same = false; }
    if (!same) {
      document.documentElement.style.visibility = 'hidden';
      try { window.top.location = window.location.href; } catch (e) {}
    }
  }
  var t = null, d = 'dark', c = {};
  try {
    t = localStorage.getItem('theme');
    d = localStorage.getItem('theme.default') || 'dark';
    c = JSON.parse(localStorage.getItem('site.cache') || '{}');
  } catch (e) {}
  if (t !== 'light' && t !== 'dark') {
    t = d === 'light' || d === 'dark' ? d : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }
  var root = document.documentElement;
  root.setAttribute('data-theme', t);
  ['a1', 'a2', 'a3'].forEach(function (k) {
    if (/^#[0-9a-f]{6}$/i.test(c[k] || '')) root.style.setProperty('--' + k, c[k]);
  });
})();
