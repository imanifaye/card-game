/*
 *  Design School is a Game
 *  A four-question quiz deals one of six design-student cards (Figma: Mini-Capstone,
 *  "Final Card Iterations"); the results page puts the player's face in the card's
 *  Canvas with getUserMedia.
 *
 *  Each card has a fixed rarity (its star count), and the Canvas runs the matching
 *  shaders.com WebGPU effect:
 *  Common (1 star) → ChromaticAberration, Rare (2) → Engraving, Legendary (3) → Glitch.
 *  Without WebGPU the plain <video> / snapshot is shown instead.
 */

'use strict';

// ───────── Data ─────────

// Colors are the Figma color styles; CSS reads them as custom properties.
const PALETTE = {
  cream: '#faebce',   // Warm Cream
  sand: '#cbc1a6',    // Sand Beige
  gold: '#c7a565',    // Antique Gold
  orchid: '#fe7efe',  // Bright Orchid
  citron: '#d7d36f',  // Muted Citron
  navy: '#2b2d43',    // Midnight Navy
  slate: '#616595',   // Slate Violet
  orange: '#be4d17'   // Burnt Orange
};

const P = PALETTE;

// One entry per Figma card. `onCanvas` is the ink used on top of the Canvas
// (placeholder icon, Engraving lines) and contrasts with `canvas`.
const CARDS = {
  'all-nighter': {
    title: 'The All-Nighter', rarity: 'legendary', stars: 3,
    text: 'the ultimate design student superpower, but comes at a heavy price.',
    blurb: 'You finish everything, eventually, at 4am. The only three-star card in the deck.',
    bg: P.navy, border: P.citron, shadow: P.slate,
    canvas: P.slate, canvasBorder: P.citron, onCanvas: P.cream,
    titleColor: P.orchid, titleSize: 31,
    box: P.slate, boxBorder: P.citron, body: P.cream
  },
  'pixel-pusher': {
    title: 'The Pixel Pusher', rarity: 'rare', stars: 2,
    text: 'spend two hours fixing one minor issue.',
    blurb: 'Nobody else saw the problem. You did, and now it’s perfect.',
    bg: P.orange, border: P.navy, shadow: P.citron,
    canvas: P.gold, canvasBorder: P.navy, onCanvas: P.navy,
    titleColor: P.citron, titleSize: 31,
    box: P.gold, boxBorder: P.navy, body: P.navy
  },
  'silent-crit': {
    title: 'The Silent Crit', rarity: 'rare', stars: 2,
    text: 'no feedback, no participation, just a sea of eyes staring back at you.',
    blurb: 'You’ve survived the quietest room in art school. Twice.',
    bg: P.slate, border: P.navy, shadow: P.navy,
    canvas: P.sand, canvasBorder: P.navy, onCanvas: P.navy,
    titleColor: P.sand, titleSize: 31,
    box: P.sand, boxBorder: P.navy, body: P.navy
  },
  'dusty-awl': {
    title: 'The Dusty Awl', rarity: 'common', stars: 1,
    text: 'comes in clutch for print projects. use once and forget in a desk drawer.',
    blurb: 'Not used often, but you’re exactly what’s needed when the moment comes.',
    bg: P.citron, border: P.navy, shadow: P.slate,
    canvas: P.cream, canvasBorder: P.gold, onCanvas: P.navy,
    titleColor: P.navy, titleSize: 31,
    box: P.cream, boxBorder: P.gold, body: P.navy
  },
  'lonely-runt': {
    title: 'The Lonely Runt', rarity: 'common', stars: 1,
    text: 'what? it can’t be? surely i didn’t overlook... that’s impossible!',
    blurb: 'The last one left on the sheet. Small, a little forgotten, completely yours.',
    bg: P.gold, border: P.navy, shadow: P.orange,
    canvas: P.navy, canvasBorder: P.navy, onCanvas: P.cream,
    titleColor: P.navy, titleSize: 31,
    box: P.navy, boxBorder: P.navy, body: P.cream
  },
  'misaligned-print': {
    title: 'The Misaligned Print', rarity: 'common', stars: 1,
    text: '30 hours. 300 pages. straight in the trash.',
    blurb: 'Big plans, bigger print run, one millimeter off. You’ll laugh about it later.',
    bg: P.orchid, border: P.navy, shadow: P.navy,
    canvas: P.citron, canvasBorder: P.orange, onCanvas: P.navy,
    titleColor: P.navy, titleSize: 28,
    box: P.citron, boxBorder: P.orange, body: P.navy
  }
};

const CARD_KEYS = Object.keys(CARDS);

