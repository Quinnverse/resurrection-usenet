/*
 * P3 sound effects, synthesised with WebAudio. No audio files, no network.
 * The AudioContext is created on the first call to play(), which only happens after a player
 * input, so browsers allow it. Mute state is stored in localStorage and defaults to sound on.
 * UMD: window.P3Audio in the browser, module.exports in Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.P3Audio = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MUTE_KEY = 'p3.muted.v1';
  var ctx = null;
  var muted = false;

  try {
    muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  } catch (e) {
    muted = false;
  }

  function context() {
    if (ctx) {
      return ctx;
    }
    var AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) {
      return null;
    }
    try {
      ctx = new AC();
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  // One oscillator note with a simple volume envelope. freqEnd makes a slide.
  function tone(c, at, freq, dur, vol, type, freqEnd) {
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, at);
    if (freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, at + dur);
    }
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  // Short white-noise burst, used for the static when a server is restored.
  function noise(c, at, dur, vol) {
    var length = Math.floor(c.sampleRate * dur);
    var buffer = c.createBuffer(1, length, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    var src = c.createBufferSource();
    var gain = c.createGain();
    gain.gain.setValueAtTime(vol, at);
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(c.destination);
    src.start(at);
  }

  var SOUNDS = {
    jump: function (c, t) { tone(c, t, 320, 0.14, 0.06, 'square', 620); },
    star: function (c, t) { tone(c, t, 880, 0.1, 0.06, 'sine'); tone(c, t + 0.08, 1320, 0.14, 0.05, 'sine'); },
    hidden: function (c, t) {
      tone(c, t, 660, 0.12, 0.05, 'triangle');
      tone(c, t + 0.1, 990, 0.12, 0.05, 'triangle');
      tone(c, t + 0.2, 1320, 0.3, 0.05, 'triangle');
    },
    sign: function (c, t) { tone(c, t, 440, 0.09, 0.04, 'triangle'); },
    click: function (c, t) { tone(c, t, 700, 0.04, 0.03, 'square'); },
    restore: function (c, t) { noise(c, t, 0.45, 0.05); tone(c, t + 0.1, 200, 0.5, 0.05, 'sawtooth', 900); },
    door: function (c, t) {
      tone(c, t, 523, 0.18, 0.06, 'triangle');
      tone(c, t + 0.15, 659, 0.18, 0.06, 'triangle');
      tone(c, t + 0.3, 784, 0.4, 0.06, 'triangle');
    },
    fall: function (c, t) { tone(c, t, 260, 0.35, 0.06, 'sawtooth', 90); },
    land: function (c, t) { tone(c, t, 160, 0.06, 0.03, 'sine'); }
  };

  function play(name) {
    if (muted || !SOUNDS[name]) {
      return false;
    }
    var c = context();
    if (!c) {
      return false;
    }
    if (c.state === 'suspended' && c.resume) {
      c.resume();
    }
    SOUNDS[name](c, c.currentTime + 0.01);
    return true;
  }

  // Call from a user gesture (key or pointer) so the browser allows audio to start.
  function unlock() {
    var c = context();
    if (c && c.state === 'suspended' && c.resume) {
      c.resume();
    }
  }

  function isMuted() {
    return muted;
  }

  function setMuted(value) {
    muted = !!value;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      }
    } catch (e) {
      // Storage blocked: the setting lasts for this page only.
    }
    return muted;
  }

  return { play: play, unlock: unlock, isMuted: isMuted, setMuted: setMuted, names: Object.keys(SOUNDS) };
});
