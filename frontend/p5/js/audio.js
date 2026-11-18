// P5 sound (extended from P4), synthesised with WebAudio at run time: no audio files, no network, nothing licensed.
// Each scene has an ambience bed; the archive has a guide tone that grows louder near the current target.
// Mute and volume are stored in localStorage. The AudioContext starts on the first user gesture.

const MUTE_KEY = 'p5.muted.v1', VOL_KEY = 'p5.volume.v1';
let ctx = null, master = null, music = null, amb = null, guide = null, guideOsc = null, guideOsc2 = null;
let muted = false, volume = 0.75, scene = null, timer = null, noteAt = 0, noteIdx = 0;
const heard = new Set();
const noiseBuf = {};

try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
  const v = parseFloat(localStorage.getItem(VOL_KEY)); if (isFinite(v) && v >= 0 && v <= 1) { volume = v; }
} catch (e) { /* storage blocked */ }

function save() { try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); localStorage.setItem(VOL_KEY, String(volume)); } catch (e) { /* ignore */ } }

function context() {
  if (ctx) { return ctx; }
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) { return null; }
  try {
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = 0.32; music.connect(master);
    amb = ctx.createGain(); amb.gain.value = 0.0; amb.connect(master);
    guide = ctx.createGain(); guide.gain.value = 0; guide.connect(master);
    applyGain();
  } catch (e) { ctx = null; }
  return ctx;
}
function applyGain() { if (master) { master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05); } }

function noise(seconds, seed) {
  const key = seconds + ':' + seed;
  if (noiseBuf[key]) { return noiseBuf[key]; }
  const n = Math.floor(ctx.sampleRate * seconds); const b = ctx.createBuffer(1, n, ctx.sampleRate); const d = b.getChannelData(0);
  let s = seed || 7; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x7fffffff) * 2 - 1; }
  noiseBuf[key] = b; return b;
}
function tone(at, f, dur, vol, type, f2, dest, attack) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, at); if (f2) { o.frequency.exponentialRampToValueAtTime(f2, at + dur); }
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + (attack || 0.015)); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(dest || master); o.start(at); o.stop(at + dur + 0.05);
}
function hiss(at, dur, vol, freq, q, dest) {
  const src = ctx.createBufferSource(); src.buffer = noise(Math.max(0.5, dur), 3);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = q || 0.8;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f); f.connect(g); g.connect(dest || master); src.start(at); src.stop(at + dur + 0.1);
}