// Each answer gives 2 points to one card and 1 to another.
// Every card can win (checked by trying all 64 answer combinations).
const QUESTIONS = [
  {
    title: 'It’s the night before critique. You…',
    options: [
      { label: 'Stay up and finish everything', scores: { 'all-nighter': 2, 'pixel-pusher': 1 } },
      { label: 'Keep polishing one tiny detail', scores: { 'pixel-pusher': 2, 'misaligned-print': 1 } },
      { label: 'Send it to the printer and hope', scores: { 'misaligned-print': 2, 'dusty-awl': 1 } },
      { label: 'Wonder if anyone would notice if yours was missing', scores: { 'lonely-runt': 2, 'silent-crit': 1 } }
    ]
  },
  {
    title: 'In critique, you’re the one who…',
    options: [
      { label: 'Nods and says nothing', scores: { 'silent-crit': 2, 'lonely-runt': 1 } },
      { label: 'Has notes on everyone’s kerning', scores: { 'pixel-pusher': 2, 'all-nighter': 1 } },
      { label: 'Shows up on two hours of sleep', scores: { 'all-nighter': 2, 'misaligned-print': 1 } },
      { label: 'Brought the tool everyone forgot', scores: { 'dusty-awl': 2, 'silent-crit': 1 } }
    ]
  },
  {
    title: 'Your desk drawer is full of…',
    options: [
      { label: 'Tools you used exactly once', scores: { 'dusty-awl': 2, 'lonely-runt': 1 } },
      { label: 'Test prints that came out crooked', scores: { 'misaligned-print': 2, 'pixel-pusher': 1 } },
      { label: 'Empty energy drink cans', scores: { 'all-nighter': 2, 'silent-crit': 1 } },
      { label: 'Sketches nobody has seen', scores: { 'lonely-runt': 2, 'silent-crit': 1 } }
    ]
  }
];

// shaders.com ESM bundle, pinned. https://shaders.com/docs/components
const SHADERS_URL = 'https://cdn.jsdelivr.net/npm/shaders@4.0.4/dist/js/bundle.js';

// Canvas shader per rarity, from common to legendary.
const EFFECTS = {
  common: {
    type: 'ChromaticAberration',
    label: 'Chromatic Aberration',
    props: () => ({ strength: 0.35, angle: 20 })
  },
  rare: {
    type: 'Engraving',
    label: 'Engraving',
    props: (c) => ({ style: 'crosshatch', frequency: 110, inkColor: c.onCanvas, paperColor: c.canvas })
  },
  legendary: {
    type: 'Glitch',
    label: 'Glitch',
    props: () => ({ intensity: 0.8, speed: 1, rgbShift: 8, colorBarIntensity: 0.3 }),
    // Glitch fires in bursts: at intensity 0.8 a full burst is on only ~40% of
    // the time, so a download could land on a clean frame. At 1 the burst is on
    // every frame, so exports switch to it for the captured frame only.
    exportProps: { intensity: 1 }
  }
};

const RARITY_LABEL = { common: 'Common', rare: 'Rare', legendary: 'Legendary' };

// Star icons exported from the Figma cards, one per card color.
const STAR_SRC = (key) => `assets/stars/star-${key}.svg`;

const SCREENS = ['intro', 'q1', 'q2', 'q3', 'q4', 'camera', 'results'];

// ───────── Elements ─────────

const $ = (sel) => document.querySelector(sel);
const card = $('#card');
const cardWrap = $('#cardWrap');
const portrait = $('#portrait');
const video = window.video = $('#video');
const still = window.canvas = $('#still');
const flash = $('#flash');
const cameraBtn = $('#cameraBtn');
const captureBtn = $('#captureBtn');
const captureLabel = $('#captureLabel');
const cameraField = $('#cameraField');
const cameraSelect = $('#cameraSelect');
const uploadInput = $('#upload');
const zoomInput = $('#zoom');
const mirrorInput = $('#mirror');
const statusEl = $('#status');

const state = {
  name: '',
  card: 'all-nighter',
  zoom: '1',
  panX: 0,   // photo offset as a fraction of the Canvas width / height
  panY: 0,
  mirror: true
};

const activeCard = () => CARDS[state.card] || CARDS[CARD_KEYS[0]];
const rarityOf = () => activeCard().rarity;

const answers = [null, null, null];
let stream = null;
let source = 'none';        // 'none' | 'live' | 'still'
let stillFromCamera = false;
let hasStill = false;

// ───────── Screens ─────────

let current = 'intro';

function go(name) {
  current = name;
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.dataset.screen !== name; });
  if (QUIZ_STEPS.includes(name)) updateProgress(QUIZ_STEPS.indexOf(name));
  window.scrollTo({ top: 0 });
  document.querySelector(`[data-screen="${name}"] .screen-title`)?.focus({ preventScroll: true });
}

document.addEventListener('click', (e) => {
  const fwd = e.target.closest('[data-go]');
  if (fwd) go(fwd.dataset.go);
  if (e.target.closest('[data-back]')) go(SCREENS[SCREENS.indexOf(current) - 1]);
});

// ───────── Quiz ─────────

// Progress bar: one segment per question (3 quiz questions + the name).
// Segments for questions you've already reached are buttons that jump back
// to that question; your earlier answers stay selected.
const QUIZ_STEPS = ['q1', 'q2', 'q3', 'q4'];
const STEP_TITLES = [...QUESTIONS.map((q) => q.title), 'What’s your name?'];
let furthestStep = 0; // highest question index reached so far

function buildProgress(el, index) {
  el.classList.add('progress');
  el.innerHTML = `
    <span class="num">Question ${index + 1} of ${QUIZ_STEPS.length}</span>
    <ol class="progress-steps" aria-label="Questions"></ol>`;
  const list = el.querySelector('ol');
  QUIZ_STEPS.forEach((step, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'progress-step';
    b.dataset.step = String(i);
    b.setAttribute('aria-label', `Question ${i + 1}: ${STEP_TITLES[i]}`);
    if (i === index) b.setAttribute('aria-current', 'step');
    b.addEventListener('click', () => { if (i !== index && i <= furthestStep) go(step); });
    li.appendChild(b);
    list.appendChild(li);
  });
}

