// Boot screen: an interactive dot field in the site's accent colour with a progress ring.
// Dots swell and push away from the pointer; when the page is ready an iris opens from the centre.
// Shown once per browser session. app.js calls window.__boot.finish(cb) when the page is ready.
(function () {
  var el = document.getElementById('preloader');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen = false, off = false, cache = {};
  try {
    seen = !!sessionStorage.getItem('seenPreloader');
    off = localStorage.getItem('pl.off') === '1';
    cache = JSON.parse(localStorage.getItem('site.cache') || '{}');
  } catch (e) {}
  if (!el || seen || off || reduce) {
    if (el) el.classList.add('skip');
    window.__boot = { finish: function (cb) { if (el) el.remove(); cb && cb(); } };
    return;
  }
  try { sessionStorage.setItem('seenPreloader', '1'); } catch (e) {}

  var q = function (s) { return el.querySelector(s); };
  if (cache.initials) q('[data-initials]').textContent = cache.initials;
  if (cache.name) q('[data-name]').textContent = cache.name;

  var canvas = q('canvas'), ctx = canvas.getContext('2d');
  var ring = q('.pl-prog'), pctEl = q('[data-pct]');
  var accent = getComputedStyle(document.documentElement).getPropertyValue('--a1').trim() || '#ff6a1f';
  var dark = document.documentElement.getAttribute('data-theme') !== 'light';
  var dpr = Math.min(window.devicePixelRatio || 1, 2), W = 0, H = 0, GAP = 30;
  var px = -1, py = -1, hasPointer = false, started = performance.now(), MIN = 1500;
  var pct = 0, ready = false, done = false, closing = 0, cbs = [];

  function size() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();
  window.addEventListener('resize', size);

  function frame(t) {
    if (done) return;
    var elapsed = t - started;
    // Wander gently until the visitor moves the pointer
    var cx = hasPointer ? px : W / 2 + Math.cos(t / 900) * W * 0.18;
    var cy = hasPointer ? py : H / 2 + Math.sin(t / 700) * H * 0.14;
    var wave = (elapsed / 4) % Math.max(W, H);
    // Follow the accent live: the site's own colour arrives once its content has loaded
    accent = getComputedStyle(document.documentElement).getPropertyValue('--a1').trim() || accent;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = accent;
    for (var x = GAP / 2; x < W; x += GAP) {
      for (var y = GAP / 2; y < H; y += GAP) {
        var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
        var near = Math.exp(-(d * d) / (2 * 130 * 130));
        var dw = Math.abs(Math.sqrt((x - W / 2) * (x - W / 2) + (y - H / 2) * (y - H / 2)) - wave);
        var ripple = Math.exp(-(dw * dw) / (2 * 26 * 26)) * 0.6;
        var push = near * 14 / Math.max(d, 1);
        var r = 0.9 + near * 3.2 + ripple * 1.4;
        ctx.globalAlpha = (dark ? 0.12 : 0.18) + near * 0.8 + ripple * 0.35;
        ctx.beginPath();
        ctx.arc(x + dx * push, y + dy * push, r, 0, 6.283);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    var goal = ready && elapsed > MIN ? 100 : Math.min(88, elapsed / 22);
    pct += (goal - pct) * (ready ? 0.16 : 0.06);
    ring.style.strokeDashoffset = String(100 - pct);
    pctEl.textContent = Math.round(pct) + '%';
    if (ready && elapsed > MIN && pct > 99.4 && !closing) { closing = performance.now(); el.classList.add('locked'); }
    if (closing) return reveal();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Iris: a hole opens from the centre and grows until the whole site shows through
  function reveal() {
    done = true;
    var t0 = performance.now(), max = Math.hypot(W, H) / 2 + 40;
    setTimeout(function () { cbs.forEach(function (f) { f(); }); cbs = []; }, 180);
    (function step(now) {
      var k = Math.min(1, (now - t0) / 750), e = 1 - Math.pow(1 - k, 3);
      el.style.setProperty('--iris', (e * max).toFixed(1) + 'px');
      if (k < 1) requestAnimationFrame(step); else el.remove();
    })(t0);
  }

  function move(x, y) { hasPointer = true; px = x; py = y; }
  el.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); });
  el.addEventListener('touchmove', function (e) { var p = e.touches[0]; move(p.clientX, p.clientY); }, { passive: true });
  function skipNow() { if (!done) { MIN = 0; ready = true; pct = 99.5; } }
  el.addEventListener('click', skipNow);
  window.addEventListener('keydown', function onKey() { skipNow(); window.removeEventListener('keydown', onKey); });

  // Never trap the visitor behind the boot screen
  setTimeout(function () { ready = true; }, 6000);
  setTimeout(function () { if (!done) reveal(); }, 9000);

  window.__boot = { finish: function (cb) { if (done) { cb && cb(); return; } if (cb) cbs.push(cb); ready = true; } };
})();
