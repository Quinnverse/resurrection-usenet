/*
 * P3.2 sound. Everything is synthesised with WebAudio at run time: no audio files, no network, nothing licensed.
 * Effects have fixed pitches (no random numbers), music is a short looping arpeggio that changes with the scene.
 * The AudioContext is created on the first user gesture. Mute and volume are saved in localStorage.
 * UMD: window.P3Audio / module.exports (the Node build is silent and only keeps settings in memory).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; } else { root.P3Audio = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MUTE_KEY = 'p3.muted.v1';
  var VOL_KEY = 'p3.volume.v2';
  var ctx = null, master = null, musicGain = null;
  var muted = false, volume = 0.7;
  var scene = null, musicTimer = null, nextNote = 0, noteIndex = 0;
  var played = [];          // recent effects requested, newest last
  var heard = {};           // every effect name ever requested (read by tests; requests, not proof of audible output)

  function load() {
    try {
      muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
      var v = typeof localStorage !== 'undefined' ? parseFloat(localStorage.getItem(VOL_KEY)) : NaN;
      if (isFinite(v) && v >= 0 && v <= 1) { volume = v; }
    } catch (e) { /* storage blocked: defaults */ }
  }
  load();

  function save() {
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); localStorage.setItem(VOL_KEY, String(volume)); } catch (e) { /* ignore */ }
  }

  function context() {
    if (ctx) { return ctx; }
    var AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) { return null; }
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.connect(master);
      applyGain();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function applyGain() {
    if (!master) { return; }
    master.gain.value = muted ? 0 : volume;
    musicGain.gain.value = 0.35;
  }

  function tone(at, freq, dur, vol, type, freqEnd, dest) {
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, at);
    if (freqEnd) { osc.frequency.exponentialRampToValueAtTime(freqEnd, at + dur); }
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g); g.connect(dest || master);
    osc.start(at); osc.stop(at + dur + 0.03);
  }

  function noise(at, dur, vol) {
    var n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0), seed = 12345;
    for (var i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = ((seed / 0x7fffffff) * 2 - 1) * (1 - i / n); }
    var src = ctx.createBufferSource(), g = ctx.createGain();
    g.gain.setValueAtTime(vol, at); src.buffer = buf; src.connect(g); g.connect(master); src.start(at);
  }

  var N = { c4: 261.6, d4: 293.7, e4: 329.6, g4: 392, a4: 440, c5: 523.3, d5: 587.3, e5: 659.3, g5: 784, a5: 880, c6: 1046.5 };
  var SOUNDS = {
    jump:    function (t) { tone(t, 330, 0.13, 0.07, 'square', 660); },
    land:    function (t) { tone(t, 150, 0.07, 0.06, 'sine', 90); },
    step:    function (t) { tone(t, 210, 0.03, 0.025, 'triangle', 150); },
    star:    function (t, p) { var b = 880 * Math.pow(1.0595, Math.min(12, p || 0)); tone(t, b, 0.09, 0.06, 'sine'); tone(t + 0.07, b * 1.5, 0.14, 0.05, 'sine'); },
    hidden:  function (t) { [N.e5, N.g5, N.c6, N.e5 * 2].forEach(function (f, i) { tone(t + i * 0.09, f, 0.25, 0.05, 'triangle'); }); },
    check:   function (t) { tone(t, N.g4, 0.1, 0.05, 'triangle'); tone(t + 0.1, N.c5, 0.2, 0.05, 'triangle'); },
    click:   function (t) { tone(t, 700, 0.04, 0.035, 'square'); },
    thud:    function (t) { tone(t, 120, 0.12, 0.08, 'sine', 60); noise(t, 0.06, 0.03); },
    collect: function (t) { tone(t, N.e5, 0.1, 0.06, 'triangle'); tone(t + 0.08, N.a5, 0.2, 0.06, 'triangle'); },
    powerup: function (t) { tone(t, 120, 0.5, 0.06, 'sawtooth', 700); noise(t, 0.3, 0.02); tone(t + 0.4, N.c6, 0.25, 0.05, 'sine'); },
    meow:    function (t) { tone(t, 620, 0.22, 0.05, 'triangle', 880); tone(t + 0.18, 880, 0.2, 0.04, 'triangle', 520); },
    server:  function (t) { tone(t, 90, 0.5, 0.06, 'sawtooth', 180); noise(t, 0.25, 0.03); tone(t + 0.25, N.e5, 0.1, 0.04, 'square'); tone(t + 0.35, N.a5, 0.1, 0.04, 'square'); },
    pick:    function (t) { tone(t, 520, 0.06, 0.05, 'square'); tone(t + 0.05, 780, 0.09, 0.05, 'square'); },
    putback: function (t) { tone(t, 780, 0.06, 0.04, 'square'); tone(t + 0.05, 520, 0.09, 0.04, 'square'); },
    wrong:   function (t) { noise(t, 0.18, 0.05); tone(t, 200, 0.22, 0.06, 'sawtooth', 110); },
    snap:    function (t) { tone(t, 440, 0.08, 0.06, 'triangle'); tone(t + 0.07, 660, 0.18, 0.06, 'triangle'); },
    plank:   function (t, p) { var f = 330 * Math.pow(1.122, p || 0); tone(t, f, 0.12, 0.06, 'triangle'); noise(t, 0.03, 0.02); },
    bridge:  function (t) { [N.c5, N.e5, N.g5, N.c6].forEach(function (f, i) { tone(t + i * 0.11, f, 0.5, 0.06, 'triangle'); }); },
    door:    function (t) { tone(t, 200, 0.2, 0.05, 'square', 100); tone(t + 0.15, N.g4, 0.2, 0.04, 'triangle'); },
    blip:    function (t) { tone(t, 900, 0.025, 0.02, 'square'); },
    grow:    function (t, p) { var f = N.c5 * Math.pow(1.122, (p || 0) * 2); tone(t, f, 0.5, 0.06, 'sine'); tone(t + 0.08, f * 1.25, 0.5, 0.05, 'sine'); tone(t + 0.16, f * 1.5, 0.6, 0.05, 'sine'); },
    tape:    function (t) { [N.c5, N.d5, N.e5, N.d5, N.c5, N.g4].forEach(function (f, i) { tone(t + i * 0.22, f * 1.012, 0.3, 0.04, 'triangle'); }); },
    fall:    function (t) { tone(t, 300, 0.4, 0.06, 'sawtooth', 70); },
    splash:  function (t) { noise(t, 0.3, 0.06); tone(t, 500, 0.2, 0.03, 'sine', 200); }
  };

  function play(name, param) {
    played.push(name); if (played.length > 200) { played.shift(); } heard[name] = true;
    if (muted || !SOUNDS[name]) { return false; }
    var c = context();
    if (!c) { return false; }
    if (c.state === 'suspended' && c.resume) { c.resume(); }
    SOUNDS[name](c.currentTime + 0.01, param);
    return true;
  }

  // ---- music: one soft arpeggio per scene, scheduled a little ahead of time --------------------
  var SCORES = {
    study:  { tempo: 0.5,  notes: [N.e4, N.g4, N.c5, N.g4, N.d4, N.g4, N.d5, N.g4, N.c4, N.e4, N.a4, N.e4, N.d4, N.a4, N.c5, N.a4], type: 'sine', vol: 0.5 },
    world:  { tempo: 0.28, notes: [N.c5, N.e5, N.g5, N.e5, N.d5, N.g5, N.a5, N.g5, N.e5, N.g5, N.c6, N.g5, N.d5, N.a5, N.g5, N.e5], type: 'triangle', vol: 0.4 },
    server: { tempo: 0.4,  notes: [N.a4 / 2, N.e4, N.a4, N.e4, N.g4 / 2, N.d4, N.g4, N.d4, N.a4 / 2, N.e5, N.a4, N.e4, N.e4, N.b4 || 493.9, N.e5, N.b4 || 493.9], type: 'square', vol: 0.18 },
    island: { tempo: 0.45, notes: [N.c5, N.g4, N.e5, N.g4, N.a4, N.e5, N.c5, N.e5, N.d5, N.a4, N.f5 || 698.5, N.a4, N.g4, N.d5, N.g5, N.d5], type: 'sine', vol: 0.5 }
  };

  function pump() {
    if (!ctx || muted || !scene || !SCORES[scene]) { return; }
    var s = SCORES[scene];
    if (nextNote < ctx.currentTime) { nextNote = ctx.currentTime + 0.05; }
    while (nextNote < ctx.currentTime + 0.4) {
      tone(nextNote, s.notes[noteIndex % s.notes.length], s.tempo * 1.6, 0.05 * s.vol * 2, s.type, null, musicGain);
      noteIndex += 1; nextNote += s.tempo;
    }
  }

  function setScene(name) {
    if (scene === name) { return; }
    scene = name; noteIndex = 0; nextNote = 0;
    if (typeof setInterval === 'function' && !musicTimer) { musicTimer = setInterval(pump, 120); }
  }

  function unlock() { var c = context(); if (c && c.state === 'suspended' && c.resume) { c.resume(); } }
  function isMuted() { return muted; }
  function setMuted(v) { muted = !!v; save(); applyGain(); return muted; }
  function getVolume() { return volume; }
  function setVolume(v) { volume = Math.max(0, Math.min(1, v)); save(); applyGain(); return volume; }

  return {
    play: play, unlock: unlock, isMuted: isMuted, setMuted: setMuted, getVolume: getVolume, setVolume: setVolume,
    setScene: setScene, names: Object.keys(SOUNDS), played: function () { return played.slice(); }, heard: function () { return Object.keys(heard); }
  };
});