// Fill segments up to the current question; segments you've reached are clickable
function updateProgress(index) {
  furthestStep = Math.max(furthestStep, index);
  document.querySelectorAll('.progress-step').forEach((b) => {
    const i = Number(b.dataset.step);
    const here = b.getAttribute('aria-current') === 'step';
    b.dataset.state = here ? 'current' : i < index ? 'done' : i <= furthestStep ? 'reached' : 'todo';
    b.disabled = here || i > furthestStep;
  });
}

QUESTIONS.forEach((q, qi) => {
  const screen = $(`[data-screen="q${qi + 1}"]`);
  const titleId = `q${qi + 1}Title`;
  screen.setAttribute('aria-labelledby', titleId);
  screen.innerHTML = `
    <div class="quiz-wrap">
      <div class="progress" data-progress="${qi}"></div>
      <h2 id="${titleId}" class="screen-title" tabindex="-1"></h2>
      <div class="options" role="radiogroup" aria-labelledby="${titleId}"></div>
      <div class="quiz-nav"><button type="button" class="btn" data-back>Back</button></div>
    </div>`;
  screen.querySelector('h2').textContent = q.title;
  buildProgress(screen.querySelector('[data-progress]'), qi);

  const group = screen.querySelector('.options');
  const buttons = q.options.map((opt, oi) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'option';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', 'false');
    b.innerHTML = '<span class="option-dot" aria-hidden="true"></span><span></span>';
    b.lastChild.textContent = opt.label;
    b.addEventListener('click', () => {
      answers[qi] = oi;
      buttons.forEach((x, xi) => x.setAttribute('aria-checked', String(xi === oi)));
      // brief pause so the selection registers before the next question
      setTimeout(() => go(SCREENS[SCREENS.indexOf(`q${qi + 1}`) + 1]), 220);
    });
    group.appendChild(b);
    return b;
  });

  group.addEventListener('keydown', (e) => {
    const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const i = buttons.indexOf(document.activeElement);
    buttons[(i + dir + buttons.length) % buttons.length].focus();
  });
});

buildProgress($('[data-screen="q4"] .progress'), 3);

function resetQuiz() {
  answers.fill(null);
  furthestStep = 0;
  document.querySelectorAll('.option').forEach((b) => b.setAttribute('aria-checked', 'false'));
  $('#nameInput').value = '';
  $('#nameHint').textContent = '';
}

// Tally points; ties go to the card that scored in more questions, then to
// whichever the critique question (Q2) favoured, then to the rarer card.
const RARITY_RANK = { legendary: 2, rare: 1, common: 0 };

function scoreQuiz(picks = answers) {
  const tally = Object.fromEntries(CARD_KEYS.map((k) => [k, { points: 0, hits: 0, q2: 0 }]));
  QUESTIONS.forEach((q, qi) => {
    const opt = q.options[picks[qi] ?? 0];
    for (const [key, pts] of Object.entries(opt.scores)) {
      tally[key].points += pts;
      tally[key].hits += 1;
      if (qi === 1) tally[key].q2 = pts;
    }
  });
  return Object.entries(tally).sort(([ka, a], [kb, b]) =>
    b.points - a.points || b.hits - a.hits || b.q2 - a.q2 ||
    RARITY_RANK[CARDS[kb].rarity] - RARITY_RANK[CARDS[ka].rarity])[0][0];
}

function dealCard(name) {
  state.name = name;
  state.card = scoreQuiz();
  const c = activeCard();
  $('#resultEyebrow').textContent = `${name}, you got`;
  $('#resultTitle').textContent = c.title;
  $('#resultBlurb').textContent = `${c.blurb} ${RARITY_LABEL[c.rarity]}, ${c.stars} ${c.stars === 1 ? 'star' : 'stars'}.`;
  render();
  setFxNote();
  loadShaders().catch(() => {}); // warm the 2.5 MB bundle while the camera prompt is up
}

// Has this browser already allowed the camera for this site? Then the
// permission screen has nothing to ask, so it's skipped.
let cameraAllowed = false; // set after a successful start this session

async function cameraAlreadyAllowed() {
  if (cameraAllowed) return true;
  try {
    const status = await navigator.permissions?.query({ name: 'camera' });
    return status?.state === 'granted';
  } catch {
    return false; // browser can't tell us; show the screen
  }
}

$('#nameForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#nameInput').value.trim();
  if (!name) {
    $('#nameHint').textContent = 'Enter a name to continue.';
    $('#nameInput').focus();
    return;
  }
  $('#nameHint').textContent = '';
  dealCard(name);
  if (await cameraAlreadyAllowed()) {
    go('results');
    startCamera();
  } else {
    go('camera');
  }
});

$('#nameInput').addEventListener('input', () => { $('#nameHint').textContent = ''; });

// Start every visit with an empty name. Firefox and Safari otherwise restore
// typed form values on reload and on Back/Forward, which carries one tester's
// name into the next session.
$('#nameInput').value = '';
window.addEventListener('pageshow', (e) => { if (e.persisted) resetQuiz(); });