const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
const FX = {
  step: (t) => hiss(t, 0.07, 0.03, 900, 1.5),
  inspect: (t) => { tone(t, N(84), 0.25, 0.05, 'sine'); tone(t + 0.07, N(91), 0.35, 0.04, 'sine'); },
  objective: (t) => { [76, 81, 88].forEach((m, i) => tone(t + i * 0.09, N(m), 0.6, 0.05, 'triangle')); },
  blip: (t) => tone(t, 1100, 0.03, 0.015, 'square'),
  open: (t) => tone(t, N(72), 0.12, 0.04, 'triangle'),
  crtWake: (t) => { tone(t, 60, 0.4, 0.08, 'sawtooth', 120); tone(t + 0.05, 15700, 1.6, 0.012, 'sine'); hiss(t, 0.5, 0.06, 3000, 0.5); tone(t + 0.35, N(84), 0.2, 0.05, 'square'); },
  modem: (t) => { [[1200, 0.3], [2100, 0.3], [980, 0.25], [1650, 0.4], [2400, 0.2]].forEach(([f, d], i) => tone(t + i * 0.28, f, d, 0.03, 'square', f * 1.1)); hiss(t + 1.0, 1.0, 0.05, 2600, 0.6); },
  portal: (t) => { tone(t, 80, 2.2, 0.08, 'sine', 640); hiss(t, 2.0, 0.07, 800, 0.4); [72, 76, 79, 84].forEach((m, i) => tone(t + 0.6 + i * 0.15, N(m), 1.2, 0.04, 'triangle')); },
  gateOpen: (t) => { [67, 71, 74, 79, 83].forEach((m, i) => tone(t + i * 0.11, N(m), 1.4, 0.05, 'sine')); tone(t, 110, 1.8, 0.06, 'sawtooth', 220); },
  viewIn: (t) => { tone(t, 300, 0.7, 0.05, 'sine', 180); hiss(t, 0.7, 0.05, 1600, 0.7); tone(t + 0.2, N(79), 0.8, 0.04, 'triangle'); },
  viewOut: (t) => { tone(t, 180, 0.6, 0.05, 'sine', 300); hiss(t, 0.5, 0.04, 1600, 0.7); },
  denied: (t) => { tone(t, 220, 0.25, 0.06, 'square', 150); tone(t + 0.12, 160, 0.3, 0.05, 'square', 110); },
  restore: (t) => { [60, 64, 67, 72, 76, 79, 84, 88].forEach((m, i) => tone(t + i * 0.22, N(m), 1.0, 0.045, 'triangle')); hiss(t, 2.4, 0.04, 5000, 0.6); },
  ignite: (t) => { tone(t, 55, 2.5, 0.12, 'sine', 40); tone(t, N(84), 3, 0.05, 'sine'); tone(t + 0.02, N(91), 3, 0.04, 'sine'); hiss(t, 0.6, 0.06, 400, 0.5); },
  message: (t) => { tone(t, N(88), 0.18, 0.05, 'square'); tone(t + 0.2, N(88), 0.18, 0.05, 'square'); tone(t + 0.4, N(93), 0.5, 0.05, 'square'); },
  click: (t) => tone(t, 900, 0.04, 0.03, 'square'),
  lamp: (t) => { tone(t, 1800, 0.03, 0.04, 'square'); hiss(t, 0.05, 0.03, 4000, 1); },
  guideOn: (t) => { [81, 86, 93].forEach((m, i) => tone(t + i * 0.06, N(m), 0.5, 0.025, 'sine')); },
  hint: (t) => { tone(t, N(88), 0.3, 0.025, 'sine'); tone(t + 0.1, N(84), 0.4, 0.02, 'sine'); },
  holdStart: (t) => { tone(t, 140, 0.3, 0.04, 'triangle', 220); },
  holdStop: (t) => { tone(t, 220, 0.2, 0.03, 'triangle', 150); },
  plank: (t) => { hiss(t, 0.09, 0.09, 320, 2.5); tone(t, 180 + Math.random() * 60, 0.12, 0.07, 'triangle', 90); tone(t + 0.01, N(72 + Math.floor(Math.random() * 3) * 2), 0.18, 0.02, 'sine'); },
  bridgeDone: (t) => { [67, 71, 74, 79, 83, 86].forEach((m, i) => tone(t + i * 0.1, N(m), 1.3, 0.05, 'triangle')); tone(t, 98, 1.6, 0.06, 'sine', 196); },
  to98: (t) => { tone(t, 220, 0.5, 0.05, 'sine', 440); hiss(t, 0.35, 0.04, 2400, 0.7); [76, 79, 84].forEach((m, i) => tone(t + 0.12 + i * 0.07, N(m), 0.6, 0.03, 'triangle')); },
  to04: (t) => { tone(t, 440, 0.5, 0.05, 'sine', 220); hiss(t, 0.35, 0.04, 1400, 0.7); tone(t + 0.15, N(76), 0.6, 0.03, 'sine'); },
  diskIn: (t) => { hiss(t, 0.12, 0.08, 900, 1.2); tone(t + 0.12, 320, 0.06, 0.05, 'square'); tone(t + 0.22, 200, 0.4, 0.03, 'sawtooth', 260); hiss(t + 0.3, 0.6, 0.03, 3000, 2); },
  diskOut: (t) => { tone(t, 300, 0.08, 0.05, 'square'); hiss(t + 0.05, 0.15, 0.06, 700, 1.2); },
  call: (t) => { tone(t, N(67), 0.25, 0.035, 'triangle', N(72)); tone(t + 0.3, N(72), 0.35, 0.035, 'triangle', N(69)); },
  anomaly: (t) => { tone(t, 55, 4.5, 0.1, 'sine', 48); [0.4, 0.9, 1.4].forEach((d) => { tone(t + d, N(88), 0.16, 0.05, 'square'); }); tone(t + 2.2, N(76), 2.4, 0.05, 'sine'); tone(t + 2.2, N(83), 2.4, 0.035, 'sine'); hiss(t + 2.2, 2.0, 0.03, 600, 0.4); }
};

export function play(name) {
  heard.add(name);
  if (muted || !FX[name]) { return; }
  const c = context(); if (!c) { return; }
  if (c.state === 'suspended') { c.resume(); }
  FX[name](c.currentTime + 0.01);
}

// ---- ambience and music -----------------------------------------------------------------------------
let bed = [];
function stopBed() { bed.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } }); bed = []; }
function loopNoise(freq, q, vol, lfoRate, lfoDepth) {
  const src = ctx.createBufferSource(); src.buffer = noise(4, 11); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = vol;
  if (lfoRate) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = lfoRate; lg.gain.value = lfoDepth; l.connect(lg); lg.connect(g.gain); l.start(); bed.push(l); }
  src.connect(f); f.connect(g); g.connect(amb); src.start(); bed.push(src);
}
function drone(f, vol, type) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.value = vol; o.connect(g); g.connect(amb); o.start(); bed.push(o); }

