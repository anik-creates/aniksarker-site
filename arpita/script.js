/* ═══════════════════════════════════════════════════════════
   MODERN BIRTHDAY INTERACTIVITY  —  ARPITA'S 20TH BIRTHDAY
   ═══════════════════════════════════════════════════════════ */

let isPlaying = false;
let audioCtx = null;
let synthInterval = null;

/* ═══════════════════════════════════════════
   1. LOAD MESSAGES FROM JSON (Date, Title, Text)
   ═══════════════════════════════════════════ */
async function loadMessages() {
  let data = {};
  try {
    const res = await fetch('messages.json?v=' + Date.now());
    if (res.ok) {
      data = await res.json();
    }
  } catch (err) {
    console.log('Using default messages fallback');
  }

  const defaults = {
    name: "Arpita",
    birthDate: "13th November",
    birthdayTitle: "20th Birthday",
    badgeText: "13th November • 20th Birthday",
    greeting: "Dearest,",
    tagline: "Happy 20th Birthday to the Love of My Life",
    heroWish: "Happy 20th Birthday, Arpita!",
    heroMessage: "Today marks your 20th birthday — and the world is infinitely more radiant because you are in it. From your graceful smile to that enchanting look in your red and black sari, every single moment with you is pure magic.\n\nMay this year unfold with boundless joy, thrilling milestones, and every dream your heart has ever held.\n\nHere's to celebrating you on your special day and forever.",
    heroSign: "— With all my love, your Hubby ❤️",
    ctaButton: "Celebrate & Cut Cake 🎂",
    memoriesTitle: "Our Cherished Memories",
    memoriesSubtitle: "A visual timeline of moments that mean everything to me",
    footerText: "Handcrafted with ❤️ exclusively for Arpita's 20th Birthday • 13th November"
  };

  const M = Object.assign({}, defaults, data);

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('overlay-badge', `${M.birthDate.toUpperCase()} • ${M.birthdayTitle.toUpperCase()}`);
  setTxt('hero-badge', M.badgeText || `${M.birthDate} • ${M.birthdayTitle}`);
  setTxt('hero-celebration-badge', 'Birthday Girl');
  setTxt('hero-greeting', M.greeting);
  setTxt('hero-name', M.name);
  setTxt('meta-date', M.birthDate);
  setTxt('meta-title', M.birthdayTitle);
  setTxt('hero-wish', M.heroWish);
  setTxt('hero-message', M.heroMessage);
  setTxt('hero-sign', M.heroSign);
  setTxt('cta-text', M.ctaButton);
  setTxt('memories-title', M.memoriesTitle);
  setTxt('memories-subtitle', M.memoriesSubtitle);
  setTxt('footer-text', M.footerText);

  // Typewriter effect on tagline
  initTypewriter(M.tagline || defaults.tagline);
}

function initTypewriter(text) {
  const el = document.getElementById('hero-tagline');
  if (!el) return;
  el.textContent = '';
  let i = 0;
  const speed = 55;

  function type() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  setTimeout(type, 350);
}

/* ═══════════════════════════════════════════
   2. HIGH-FIDELITY WEB AUDIO SYNTHESIZER
   ═══════════════════════════════════════════ */
function playSynthMelody() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const notes = [
      { f: 261.63, d: 0.35, p: 0.4 }, // C4
      { f: 261.63, d: 0.15, p: 0.2 }, // C4
      { f: 293.66, d: 0.5,  p: 0.55 }, // D4
      { f: 261.63, d: 0.5,  p: 0.55 }, // C4
      { f: 349.23, d: 0.5,  p: 0.55 }, // F4
      { f: 329.63, d: 0.9,  p: 1.0 }, // E4

      { f: 261.63, d: 0.35, p: 0.4 }, // C4
      { f: 261.63, d: 0.15, p: 0.2 }, // C4
      { f: 293.66, d: 0.5,  p: 0.55 }, // D4
      { f: 261.63, d: 0.5,  p: 0.55 }, // C4
      { f: 392.00, d: 0.5,  p: 0.55 }, // G4
      { f: 349.23, d: 0.9,  p: 1.0 }, // F4

      { f: 261.63, d: 0.35, p: 0.4 }, // C4
      { f: 261.63, d: 0.15, p: 0.2 }, // C4
      { f: 523.25, d: 0.5,  p: 0.55 }, // C5
      { f: 440.00, d: 0.5,  p: 0.55 }, // A4
      { f: 349.23, d: 0.5,  p: 0.55 }, // F4
      { f: 329.63, d: 0.5,  p: 0.55 }, // E4
      { f: 293.66, d: 0.8,  p: 0.9 }, // D4

      { f: 466.16, d: 0.35, p: 0.4 }, // Bb4
      { f: 466.16, d: 0.15, p: 0.2 }, // Bb4
      { f: 440.00, d: 0.5,  p: 0.55 }, // A4
      { f: 349.23, d: 0.5,  p: 0.55 }, // F4
      { f: 392.00, d: 0.5,  p: 0.55 }, // G4
      { f: 349.23, d: 1.2,  p: 1.4 }  // F4
    ];

    let time = audioCtx.currentTime + 0.1;

    function scheduleSong() {
      notes.forEach(note => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.f, time);

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.exponentialRampToValueAtTime(0.28, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + note.d);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(time);
        osc.stop(time + note.d + 0.05);

        time += note.p;
      });
      time += 0.8;
    }

    scheduleSong();
    const totalDuration = notes.reduce((acc, n) => acc + n.p, 0) + 0.8;
    synthInterval = setInterval(() => {
      if (isPlaying) {
        scheduleSong();
      }
    }, totalDuration * 1000);

  } catch (e) {
    console.log('Synth error', e);
  }
}

