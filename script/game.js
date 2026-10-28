/* ============================================
   🔐 SAFECRACKER — логика + звук
   ============================================ */

const SVG_NS = "http://www.w3.org/2000/svg";

const CENTER_X = 100;
const CENTER_Y = 100;

const SATELLITE_RADIUS = 32;
const SATELLITE_DISTANCE = 60;
const SUN_RADIUS = 20;
const SUN_DISTANCE = 20;

const DIGIT_RADIUS = 26;

const DIFF_KEY = "safecracker_difficulty";
const STATS_KEY = "safecracker_stats";
const SOUND_KEY = "safecracker_sound_enabled";

let DIGIT_COUNT = parseInt(localStorage.getItem(DIFF_KEY) || "6", 10);
if (![3, 4, 5, 6].includes(DIGIT_COUNT)) DIGIT_COUNT = 6;

const SATELLITES_CONFIG = [
  { key: "top",   angle: 0,   label: "верхний" },
  { key: "right", angle: 120, label: "правый"  },
  { key: "left",  angle: 240, label: "левый"   },
];

const SUN_POSITIONS = [
  { angle: 60  },
  { angle: 180 },
  { angle: 300 },
];

function degreesToRadians(deg) {
  return (deg - 90) * Math.PI / 180;
}

function polarToCartesian(cx, cy, radius, angleDeg) {
  const rad = degreesToRadians(angleDeg);
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function createSVG(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const key in attrs) el.setAttribute(key, attrs[key]);
  return el;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

function angleDiff(a, b) {
  let diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  if (diff > 180) diff = 360 - diff;
  return diff;
}

let satellites = [];
let sunPositionIndex = -1;
let currentSunPos = { x: CENTER_X, y: CENTER_Y };
let targetDigits = [];
let movesCount = 0;
let dragging = false;
let dragAngle = 0;
let gameWon = false;
let isRotatingMechanism = false;
let gameRecorded = false;

let winReady = false;
let sunInCenter = true;

let didDrag = false;
let dragStartPt = null;

let sunLimbAngle = 0;

/* --- Таймер --- */
let timerInterval = null;
let timerSeconds = 0;

const SUN_LIMB_STEP = 360 / 24;
const SAT_ROTATE_DURATION = 0.3;
const WHEEL_SPIN_DURATION = 1.1;

// 🔊 Переменная для ограничения частоты звука перетаскивания
let lastDragSoundTime = 0;

const svg = document.getElementById("field");
const targetDigitsEl = document.getElementById("targetDigits");
const activeDigitsEl = document.getElementById("activeDigits");
const movesCountEl = document.getElementById("movesCount");
const timerValueEl = document.getElementById("timerValue");
const statusEl = document.getElementById("status");
const rotateCWBtn = document.getElementById("rotateCW");
const rotateCCWBtn = document.getElementById("rotateCCW");
const rotateMechCWBtn = document.getElementById("rotateMechCW");
const rotateMechCCWBtn = document.getElementById("rotateMechCCW");
const restartCrossBtn = document.getElementById("restartCrossBtn");
const soundToggleBtn = document.getElementById("soundToggleBtn");
const exitMenuBtn = document.getElementById("exitMenuBtn");

/* ============================================
   🔊 ЗВУКОВОЙ ДВИЖОК (Web Audio API)
   ============================================ */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem(SOUND_KEY) !== "false";
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem(SOUND_KEY, String(this.enabled));
    return this.enabled;
  }

  playMechCW() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    this._noise(t, 0.15, 400, 1000);
    this._tone(t, 80, 0.3, "triangle", 0.4);
  }

  playMechCCW() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    this._noise(t, 0.15, 350, 900);
    this._tone(t, 70, 0.3, "triangle", 0.4);
  }

  playDialCW() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      this._tone(t + i * 0.05, 1200, 0.05, "square", 0.15);
    }
  }

  playDialCCW() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      this._tone(t + i * 0.05, 1000, 0.05, "square", 0.15);
    }
  }

  playRestart() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    this._tone(t, 400, 0.1, "sine", 0.3);
    this._tone(t + 0.12, 300, 0.15, "sine", 0.3);
  }

  playWin() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      this._tone(t + i * 0.12, freq, 0.4, "sine", 0.3);
    });
  }

  playLose() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    const notes = [392.00, 329.63, 261.63, 196.00];
    notes.forEach((freq, i) => {
      this._tone(t + i * 0.15, freq, 0.3, "sawtooth", 0.2);
    });
  }

  playDrag() {
    if (!this.enabled) return;
    this.init();
    const t = this.ctx.currentTime;
    this._noise(t, 0.05, 1500, 800);
  }

  _tone(startTime, freq, duration, type = "sine", volume = 0.3) {
    if (!this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  _noise(startTime, duration, freqStart, freqEnd) {
    if (!this.enabled) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freqStart, startTime);
    filter.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }
}

