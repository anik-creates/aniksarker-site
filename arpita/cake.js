/* ═══════════════════════════════════════════════════════════
   CAKE PAGE LOGIC  —  BLOW DETECTION, REAL-TIME SLICE & SECRET LETTER
   ═══════════════════════════════════════════════════════════ */

let quizData = [];
let secretLetterData = {};
let candlesBlown = false;
let cakeSliced = false;
let userAnswers = {};

// Microphone audio stream
let audioStream = null;
let audioContext = null;
let analyser = null;
let micAnimationId = null;

// Slicing drag state
let isDraggingKnife = false;
let cutProgress = 0; // 0.0 to 1.0

/* ═══════════════════════════════════════════
   1. LOAD DATA FROM JSON
   ═══════════════════════════════════════════ */
async function loadCakeData() {
  try {
    const res = await fetch('messages.json?v=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      quizData = data.quiz || getDefaultQuiz();
      secretLetterData = data.secretMessage || getDefaultLetter();
    } else {
      quizData = getDefaultQuiz();
      secretLetterData = getDefaultLetter();
    }
  } catch (err) {
    quizData = getDefaultQuiz();
    secretLetterData = getDefaultLetter();
  }

  renderQuiz();
}

function getDefaultQuiz() {
  return [
    {
      id: 1,
      question: "Where did you meet Anik for the first time?",
      options: ["Chunkutia", "Rajendrapur", "Ramna", "Lalbag"],
      answer: "Chunkutia"
    },
    {
      id: 2,
      question: "What was the shirt color of your Hubby on your first meet?",
      options: ["White", "Black", "Ash", "Maroon"],
      answer: "White"
    },
    {
      id: 3,
      question: "Where did you have your first kiss?",
      options: ["Rajendrapur", "Lalbag", "Chunkutia", "Ramna"],
      answer: "Rajendrapur"
    }
  ];
}

function getDefaultLetter() {
  return {
    title: "A Secret Letter From Your Hubby ❤️",
    subtitle: "Only for my real Arpi • 13th November",
    content: "My Sweetest Arpi,\n\nHappy 20th Birthday, my love!\n\nFrom that very first day we met at Chunkutia with me in that white shirt, to that magical first kiss at Rajendrapur, every memory with you has been etched forever into my heart.\n\nYou look so breathtaking in that red and black sari, but even more beautiful is the warmth, laughter, and kindness you bring into my world every single day.\n\nThank you for choosing me, for believing in us, and for being my greatest blessing. On this milestone 20th birthday, I promise to hold your hand, stand by your side through every storm and sunshine, and love you more and more with each passing breath.\n\nForever & always yours,\nAnik (Your Hubby) ❤️"
  };
}

/* ═══════════════════════════════════════════
   2. PRECISION BLOW DETECTION (WIND TURBULENCE ONLY)
   ═══════════════════════════════════════════ */
function initMicPermission() {
  const allowBtn = document.getElementById('allow-mic-btn');
  const entryModal = document.getElementById('mic-entry-modal');

  if (!allowBtn) return;

  allowBtn.addEventListener('click', async () => {
    await startMicrophoneStream();
    if (entryModal) {
      entryModal.classList.remove('active');
    }
  });
}

