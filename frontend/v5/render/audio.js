// V5 sound and original music, synthesised with WebAudio: no files, no samples, nothing licensed.
// One melody runs through the whole game: Elena's tune.ll from the archive. Each era and chapter arranges it
// differently: a bright summer version, a bouncing train version, the guitar duet, a slow parting version, a sparse
// 2004 version with notes missing, and a fuller winter version (new work for the restored edition).
const KEY = 'v5.audio.v1';
let analyser = null; let ctx = null, master = null, musicBus = null, sfxBus = null, ambBus = null;
const prefs = Object.assign({ muted: false, music: 0.7, sfx: 0.8 }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
const heard = new Set(); const noiseBuf = {};
let theme = null, tune = null, seqAt = 0, seqI = 0, timer = null, beds = [];
const DEFAULT_TUNE = { tempo: 88, phrases: [[[64, 1], [67, 1], [69, 2], [71, 1], [69, 1], [67, 2]], [[64, 1], [67, 1], [72, 2], [71, 1], [69, 1], [67, 2]], [[69, 1], [71, 1], [72, 1], [74, 1], [76, 2], [74, 1], [72, 1]], [[71, 1], [69, 1], [67, 1], [64, 1], [67, 4]]].map((p) => p.map(([midi, beats]) => ({ midi, beats }))) };

function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* blocked */ } }
function context() {
  if (ctx) { return ctx; }
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!AC) { return null; }
  try {
    ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination); analyser = ctx.createAnalyser(); analyser.fftSize = 2048; master.connect(analyser);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(comp); sfxBus = ctx.createGain(); sfxBus.connect(comp); ambBus = ctx.createGain(); ambBus.connect(comp);
    apply();
  } catch (e) { ctx = null; }
  return ctx;
}
function apply() { if (!ctx) { return; } const n = ctx.currentTime; master.gain.setTargetAtTime(prefs.muted ? 0 : 2, n, 0.05); /* +6 dB: measured peaks were about -20 dBFS at 1 */ musicBus.gain.setTargetAtTime(prefs.music * 0.55, n, 0.1); sfxBus.gain.setTargetAtTime(prefs.sfx, n, 0.05); ambBus.gain.setTargetAtTime(prefs.sfx * 0.8, n, 0.3); }
const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
function noise(sec, seed) { const k = sec + ':' + seed; if (noiseBuf[k]) { return noiseBuf[k]; } const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let s = seed || 7; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x7fffffff) * 2 - 1; } noiseBuf[k] = b; return b; }
function env(g, at, a, peak, dur) { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + a); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); }
function tone(at, f, dur, vol, type, dest, f2, attack) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, at); if (f2) { o.frequency.exponentialRampToValueAtTime(f2, at + dur); } env(g, at, attack || 0.012, vol, dur); o.connect(g); g.connect(dest || sfxBus); o.start(at); o.stop(at + dur + 0.05); }
function hiss(at, dur, vol, freq, q, dest, type) { const s = ctx.createBufferSource(); s.buffer = noise(Math.max(0.5, dur), 3); const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = q || 0.8; const g = ctx.createGain(); env(g, at, 0.04, vol, dur); s.connect(f); f.connect(g); g.connect(dest || sfxBus); s.start(at); s.stop(at + dur + 0.1); }
// instruments
function pluck(at, midi, dur, vol, dest) { const f = N(midi); [1, 1.003].forEach((d, i) => tone(at, f * d, Math.min(2.4, dur + 0.6), vol * (i ? 0.5 : 0.8), 'triangle', dest, null, 0.004)); tone(at, f * 2, 0.25, vol * 0.25, 'sine', dest, null, 0.002); hiss(at, 0.03, vol * 0.4, f * 3, 2, dest); }
function hum(at, midi, dur, vol, dest) { const o = ctx.createOscillator(), v = ctx.createOscillator(), vg = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = N(midi); v.frequency.value = 5.2; vg.gain.value = 3.5; v.connect(vg); vg.connect(o.frequency); lp.type = 'lowpass'; lp.frequency.value = 900; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.12); g.gain.setValueAtTime(vol, at + Math.max(0.12, dur - 0.15)); g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.1); o.connect(lp); lp.connect(g); g.connect(dest); o.start(at); v.start(at); o.stop(at + dur + 0.2); v.stop(at + dur + 0.2); }
function pad(at, midis, dur, vol, dest) { midis.forEach((m) => { [-4, 4].forEach((det) => { const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = N(m); o.detune.value = det; lp.type = 'lowpass'; lp.frequency.value = 700; g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol / midis.length, at + 0.6); g.gain.setValueAtTime(vol / midis.length, at + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.6); o.connect(lp); lp.connect(g); g.connect(dest); o.start(at); o.stop(at + dur + 0.7); }); }); }
const bell = (at, midi, dur, vol, dest) => { tone(at, N(midi + 12), dur * 2, vol, 'sine', dest, null, 0.003); tone(at, N(midi + 19), dur, vol * 0.3, 'sine', dest, null, 0.003); };