const sound = new SoundEngine();

function updateSoundIcon() {
  if (sound.enabled) {
    soundToggleBtn.textContent = "🔊";
    soundToggleBtn.setAttribute("aria-label", "Выключить звук");
  } else {
    soundToggleBtn.textContent = "🔇";
    soundToggleBtn.setAttribute("aria-label", "Включить звук");
  }
}

updateSoundIcon();

soundToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  sound.toggle();
  updateSoundIcon();
  if (sound.enabled) {
    sound.init();
    sound._tone(sound.ctx.currentTime, 800, 0.1, "sine", 0.2);
  }
});

exitMenuBtn.addEventListener("click", (e) => {
  sound.playLose();
  e.preventDefault();
  const href = exitMenuBtn.getAttribute("href");
  setTimeout(() => {
    window.location.href = href;
  }, 400);
});

/* ============================================
   ОСТАЛЬНАЯ ЛОГИКА ИГРЫ
   ============================================ */

function generateSatelliteDigits() {
  const digits = [];
  for (let i = 1; i <= DIGIT_COUNT; i++) digits.push(i);
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits;
}

function generateTarget() {
  return [
    randomInt(1, DIGIT_COUNT),
    randomInt(1, DIGIT_COUNT),
    randomInt(1, DIGIT_COUNT),
  ];
}

function getDigitVisualAngle(sat, i) {
  const step = 360 / sat.digits.length;
  return normalizeAngle(i * step + sat.rotation * step + sat.angle + sat.offset);
}

function getActiveAngle(sat) {
  return normalizeAngle(sat.angle + 180);
}

function getActiveDigit(sat) {
  const target = getActiveAngle(sat);
  const step = 360 / sat.digits.length;

  let bestI = 0;
  let bestDiff = Infinity;

  for (let i = 0; i < sat.digits.length; i++) {
    const diff = angleDiff(getDigitVisualAngle(sat, i), target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestI = i;
    }
  }

  if (bestDiff > step) return sat.digits[0];
  return sat.digits[bestI];
}

function getActiveDigitsInOrder() {
  const sorted = [...satellites].sort((a, b) => a.angle - b.angle);
  return sorted.map(sat => getActiveDigit(sat));
}

function getConnectedSatellites() {
  if (sunPositionIndex === -1) return [];
  const sunAngle = SUN_POSITIONS[sunPositionIndex].angle;
  const expectedAngles = [
    normalizeAngle(sunAngle - 60),
    normalizeAngle(sunAngle + 60),
  ];
  const result = [];
  expectedAngles.forEach(expectedAngle => {
    const sat = satellites.find(s => normalizeAngle(s.angle) === expectedAngle);
    if (sat) result.push(sat);
  });
  return result;
}