function stopSynth() {
  if (synthInterval) {
    clearInterval(synthInterval);
    synthInterval = null;
  }
  if (audioCtx) {
    try { audioCtx.suspend(); } catch (e) {}
  }
}

/* ═══════════════════════════════════════════
   3. AUDIO CONTROLLER
   ═══════════════════════════════════════════ */
function startMusic() {
  isPlaying = true;
  const audio = document.getElementById('bg-music');
  const pillWave = document.getElementById('music-wave');
  if (pillWave) pillWave.classList.add('playing');

  let audioPlayed = false;
  if (audio) {
    try {
      audio.volume = 0.55;
    } catch(e) {}

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          audioPlayed = true;
        })
        .catch(() => {
          playSynthMelody();
        });
    }
  }

  setTimeout(() => {
    if (!audioPlayed && (!audio || audio.paused || audio.currentTime === 0)) {
      playSynthMelody();
    }
  }, 600);
}

function toggleMusic() {
  const audio = document.getElementById('bg-music');
  const pillWave = document.getElementById('music-wave');

  if (isPlaying) {
    isPlaying = false;
    if (audio) audio.pause();
    stopSynth();
    if (pillWave) pillWave.classList.remove('playing');
  } else {
    isPlaying = true;
    if (pillWave) pillWave.classList.add('playing');
    if (audio) {
      audio.play().catch(() => playSynthMelody());
    } else {
      playSynthMelody();
    }
  }
}

/* ═══════════════════════════════════════════
   4. VOLUME ENTRY GATE (100% MAXIMUM CONFIRMATION)
   ═══════════════════════════════════════════ */
function initVolumeGate() {
  const overlay = document.getElementById('entry-overlay');
  const slider = document.getElementById('volume-slider');
  const readout = document.getElementById('vol-readout');
  const indicator = document.getElementById('volume-indicator');
  const btn = document.getElementById('entry-btn');
  const btnIcon = document.getElementById('btn-lock-icon');
  const btnLabel = document.getElementById('btn-label');
  const main = document.getElementById('main-content');

  if (!slider || !btn) return;

  function updateState() {
    const val = parseInt(slider.value, 10);
    readout.textContent = val + '%';
    slider.style.background = `linear-gradient(to right, #e03c31 ${val}%, rgba(255,255,255,0.1) ${val}%)`;

    if (val >= 100) {
      indicator.textContent = '✓ Volume Confirmed at 100% (Maximum)';
      indicator.classList.add('ready');
      btn.disabled = false;
      btn.classList.add('unlocked');
      if (btnIcon) {
        btnIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
      }
      if (btnLabel) btnLabel.textContent = 'Unlock The Celebration';
    } else {
      indicator.textContent = `Slide to 100% to unlock (Currently ${val}%)`;
      indicator.classList.remove('ready');
      btn.disabled = true;
      btn.classList.remove('unlocked');
      if (btnIcon) {
        btnIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
      }
      if (btnLabel) btnLabel.textContent = 'Set Volume to 100% to Unlock';
    }
  }

  slider.addEventListener('input', updateState);
  updateState();

  btn.addEventListener('click', () => {
    if (btn.disabled) return;

    startMusic();
    overlay.classList.add('fade-out');
    main.classList.remove('content-hidden');

    triggerSparkles();

    setTimeout(() => {
      overlay.remove();
    }, 850);
  });
}

/* ═══════════════════════════════════════════
   5. MEMORY CAROUSEL (11 UNIQUE REAL PHOTOS)
   ═══════════════════════════════════════════ */