// ---- themes: arrangements of the same melody -------------------------------------------------------------------
const ARR = {
  study: { tempo: 0.7, voice: 'pluck', vol: 0.05, skip: 0, bass: false, padOn: true, padVol: 0.035, transpose: -12 },
  summer: { tempo: 1.1, voice: 'pluck', vol: 0.07, bass: true, bassVol: 0.05, bells: true },
  train: { tempo: 1.4, voice: 'pluck', vol: 0.07, bass: true, bassVol: 0.06, oompah: true },
  coast: { tempo: 1.25, voice: 'pluck', vol: 0.065, bass: true, bassVol: 0.05, bells: true, hum: 0.025 },
  parting: { tempo: 0.62, voice: 'pluck', vol: 0.06, transpose: -2, padOn: true, padVol: 0.04 },
  y2004: { tempo: 0.8, voice: 'sine', vol: 0.045, skip: 2, padOn: true, padVol: 0.025, transpose: -5 },
  cottage04: { tempo: 0.55, voice: 'sine', vol: 0.03, skip: 3, padOn: false },
  winter: { tempo: 0.75, voice: 'bell', vol: 0.06, bass: true, bassVol: 0.05, padOn: true, padVol: 0.06, hum: 0.02 },
  night: { tempo: 0.6, voice: 'bell', vol: 0.035, padOn: true, padVol: 0.03, transpose: -12, hum: 0.012 },
  ending: { tempo: 0.7, voice: 'pluck', vol: 0.06, padOn: true, padVol: 0.05, bells: true }
};
function flat() { const t = tune || DEFAULT_TUNE; const out = []; t.phrases.forEach((ph, pi) => { ph.forEach((n, i) => out.push({ midi: n.midi, beats: n.beats, phrase: pi, first: i === 0 })); out.push({ midi: 0, beats: 1, phrase: pi }); }); return out; }
function pump() {
  if (!ctx || !theme || !ARR[theme]) { return; }
  const a = ARR[theme], t = tune || DEFAULT_TUNE, spb = 60 / ((t.tempo || 88) * a.tempo), notes = flat();
  if (seqAt < ctx.currentTime) { seqAt = ctx.currentTime + 0.08; }
  while (seqAt < ctx.currentTime + 0.6) {
    const n = notes[seqI % notes.length]; const dur = n.beats * spb; const m = n.midi + (a.transpose || 0);
    const drop = a.skip && (seqI % a.skip === 1);
    if (n.midi && !drop) {
      if (a.voice === 'pluck') { pluck(seqAt, m, dur, a.vol, musicBus); } else if (a.voice === 'bell') { bell(seqAt, m, dur, a.vol, musicBus); } else { tone(seqAt, N(m), dur * 1.2, a.vol, 'sine', musicBus, null, 0.05); }
      if (a.hum) { hum(seqAt, m - 12, dur, a.hum, musicBus); }
    }
    if (n.first) {
      const root = [52, 48, 53, 55][n.phrase % 4] + (a.transpose || 0);
      if (a.bass) { tone(seqAt, N(root - 12), spb * 3.5, a.bassVol, 'triangle', musicBus, null, 0.02); }
      if (a.padOn) { pad(seqAt, [root, root + 7, root + 16], spb * 7, a.padVol, musicBus); }
      if (a.bells && n.phrase % 2 === 1) { bell(seqAt + spb * 2, root + 24, spb, 0.02, musicBus); }
    }
    if (a.oompah && n.midi) { tone(seqAt + dur / 2, N(55 - 12), 0.12, 0.03, 'square', musicBus); }
    seqI += 1; seqAt += dur;
  }
}
export function setTheme(name) {
  if (theme === name) { return; } theme = name; seqI = 0; heard.add('theme:' + name);
  const c = context(); if (!c) { return; }
  seqAt = c.currentTime + 0.4; if (!timer && typeof setInterval === 'function') { timer = setInterval(pump, 120); }
}
export function setTune(t) { if (t && t.phrases && t.phrases.length) { tune = t; } }
export function setAmbience(kind) {
  const c = context(); if (!c) { return; }
  beds.forEach((b) => { try { b.stop(); } catch (e) { /* stopped */ } }); beds = [];
  const loop = (freq, q, vol, lfo) => { const s = c.createBufferSource(); s.buffer = noise(4, 11); s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = vol; if (lfo) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = lfo; lg.gain.value = vol * 0.6; l.connect(lg); lg.connect(g.gain); l.start(); beds.push(l); } s.connect(f); f.connect(g); g.connect(ambBus); s.start(); beds.push(s); };
  if (kind === 'sea') { loop(700, 0.5, 0.12, 0.12); loop(2600, 0.2, 0.012); }
  if (kind === 'room') { loop(400, 0.4, 0.04); }
  if (kind === 'train') { loop(220, 0.8, 0.16, 2.2); loop(1800, 0.3, 0.02); }
  if (kind === 'wind') { loop(900, 0.6, 0.1, 0.3); }
  if (kind === 'winter') { loop(500, 0.4, 0.05, 0.1); }
  // R4: rain on a kitchen window at night: a soft low wash, a brighter patter on the glass, and a slow gust
  if (kind === 'rain') { loop(1500, 0.3, 0.06, 0.08); loop(5200, 0.4, 0.018, 0.6); loop(300, 0.5, 0.05, 0.05); }
  if (kind === 'house') { loop(250, 0.4, 0.025); }
  heard.add('amb:' + kind);
}