function buildField() {
  svg.innerHTML = "";

  const defs = createSVG("defs");

  const linearGradient = createSVG("linearGradient", {
    id: "metalGradient",
    x1: "0%", y1: "0%", x2: "100%", y2: "100%"
  });
  linearGradient.appendChild(createSVG("stop", { offset: "0%",   "stop-color": "#e0e0e0" }));
  linearGradient.appendChild(createSVG("stop", { offset: "30%",  "stop-color": "#888888" }));
  linearGradient.appendChild(createSVG("stop", { offset: "50%",  "stop-color": "#555555" }));
  linearGradient.appendChild(createSVG("stop", { offset: "70%",  "stop-color": "#999999" }));
  linearGradient.appendChild(createSVG("stop", { offset: "100%", "stop-color": "#dddddd" }));
  defs.appendChild(linearGradient);

  const sunGradient = createSVG("radialGradient", {
    id: "sunGradient",
    cx: "50%", cy: "50%", r: "50%"
  });
  sunGradient.appendChild(createSVG("stop", { offset: "0%",   "stop-color": "#c8c8c8" }));
  sunGradient.appendChild(createSVG("stop", { offset: "55%",  "stop-color": "#7a7a7a" }));
  sunGradient.appendChild(createSVG("stop", { offset: "100%", "stop-color": "#3a3a3a" }));
  defs.appendChild(sunGradient);

  svg.appendChild(defs);

  const bg = createSVG("circle", {
    cx: CENTER_X, cy: CENTER_Y, r: 96,
    fill: "rgba(0, 0, 0, 0.3)",
    stroke: "rgba(180, 180, 180, 0.3)",
    "stroke-width": 2,
  });
  svg.appendChild(bg);

  const mechGroup = createSVG("g", { class: "mechanism-group" });
  mechGroup.style.transformOrigin = `${CENTER_X}px ${CENTER_Y}px`;
  svg.appendChild(mechGroup);

  const wheelGroup = createSVG("g", { class: "center-wheel-group" });
  wheelGroup.style.transformOrigin = `${CENTER_X}px ${CENTER_Y}px`;

  const wheelRim = createSVG("circle", {
    cx: CENTER_X, cy: CENTER_Y, r: SUN_RADIUS,
    class: "center-wheel",
    id: "centerWheel"
  });
  wheelGroup.appendChild(wheelRim);

  for (let i = 0; i < 4; i++) {
    const angle = i * 90;
    const innerPos = polarToCartesian(CENTER_X, CENTER_Y, 5, angle);
    const outerPos = polarToCartesian(CENTER_X, CENTER_Y, SUN_RADIUS - 2, angle);

    const spoke = createSVG("line", {
      x1: innerPos.x, y1: innerPos.y,
      x2: outerPos.x, y2: outerPos.y,
      class: "center-wheel-spoke"
    });
    wheelGroup.appendChild(spoke);
  }

  const hub = createSVG("circle", {
    cx: CENTER_X, cy: CENTER_Y, r: 6,
    class: "center-wheel-hub"
  });
  wheelGroup.appendChild(hub);

  const icon = createSVG("text", {
    x: CENTER_X, y: CENTER_Y,
    class: "center-wheel-icon",
  });
  icon.textContent = "🔒";
  wheelGroup.appendChild(icon);

  wheelRim.addEventListener("click", onCenterWheelClick);

  mechGroup.appendChild(wheelGroup);
  window.centerWheelGroup = wheelGroup;

  satellites.forEach(sat => {
    const pos = polarToCartesian(CENTER_X, CENTER_Y, SATELLITE_DISTANCE, sat.angle);

    const group = createSVG("g", { class: "satellite-group" });
    group.style.transformOrigin = `${pos.x}px ${pos.y}px`;

    const circle = createSVG("circle", {
      cx: pos.x, cy: pos.y, r: SATELLITE_RADIUS,
      fill: "url(#metalGradient)",
      class: "satellite-bg",
    });
    group.appendChild(circle);

    const knobRadius = SATELLITE_RADIUS * 0.45;
    const knob = createSVG("circle", {
      cx: pos.x, cy: pos.y, r: knobRadius, class: "satellite-knob",
    });
    group.appendChild(knob);

    mechGroup.appendChild(group);
    sat.groupEl = group;
    sat.centerX = pos.x;
    sat.centerY = pos.y;
    sat.knobEl = knob;
    sat.markEl = null;

    sat.digitsGroupEl = createSVG("g", { class: "satellite-digits-group" });
    sat.digitsGroupEl.style.transformOrigin = `${pos.x}px ${pos.y}px`;
    group.appendChild(sat.digitsGroupEl);

    drawSatelliteDigits(sat);
  });

  const sunPos = getSunPosition();
  currentSunPos = { x: sunPos.x, y: sunPos.y };

  const sunGroup = createSVG("g", { class: "sun-group" });
  sunGroup.setAttribute("transform", `translate(${sunPos.x}, ${sunPos.y})`);

  const sunLimb = createSVG("g", { class: "sun-limb" });
  sunLimb.style.transformBox = "view-box";
  sunLimb.style.transformOrigin = "0 0";
  sunLimb.style.willChange = "transform";
  sunGroup.appendChild(sunLimb);

  const sunRim = createSVG("circle", {
    cx: 0, cy: 0, r: SUN_RADIUS,
    class: "sun-rim" + (sunPositionIndex === -1 ? " in-center" : ""),
  });
  sunLimb.appendChild(sunRim);

  const sunFace = createSVG("circle", {
    cx: 0, cy: 0, r: SUN_RADIUS - 3,
    class: "sun-face",
  });
  sunLimb.appendChild(sunFace);

  const teethCount = 24;
  for (let i = 0; i < teethCount; i++) {
    const angle = (i * 360) / teethCount;
    const isMajor = i % 4 === 0;
    const outerR = SUN_RADIUS - 0.5;
    const innerR = SUN_RADIUS - (isMajor ? 7 : 4);

    const p1 = polarToCartesian(0, 0, innerR, angle);
    const p2 = polarToCartesian(0, 0, outerR, angle);

    const tooth = createSVG("line", {
      x1: p1.x, y1: p1.y,
      x2: p2.x, y2: p2.y,
      class: isMajor ? "sun-tooth sun-tooth-major" : "sun-tooth",
    });
    sunLimb.appendChild(tooth);
  }

  const sunHub = createSVG("circle", {
    cx: 0, cy: 0, r: 6, class: "sun-hub",
  });
  sunGroup.appendChild(sunHub);

  const sunHole = createSVG("circle", {
    cx: 0, cy: 0, r: 2.5, class: "sun-hole",
  });
  sunGroup.appendChild(sunHole);

  const dragTarget = createSVG("circle", {
    cx: 0, cy: 0, r: SUN_RADIUS + 8,
    class: "sun-drag-target" + (sunPositionIndex === -1 ? " in-center" : ""),
  });
  dragTarget.addEventListener("mousedown", onSunMouseDown);
  dragTarget.addEventListener("touchstart", onSunTouchStart, { passive: false });
  sunGroup.appendChild(dragTarget);

  mechGroup.appendChild(sunGroup);
  window.sunGroupEl = sunGroup;
  window.sunLimbEl = sunLimb;
  window.sunDragTargetEl = dragTarget;

  sunLimb.style.transform = `rotate(${sunLimbAngle}deg)`;

  drawLinkLines();
  updateCenterWheelState();

  svg.addEventListener("click", onSvgClick);
}