$('#allowCameraBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = 'Waiting for permission…';
  await startCamera();
  btn.disabled = false;
  btn.textContent = 'Allow camera';
  go('results');
});

$('#skipCameraBtn').addEventListener('click', () => {
  setStatus('Start the camera or upload a photo whenever you’re ready.');
  go('results');
});

$('#startOverBtn').addEventListener('click', () => {
  stopCamera();
  hasStill = false;
  stillFromCamera = false;
  setSource('none');
  setStatus('');
  resetQuiz();
  resetFraming();
  go('intro');
});

// ───────── Zoom + mirror ─────────

zoomInput.addEventListener('input', () => { setZoom(Number(zoomInput.value)); });
mirrorInput.addEventListener('change', () => { state.mirror = mirrorInput.checked; render(); });

// ───────── Render ─────────

function setField(name, value) {
  document.querySelectorAll(`[data-field="${name}"]`).forEach((n) => { n.textContent = value; });
}

const CARD_VARS = ['bg', 'border', 'shadow', 'canvas', 'canvasBorder', 'onCanvas', 'titleColor', 'box', 'boxBorder', 'body'];
const starsEl = $('#stars');

function render() {
  const c = activeCard();
  card.dataset.card = state.card;
  card.dataset.rarity = c.rarity;
  for (const k of CARD_VARS) card.style.setProperty(`--c-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, c[k]);
  card.style.setProperty('--title-size', c.titleSize);

  setField('title', c.title);
  setField('text', c.text);

  if (starsEl.dataset.card !== state.card) {
    starsEl.dataset.card = state.card;
    starsEl.setAttribute('aria-label', `${RARITY_LABEL[c.rarity]}: ${c.stars} of 3 stars`);
    starsEl.replaceChildren(...Array.from({ length: c.stars }, () => {
      const img = new Image(28, 28);
      img.src = STAR_SRC(state.card);
      img.alt = '';
      return img;
    }));
  }

  portrait.style.setProperty('--zoom', state.zoom);
  portrait.style.setProperty('--pan-x', `${state.panX * 100}%`);
  portrait.style.setProperty('--pan-y', `${state.panY * 100}%`);
  portrait.dataset.pannable = String(source !== 'none' && Number(state.zoom) > 1);
  portrait.style.setProperty('--flip', state.mirror ? -1 : 1);
  $('#zoomOut').textContent = `${Number(state.zoom).toFixed(1)}×`;
}

// ───────── Status ─────────

function setStatus(msg, tone) {
  statusEl.textContent = msg;
  if (tone) statusEl.dataset.tone = tone;
  else delete statusEl.dataset.tone;
}

// ───────── Rarity shader (shaders.com, WebGPU) ─────────

const fxNote = $('#fxNote');
let fxCanvas = $('#fx');
let fx = null;              // live shader instance
let fxToken = 0;            // bumps on every (re)mount so stale async work bails out
let fxImageURL = null;
let shadersLib = null;
const fxStreams = [];       // stream clones handed to WebcamTexture

const loadShaders = () => (shadersLib ??= import(SHADERS_URL).catch((err) => {
  shadersLib = null; // allow a retry on the next mount
  throw err;
}));

// WebcamTexture asks for its own camera. Give it a clone of the stream the page
// already opened, so there is one permission prompt and the chosen camera is used.
const nativeGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
if (nativeGetUserMedia) {
  navigator.mediaDevices.getUserMedia = (constraints) => {
    if (stream && constraints?.video) {
      const clone = stream.clone();
      fxStreams.push(clone);
      return Promise.resolve(clone);
    }
    return nativeGetUserMedia(constraints);
  };
}

// Only speaks up when the shader can't run (the note hides itself when empty)
function setFxNote(problem) {
  fxNote.textContent = problem || '';
  fxNote.dataset.tone = problem ? 'warn' : '';
}

function unmountShader() {
  fxToken++;
  fx?.destroy();
  fx = null;
  portrait.dataset.fx = 'off';
  fxStreams.splice(0).forEach((s) => s.getTracks().forEach((t) => t.stop()));
  if (fxImageURL) URL.revokeObjectURL(fxImageURL);
  fxImageURL = null;
  // A fresh canvas per mount so a new instance never inherits an old GPU context
  const fresh = fxCanvas.cloneNode(false);
  fxCanvas.replaceWith(fresh);
  fxCanvas = fresh;
}

function shaderFailed(reason) {
  console.log('Shader unavailable: ', reason);
  portrait.dataset.fx = 'off';
  setFxNote(reason === 'unsupported' || reason === 'no-adapter'
    ? 'This browser doesn’t support WebGPU, so the plain photo is shown.'
    : 'The shader couldn’t start, so the plain photo is shown.');
}

async function mountShader() {
  unmountShader();
  const token = fxToken;
  setFxNote();
  if (source === 'none') return;

  let lib;
  try {
    lib = await loadShaders();
  } catch (err) {
    console.log('Shader library failed to load: ', err);
    if (token === fxToken) setFxNote('The shader library couldn’t load, so the plain photo is shown.');
    return;
  }
  if (token !== fxToken) return;
  if (!lib.isWebGPUSupported()) { shaderFailed('unsupported'); return; }

  let input;
  if (source === 'live') {
    // Mirroring is done with CSS (and in the export), same as the raw video
    input = { type: 'WebcamTexture', props: { objectFit: 'cover', mirror: false } };
  } else {
    const blob = await new Promise((resolve) => still.toBlob(resolve, 'image/png'));
    if (token !== fxToken || !blob) return;
    fxImageURL = URL.createObjectURL(blob);
    input = { type: 'ImageTexture', props: { url: fxImageURL, objectFit: 'cover' } };
  }

  const effect = EFFECTS[rarityOf()];
  // createShader() writes the canvas's measured size into its inline style when
  // none is set. If the results screen is still hidden (camera allowed from the
  // permission screen) that measures 0 and it falls back to 300 × 150px.
  // A relative inline size stops that; its ResizeObserver then sizes the buffer.
  fxCanvas.style.width = '100%';
  fxCanvas.style.height = '100%';
  try {
    const instance = await lib.createShader(fxCanvas, {
      components: [{
        type: effect.type,
        id: 'fx',
        props: effect.props(activeCard()),
        children: [input]
      }]
    }, {
      disableTelemetry: true,
      onReady: () => { if (token === fxToken) portrait.dataset.fx = 'on'; },
      onError: (reason) => {
        // Terminal failures set getFailureReason(); device-loss rebuilds don't
        queueMicrotask(() => { if (token === fxToken && fx?.getFailureReason()) shaderFailed(reason); });
      }
    });
    if (token !== fxToken) { instance.destroy(); return; }
    fx = instance;
    if (instance.getFailureReason()) shaderFailed(instance.getFailureReason());
  } catch (err) {
    if (token === fxToken) shaderFailed(err?.reason || 'init-failed');
  }
}

// ───────── Camera (getUserMedia) ─────────

function setSource(next) {
  source = next;
  portrait.dataset.source = next;
  mountShader();
  const live = next === 'live';
  cameraBtn.textContent = live ? 'Stop camera' : 'Start camera';
  cameraBtn.classList.toggle('btn-primary', next === 'none');
  captureBtn.disabled = !(live || (next === 'still' && stillFromCamera));
  captureLabel.textContent = next === 'still' && stillFromCamera ? 'Retake' : 'Take snapshot';
  captureBtn.classList.toggle('btn-primary', live);
  render(); // the photo can only be dragged once there is one
}

function stopCamera() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = window.stream = null;
  video.srcObject = null;
}

const ERROR_MESSAGES = {
  NotAllowedError: 'Camera permission was blocked. Allow it in your browser’s site settings, or upload a photo instead.',
  NotFoundError: 'No camera found. You can upload a photo instead.',
  NotReadableError: 'Your camera is busy in another app. Close it there and try again.',
  OverconstrainedError: 'That camera can’t provide video right now. Try another one.',
  SecurityError: 'Camera access needs a secure page (https or localhost).'
};

async function startCamera(deviceId) {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Camera access needs a secure page (https or localhost). Upload a photo instead.', 'error');
    return false;
  }
  stopCamera();
  setStatus('Waiting for camera permission…');

  const video_ = { width: { ideal: 1280 }, height: { ideal: 960 } };
  if (deviceId) video_.deviceId = { exact: deviceId };
  else video_.facingMode = 'user';

  try {
    stream = window.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: video_ });
    video.srcObject = stream;
    cameraAllowed = true;
    await video.play().catch(() => {});
    setSource('live');
    setStatus('Line up your face, then take a snapshot.');
    listCameras();
    return true;
  } catch (err) {
    console.log('navigator.MediaDevices.getUserMedia error: ', err.message, err.name);
    setStatus(ERROR_MESSAGES[err.name] || `Couldn’t start the camera (${err.name}).`, 'error');
    setSource(hasStill ? 'still' : 'none');
    return false;
  }
}

async function listCameras() {
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  cameraField.hidden = devices.length < 2;
  const active = stream?.getVideoTracks()[0]?.getSettings().deviceId;
  cameraSelect.replaceChildren(...devices.map((d, i) => {
    const o = new Option(d.label || `Camera ${i + 1}`, d.deviceId);
    o.selected = d.deviceId === active;
    return o;
  }));
}

cameraSelect.addEventListener('change', () => startCamera(cameraSelect.value));

document.querySelectorAll('[data-action="start-camera"]').forEach((b) => {
  b.addEventListener('click', () => {
    if (b === cameraBtn && source === 'live') {
      stopCamera();
      setSource(hasStill ? 'still' : 'none');
      setStatus('Camera stopped.');
    } else {
      startCamera(cameraSelect.value || undefined);
    }
  });
});

function takeSnapshot() {
  // Same idea as the sample: copy the current video frame onto a canvas.
  // The raw frame is kept; the rarity shader re-runs on it, and zoom / mirror stay editable.
  still.width = video.videoWidth;
  still.height = video.videoHeight;
  still.getContext('2d').drawImage(video, 0, 0, still.width, still.height);
  stillFromCamera = true;
  hasStill = true;
  stopCamera();
  setSource('still');
  flash.classList.remove('is-on');
  void flash.offsetWidth; // restart the one-shot animation
  flash.classList.add('is-on');
  setStatus('Snapshot taken. Adjust the zoom, then export.');
}

captureBtn.addEventListener('click', () => {
  if (source === 'live') takeSnapshot();
  else startCamera(cameraSelect.value || undefined);
});

uploadInput.addEventListener('change', () => {
  const file = uploadInput.files?.[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const max = 1600;
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    still.width = Math.round(img.naturalWidth * s);
    still.height = Math.round(img.naturalHeight * s);
    still.getContext('2d').drawImage(img, 0, 0, still.width, still.height);
    URL.revokeObjectURL(url);
    stopCamera();
    stillFromCamera = false;
    hasStill = true;
    state.mirror = false;
    mirrorInput.checked = false;
    resetFraming(); // a new photo starts uncropped
    setSource('still');
    render();
    setStatus('Photo loaded.');
  };
  img.onerror = () => setStatus('That file couldn’t be read as an image.', 'error');
  img.src = url;
  uploadInput.value = '';
});

// ───────── Pan + zoom inside the Canvas ─────────
// Drag the photo to move it, scroll / pinch to zoom toward a point, or use
// the Zoom slider. Pan is clamped so the photo always covers the Canvas.

const ZOOM_MIN = Number(zoomInput.min), ZOOM_MAX = Number(zoomInput.max);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function clampPan() {
  const room = (Number(state.zoom) - 1) / 2; // how far the zoomed photo overhangs each edge
  state.panX = clamp(state.panX, -room, room);
  state.panY = clamp(state.panY, -room, room);
}

// Zoom to `z`, keeping the point (fx, fy) — fractions from the Canvas center — still
function setZoom(z, fx = 0, fy = 0) {
  const prev = Number(state.zoom);
  const next = clamp(z, ZOOM_MIN, ZOOM_MAX);
  state.panX = fx - (fx - state.panX) * (next / prev);
  state.panY = fy - (fy - state.panY) * (next / prev);
  state.zoom = String(Math.round(next * 100) / 100);
  zoomInput.value = state.zoom;
  clampPan();
  render();
}

function resetFraming() {
  state.zoom = '1';
  state.panX = state.panY = 0;
  zoomInput.value = '1';
  render();
}

const pointers = new Map();
let gesture = null;

function canvasPoint(e) {
  const r = portrait.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 };
}

portrait.addEventListener('pointerdown', (e) => {
  if (source === 'none' || e.target.closest('button')) return;
  try { portrait.setPointerCapture(e.pointerId); } catch { /* keep dragging without capture */ }
  pointers.set(e.pointerId, canvasPoint(e));
  gesture = null;
  portrait.dataset.dragging = 'true';
});

portrait.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const p = canvasPoint(e);
  const prev = pointers.get(e.pointerId);
  pointers.set(e.pointerId, p);
  if (pointers.size === 1) {
    state.panX += p.x - prev.x;
    state.panY += p.y - prev.y;
    clampPan();
    render();
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (gesture) setZoom(Number(state.zoom) * (dist / gesture), (a.x + b.x) / 2, (a.y + b.y) / 2);
    gesture = dist;
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  gesture = null;
  if (!pointers.size) delete portrait.dataset.dragging;
}
portrait.addEventListener('pointerup', endPointer);
portrait.addEventListener('pointercancel', endPointer);

portrait.addEventListener('wheel', (e) => {
  if (source === 'none') return;
  e.preventDefault();
  const p = canvasPoint(e);
  setZoom(Number(state.zoom) * Math.exp(-e.deltaY * 0.0015), p.x, p.y);
}, { passive: false });

// Keyboard: arrows move the photo, + / − zoom
portrait.addEventListener('keydown', (e) => {
  if (source === 'none') return;
  const step = 0.04;
  const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  if (moves[e.key]) {
    e.preventDefault();
    state.panX += moves[e.key][0];
    state.panY += moves[e.key][1];
    clampPan();
    render();
  } else if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    setZoom(Number(state.zoom) + 0.1);
  } else if (e.key === '-') {
    e.preventDefault();
    setZoom(Number(state.zoom) - 0.1);
  }
});

// ───────── Tilt + foil glare (mouse / pen only) ─────────

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

cardWrap.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch' || reduceMotion.matches || portrait.dataset.dragging) return;
  const r = cardWrap.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width;
  const py = (e.clientY - r.top) / r.height;
  card.classList.add('is-tilting');
  card.style.setProperty('--ry', `${(px - 0.5) * 14}deg`);
  card.style.setProperty('--rx', `${(0.5 - py) * 14}deg`);
  card.style.setProperty('--mx', `${px * 100}%`);
  card.style.setProperty('--my', `${py * 100}%`);
});

cardWrap.addEventListener('pointerleave', () => {
  card.classList.remove('is-tilting');
  card.style.setProperty('--rx', '0deg');
  card.style.setProperty('--ry', '0deg');
  card.style.setProperty('--mx', '50%');
  card.style.setProperty('--my', '50%');
});

// ───────── Export (canvas re-draw of the 334 × 468 Figma card) ─────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ellipsize(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function wrap(ctx, text, maxW, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width <= maxW || !line) {
      line = test;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) {
        lines[maxLines - 1] = ellipsize(ctx, `${lines[maxLines - 1]} ${words.slice(i).join(' ')}`, maxW);
        return lines;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

// A WebGPU canvas reads back as blank outside the task that drew it, so copy it
// in a microtask right after the shader's next GPU submit (before it presents).
// If the effect has exportProps (Glitch), those apply for the captured frame
// and the preview settings come straight back afterwards.
function captureShaderFrame() {
  if (portrait.dataset.fx !== 'on' || !window.GPUQueue || !fx) return Promise.resolve(null);
  const effect = EFFECTS[rarityOf()];
  const boost = effect.exportProps;
  const shader = fx;
  if (boost) {
    try { shader.update('fx', boost); } catch { /* capture as-is */ }
  }
  const restore = () => {
    if (!boost || shader !== fx) return;
    const preview = effect.props(activeCard());
    try { shader.update('fx', Object.fromEntries(Object.keys(boost).map((k) => [k, preview[k]]))); } catch { /* ignore */ }
  };
  // Skip one frame after changing settings so the new values are on the GPU
  let skip = boost ? 1 : 0;
  return new Promise((resolve) => {
    const proto = GPUQueue.prototype;
    const submit = proto.submit;
    let queued = false;
    const done = (frame) => {
      proto.submit = submit;
      clearTimeout(timer);
      restore();
      resolve(frame);
    };
    const timer = setTimeout(() => done(null), 1000);
    proto.submit = function (...args) {
      const result = submit.apply(this, args);
      if (skip > 0) {
        skip--;
      } else if (!queued) {
        queued = true;
        queueMicrotask(() => {
          const copy = document.createElement('canvas');
          copy.width = fxCanvas.width;
          copy.height = fxCanvas.height;
          copy.getContext('2d').drawImage(fxCanvas, 0, 0);
          done(copy);
        });
      }
      return result;
    };
  });
}

function drawPortraitSource(ctx, x, y, w, h, frame) {
  // Prefer the captured shader frame; fall back to the raw video / snapshot
  const media = frame || (source === 'live' ? video : source === 'still' ? still : null);
  const sw = media === video ? video.videoWidth : media?.width;
  const sh = media === video ? video.videoHeight : media?.height;
  if (!media || !sw || !sh) return false;

  const cover = Math.max(w / sw, h / sh);
  const dw = sw * cover, dh = sh * cover;
  const zoom = Number(state.zoom);

  // Same order as the CSS: move by the pan, then zoom / mirror around the center
  ctx.save();
  ctx.translate(x + w / 2 + state.panX * w, y + h / 2 + state.panY * h);
  ctx.scale(zoom * (state.mirror ? -1 : 1), zoom);
  ctx.drawImage(media, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
  return true;
}

// Same 24-unit person icon as the on-screen placeholder, drawn at `size` px
function drawSilhouette(ctx, cx, cy, size, color) {
  const s = size / 24;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.5 * s;
  ctx.lineCap = 'round';
  ctx.translate(cx - 12 * s, cy - 12 * s);
  ctx.beginPath();
  ctx.arc(12 * s, 9 * s, 4 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4 * s, 20 * s);
  ctx.bezierCurveTo(5.5 * s, 16.5 * s, 8.5 * s, 15 * s, 12 * s, 15 * s);
  ctx.bezierCurveTo(15.5 * s, 15 * s, 18.5 * s, 16.5 * s, 20 * s, 20 * s);
  ctx.stroke();
  ctx.restore();
}

const TITLE_FONT = 'PicNic, Georgia, serif';
const BODY_FONT = 'Squarevetica, system-ui, sans-serif';

// Geometry in Figma px (card 334 × 468, 4px hard shadow), scaled up for export
const CARD_W = 334, CARD_H = 468, SHADOW = 4, EXPORT_SCALE = 3;

// The export draws the stars from the Figma icon's own path data instead of
// loading assets/stars/*.svg. Opened from file://, Safari and Firefox treat each
// file as a separate origin, so drawing the SVG image "taints" the canvas and
// toBlob() then refuses to export it.
// Path and colors copied from the star SVGs (28 × 28 viewBox).
const STAR_PATH = new Path2D('M14 2.07884C12.7718 2.07884 10.3648 8.11087 9.37125 8.83285C8.37758 9.55473 1.89689 9.97992 1.51736 11.148C1.13783 12.316 6.13091 16.4693 6.51044 17.6373C6.88997 18.8054 5.29167 25.1003 6.28534 25.8221C7.27902 26.544 12.7718 23.0788 14 23.0788C15.2282 23.0788 20.7211 26.5441 21.7147 25.8221C22.7083 25.1003 21.11 18.8054 21.4896 17.6373C21.8691 16.4692 26.8622 12.316 26.4826 11.1479C26.1031 9.97981 19.6224 9.55467 18.6288 8.83274C17.6352 8.11087 15.2282 2.07873 14.0001 2.07873L14 2.07884Z');
const STAR_COLORS = {
  'all-nighter': ['#FE7EFE', '#FAEBCE'],
  'pixel-pusher': ['#D7D36F', '#2B2D43'],
  'silent-crit': ['#2B2D43', '#CBC1A6'],
  'dusty-awl': ['#616595', '#FAEBCE'],
  'lonely-runt': ['#BE4D17', '#CBC1A6'],
  'misaligned-print': ['#FE7EFE', '#FAEBCE']
};

// Fill, then a 1px outline outside the shape (the SVG masks its 2px stroke to the outside)
function drawStar(ctx, x, y, key) {
  const [fill, outline] = STAR_COLORS[key] || STAR_COLORS['all-nighter'];
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = fill;
  ctx.fill(STAR_PATH);
  const outside = new Path2D();
  outside.rect(-2, -2, 32, 32);
  outside.addPath(STAR_PATH);
  ctx.clip(outside, 'evenodd');
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke(STAR_PATH);
  ctx.restore();
}

function drawCard(canvas, frame) {
  const c = activeCard();
  const k = EXPORT_SCALE;
  canvas.width = (CARD_W + SHADOW) * k;
  canvas.height = (CARD_H + SHADOW) * k;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(k, k);

  // Hard offset shadow, then the card with its 2px inside border
  ctx.fillStyle = c.shadow;
  roundRect(ctx, SHADOW, SHADOW, CARD_W, CARD_H, 8);
  ctx.fill();
  ctx.fillStyle = c.bg;
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 8);
  ctx.fill();
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, CARD_W - 2, CARD_H - 2, 7);
  ctx.stroke();

  // Canvas: the webcam frame (300 × 273 at 17, 17)
  const cx = 17, cy = 17, cw = 300, ch = 273;
  ctx.save();
  roundRect(ctx, cx, cy, cw, ch, 6);
  ctx.clip();
  ctx.fillStyle = c.canvas;
  ctx.fillRect(cx, cy, cw, ch);
  if (!drawPortraitSource(ctx, cx, cy, cw, ch, frame)) {
    drawSilhouette(ctx, cx + cw / 2, cy + ch / 2, 66, c.onCanvas);
  }
  ctx.restore();
  ctx.strokeStyle = c.canvasBorder;
  ctx.lineWidth = 1;
  roundRect(ctx, cx + 0.5, cy + 0.5, cw - 1, ch - 1, 5.5);
  ctx.stroke();

  // Stars, right-aligned inside the Canvas's 8px padding, 6px apart
  for (let i = 0; i < c.stars; i++) {
    drawStar(ctx, cx + cw - 1 - 8 - 28 - i * (28 + 6), cy + 1 + 8, state.card);
  }

  // Title row (37px tall at y 302)
  ctx.fillStyle = c.titleColor;
  ctx.font = `400 ${c.titleSize}px ${TITLE_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(ellipsize(ctx, c.title.toUpperCase(), 300), 17, 302 + 37 / 2);

  // Description box (300 × 100 at 17, 351), text centered vertically
  const bx = 17, by = 351, bw = 300, bh = 100;
  ctx.fillStyle = c.box;
  roundRect(ctx, bx, by, bw, bh, 6);
  ctx.fill();
  ctx.strokeStyle = c.boxBorder;
  roundRect(ctx, bx + 0.5, by + 0.5, bw - 1, bh - 1, 5.5);
  ctx.stroke();

  ctx.fillStyle = c.body;
  ctx.font = `400 22px ${BODY_FONT}`;
  const lh = 26;
  const lines = wrap(ctx, c.text, bw - 2 - 16, 3);
  const top = by + bh / 2 - (lines.length * lh) / 2;
  lines.forEach((line, i) => ctx.fillText(line, bx + 1 + 8, top + lh / 2 + i * lh));
}

// ───────── Export ─────────

async function renderExport(type) {
  const c = activeCard();
  try {
    await Promise.all([
      document.fonts.load(`400 ${c.titleSize}px PicNic`),
      document.fonts.load('400 22px Squarevetica')
    ]);
  } catch { /* fall back to system fonts */ }

  const canvas = $('#exportCanvas');
  drawCard(canvas, await captureShaderFrame());
  let out = canvas;
  if (type === 'image/jpeg') {
    // JPEG has no transparency: put the card on white
    out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
  }
  return new Promise((resolve, reject) => {
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), type, 0.92);
  });
}