function initCarousel() {
  const TOTAL_SLIDES = 11;
  const AUTOPLAY_TIME = 4500;
  const track = document.getElementById('carousel-track');
  const dotsWrap = document.getElementById('carousel-dots');
  const counter = document.getElementById('meta-counter');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');

  if (!track || !dotsWrap) return;

  for (let i = 1; i <= TOTAL_SLIDES; i++) {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide-item';

    const img = document.createElement('img');
    img.src = `images/memory${i}.jpg`;
    img.alt = `Arpita Memory ${i}`;
    img.loading = i <= 2 ? 'eager' : 'lazy';

    slide.appendChild(img);
    track.appendChild(slide);

    const dot = document.createElement('button');
    dot.className = 'carousel-dot-chip' + (i === 1 ? ' active' : '');
    dot.setAttribute('aria-label', `Go to slide ${i}`);
    dotsWrap.appendChild(dot);
  }

  let currentIndex = 0;
  let autoTimer = null;
  const dots = dotsWrap.querySelectorAll('.carousel-dot-chip');

  function updateSlide(idx) {
    currentIndex = ((idx % TOTAL_SLIDES) + TOTAL_SLIDES) % TOTAL_SLIDES;
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentIndex);
    });

    if (counter) {
      const padIndex = (currentIndex + 1).toString().padStart(2, '0');
      counter.textContent = `${padIndex} / ${TOTAL_SLIDES.toString().padStart(2, '0')}`;
    }
  }

  function nextSlide() { updateSlide(currentIndex + 1); }
  function prevSlide() { updateSlide(currentIndex - 1); }

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(nextSlide, AUTOPLAY_TIME);
  }

  function stopAuto() {
    if (autoTimer) clearInterval(autoTimer);
  }

  if (prevBtn) prevBtn.addEventListener('click', () => { prevSlide(); startAuto(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { nextSlide(); startAuto(); });

  dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      updateSlide(idx);
      startAuto();
    });
  });

  const frame = document.querySelector('.carousel-glass-frame');
  if (frame) {
    frame.addEventListener('mouseenter', stopAuto);
    frame.addEventListener('mouseleave', startAuto);

    let startX = 0;
    frame.addEventListener('touchstart', e => {
      startX = e.changedTouches[0].clientX;
    }, { passive: true });

    frame.addEventListener('touchend', e => {
      const deltaX = e.changedTouches[0].clientX - startX;
      if (Math.abs(deltaX) > 40) {
        if (deltaX < 0) nextSlide();
        else prevSlide();
        startAuto();
      }
    }, { passive: true });
  }

  updateSlide(0);
  startAuto();
}

/* ═══════════════════════════════════════════
   6. GLOBAL CLICK-ANYWHERE LOVE ICON EFFECT
   ═══════════════════════════════════════════ */
function spawnClickLoveIcon(x, y) {
  const count = 3 + Math.floor(Math.random() * 3);
  const hearts = [
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="#e03c31" stroke="#e03c31" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="#e67e22" stroke="#e67e22" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="#ff4757" stroke="#ff4757" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
  ];

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.innerHTML = hearts[Math.floor(Math.random() * hearts.length)];
    el.style.position = 'fixed';
    el.style.zIndex = '99999';
    el.style.left = (x + (Math.random() - 0.5) * 30) + 'px';
    el.style.top = (y + (Math.random() - 0.5) * 20) + 'px';
    el.style.pointerEvents = 'none';
    el.style.filter = 'drop-shadow(0 0 6px rgba(224, 60, 49, 0.6))';
    el.style.transform = 'translate(-50%, -50%) scale(0.6)';
    el.style.opacity = '1';

    const duration = 1.2 + Math.random() * 0.8;
    const destX = (Math.random() - 0.5) * 80;
    const destY = -80 - Math.random() * 60;
    const rot = (Math.random() - 0.5) * 60;

    el.style.transition = `transform ${duration}s cubic-bezier(0.16, 1, 0.3, 1), opacity ${duration}s ease-out`;

    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = `translate(calc(-50% + ${destX}px), calc(-50% + ${destY}px)) scale(1.2) rotate(${rot}deg)`;
      el.style.opacity = '0';
    });

    setTimeout(() => el.remove(), duration * 1000);
  }
}

function initGlobalClickLove() {
  window.addEventListener('click', (e) => {
    // Avoid double triggering if clicking slider or input
    if (e.target.tagName === 'INPUT') return;
    spawnClickLoveIcon(e.clientX, e.clientY);
  });
}

/* ═══════════════════════════════════════════
   7. CELEBRATION EFFECTS
   ═══════════════════════════════════════════ */