function onSvgClick(e) {
  if (gameWon || isRotatingMechanism) return;
  if (dragging) return;

  if (didDrag) {
    didDrag = false;
    return;
  }

  const pt = svgPoint(e);
  const distToCenter = Math.hypot(pt.x - CENTER_X, pt.y - CENTER_Y);

  if (winReady && distToCenter <= SUN_RADIUS + 4) {
    return;
  }

  if (distToCenter <= SUN_RADIUS + 4) {
    onCenterWheelClick();
  }
}

function drawSatelliteDigits(sat) {
  const group = sat.digitsGroupEl;
  group.innerHTML = "";

  const knobRadius = SATELLITE_RADIUS * 0.45;
  const markWidth = 4;
  const markHeight = knobRadius * 0.8;
  const markX = sat.centerX - markWidth / 2;
  const markY = sat.centerY - knobRadius - 2;

  if (sat.markEl && sat.markEl.parentNode) {
    sat.markEl.remove();
  }

  const mark = createSVG("rect", {
    x: markX, y: markY,
    width: markWidth, height: markHeight,
    rx: 2,
    class: "satellite-knob-mark",
    transform: `rotate(${sat.angle}, ${sat.centerX}, ${sat.centerY})`
  });

  sat.markEl = mark;
  sat.groupEl.insertBefore(mark, sat.digitsGroupEl);

  const activeAngle = getActiveAngle(sat);
  const step = 360 / sat.digits.length;

  let bestI = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < sat.digits.length; i++) {
    const diff = angleDiff(getDigitVisualAngle(sat, i), activeAngle);
    if (diff < bestDiff) { bestDiff = diff; bestI = i; }
  }

  for (let i = 0; i < sat.digits.length; i++) {
    const visualAngle = getDigitVisualAngle(sat, i);
    const dp = polarToCartesian(sat.centerX, sat.centerY, DIGIT_RADIUS, visualAngle);
    const isActive = (i === bestI) && (bestDiff < step / 2);

    const tickAngle = normalizeAngle(visualAngle + step / 2);
    const tickOuter = polarToCartesian(sat.centerX, sat.centerY, SATELLITE_RADIUS - 1, tickAngle);
    const tickInner = polarToCartesian(sat.centerX, sat.centerY, SATELLITE_RADIUS - 5, tickAngle);

    const tick = createSVG("line", {
      x1: tickInner.x, y1: tickInner.y,
      x2: tickOuter.x, y2: tickOuter.y,
      stroke: "#222", "stroke-width": 1.5
    });
    group.appendChild(tick);

    const text = createSVG("text", {
      x: dp.x, y: dp.y,
      class: isActive ? "satellite-active-digit" : "satellite-digit",
    });
    text.textContent = sat.digits[i];
    group.appendChild(text);
  }
}

function getSunPosition() {
  if (sunPositionIndex === -1) {
    return { x: CENTER_X, y: CENTER_Y };
  }
  const pos = SUN_POSITIONS[sunPositionIndex];
  return polarToCartesian(CENTER_X, CENTER_Y, SUN_DISTANCE, pos.angle);
}

function drawLinkLines() {
  svg.querySelectorAll(".link-line").forEach(el => el.remove());
  if (sunPositionIndex === -1) return;
  const mechGroup = svg.querySelector(".mechanism-group");
  if (!mechGroup) return;

  const sunPos = getSunPosition();
  const connected = getConnectedSatellites();

  connected.forEach(sat => {
    const line = createSVG("line", {
      x1: sunPos.x, y1: sunPos.y,
      x2: sat.centerX, y2: sat.centerY,
      class: "link-line",
    });
    mechGroup.insertBefore(line, mechGroup.firstChild);
  });
}

/* ============================================
   ОБНОВЛЕНИЕ СЛОЁВ + ЭФФЕКТ "ЗАЕЗДА"
   ============================================ */

