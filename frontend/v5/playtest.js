// Playtest recorder for V5 (only active with ?playtest in the address or in the standalone playtest page). It records what a facilitator needs from a session and nothing else:
//   - real time per beat and per chapter, with the wall-clock start and end of each chapter (pause menu, title and
//     rating screens excluded from the times),
//   - pauses (count and total time), page exits and tab switches, skipped lines, hints, idle stretches, retries, falls,
//   - the choices made, frame times (average, slow-frame share, worst frame, approximate 1% low), memory when the
//     browser reports it, the input devices used, the browser, screen and graphics card name,
//   - an optional 1–5 rating and one sentence after each chapter.
// Nothing is recorded until the player presses Start or Continue (the title screen says what is recorded). Everything stays in
// this browser (localStorage) until the player or facilitator downloads the JSON. No network. "Delete my record" is in the
// pause menu. The tester id is whatever the facilitator types (P01…); no name or contact detail is asked for.
const KEY = 'v5.playtest.v1';
const flagged = typeof window !== 'undefined' && window.__V5_PLAYTEST__ === true;
const on = flagged || (typeof location !== 'undefined' && /[?&]playtest\b/.test(location.search || ''));
// upper bounds of the frame-time bins in ms; one more bin for everything slower
export const EDGES = [8, 12, 17, 20, 25, 34, 42, 50, 67, 100, 150, 250];
let log = null, cur = null, idle = 0, lastIdleSpot = null, pending = null, pausedAt = 0;
const nowMs = () => Date.now(); const iso = () => new Date().toISOString();
const save = () => { if (log) { try { localStorage.setItem(KEY, JSON.stringify(log)); } catch (e) { /* full */ } } };
function binOf(ms) { for (let i = 0; i < EDGES.length; i++) { if (ms <= EDGES[i]) { return i; } } return EDGES.length; }
function beatRec(beat, chapter) {
  if (!log.beats[beat]) { log.beats[beat] = { chapter: chapter == null ? null : chapter, ms: 0, frames: 0, slow: 0, worstMs: 0, ftSum: 0, hist: new Array(EDGES.length + 1).fill(0), hints: 0, hintKeys: 0, retries: 0, falls: 0, tabDenied: 0, skips: 0, idle: [], heapMB: null, heapMaxMB: null, visits: 0 }; }
  return log.beats[beat];
}
// the frame rate of the slowest 1% of frames, from the histogram (each bin counts at its middle)
export function low1FromHist(hist) {
  const n = hist.reduce((a, b) => a + b, 0); if (!n) { return null; }
  let need = Math.max(1, Math.ceil(n / 100)), sum = 0, taken = 0;
  for (let i = hist.length - 1; i >= 0 && need > 0; i--) { const lo = i === 0 ? 0 : EDGES[i - 1]; const hi = i < EDGES.length ? EDGES[i] : 300; const mid = (lo + hi) / 2; const k = Math.min(need, hist[i]); sum += k * mid; taken += k; need -= k; }
  return taken ? Math.round(1000 / (sum / taken) * 10) / 10 : null;
}