async function startMicrophoneStream() {
  const meterFill = document.getElementById('meter-fill');
  const meterText = document.getElementById('meter-text');
  const micIcon = document.getElementById('mic-icon');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (meterText) meterText.textContent = "Mic unavailable • Tap candle to blow";
    return;
  }

  try {
    // Disable noise suppression & echo cancellation so raw wind pressure reaches analyser
    const constraints = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      },
      video: false
    };

    audioStream = await navigator.mediaDevices.getUserMedia(constraints);
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.15;

    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(analyser);

    if (micIcon) micIcon.classList.add('active');
    if (meterText) meterText.textContent = "Listening... Blow hard directly into mic! 💨";

    const bufferLength = analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    let blowSustainFrames = 0;

    function analyzeSound() {
      if (candlesBlown) return;

      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      // 1. Low-frequency wind rumble (0 - 150 Hz): Bins 0 to 4
      // Direct breath hitting mic capsule causes violent low-end diaphragm displacement
      let lowRumble = 0;
      for (let i = 0; i <= 3; i++) {
        lowRumble += freqData[i];
      }
      lowRumble /= 4;

      // 2. Mid voice energy (200 - 1000 Hz): Bins 5 to 20
      // Normal speech concentrates energy here with distinct harmonic formants
      let midVoice = 0;
      for (let i = 5; i <= 20; i++) {
        midVoice += freqData[i];
      }
      midVoice /= 16;

      // 3. High hiss breath turbulence (1200 - 3000 Hz): Bins 25 to 60
      let highHiss = 0;
      for (let i = 25; i <= 60; i++) {
        highHiss += freqData[i];
      }
      highHiss /= 36;

      // 4. Time domain amplitude swing
      let maxDelta = 0;
      for (let i = 0; i < bufferLength; i++) {
        let delta = Math.abs(timeData[i] - 128);
        if (delta > maxDelta) maxDelta = delta;
      }

      // Live meter response
      let displayScore = Math.min(100, Math.round((lowRumble * 0.6) + (highHiss * 0.7) + (maxDelta * 0.5)));
      if (meterFill) {
        meterFill.style.width = Math.max(5, displayScore) + '%';
      }

      /*
        BLOW SIGNATURE CRITERIA:
        - Wind rumble > 70 OR (maxDelta > 28 AND highHiss > 32)
        - Speech rejection: If midVoice is way higher than lowRumble and lowRumble < 50, it's talking/music, NOT blowing!
      */
      const isBreathTurbulence = (lowRumble > 65 || (maxDelta > 28 && highHiss > 30));
      const isNotJustVoice = (lowRumble > midVoice * 0.7) || (lowRumble > 65);

      if (isBreathTurbulence && isNotJustVoice) {
        blowSustainFrames++;
        if (meterText) meterText.textContent = "Blowing detected! Keep blowing... 💨";

        // Must be sustained for at least 5 frames (~100ms) to ensure it's a real breath
        if (blowSustainFrames >= 5) {
          extinguishCandles();
          return;
        }
      } else {
        blowSustainFrames = Math.max(0, blowSustainFrames - 1);
        if (meterText && blowSustainFrames === 0) {
          meterText.textContent = "Listening... Blow directly into mic! 💨";
        }
      }

      micAnimationId = requestAnimationFrame(analyzeSound);
    }

    analyzeSound();

  } catch (err) {
    console.log("Mic note:", err);
    if (meterText) meterText.textContent = "Mic optional • Tap candle to blow!";
  }
}

function extinguishCandles() {
  if (candlesBlown) return;
  candlesBlown = true;

  if (micAnimationId) cancelAnimationFrame(micAnimationId);
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
  }

  // Staggered candle extinction with smoke
  const candles = document.querySelectorAll('.candle');
  candles.forEach((c, idx) => {
    setTimeout(() => {
      c.classList.add('blown');
    }, idx * 100);
  });

  // Update instruction & activate interactive knife cutting
  setTimeout(() => {
    const stepInd = document.getElementById('step-indicator');
    const title = document.getElementById('instruction-title');
    const desc = document.getElementById('instruction-desc');
    const meterWrap = document.getElementById('mic-meter-wrap');
    const knife = document.getElementById('cake-knife');
    const sliceGuide = document.getElementById('slice-guide-group');

    if (stepInd) stepInd.textContent = "STEP 2 OF 3";
    if (title) title.textContent = "Candles Blown! Make a Wish! ✨";
    if (desc) desc.textContent = "Take the knife and slice the birthday cake for Arpi! 🍰";
    if (meterWrap) meterWrap.style.display = 'none';

    if (sliceGuide) {
      sliceGuide.classList.add('visible');
    }

    if (knife) {
      knife.classList.add('visible');
    }

    triggerSparkles();
  }, 650);
}

/* ═══════════════════════════════════════════
   3. REAL-TIME INTERACTIVE CAKE CUTTING
   (Cake cuts dynamically as knife moves — Intact Heart, Never Broken 💔)
   ═══════════════════════════════════════════ */