function updateCenterWheelState() {
  const wheel = document.getElementById("centerWheel");
  const icon = svg.querySelector(".center-wheel-icon");
  const mechGroup = svg.querySelector(".mechanism-group");
  const wheelGroup = window.centerWheelGroup;
  const sunGroup = window.sunGroupEl;
  const sunLimb = window.sunLimbEl;

  if (!wheel || !mechGroup || !wheelGroup || !sunGroup) return;

  if (winReady) {
    wheel.classList.add("win-active");
    if (icon) icon.textContent = "";

    if (mechGroup.lastElementChild !== wheelGroup) {
      mechGroup.appendChild(wheelGroup);
    }
    wheelGroup.classList.add("on-top");

    if (sunPositionIndex === -1) {
      sunGroup.classList.add("under-wheel");
      sunGroup.classList.remove("win-pending");
      if (sunLimb) {
        sunLimb.style.opacity = "";
        sunLimb.style.transform = `rotate(${sunLimbAngle}deg)`;
      }
    } else {
      sunGroup.classList.remove("under-wheel");
      sunGroup.classList.add("win-pending");
      if (sunLimb) {
        sunLimb.style.opacity = "0.7";
        sunLimb.style.transform = `rotate(${sunLimbAngle}deg) scale(0.9)`;
      }
    }

    if (sunPositionIndex !== -1) {
      updateStatus("Код верен! Перетащите солнечную шестерню в центр (под штурвал).");
    } else {
      updateStatus("Код верен! Нажмите на штурвал в центре.");
    }
  } else {
    wheel.classList.remove("win-active");
    if (icon) icon.textContent = "";

    if (mechGroup.firstElementChild !== wheelGroup) {
      mechGroup.insertBefore(wheelGroup, mechGroup.firstElementChild);
    }
    wheelGroup.classList.remove("on-top");

    sunGroup.classList.remove("under-wheel");
    sunGroup.classList.remove("win-pending");
    if (sunLimb) {
      sunLimb.style.opacity = "";
      sunLimb.style.transform = `rotate(${sunLimbAngle}deg)`;
    }
  }

  const dragTarget = window.sunDragTargetEl;
  if (dragTarget) {
    dragTarget.classList.toggle(
      "win-ready",
      winReady && sunPositionIndex === -1
    );
  }
}

function onCenterWheelClick() {
  if (gameWon) return;

  if (!winReady) {
    updateStatus("Сначала подберите правильный код!");
    return;
  }
  if (sunPositionIndex !== -1) {
    updateStatus("Сначала перетащите солнечную шестерню в центр!");
    return;
  }

  const wheelGroup = window.centerWheelGroup;
  if (!wheelGroup) {
    finishGame();
    return;
  }

  gameWon = true;
  setButtonsEnabled(false);

  wheelGroup.style.animation = "none";

  wheelGroup.style.transition = "none";
  wheelGroup.style.transform = "rotate(0deg)";

  void wheelGroup.getBoundingClientRect();

  requestAnimationFrame(() => {
    wheelGroup.style.transition =
      `transform ${WHEEL_SPIN_DURATION}s cubic-bezier(0.34, 1.56, 0.64, 1)`;
    wheelGroup.style.transform = "rotate(360deg)";

    setTimeout(() => {
      finishGame();
    }, WHEEL_SPIN_DURATION * 1000 + 50);
  });
}

function updateTargetDisplay() {
  targetDigitsEl.innerHTML = "";
  targetDigits.forEach(d => {
    const el = document.createElement("div");
    el.className = "target-digit";
    el.textContent = d;
    targetDigitsEl.appendChild(el);
  });
}

function updateActiveDisplay() {
  const digits = getActiveDigitsInOrder();
  activeDigitsEl.innerHTML = "";
  digits.forEach(d => {
    const el = document.createElement("div");
    el.className = "target-digit";
    el.textContent = d;
    activeDigitsEl.appendChild(el);
  });
}

function updateMovesDisplay() {
  movesCountEl.textContent = movesCount;
}

function updateStatus(text) {
  statusEl.textContent = text;
}

function setButtonsEnabled(enabled) {
  [rotateCWBtn, rotateCCWBtn, rotateMechCWBtn, rotateMechCCWBtn].forEach(b => {
    if (b) b.disabled = !enabled;
  });
}

/* ============================================
   ТАЙМЕР
   ============================================ */