const SCORES = {
  study: { step: 0.62, notes: [64, 67, 71, 74, 72, 67, 64, 60, 62, 66, 69, 74, 71, 66, 62, 59], type: 'triangle', vol: 0.05 },
  archive: { step: 0.9, notes: [57, 64, 69, 71, 64, 57, 62, 69, 52, 59, 64, 67, 59, 52, 55, 62], type: 'sine', vol: 0.06 },
  town98: { step: 0.36, notes: [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 76, 74], type: 'triangle', vol: 0.05 },
  // 2004: the same motif with half its notes missing, in a plainer voice
  town04: { step: 0.36, notes: [72, 0, 79, 0, 74, 0, 81, 0, 72, 0, 79, 0, 83, 0, 76, 0], type: 'sine', vol: 0.04 },
  ending: { step: 0.55, notes: [76, 72, 69, 72, 74, 71, 67, 71, 72, 69, 65, 69, 71, 74, 79, 0], type: 'sine', vol: 0.06 }
};
function pump() {
  if (!ctx || !scene || !SCORES[scene]) { return; }
  const s = SCORES[scene];
  if (noteAt < ctx.currentTime) { noteAt = ctx.currentTime + 0.05; }
  while (noteAt < ctx.currentTime + 0.5) {
    const m = s.notes[noteIdx % s.notes.length];
    if (m) { tone(noteAt, N(m), s.step * 2.2, s.vol, s.type, null, music, 0.04); if (noteIdx % 4 === 0) { tone(noteAt, N(m - 24), s.step * 4, s.vol * 0.8, 'sine', null, music, 0.08); } }
    noteIdx += 1; noteAt += s.step;
  }
  if (scene === 'town98' && noteIdx % 23 === 0) { const t = ctx.currentTime + 0.2; tone(t, 2200, 0.25, 0.012, 'sine', 1500); tone(t + 0.3, 2400, 0.22, 0.01, 'sine', 1600); }
}

export function setScene(name) {
  if (scene === name) { return; }
  scene = name; noteIdx = 0;
  const c = context(); if (!c) { return; }
  stopBed();
  amb.gain.setTargetAtTime(0, c.currentTime, 0.2);
  if (name === 'study') { loopNoise(500, 0.4, 0.05); drone(55, 0.015); }
  if (name === 'archive') { drone(55, 0.035, 'sine'); drone(82.4, 0.02, 'sine'); drone(110.6, 0.012, 'triangle'); loopNoise(2400, 0.3, 0.012, 0.1, 0.008); }
  if (name === 'town98') { loopNoise(700, 0.5, 0.12, 0.12, 0.08); loopNoise(2600, 0.2, 0.01); }
  if (name === 'town04') { loopNoise(600, 0.5, 0.09, 0.08, 0.05); }
  setTimeout(() => { if (amb) { amb.gain.setTargetAtTime(1, ctx.currentTime, 0.6); } }, 250);
  if (!guideOsc) {
    guideOsc = c.createOscillator(); guideOsc.type = 'sine'; guideOsc.frequency.value = N(81);
    guideOsc2 = c.createOscillator(); guideOsc2.type = 'sine'; guideOsc2.frequency.value = N(88);
    const trem = c.createOscillator(), tg = c.createGain(); trem.frequency.value = 3; tg.gain.value = 0.5;
    const g2 = c.createGain(); g2.gain.value = 0.5; trem.connect(tg); tg.connect(g2.gain);
    guideOsc.connect(g2); guideOsc2.connect(g2); g2.connect(guide); guideOsc.start(); guideOsc2.start(); trem.start();
  }
  if (!timer && typeof setInterval === 'function') { timer = setInterval(pump, 150); }
}

// 0..1: how strongly the guide tone sings (used in the archive, louder near the target).
export function setGuide(level) { if (guide && ctx) { guide.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.03, ctx.currentTime, 0.3); } }

export function unlock() { const c = context(); if (c && c.state === 'suspended') { c.resume(); } }
export function isMuted() { return muted; }
export function setMuted(v) { muted = !!v; save(); applyGain(); }
export function getVolume() { return volume; }
export function setVolume(v) { volume = Math.max(0, Math.min(1, v)); save(); applyGain(); }
export function heardList() { return Array.from(heard); }