function playSliceSound(progress) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!audioContext) audioContext = new AudioCtx();
    if (audioContext.state === 'suspended') audioContext.resume();

    // Slicing texture: Bandpass filtered noise burst
    const bufferSize = Math.floor(audioContext.sampleRate * 0.06);
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1600 + (progress * 1000);
    filter.Q.value = 2.0;

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.06, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    noise.start();
  } catch (e) {
    // Audio optional fallback
  }
}

function playCelebrationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!audioContext) audioContext = new AudioCtx();
    if (audioContext.state === 'suspended') audioContext.resume();

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 sweet arpeggio
    notes.forEach((freq, idx) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, audioContext.currentTime + idx * 0.1);

      gain.gain.setValueAtTime(0.12, audioContext.currentTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + idx * 0.1 + 0.5);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(audioContext.currentTime + idx * 0.1);
      osc.stop(audioContext.currentTime + idx * 0.1 + 0.55);
    });
  } catch (e) {}
}

function initInteractiveCakeCutting() {
  const knife = document.getElementById('cake-knife');
  const cakeWrap = document.getElementById('heart-cake-wrap');
  const cakeStage = document.getElementById('cake-stage');
  const sliceWedge = document.getElementById('cake-slice-wedge');
  const sliceCavity = document.getElementById('cake-slice-cavity');
  const dynamicCutSeam = document.getElementById('dynamic-cut-seam');
  const sliceGuide = document.getElementById('slice-guide-group');
  const knifeHint = document.getElementById('knife-hint');
  const candles = document.querySelectorAll('.candle');

  // Secret candle click bypass
  candles.forEach(candle => {
    candle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!candlesBlown) {
        extinguishCandles();
      }
    });
  });

  if (!knife || !cakeWrap) return;

  let lastMoveTime = 0;

  function updateKnifeAndCut(clientX, clientY) {
    if (!candlesBlown || cakeSliced) return;

    const rect = cakeWrap.getBoundingClientRect();
    const stageRect = cakeStage.getBoundingClientRect();

    // Position knife relative to cake stage
    const knifeX = clientX - stageRect.left;
    const knifeY = clientY - stageRect.top;

    // Tilt blade naturally based on motion
    knife.style.transform = `translate(${knifeX}px, ${knifeY}px) rotate(20deg)`;

    // Check if cursor is over or near the cake bounds
    const isOverCake = (
      clientX >= rect.left - 20 &&
      clientX <= rect.right + 20 &&
      clientY >= rect.top &&
      clientY <= rect.bottom + 20
    );

    if (isOverCake) {
      // Calculate progress across cake
      // Slice area apex is ~ (252, 280), outer is ~ (380, 295) and (315, 360)
      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;

      // Increment progress with each cutting movement over the cake
      const now = performance.now();
      if (now - lastMoveTime > 30) {
        lastMoveTime = now;
        cutProgress = Math.min(1.0, cutProgress + 0.08);

        // Sound feedback
        playSliceSound(cutProgress);

        // Spark particles at knife contact point
        spawnKnifeSparks(clientX, clientY);

        // Update live cut seam in SVG
        if (dynamicCutSeam) {
          dynamicCutSeam.classList.add('cutting-active');

          if (cutProgress <= 0.5) {
            const p1 = cutProgress * 2;
            const x1 = 252 + (380 - 252) * p1;
            const y1 = 280 + (295 - 280) * p1;
            dynamicCutSeam.setAttribute('d', `M252 280 L${x1.toFixed(1)} ${y1.toFixed(1)}`);
          } else {
            const p2 = (cutProgress - 0.5) * 2;
            const x2 = 252 + (315 - 252) * p2;
            const y2 = 280 + (360 - 280) * p2;
            dynamicCutSeam.setAttribute('d', `M252 280 L380 295 M252 280 L${x2.toFixed(1)} ${y2.toFixed(1)}`);
          }
        }

        if (knifeHint) {
          knifeHint.textContent = `Slicing Cake: ${Math.round(cutProgress * 100)}% 🔪`;
        }

        // When cut reaches >= 85% -> Complete slice!
        if (cutProgress >= 0.85) {
          completeCakeSlice();
        }
      }
    }
  }

  function completeCakeSlice() {
    if (cakeSliced) return;
    cakeSliced = true;

    // 1. Reveal inside cavity & slide slice wedge smoothly onto server spatula
    // NOTE: The main heart cake remains 100% WHOLE and INTACT! (Never broken in two 💔)
    if (sliceCavity) sliceCavity.classList.add('active');
    if (sliceWedge) sliceWedge.classList.add('cut-done');

    // 2. Finalize dynamic cut seam with golden celebratory glow
    if (dynamicCutSeam) {
      dynamicCutSeam.setAttribute('d', 'M252 280 L380 295 M252 280 L315 360');
      dynamicCutSeam.classList.add('cut-complete');
    }

    // 3. Hide knife smoothly
    if (knife) {
      knife.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      knife.style.opacity = '0';
      knife.style.transform = 'translate(60%, 220px) rotate(45deg)';
    }

    // 4. Celebratory sound & visuals
    playCelebrationChime();
    triggerSparkles();
    showerHeartIcons();

    // 5. Update instructions & reveal secret message button
    setTimeout(() => {
      const stepInd = document.getElementById('step-indicator');
      const title = document.getElementById('instruction-title');
      const desc = document.getElementById('instruction-desc');
      const secretWrap = document.getElementById('secret-btn-wrap');

      if (stepInd) stepInd.textContent = "STEP 3 OF 3";
      if (title) title.textContent = "Cake Sliced! Happy 20th Birthday, Arpi! 🍰";
      if (desc) desc.textContent = "A sweet first slice has been served! Open your secret message from your Hubby below.";
      if (secretWrap) secretWrap.classList.add('visible');
    }, 450);
  }

  // Pointer drag events (Works universally across Desktop Mouse & Mobile Touch)
  cakeStage.addEventListener('pointerdown', (e) => {
    if (!candlesBlown || cakeSliced) return;
    isDraggingKnife = true;
    knife.classList.add('active-drag');
    updateKnifeAndCut(e.clientX, e.clientY);
  });

  window.addEventListener('pointermove', (e) => {
    if (isDraggingKnife && !cakeSliced) {
      updateKnifeAndCut(e.clientX, e.clientY);
    }
  });

  window.addEventListener('pointerup', () => {
    isDraggingKnife = false;
    if (knife) knife.classList.remove('active-drag');
  });

  window.addEventListener('pointercancel', () => {
    isDraggingKnife = false;
    if (knife) knife.classList.remove('active-drag');
  });

  // Touch drag events fallback
  cakeStage.addEventListener('touchstart', (e) => {
    if (!candlesBlown || cakeSliced) return;
    isDraggingKnife = true;
    knife.classList.add('active-drag');
    updateKnifeAndCut(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (isDraggingKnife && !cakeSliced && e.touches.length > 0) {
      updateKnifeAndCut(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    isDraggingKnife = false;
    if (knife) knife.classList.remove('active-drag');
  });

  // Tap / click fallback: tapping on the cake cuts the slice automatically
  cakeWrap.addEventListener('click', (e) => {
    if (candlesBlown && !cakeSliced) {
      // Smoothly animate cut progress to completion
      let p = cutProgress;
      const stepInterval = setInterval(() => {
        p += 0.2;
        updateKnifeAndCut(e.clientX, e.clientY);
        if (p >= 1.0) {
          clearInterval(stepInterval);
          completeCakeSlice();
        }
      }, 50);
    }
  });
}

function spawnKnifeSparks(x, y) {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.zIndex = '9999';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.width = '5px';
  el.style.height = '5px';
  el.style.borderRadius = '50%';
  el.style.backgroundColor = Math.random() > 0.5 ? '#f1c40f' : '#ffffff';
  el.style.boxShadow = '0 0 8px #f1c40f';
  el.style.pointerEvents = 'none';

  const destX = (Math.random() - 0.5) * 40;
  const destY = -15 - Math.random() * 25;
  el.style.transition = 'all 0.6s ease-out';

  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.transform = `translate(${destX}px, ${destY}px) scale(0.2)`;
    el.style.opacity = '0';
  });

  setTimeout(() => el.remove(), 600);
}