function updateTimerDisplay() {
  if (!timerValueEl) return;
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  timerValueEl.textContent = `${m}:${s}`;
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

/* ============================================
   ВЗАИМОДЕЙСТВИЕ
   ============================================ */

function onSunMouseDown(e) {
  if (gameWon || isRotatingMechanism) return;

  dragging = true;
  e.preventDefault();

  dragStartPt = svgPoint(e);
  didDrag = false;

  document.addEventListener("mousemove", onSunMouseMove);
  document.addEventListener("mouseup", onSunMouseUp);
}

function onSunMouseMove(e) {
  if (!dragging) return;
  const pt = svgPoint(e);

  if (dragStartPt && Math.hypot(pt.x - dragStartPt.x, pt.y - dragStartPt.y) > 3) {
    didDrag = true;
  }

  const dx = pt.x - CENTER_X;
  const dy = pt.y - CENTER_Y;
  const radius = Math.hypot(dx, dy);

  dragAngle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  if (dragAngle < 0) dragAngle += 360;

  const constrainedRadius = Math.min(radius, SUN_DISTANCE);
  const pos = polarToCartesian(CENTER_X, CENTER_Y, constrainedRadius, dragAngle);
  moveSunTo(pos.x, pos.y);

  const now = performance.now();
  if (didDrag && now - lastDragSoundTime > 60) {
    sound.playDrag();
    lastDragSoundTime = now;
  }
}

function onSunMouseUp() {
  if (!dragging) return;
  dragging = false;
  document.removeEventListener("mousemove", onSunMouseMove);
  document.removeEventListener("mouseup", onSunMouseUp);
  snapSunToNearest();

  setTimeout(() => { didDrag = false; }, 0);
}

function onSunTouchStart(e) {
  if (gameWon || isRotatingMechanism) return;

  e.preventDefault();
  dragging = true;

  dragStartPt = svgPoint(e.touches[0]);
  didDrag = false;

  document.addEventListener("touchmove", onSunTouchMove, { passive: false });
  document.addEventListener("touchend", onSunTouchUp);
}

function onSunTouchMove(e) {
  if (!dragging) return;
  e.preventDefault();
  const pt = svgPoint(e.touches[0]);

  if (dragStartPt && Math.hypot(pt.x - dragStartPt.x, pt.y - dragStartPt.y) > 3) {
    didDrag = true;
  }

  const dx = pt.x - CENTER_X;
  const dy = pt.y - CENTER_Y;
  const radius = Math.hypot(dx, dy);

  dragAngle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  if (dragAngle < 0) dragAngle += 360;

  const constrainedRadius = Math.min(radius, SUN_DISTANCE);
  const pos = polarToCartesian(CENTER_X, CENTER_Y, constrainedRadius, dragAngle);
  moveSunTo(pos.x, pos.y);

  const now = performance.now();
  if (didDrag && now - lastDragSoundTime > 60) {
    sound.playDrag();
    lastDragSoundTime = now;
  }
}

function onSunTouchUp() {
  if (!dragging) return;
  dragging = false;
  document.removeEventListener("touchmove", onSunTouchMove);
  document.removeEventListener("touchend", onSunTouchUp);
  snapSunToNearest();

  setTimeout(() => { didDrag = false; }, 0);
}

function moveSunTo(x, y) {
  if (window.sunGroupEl) {
    window.sunGroupEl.setAttribute("transform", `translate(${x}, ${y})`);
  }
  currentSunPos = { x, y };
  svg.querySelectorAll(".link-line").forEach(el => el.remove());
}

function snapSunToNearest() {
  const dx = currentSunPos.x - CENTER_X;
  const dy = currentSunPos.y - CENTER_Y;
  const radius = Math.hypot(dx, dy);

  if (radius < SUN_DISTANCE / 2) {
    if (sunPositionIndex !== -1) {
      sunPositionIndex = -1;
      movesCount++;
      updateMovesDisplay();
    }
    sunInCenter = true;
    animateSunTo(CENTER_X, CENTER_Y);
    return;
  }

  sunInCenter = false;

  let nearestIndex = 0;
  let minDiff = Infinity;

  SUN_POSITIONS.forEach((pos, idx) => {
    let diff = Math.abs(dragAngle - pos.angle);
    if (diff > 180) diff = 360 - diff;
    if (diff < minDiff) {
      minDiff = diff;
      nearestIndex = idx;
    }
  });

  if (nearestIndex !== sunPositionIndex) {
    sunPositionIndex = nearestIndex;
    movesCount++;
    updateMovesDisplay();
  }

  const finalPos = getSunPosition();
  animateSunTo(finalPos.x, finalPos.y);
}

function animateSunTo(x, y, duration = 250, onDone) {
  const startX = currentSunPos.x;
  const startY = currentSunPos.y;
  const startTime = performance.now();

  function animate(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const cx = startX + (x - startX) * ease;
    const cy = startY + (y - startY) * ease;

    if (window.sunGroupEl) {
      window.sunGroupEl.setAttribute("transform", `translate(${cx}, ${cy})`);
    }
    currentSunPos = { x: cx, y: cy };

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      currentSunPos = { x, y };
      if (window.sunGroupEl) {
        window.sunGroupEl.setAttribute("transform", `translate(${x}, ${y})`);
      }
      drawLinkLines();

      if (sunPositionIndex === -1) {
        sunInCenter = true;
        updateStatus(winReady ? "Код верен! Нажмите на штурвал в центре." : "Солнечная в центре — не соединена");
      } else {
        sunInCenter = false;
        const connected = getConnectedSatellites();
        updateStatus(winReady
          ? "Код верен! Перетащите солнечную шестерню в центр (под штурвал)."
          : `Соединены: ${connected.map(sat => sat.label).join(" и ")}`);
      }

      updateCenterWheelState();

      const sunRimEl = window.sunGroupEl.querySelector(".sun-rim");
      const dragTarget = window.sunGroupEl.querySelector(".sun-drag-target");
      if (sunRimEl && dragTarget) {
        sunRimEl.classList.toggle("in-center", sunPositionIndex === -1);
        dragTarget.classList.toggle("in-center", sunPositionIndex === -1);
      }

      if (typeof onDone === "function") onDone();
    }
  }

  requestAnimationFrame(animate);
}