function triggerSparkles() {
  const colors = ['#e03c31', '#e67e22', '#ffffff', '#ffd166', '#ff4757'];
  const count = 70;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.zIndex = '99999';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.top = '-10px';
    el.style.width = (Math.random() * 8 + 4) + 'px';
    el.style.height = (Math.random() * 8 + 4) + 'px';
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    el.style.borderRadius = '50%';
    el.style.pointerEvents = 'none';
    el.style.boxShadow = '0 0 10px ' + el.style.backgroundColor;

    const duration = Math.random() * 2.2 + 2;
    el.style.transition = `transform ${duration}s cubic-bezier(0.25, 1, 0.5, 1), top ${duration}s cubic-bezier(0.25, 1, 0.5, 1), opacity ${duration}s`;

    document.body.appendChild(el);

    setTimeout(() => {
      el.style.top = (window.innerHeight + 20) + 'px';
      el.style.transform = `translateX(${(Math.random() - 0.5) * 160}px) scale(0.3)`;
      el.style.opacity = '0';
    }, 20);

    setTimeout(() => el.remove(), duration * 1000);
  }
}

function showerHeartIcons() {
  const count = 25;
  for (let i = 0; i < count; i++) {
    const heartWrap = document.createElement('div');
    heartWrap.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="#e03c31" stroke="#e03c31" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    heartWrap.style.position = 'fixed';
    heartWrap.style.zIndex = '9999';
    heartWrap.style.left = Math.random() * 92 + 'vw';
    heartWrap.style.bottom = '-30px';
    heartWrap.style.pointerEvents = 'none';
    heartWrap.style.filter = 'drop-shadow(0 0 8px rgba(224, 60, 49, 0.5))';

    const duration = Math.random() * 2 + 2.5;
    heartWrap.style.transition = `all ${duration}s cubic-bezier(0.25, 1, 0.5, 1)`;

    document.body.appendChild(heartWrap);

    setTimeout(() => {
      heartWrap.style.bottom = (window.innerHeight + 50) + 'px';
      heartWrap.style.transform = `translateX(${(Math.random() - 0.5) * 90}px) scale(1.3) rotate(${(Math.random() - 0.5) * 40}deg)`;
      heartWrap.style.opacity = '0';
    }, 20);

    setTimeout(() => heartWrap.remove(), duration * 1000);
  }
}

function initChips() {
  const chipConfetti = document.getElementById('chip-confetti');
  const chipLove = document.getElementById('chip-love');
  const chipMusic = document.getElementById('chip-music');
  const chipMemories = document.getElementById('chip-memories');
  const musicPill = document.getElementById('music-pill');

  if (chipConfetti) chipConfetti.addEventListener('click', triggerSparkles);
  if (chipLove) chipLove.addEventListener('click', showerHeartIcons);
  if (chipMusic) chipMusic.addEventListener('click', toggleMusic);
  if (musicPill) musicPill.addEventListener('click', toggleMusic);

  if (chipMemories) {
    chipMemories.addEventListener('click', () => {
      const section = document.getElementById('memories');
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    });
  }
}

/* ═══════════════════════════════════════════
   8. ANIMATED PARTICLES (RED & GOLD EMBERS)
   ═══════════════════════════════════════════ */
function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;
  const particles = [];
  const COUNT = 45;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Ember {
    constructor() { this.reset(true); }
    reset(init) {
      this.x = Math.random() * W;
      this.y = init ? Math.random() * H : H + 10;
      this.r = Math.random() * 2 + 0.6;
      this.vy = -(Math.random() * 0.35 + 0.1);
      this.vx = (Math.random() - 0.5) * 0.2;
      this.alpha = Math.random() * 0.35 + 0.1;
      this.life = 0;
      this.maxLife = Math.random() * 500 + 300;
      this.isRed = Math.random() > 0.45;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life++;
      if (this.life > this.maxLife || this.y < -10) this.reset(false);
    }
    draw() {
      const fade = 1 - (this.life / this.maxLife);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      if (this.isRed) {
        ctx.fillStyle = `rgba(224, 60, 49, ${this.alpha * fade})`;
      } else {
        ctx.fillStyle = `rgba(230, 126, 34, ${this.alpha * fade * 0.8})`;
      }
      ctx.fill();
    }
  }

  for (let i = 0; i < COUNT; i++) particles.push(new Ember());

  function render() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(render);
  }
  render();
}

/* ═══════════════════════════════════════════
   INITIALIZE EVERYTHING
   ═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadMessages();
  initVolumeGate();
  initCarousel();
  initChips();
  initParticles();
  initGlobalClickLove();
});