/* ═══════════════════════════════════════════
   4. ARPI VERIFICATION QUIZ & SECRET LETTER
   ═══════════════════════════════════════════ */
function renderQuiz() {
  const container = document.getElementById('quiz-container');
  if (!container || !quizData.length) return;

  container.innerHTML = '';
  userAnswers = {};

  quizData.forEach((q, idx) => {
    const item = document.createElement('div');
    item.className = 'quiz-item';
    item.id = `quiz-q-${q.id}`;

    const title = document.createElement('div');
    title.className = 'quiz-question';
    title.innerHTML = `<span class="q-num">0${idx + 1}.</span> <span>${q.question}</span>`;
    item.appendChild(title);

    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'quiz-options';

    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-btn';
      btn.textContent = opt;

      btn.addEventListener('click', () => {
        optionsWrap.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        userAnswers[q.id] = opt;
        item.classList.remove('wrong');

        checkQuizComplete();
      });

      optionsWrap.appendChild(btn);
    });

    item.appendChild(optionsWrap);
    container.appendChild(item);
  });
}

function checkQuizComplete() {
  const submitBtn = document.getElementById('quiz-submit-btn');
  const answeredCount = Object.keys(userAnswers).length;

  if (submitBtn) {
    submitBtn.disabled = answeredCount < quizData.length;
  }
}