function fileName(ext) {
  const slug = state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'card'}-${state.card}.${ext}`;
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.hidden = true;
  document.body.appendChild(a); // Firefox ignores clicks on detached links in some cases
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const EXPORTS = {
  async png() {
    download(await renderExport('image/png'), fileName('png'));
    setStatus(`PNG downloaded.`);
  },
  async jpg() {
    download(await renderExport('image/jpeg'), fileName('jpg'));
    setStatus(`JPG downloaded.`);
  },
  async copy() {
    // Pass the promise straight to ClipboardItem so Safari keeps the user gesture
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderExport('image/png') })]);
    setStatus(`Card copied to the clipboard.`);
  },
  async share() {
    const file = new File([await renderExport('image/png')], fileName('png'), { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: `${state.name}’s card: ${activeCard().title}` });
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
    }
  }
};

document.querySelectorAll('[data-export]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await EXPORTS[btn.dataset.export]();
    } catch (err) {
      console.log('Export error: ', err);
      setStatus('Export failed. Try again.', 'error');
    } finally {
      btn.disabled = false;
    }
  });
});

// Only offer copy / share where the browser supports them
$('#copyBtn').hidden = !(window.ClipboardItem && navigator.clipboard?.write);
try {
  $('#shareBtn').hidden = !navigator.canShare?.({ files: [new File([''], 'card.png', { type: 'image/png' })] });
} catch {
  $('#shareBtn').hidden = true;
}

// ───────── Init ─────────

setSource('none');
render();
if (!window.isSecureContext) {
  setStatus('Open this page from localhost or https to use the camera. Uploading a photo still works.', 'error');
}