// ---- effects ---------------------------------------------------------------------------------------------------
const FX = {
  step: (t) => hiss(t, 0.06, 0.035, 900, 1.5), jump: (t) => hiss(t, 0.12, 0.05, 1400, 1), land: (t) => hiss(t, 0.1, 0.07, 400, 1.2),
  click: (t) => tone(t, 900, 0.04, 0.03, 'square'), open: (t) => tone(t, N(72), 0.12, 0.04, 'triangle'), blip: (t) => tone(t, 1100, 0.025, 0.012, 'square'),
  crtWake: (t) => { tone(t, 60, 0.4, 0.08, 'sawtooth', null, 120); tone(t + 0.05, 15700, 1.4, 0.01, 'sine'); hiss(t, 0.5, 0.05, 3000, 0.5); },
  modem: (t) => { [[1200, 0.3], [2100, 0.3], [980, 0.25], [1650, 0.4], [2400, 0.2]].forEach(([f, d], i) => tone(t + i * 0.26, f, d, 0.03, 'square', null, f * 1.1)); hiss(t + 1, 1, 0.05, 2600, 0.6); },
  restoreStart: (t) => { tone(t, 140, 0.4, 0.05, 'triangle', null, 280); hiss(t, 0.5, 0.03, 3000, 0.6); },
  plank: (t) => { hiss(t, 0.09, 0.1, 320, 2.5); tone(t, 170 + Math.random() * 60, 0.12, 0.07, 'triangle', null, 90); },
  restored: (t) => { [67, 71, 74, 79, 83, 86].forEach((m, i) => tone(t + i * 0.09, N(m), 1.2, 0.05, 'triangle')); },
  to98: (t) => { tone(t, 220, 0.5, 0.05, 'sine', null, 440); hiss(t, 0.35, 0.04, 2400, 0.7); [76, 79, 84].forEach((m, i) => tone(t + 0.1 + i * 0.07, N(m), 0.5, 0.03, 'triangle')); },
  to04: (t) => { tone(t, 440, 0.5, 0.05, 'sine', null, 220); hiss(t, 0.35, 0.04, 1400, 0.7); tone(t + 0.15, N(76), 0.5, 0.03, 'sine'); },
  denied: (t) => { tone(t, 220, 0.2, 0.05, 'square', null, 150); },
  whistle: (t) => { tone(t, N(81), 0.9, 0.05, 'sine', null, N(80)); tone(t, N(85), 0.9, 0.03, 'sine'); },
  caught: (t) => { [72, 76, 79, 84].forEach((m, i) => tone(t + i * 0.08, N(m), 0.7, 0.05, 'triangle')); },
  shutter: (t) => { hiss(t, 0.05, 0.12, 3000, 1.5); tone(t + 0.04, 2400, 0.03, 0.05, 'square'); hiss(t + 0.08, 0.06, 0.08, 1800, 1.5); },
  bell: (t) => { tone(t, N(91), 0.5, 0.05, 'sine'); tone(t + 0.15, N(91), 0.6, 0.05, 'sine'); },
  crank: (t) => { hiss(t, 0.05, 0.05, 700, 3); tone(t, 300, 0.04, 0.03, 'square'); },
  lit: (t) => { tone(t, 55, 2.4, 0.1, 'sine', null, 45); [76, 81, 84, 88].forEach((m, i) => tone(t + 0.2 + i * 0.12, N(m), 2.2, 0.04, 'sine')); },
  door: (t) => { hiss(t, 0.3, 0.06, 500, 1.2); tone(t + 0.2, 120, 0.2, 0.05, 'triangle'); },
  page: (t) => hiss(t, 0.25, 0.04, 2500, 0.8), choice: (t) => tone(t, N(79), 0.25, 0.04, 'triangle'),
  season: (t) => { [72, 76, 79, 83, 86, 91].forEach((m, i) => bell(t + i * 0.2, m, 1.2, 0.025, sfxBus)); },
  credit: (t) => { [64, 67, 72, 76].forEach((m, i) => tone(t + i * 0.12, N(m), 1.4, 0.05, 'triangle')); },
  iris: (t) => { tone(t, N(71), 0.6, 0.04, 'sine'); tone(t + 0.3, N(76), 0.8, 0.04, 'sine'); },
  lamp: (t) => tone(t, 1800, 0.03, 0.04, 'square'), hint: (t) => tone(t, N(88), 0.3, 0.02, 'sine'),
  can: (t) => { tone(t, 180, 0.08, 0.06, 'triangle', null, 90); hiss(t + 0.05, 0.12, 0.06, 2200, 2); tone(t + 0.12, 1400, 0.05, 0.02, 'sine'); },
  chain: (t) => { [0, 0.05, 0.1, 0.16].forEach((d) => tone(t + d, 2200 + d * 3000, 0.03, 0.02, 'square')); },
  rope: (t) => { hiss(t, 0.35, 0.05, 900, 2.2); tone(t + 0.25, 140, 0.15, 0.04, 'triangle'); },
  touch: (t) => { tone(t, N(84), 0.9, 0.025, 'sine'); tone(t + 0.12, N(88), 0.9, 0.02, 'sine'); },
  express: (t) => { hiss(t, 3.2, 0.12, 300, 0.6, null, 'lowpass'); tone(t, N(79), 1.2, 0.03, 'sine', null, N(75)); },
  star: (t) => { bell(t, 84, 0.8, 0.03, sfxBus); }, dot: (t) => tone(t, N(84), 0.15, 0.02, 'triangle'), carve: (t) => hiss(t, 0.25, 0.06, 3200, 3),
  tuned: (t) => { tone(t, N(64), 1.0, 0.05, 'triangle'); tone(t, N(64) * 2, 0.6, 0.02, 'sine'); }, detuned: (t) => { tone(t, N(64) * 1.04, 0.5, 0.04, 'triangle'); tone(t, N(64), 0.5, 0.03, 'triangle'); },
  found: (t) => { [79, 84, 88].forEach((m, i) => tone(t + i * 0.1, N(m), 1.2, 0.04, 'sine')); }, lens: (t) => { tone(t, 600, 0.06, 0.04, 'triangle'); hiss(t, 0.2, 0.04, 2400, 2); },
  gate: (t) => { hiss(t, 0.25, 0.05, 2600, 1); tone(t, N(86), 0.3, 0.03, 'sine'); },
  // R4: the kettle comes to the boil and screams; the answering machine's beep; a record breaking up; a photo unfolded
  kettle: (t) => { hiss(t, 1.2, 0.03, 2600, 1.5); tone(t + 0.6, 1800, 2.2, 0.035, 'sine', null, 2400, 0.4); tone(t + 0.7, 2650, 2.0, 0.02, 'sine', null, 3100, 0.5); },
  machine: (t) => { tone(t, 1000, 0.35, 0.04, 'sine'); hiss(t + 0.4, 0.5, 0.02, 3500, 0.6); },
  glitch: (t) => { [0, 0.07, 0.15, 0.2, 0.31].forEach((d, i) => tone(t + d, 180 + i * 140, 0.06, 0.04, 'square', null, 90)); hiss(t, 0.5, 0.05, 1200, 0.4); },
  unfold: (t) => { hiss(t, 0.35, 0.05, 2200, 0.9); [72, 76, 79].forEach((m, i) => tone(t + 0.3 + i * 0.12, N(m), 1.4, 0.03, 'sine')); }
};
export function play(name) { heard.add(name); if (prefs.muted || !FX[name]) { return; } const c = context(); if (!c) { return; } if (c.state === 'suspended') { c.resume(); } FX[name](c.currentTime + 0.01); }
// A duet note: the player's guitar, and June's humming once she joins.
export function duetNote(midi, dur, layer, cue) {
  heard.add('duet'); const c = context(); if (!c || prefs.muted) { return; } const at = c.currentTime + 0.01;
  pluck(at, midi, dur, cue ? 0.11 : 0.08, musicBus);
  if (layer >= 1) { hum(at, midi - 12, dur, 0.035 + layer * 0.01, musicBus); }
  if (layer >= 2) { tone(at, N(midi + 4), dur, 0.02, 'sine', musicBus, null, 0.05); }
  if (layer >= 3) { pad(at, [midi - 24, midi - 17], dur, 0.03, musicBus); }
}
export function unlock() { const c = context(); if (c && c.state === 'suspended') { c.resume(); } }
export const getPrefs = () => Object.assign({}, prefs);
export function setPref(k, v) { prefs[k] = v; save(); apply(); }
export const heardList = () => Array.from(heard);
// Output level for automated checks (RMS of what reaches the speakers, 0..1) and the context state. This shows that
// sound is produced; it says nothing about whether it sounds good.
export function level() { if (!analyser) { return { state: ctx ? ctx.state : 'none', rms: 0, peak: 0 }; } const b = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(b); let s = 0, pk = 0; for (let i = 0; i < b.length; i++) { s += b[i] * b[i]; pk = Math.max(pk, Math.abs(b[i])); } return { state: ctx.state, rms: Math.sqrt(s / b.length), peak: pk }; }
// for the listening page (audio.html)
export const themes = () => Object.keys(ARR);
export const effects = () => Object.keys(FX);
export function stopMusic() { theme = null; }
export const currentTheme = () => theme;