export const active = () => on;
// Called once at load: remembers the device details. Nothing is recorded or stored yet.
export function start(info) { pending = info || null; }
// Called when the player presses Start or Continue: only now is a record created (or an unfinished one resumed).
export function begin(tester) {
  if (!on) { return; }
  if (!log) {
    let old = null; try { old = JSON.parse(localStorage.getItem(KEY)); } catch (e) { old = null; }
    log = old && old.version === 2 && !old.finished ? old : { version: 2, tester: null, startedAt: iso(), device: pending, inputs: [], beats: {}, chapters: {}, ratings: {}, choices: {}, order: [], pauses: { count: 0, ms: 0 }, exits: [], hidden: 0, finished: false, notes: 'Recorded by the game in playtest mode, in this browser only. Times are real time with the pause menu, title and rating screens excluded. No name or contact detail is recorded.' };
  }
  log.device = Object.assign({}, log.device || {}, pending || {});
  if (tester !== undefined) { log.tester = String(tester || '').slice(0, 40) || log.tester || ('t-' + Math.random().toString(36).slice(2, 8)); }
  save();
}
export function setTester(id) { if (log) { log.tester = String(id || '').slice(0, 40) || ('t-' + Math.random().toString(36).slice(2, 8)); save(); } }
export const recording = () => !!log;
export function input(kind) { if (log && log.inputs.indexOf(kind) < 0) { log.inputs.push(kind); save(); } }
export function beat(b, chapter) {
  if (!log) { return; }
  cur = { beat: b, chapter }; const r = beatRec(b, chapter); r.visits += 1; if (log.order[log.order.length - 1] !== b) { log.order.push(b); } idle = 0;
  const c = log.chapters[chapter] = log.chapters[chapter] || { ms: 0 }; if (!c.startedAt) { c.startedAt = iso(); } c.endedAt = iso();
  save();
}
// every frame: raw frame time in ms, whether the game is being played (not paused, not on a menu)
export function frame(rawMs, playing, snap, inputSeen) {
  if (!log || !cur) { return; }
  const r = beatRec(cur.beat, cur.chapter);
  if (playing) {
    const ms = Math.min(rawMs, 250); r.ms += ms; const c = log.chapters[cur.chapter] = log.chapters[cur.chapter] || { ms: 0 }; c.ms += ms;
    r.frames += 1; r.ftSum += rawMs; r.hist[binOf(rawMs)] += 1; if (rawMs > 50) { r.slow += 1; } r.worstMs = Math.max(r.worstMs, Math.round(rawMs));
    // an idle stretch: no input for 30 s while nothing is being said
    if (!inputSeen && snap && !snap.dialog && !snap.choice) { idle += ms; if (idle > 30000 && !lastIdleSpot) { lastIdleSpot = { at: Math.round(r.ms / 1000), x: Math.round(snap.x * 10) / 10, z: Math.round(snap.z * 10) / 10, prompt: snap.prompt ? snap.prompt.id : null }; r.idle.push(lastIdleSpot); } }
    else { idle = 0; lastIdleSpot = null; }
    if (r.frames % 150 === 1) { c.endedAt = iso(); }
  }
  if (typeof performance !== 'undefined' && performance.memory && r.frames % 300 === 1) { const mb = Math.round(performance.memory.usedJSHeapSize / 1048576); r.heapMB = mb; r.heapMaxMB = Math.max(r.heapMaxMB || 0, mb); }
  if (r.frames % 150 === 1) { save(); }
}
export function event(ev) {
  if (!log || !cur) { return; }
  const r = beatRec(cur.beat, cur.chapter);
  if (ev.type === 'hint') { r.hints += 1; } if (ev.type === 'retry') { r.retries += 1; } if (ev.type === 'body' && ev.what === 'fall') { r.falls += 1; }
  if (ev.type === 'tab-denied') { r.tabDenied += 1; } if (ev.type === 'choice') { log.choices[ev.id] = ev.pick; }
}
export const hintKey = () => { if (log && cur) { beatRec(cur.beat, cur.chapter).hintKeys += 1; } };
export const skipped = () => { if (log && cur) { beatRec(cur.beat, cur.chapter).skips += 1; } };
// the pause menu opens / closes
export function pause() { if (!log || pausedAt) { return; } pausedAt = nowMs(); log.pauses.count += 1; save(); }
export function resume() { if (!log || !pausedAt) { return; } log.pauses.ms += nowMs() - pausedAt; pausedAt = 0; save(); }
export function rate(chapter, fun, moved, note) { if (log) { log.ratings[chapter] = { fun, moved, note: String(note || '').slice(0, 400) }; save(); } }
export function finish() { if (log) { log.finished = true; log.finishedAt = iso(); if (cur && log.chapters[cur.chapter]) { log.chapters[cur.chapter].endedAt = iso(); } save(); } }
const mins = (ms) => Math.round(ms / 600) / 100;
export function summary() {
  if (!log) { return null; }
  const out = JSON.parse(JSON.stringify(log)); const all = new Array(EDGES.length + 1).fill(0); const byChapter = {};
  let hints = 0, hintKeys = 0, retries = 0, falls = 0, skips = 0, tabDenied = 0, idles = 0, frames = 0, ftSum = 0, worst = 0, heapMax = null, slow = 0;
  Object.values(out.beats).forEach((r) => {
    r.minutes = mins(r.ms); r.avgFps = r.frames ? Math.round(1000 / (r.ftSum / r.frames)) : null; r.slowShare = r.frames ? Math.round((r.slow / r.frames) * 1000) / 10 : null; r.low1FpsApprox = low1FromHist(r.hist || []);
    (r.hist || []).forEach((n, i) => { all[i] += n; if (r.chapter != null) { byChapter[r.chapter] = byChapter[r.chapter] || new Array(EDGES.length + 1).fill(0); byChapter[r.chapter][i] += n; } });
    hints += r.hints; hintKeys += r.hintKeys; retries += r.retries; falls += r.falls; skips += r.skips; tabDenied += r.tabDenied; idles += (r.idle || []).length; frames += r.frames; ftSum += r.ftSum; slow += r.slow; worst = Math.max(worst, r.worstMs); if (r.heapMaxMB != null) { heapMax = Math.max(heapMax || 0, r.heapMaxMB); }
    delete r.ftSum;
  });
  Object.entries(out.chapters).forEach(([ch, c]) => { c.minutes = mins(c.ms); c.low1FpsApprox = byChapter[ch] ? low1FromHist(byChapter[ch]) : null; });
  out.totalMinutes = mins(Object.values(out.chapters).reduce((a, c) => a + c.ms, 0));
  out.totals = { minutes: out.totalMinutes, pauses: out.pauses.count, pauseMinutes: mins(out.pauses.ms), skippedLines: skips, hintsShown: hints, hintKeyPresses: hintKeys, retries, falls, tabRefused: tabDenied, idleStretches: idles, exits: out.exits.length, tabSwitches: out.hidden, avgFps: frames ? Math.round(1000 / (ftSum / frames)) : null, low1FpsApprox: low1FromHist(all), worstFrameMs: worst, slowFrameShare: frames ? Math.round((slow / frames) * 1000) / 10 : null, maxHeapMB: heapMax };
  out.edgesMs = EDGES.slice();
  return out;
}
export function download() {
  const s = summary(); if (!s) { return; }
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `v5-playtest-${s.tester || 'anon'}-${s.startedAt.slice(0, 10)}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
// "Delete my record": removes the log; nothing more is recorded until the player presses Start or Continue again
export function reset() { try { localStorage.removeItem(KEY); } catch (e) { /* blocked */ } log = null; cur = null; pausedAt = 0; }
export function exitNote(reason) { if (log && !log.finished) { log.exits.push({ at: iso(), beat: cur ? cur.beat : null, chapter: cur ? cur.chapter : null, reason }); if (pausedAt) { log.pauses.ms += nowMs() - pausedAt; pausedAt = 0; } save(); } }
export function hiddenNote() { if (log && !log.finished) { log.hidden += 1; save(); } }
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('pagehide', () => exitNote('pagehide'));
  if (typeof document !== 'undefined' && document.addEventListener) { document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { hiddenNote(); } }); }
}
