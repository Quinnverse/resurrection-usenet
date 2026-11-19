// Playtest recorder for V5 (only active with ?playtest in the address, or after it has been switched on once in this
// browser). It records what a facilitator needs from a blind session and nothing else: real time per beat and per
// chapter (paused, title and rating screens excluded), hints, idle stretches, retries, skips, choices, frame times,
// memory, the input devices used, the device and GPU, and an optional 1–5 rating after each chapter.
// Everything stays in this browser (localStorage) until the facilitator downloads the JSON. No network.
const KEY = 'v5.playtest.v1';
const on = typeof location !== 'undefined' && (/[?&]playtest\b/.test(location.search) || (() => { try { return localStorage.getItem(KEY + '.on') === '1'; } catch (e) { return false; } })());
if (on) { try { localStorage.setItem(KEY + '.on', '1'); } catch (e) { /* blocked */ } }
let log = null, cur = null, idle = 0, lastIdleSpot = null;
const now = () => Date.now();
const save = () => { if (log) { try { localStorage.setItem(KEY, JSON.stringify(log)); } catch (e) { /* full */ } } };
function beatRec(beat) { if (!log.beats[beat]) { log.beats[beat] = { ms: 0, frames: 0, slow: 0, worstMs: 0, ftSum: 0, hints: 0, hintKeys: 0, retries: 0, falls: 0, tabDenied: 0, skips: 0, idle: [], heapMB: null, visits: 0 }; } return log.beats[beat]; }

export const active = () => on;
export function start(info) {
  if (!on) { return; }
  let old = null; try { old = JSON.parse(localStorage.getItem(KEY)); } catch (e) { old = null; }
  log = old && old.version === 1 && !old.finished ? old : { version: 1, tester: null, startedAt: new Date().toISOString(), device: info, inputs: [], beats: {}, chapters: {}, ratings: {}, choices: {}, order: [], finished: false, notes: 'Recorded by the game in playtest mode. Times are real time with the pause menu, title and rating screens excluded.' };
  log.device = Object.assign({}, log.device || {}, info); save();
}
export function setTester(id) { if (log) { log.tester = String(id || '').slice(0, 40) || ('t-' + Math.random().toString(36).slice(2, 8)); save(); } }
export function input(kind) { if (log && log.inputs.indexOf(kind) < 0) { log.inputs.push(kind); save(); } }
export function beat(b, chapter) {
  if (!log) { return; }
  cur = { beat: b, chapter }; const r = beatRec(b); r.visits += 1; if (log.order[log.order.length - 1] !== b) { log.order.push(b); } idle = 0; save();
}
// every frame: raw frame time in ms, whether the game is being played (not paused, not on a menu)
export function frame(rawMs, playing, snap, inputSeen) {
  if (!log || !cur) { return; }
  const r = beatRec(cur.beat);
  if (playing) {
    const ms = Math.min(rawMs, 250); r.ms += ms; const c = log.chapters[cur.chapter] = log.chapters[cur.chapter] || { ms: 0 }; c.ms += ms;
    r.frames += 1; r.ftSum += rawMs; if (rawMs > 50) { r.slow += 1; } r.worstMs = Math.max(r.worstMs, Math.round(rawMs));
    // an idle stretch: no input for 30 s while nothing is being said
    if (!inputSeen && snap && !snap.dialog && !snap.choice) { idle += ms; if (idle > 30000 && !lastIdleSpot) { lastIdleSpot = { at: Math.round(r.ms / 1000), x: Math.round(snap.x * 10) / 10, z: Math.round(snap.z * 10) / 10, prompt: snap.prompt ? snap.prompt.id : null }; r.idle.push(lastIdleSpot); } }
    else { idle = 0; lastIdleSpot = null; }
  }
  if (typeof performance !== 'undefined' && performance.memory && r.frames % 300 === 1) { r.heapMB = Math.round(performance.memory.usedJSHeapSize / 1048576); }
  if (r.frames % 150 === 1) { save(); }
}
export function event(ev) {
  if (!log || !cur) { return; }
  const r = beatRec(cur.beat);
  if (ev.type === 'hint') { r.hints += 1; } if (ev.type === 'retry') { r.retries += 1; } if (ev.type === 'body' && ev.what === 'fall') { r.falls += 1; }
  if (ev.type === 'tab-denied') { r.tabDenied += 1; } if (ev.type === 'choice') { log.choices[ev.id] = ev.pick; }
}
export const hintKey = () => { if (log && cur) { beatRec(cur.beat).hintKeys += 1; } };
export const skipped = () => { if (log && cur) { beatRec(cur.beat).skips += 1; } };
export function rate(chapter, fun, moved, note) { if (log) { log.ratings[chapter] = { fun, moved, note: String(note || '').slice(0, 400) }; save(); } }
export function finish() { if (log) { log.finished = true; log.finishedAt = new Date().toISOString(); save(); } }
export function summary() {
  if (!log) { return null; }
  const out = JSON.parse(JSON.stringify(log));
  Object.values(out.beats).forEach((r) => { r.minutes = Math.round(r.ms / 600) / 100; r.avgFps = r.frames ? Math.round(1000 / (r.ftSum / r.frames)) : null; r.slowShare = r.frames ? Math.round((r.slow / r.frames) * 1000) / 10 : null; delete r.ftSum; });
  Object.values(out.chapters).forEach((c) => { c.minutes = Math.round(c.ms / 600) / 100; });
  out.totalMinutes = Math.round(Object.values(out.chapters).reduce((a, c) => a + c.ms, 0) / 600) / 100;
  return out;
}
export function download() {
  const s = summary(); if (!s) { return; }
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `v5-playtest-${s.tester || 'anon'}-${s.startedAt.slice(0, 10)}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
export function reset() { try { localStorage.removeItem(KEY); } catch (e) { /* blocked */ } log = null; cur = null; }