function initQuizModal() {
  const openBtn = document.getElementById('open-secret-btn');
  const quizModal = document.getElementById('quiz-modal');
  const cancelBtn = document.getElementById('quiz-cancel-btn');
  const submitBtn = document.getElementById('quiz-submit-btn');
  const errorMsg = document.getElementById('quiz-error');
  const letterModal = document.getElementById('letter-modal');
  const letterCloseBtn = document.getElementById('letter-close-btn');

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (quizModal) quizModal.classList.add('active');
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (quizModal) quizModal.classList.remove('active');
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      let allCorrect = true;

      quizData.forEach(q => {
        const itemEl = document.getElementById(`quiz-q-${q.id}`);
        const userChoice = userAnswers[q.id];

        if (userChoice !== q.answer) {
          allCorrect = false;
          if (itemEl) itemEl.classList.add('wrong');
        } else {
          if (itemEl) itemEl.classList.add('correct');
        }
      });

      if (allCorrect) {
        if (errorMsg) errorMsg.textContent = '';
        if (quizModal) quizModal.classList.remove('active');
        revealSecretLetter();
      } else {
        if (errorMsg) {
          errorMsg.textContent = "Oops! Impostor detected! Only my real Arpi knows these answers 🥰 Try again!";
        }
      }
    });
  }

  if (letterCloseBtn) {
    letterCloseBtn.addEventListener('click', () => {
      if (letterModal) letterModal.classList.remove('active');
    });
  }
}

function revealSecretLetter() {
  const letterModal = document.getElementById('letter-modal');
  const title = document.getElementById('letter-title');
  const subtitle = document.getElementById('letter-subtitle');
  const content = document.getElementById('letter-content');

  if (title) title.textContent = secretLetterData.title || "A Secret Letter From Your Hubby ❤️";
  if (subtitle) subtitle.textContent = secretLetterData.subtitle || "Only for my real Arpi • 13th November";
  if (content) content.textContent = secretLetterData.content || "";

  if (letterModal) {
    letterModal.classList.add('active');
    triggerSparkles();
    showerHeartIcons();
  }
}

/* ═══════════════════════════════════════════
   5. GLOBAL CLICK-ANYWHERE LOVE ICON EFFECT
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
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || isDraggingKnife) return;
    spawnClickLoveIcon(e.clientX, e.clientY);
  });
}

/* ═══════════════════════════════════════════
   6. CELEBRATION SPARKS & HEARTS
   ═══════════════════════════════════════════ */
function triggerSparkles() {
  const colors = ['#e03c31', '#e67e22', '#ffffff', '#ffd166', '#ff4757'];
  const count = 60;

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

/* ═══════════════════════════════════════════
   7. AMBIENT PARTICLES
   ═══════════════════════════════════════════ */
function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H;
  const particles = [];
  const COUNT = 35;

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
   INITIALIZE CAKE EXPERIENCE
   ═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadCakeData();
  initMicPermission();
  initInteractiveCakeCutting();
  initQuizModal();
  initGlobalClickLove();
  initParticles();
});