function svgPoint(e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function rotate(clockwise) {
  if (gameWon || isRotatingMechanism) return;

  if (sunPositionIndex === -1) {
    updateStatus("Солнечная в центре — не соединена ни с кем. Перетащите её к паре сателлитов.");
    return;
  }

  const connected = getConnectedSatellites();
  if (connected.length === 0) {
    updateStatus("Нет соединённых сателлитов. Перетащите солнечную к паре.");
    return;
  }

  connected.forEach(sat => {
    const count = sat.digits.length;
    if (clockwise) {
      sat.rotation = (sat.rotation + 1) % count;
    } else {
      sat.rotation = (sat.rotation - 1 + count) % count;
    }
  });

  animateSatellites(clockwise);
  animateSunLimb(clockwise);

  movesCount++;
  updateMovesDisplay();
  updateStatus(`Вращение ${clockwise ? "по часовой" : "против часовой"}`);

  if (clockwise) {
    sound.playDialCW();
  } else {
    sound.playDialCCW();
  }

  setTimeout(checkWin, 350);
}

function animateSatellites(clockwise) {
  const connected = getConnectedSatellites();

  connected.forEach(sat => {
    const step = 360 / sat.digits.length;
    const angle = clockwise ? step : -step;

    sat.digitsGroupEl.style.transition = `transform ${SAT_ROTATE_DURATION}s ease-in-out`;
    sat.digitsGroupEl.style.transform = `rotate(${angle}deg)`;

    setTimeout(() => {
      sat.digitsGroupEl.style.transition = "none";
      sat.digitsGroupEl.style.transform = "rotate(0deg)";
      drawSatelliteDigits(sat);
    }, SAT_ROTATE_DURATION * 1000);
  });
}

function animateSunLimb(clockwise) {
  if (!window.sunLimbEl) return;

  sunLimbAngle += clockwise ? -SUN_LIMB_STEP : SUN_LIMB_STEP;

  window.sunLimbEl.style.transition = `transform ${SAT_ROTATE_DURATION}s ease-in-out`;
  window.sunLimbEl.style.transform = `rotate(${sunLimbAngle}deg)`;
}

function rotateMechanism(direction) {
  if (gameWon || isRotatingMechanism) return;

  isRotatingMechanism = true;
  setButtonsEnabled(false);

  const mechGroup = svg.querySelector(".mechanism-group");
  if (!mechGroup) {
    isRotatingMechanism = false;
    setButtonsEnabled(true);
    return;
  }

  const animAngle = direction * 120;

  mechGroup.style.transition = "transform 0.5s ease-in-out";
  mechGroup.style.transform = `rotate(${animAngle}deg)`;

  if (direction > 0) {
    sound.playMechCW();
  } else {
    sound.playMechCCW();
  }

  setTimeout(() => {
    mechGroup.style.transition = "none";
    mechGroup.style.transform = "rotate(0deg)";

    satellites.forEach(sat => {
      sat.angle = normalizeAngle(sat.angle + direction * 120);
    });

    if (sunPositionIndex !== -1) {
      sunPositionIndex = ((sunPositionIndex + direction) % 3 + 3) % 3;
    }

    const newSunPos = getSunPosition();
    currentSunPos = { x: newSunPos.x, y: newSunPos.y };

    if (window.sunGroupEl) {
      window.sunGroupEl.setAttribute(
        "transform",
        `translate(${newSunPos.x}, ${newSunPos.y})`
      );
    }

    satellites.forEach(sat => {
      const pos = polarToCartesian(CENTER_X, CENTER_Y, SATELLITE_DISTANCE, sat.angle);
      sat.centerX = pos.x;
      sat.centerY = pos.y;

      const circles = sat.groupEl.querySelectorAll("circle");
      circles.forEach(c => {
        c.setAttribute("cx", pos.x);
        c.setAttribute("cy", pos.y);
      });

      sat.groupEl.style.transformOrigin = `${pos.x}px ${pos.y}px`;
      sat.digitsGroupEl.style.transformOrigin = `${pos.x}px ${pos.y}px`;

      drawSatelliteDigits(sat);
    });

    drawLinkLines();
    updateActiveDisplay();
    updateCenterWheelState();

    movesCount++;
    updateMovesDisplay();
    updateStatus(`Механизм повёрнут ${direction > 0 ? "по часовой" : "против часовой"} на 120°`);

    isRotatingMechanism = false;
    if (!gameWon) setButtonsEnabled(true);

    setTimeout(checkWin, 100);
  }, 500);
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function recordGameStart() {
  const stats = loadStats();
  const key = String(DIGIT_COUNT);
  if (!stats[key]) stats[key] = { games: 0, wins: 0, bestMoves: null, bestTime: null };
  stats[key].games = (stats[key].games || 0) + 1;
  saveStats(stats);
  gameRecorded = true;
}

function recordWin(moves, time) {
  const stats = loadStats();
  const key = String(DIGIT_COUNT);
  if (!stats[key]) stats[key] = { games: 0, wins: 0, bestMoves: null, bestTime: null };
  stats[key].wins = (stats[key].wins || 0) + 1;

  if (stats[key].bestMoves === null || moves < stats[key].bestMoves) {
    stats[key].bestMoves = moves;
  }

  if (stats[key].bestTime === null || time < stats[key].bestTime) {
    stats[key].bestTime = time;
  }

  saveStats(stats);
}

function checkWin() {
  updateActiveDisplay();

  const currentDigits = getActiveDigitsInOrder();
  const isWin = currentDigits.every((d, i) => d === targetDigits[i]);

  if (isWin && !winReady) {
    winReady = true;
    highlightMatchedDigits();
    updateCenterWheelState();
  } else if (!isWin && winReady) {
    winReady = false;
    clearMatchedDigits();
    updateCenterWheelState();
    updateStatus(`Активные: ${currentDigits.join(", ")}. Цель: ${targetDigits.join(", ")}`);
  } else if (!isWin) {
    updateStatus(`Активные: ${currentDigits.join(", ")}. Цель: ${targetDigits.join(", ")}`);
  }
}

function highlightMatchedDigits() {
  const targetEls = targetDigitsEl.querySelectorAll(".target-digit");
  const activeEls = activeDigitsEl.querySelectorAll(".target-digit");
  targetEls.forEach(el => el.classList.add("win-match"));
  activeEls.forEach(el => el.classList.add("win-match"));
}

function clearMatchedDigits() {
  targetDigitsEl.querySelectorAll(".target-digit")
    .forEach(el => el.classList.remove("win-match"));
  activeDigitsEl.querySelectorAll(".target-digit")
    .forEach(el => el.classList.remove("win-match"));
}

function finishGame() {
  setButtonsEnabled(false);
  stopTimer();
  recordWin(movesCount, timerSeconds);
  sound.playWin();
  setTimeout(() => {
    window.location.href = "victory.html";
  }, 600);
}

function init() {
  DIGIT_COUNT = parseInt(localStorage.getItem(DIFF_KEY) || "6", 10);
  if (![3, 4, 5, 6].includes(DIGIT_COUNT)) DIGIT_COUNT = 6;

  satellites = SATELLITES_CONFIG.map(cfg => {
    const digits = generateSatelliteDigits();
    const step = 360 / digits.length;
    const offset = (digits.length % 2 === 0) ? 0 : step / 2;

    return {
      key: cfg.key,
      label: cfg.label,
      angle: cfg.angle,
      digits,
      offset,
      rotation: 0,
      groupEl: null,
      digitsGroupEl: null,
      centerX: 0,
      centerY: 0,
      knobEl: null,
      markEl: null,
    };
  });

  targetDigits = generateTarget();

  sunPositionIndex = -1;
  currentSunPos = { x: CENTER_X, y: CENTER_Y };
  movesCount = 0;
  gameWon = false;
  isRotatingMechanism = false;
  gameRecorded = false;
  winReady = false;
  sunInCenter = true;
  sunLimbAngle = 0;

  didDrag = false;
  dragStartPt = null;
  dragging = false;
  lastDragSoundTime = 0;

  stopTimer();
  timerSeconds = 0;
  updateTimerDisplay();

  updateTargetDisplay();
  updateMovesDisplay();
  buildField();
  updateActiveDisplay();

  clearMatchedDigits();

  setButtonsEnabled(true);
  if (restartCrossBtn) restartCrossBtn.disabled = false;

  updateStatus(`Сложность: ${DIGIT_COUNT} цифр. Перетащите солнечную к паре сателлитов.`);

  if (!gameRecorded) recordGameStart();

  startTimer();
}

rotateCWBtn.addEventListener("click", () => rotate(true));
rotateCCWBtn.addEventListener("click", () => rotate(false));
rotateMechCWBtn.addEventListener("click", () => rotateMechanism(1));
rotateMechCCWBtn.addEventListener("click", () => rotateMechanism(-1));

restartCrossBtn.addEventListener("click", () => {
  sound.playRestart();
  init();
});

init();