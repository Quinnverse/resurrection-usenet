// Runs the real V5 browser shell (frontend/v5/main.js, every render module, the HUD code, saves) in Node with a
// minimal fake DOM and a recording stand-in for WebGL (tools/v5-three-shim.mjs). The scripted bot from
// test/v5-bot.mjs plays the whole game through the shell's own frame loop. It catches exceptions in the shell,
// non-finite cameras, missing translations, prompts that never appear on screen and saves that do not load.
// It is NOT a browser test: no pixels are drawn, no GPU, no real input events, no audio output.
//
//   node tools/v5-shell-run.mjs [--lang en|zh] [--alt] [--quiet]        full playthrough
//   node tools/v5-shell-run.mjs --continue <save.json> [--lang zh]      title -> Continue -> 4 s of play
//   node tools/v5-shell-run.mjs --shots <dir>                           also write software-rasterised previews of what
//                                                                       the shell's camera sees (tools/p4-preview.mjs)
//   node tools/v5-shell-run.mjs --tech                                  the tech demo page and its 3-minute walkthrough
import { register } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); const root = path.resolve(here, '..');
const args = process.argv.slice(2); const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? (args[i + 1] || true) : null; };
const TECH = args.includes('--tech'); const SHOTS = opt('--shots');
const LANG = opt('--lang') || 'en', ALT = args.includes('--alt'), QUIET = args.includes('--quiet'), CONT = opt('--continue');
const SHIM = pathToFileURL(path.join(here, 'v5-three-shim.mjs')).href;

// ---- route three.module.min.js to the shim (except from the shim itself) -------------------------------------
const hooks = `export async function resolve(spec, ctx, next) {
  if (spec.endsWith('three.module.min.js') && !(ctx.parentURL || '').endsWith('v5-three-shim.mjs')) { return { url: ${JSON.stringify(SHIM)}, shortCircuit: true }; }
  return next(spec, ctx); }`;
register('data:text/javascript,' + encodeURIComponent(hooks));

// ---- virtual clock ---------------------------------------------------------------------------------------------
let now = 1000; const timers = []; let timerId = 0; let rafCb = null;
globalThis.setTimeout = (fn, ms) => { const id = ++timerId; timers.push({ id, at: now + (ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = timers.findIndex((x) => x.id === id); if (i >= 0) { timers.splice(i, 1); } };
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
globalThis.setInterval = (fn, ms) => { const id = ++timerId; const rep = () => { fn(); if (!cancelled.has(id)) { timers.push({ id, at: now + ms, fn: rep }); } }; timers.push({ id, at: now + ms, fn: rep }); return id; };
const cancelled = new Set();
globalThis.clearInterval = (id) => { cancelled.add(id); for (let i = timers.length - 1; i >= 0; i--) { if (timers[i].id === id) { timers.splice(i, 1); } } };
const idMap = new Map();
function runTimers() { for (;;) { timers.sort((a, b) => a.at - b.at); if (!timers.length || timers[0].at > now) { return; } timers.shift().fn(); } }

// ---- fake DOM --------------------------------------------------------------------------------------------------
const all = [];
const ctx2d = new Proxy({}, { get: (t, k) => (k === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' ? () => ({ addColorStop() {} }) : k === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
class El {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.attrs = {}; this.listeners = {}; this.style = {}; this.hidden = false; this._text = ''; this.className = ''; this.parent = null; all.push(this);
    const self = this; this.classList = { add: (...c) => c.forEach((x) => { if (!self.cls().includes(x)) { self.className = (self.className + ' ' + x).trim(); } }), remove: (...c) => { self.className = self.cls().filter((x) => !c.includes(x)).join(' '); }, toggle: (c, on) => { const has = self.cls().includes(c); const want = on === undefined ? !has : !!on; if (want && !has) { self.classList.add(c); } if (!want && has) { self.classList.remove(c); } return want; }, contains: (c) => self.cls().includes(c) }; }
  cls() { return this.className.split(/\s+/).filter(Boolean); }
  set textContent(v) { this.children.forEach((c) => { c.parent = null; }); this.children = []; this._text = String(v); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  appendChild(c) { if (typeof c === 'string') { this._text += c; return c; } c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'hidden') { this.hidden = true; } if (k === 'id') { idMap.set(String(v), this); } if (k === 'src') { this.src = v; } }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(k, fn, o) { (this.listeners[k] = this.listeners[k] || []).push({ fn, once: o && o.once }); }
  removeEventListener() {}
  dispatch(k, ev) { const ls = this.listeners[k] || []; this.listeners[k] = ls.filter((l) => !l.once); ls.forEach((l) => l.fn(Object.assign({ target: this, stopPropagation() {}, preventDefault() {} }, ev || {}))); }
  querySelector(sel) { const c = sel.replace(/^\./, ''); for (const ch of this.children) { if (ch.cls().includes(c)) { return ch; } const f = ch.querySelector(sel); if (f) { return f; } } return null; }
  isShown() { let n = this; while (n) { if (n.hidden) { return false; } if (n.isRoot) { return true; } n = n.parent; } return false; }
  getContext(k) { return k === '2d' ? ctx2d : null; }
  toDataURL() { return 'data:image/jpeg;base64,AAAA'; }
  requestPointerLock() {}
  scrollIntoView() {}
}
globalThis.Node = El;
const byTestId = (id) => all.find((e) => e.attrs['data-testid'] === id && e.isShown());
const appEl = new El('div'), stageEl = new El('div'); appEl.isRoot = true;
const store = new Map();
const winListeners = {};
globalThis.window = globalThis;
Object.assign(globalThis, {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener: (k, fn) => { (winListeners[k] = winListeners[k] || []).push(fn); }, matchMedia: () => ({ matches: false }), confirm: () => true,
  localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  document: { getElementById: (id) => (id === 'app' ? appEl : id === 'stage' ? stageEl : idMap.get(id) || null), createElement: (t) => new El(t), createTextNode: (t) => { const n = new El('#text'); n._text = String(t); return n; }, addEventListener() {}, documentElement: { lang: 'en' }, title: '', pointerLockElement: null, exitPointerLock() {} },
  fetch: async (url) => { const f = path.join(root, 'frontend', String(url).replace(/^\//, '')); if (!fs.existsSync(f)) { return { ok: false, status: 404 }; } const txt = fs.readFileSync(f, 'utf8'); return { ok: true, status: 200, text: async () => txt }; }
});
Object.defineProperty(globalThis, 'navigator', { value: { language: LANG === 'zh' ? 'zh-CN' : 'en-US', getGamepads: () => [] }, configurable: true });
const errors = []; const origErr = console.error; console.error = (...a) => { errors.push(a.map(String).join(' ')); if (!QUIET) { origErr('[shell error]', ...a); } };

// ---- test hook -------------------------------------------------------------------------------------------------
const hook = { game: null, next: null, last: [] };
hook.input = () => hook.next; hook.events = (evs) => { hook.last = evs; };
globalThis.__V5_TEST__ = hook;
store.set('v5.prefs.v1', JSON.stringify({ lang: LANG, quality: 'medium' }));
if (CONT) { store.set('v5.save.v1', fs.readFileSync(CONT, 'utf8')); }

if (TECH) {
  for (const id of ['main', 'play', 'restore', 'reset', 'variant', 'timer']) { const e = new El(id === 'main' ? 'main' : 'button'); e.setAttribute('id', id); e.isRoot = true; }
  globalThis.performance = { now: () => now };
  await import('../frontend/v5/tech.js');
  const tick = (secs) => { for (let i = 0; i < secs * 10; i++) { now += 100; runTimers(); await0(); } };
  const await0 = () => {}; for (let i = 0; i < 20; i++) { await new Promise((r) => setImmediate(r)); }
  const states = []; const snap = (label) => states.push(Object.assign({ label }, window.V5Tech, { verdicts: ['broken-verdict', 'restore-verdict', 'gap'].map((id) => { const e = byTestId(id); return e ? e.textContent.slice(0, 90) : null; }) }));
  snap('loaded');
  idMap.get('restore').dispatch('click'); snap('restore');
  idMap.get('variant').dispatch('click'); snap('variant+restore');
  idMap.get('reset').dispatch('click'); snap('reset');
  idMap.get('play').dispatch('click'); const seen = []; for (let t = 0; t < 185; t += 5) { tick(5); const now2 = all.find((e) => e.cls().includes('now') && e.isShown()); seen.push([t + 5, now2 ? now2.attrs.id : null, window.V5Tech.restored, window.V5Tech.variant]); }
  const r = { tech: true, states, walkthrough: seen.filter((x, i) => i === 0 || seen[i - 1][1] !== x[1] || seen[i - 1][2] !== x[2] || seen[i - 1][3] !== x[3]), errors };
  r.ok = errors.length === 0 && states[0].fixture && !states[0].path2004 && states[1].path2004 && !states[2].restoreOk && !states[2].path1998 && states[3].path1998 && !states[3].restored;
  console.log(JSON.stringify(r, null, 1)); process.exit(r.ok ? 0 : 1);
}
const { RENDER_LOG, REAL: THREE } = await import(SHIM);
const Gm = await import('../frontend/v5/core/game.js');
const { t: tr } = await import('../frontend/v5/core/i18n.js');
await import('../frontend/v5/main.js');

const stats = { frames: 0, beats: {}, promptFrames: 0, promptOff: 0, offscreen: 0, missingText: new Set(), saves: {} };
let curBeat = null; let preview = null; const shotLog = []; const shotRgb = []; const seenShot = new Set();
if (SHOTS) { preview = await import('./p4-preview.mjs'); fs.mkdirSync(SHOTS, { recursive: true }); }
function capture(label) {
  const L = RENDER_LOG.last; if (!L || shotLog.length >= 70) { return; }
  const W = 480, H = 270; const cam = L.camera.clone(); cam.aspect = W / H; cam.updateProjectionMatrix();
  const name = `${String(shotLog.length + 1).padStart(2, '0')}-${curBeat}-${label}`.replace(/[^a-zA-Z0-9.-]+/g, '_');
  const rgb = preview.render(L.scene, cam, W, H, { exposure: 1.08 });
  fs.writeFileSync(path.join(SHOTS, name + '.png'), preview.png(W * 2, H * 2, preview.upscale(rgb, W, H, 2)));
  shotLog.push(name); shotRgb.push(rgb);
}
function frameOnce(input) {
  hook.next = input || {}; hook.last = [];
  now += 1000 / 30; runTimers(); const cb = rafCb; rafCb = null; if (cb) { cb(now); }
  stats.frames += 1; check(); return hook.last;
}
function check() {
  const dbg = window.V5Debug.snapshot(); if (!dbg.beat) { return; }
  if (dbg.beat !== curBeat) { curBeat = dbg.beat; stats.beats[curBeat] = stats.beats[curBeat] || { world: dbg.world, frames: 0, off: 0 }; const raw = store.get('v5.save.v1'); if (raw) { stats.saves[curBeat] = raw; } }
  const b = stats.beats[curBeat]; b.frames += 1;
  if (SHOTS) {
    const key = curBeat + '|' + (dbg.shot || (dbg.aim ? 'aim' : dbg.mode === 'play' ? 'follow' : dbg.mode));
    if (b.frames === 20) { capture('start'); }
    else if (!seenShot.has(key) && b.frames > 20) { seenShot.add(key); b.wantShot = { key, at: b.frames + 12 }; }
    if (b.wantShot && b.frames === b.wantShot.at) { capture(b.wantShot.key.split('|')[1]); b.wantShot = null; }
    if (b.frames % 450 === 0) { capture('t' + Math.round(b.frames / 30)); }
  }
  // every visible text must be a translation, never a raw key
  const subs = byTestId('subs'); if (subs && subs.children[1] && subs.attrs['data-key'] && subs.children[1].textContent === subs.attrs['data-key']) { stats.missingText.add(subs.attrs['data-key']); }
  const pr = byTestId('prompt');
  if (dbg.prompt && dbg.mode === 'play' && !dbg.dialog && !dbg.shot && !dbg.choice) {
    stats.promptFrames += 1; if (!pr) { stats.promptOff += 1; b.promptOff = (b.promptOff || 0) + 1; }
    else { pr.children.forEach((c) => { if (/^(name|ui|verb)\./.test(c.textContent) || c.textContent.includes('.')) { if (/^[a-z]+\.[a-zA-Z.]+$/.test(c.textContent)) { stats.missingText.add(c.textContent); } } }); }
  }
  // the player should be on screen whenever the camera is the follow camera
  const L = RENDER_LOG.last; const g = hook.game;
  if (L && g && dbg.mode === 'play' && !dbg.shot && !dbg.dialog && dbg.scene !== 'train' && dbg.scene !== 'ride' && dbg.scene !== 'porch' && g.rt.body) {
    const p = new THREE.Vector3(g.rt.body.x, g.rt.body.y + 1.0, g.rt.body.z).project(L.camera);
    if (!(Math.abs(p.x) <= 1.02 && Math.abs(p.y) <= 1.02 && p.z < 1)) { stats.offscreen += 1; b.off += 1; (b.samples = b.samples || []).length < 4 && b.samples.push({ f: b.frames, p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(3)], body: [g.rt.body.x, g.rt.body.y, g.rt.body.z].map((v) => +v.toFixed(2)), cam: L.camera.position.toArray().map((v) => +v.toFixed(2)), y: dbg.y }); }
    const d = L.camera.position.distanceTo(new THREE.Vector3(g.rt.body.x, g.rt.body.y + 1.35, g.rt.body.z)); b.maxDist = Math.max(b.maxDist || 0, d); b.minDist = Math.min(b.minDist === undefined ? 99 : b.minDist, d);
  }
}
const click = (id) => { const e = byTestId(id); if (!e) { throw new Error('no visible element ' + id); } e.dispatch('click'); };
const waitFor = (fn, secs, label) => { for (let i = 0; i < secs * 30; i++) { if (fn()) { return; } frameOnce({}); } throw new Error('timed out waiting for ' + label); };

const report = { lang: LANG, alt: ALT, ok: false };
try {
  waitFor(() => byTestId(CONT ? 'continue' : 'start'), 5, 'title screen');
  if (CONT) {
    click('continue'); const beat = JSON.parse(store.get('v5.save.v1')).beat;
    for (let i = 0; i < 120; i++) { frameOnce({}); }
    const dbg = window.V5Debug.snapshot();
    Object.assign(report, { continued: beat, beatNow: dbg.beat, world: dbg.world, mode: dbg.mode, ok: errors.length === 0 && RENDER_LOG.problems.length === 0 && dbg.beat === beat });
  } else {
    click('start'); frameOnce({});
    const { playThrough } = await import('../test/v5-bot.mjs');
    const choices = ALT ? { train: 0, parting: 1, finish: 0, closer: 1, defend: 1, offer: 1, letter: 1 } : { train: 1, parting: 0, finish: 1, closer: 0, defend: 0, offer: 0, letter: 0 };
    const bot = await playThrough(hook.game, { step: frameOnce, choices });
    waitFor(() => byTestId('credits'), 30, 'credits roll');
    const credits = byTestId('credits').textContent; const album = byTestId('album');
    const want = [tr(LANG, 'end.elena'), tr(LANG, 'end.june'), tr(LANG, 'end.unsent')];
    const { loadArchive } = await import('./v5-playthrough.mjs'); const saved = Gm.parseSave(JSON.parse(store.get('v5.save.v1')), loadArchive());
    Object.assign(report, {
      gameSeconds: Math.round(bot.t), frames: stats.frames, beatsVisited: Object.keys(stats.beats),
      creditsHave: want.map((w) => [w, credits.includes(w)]), albumPhotos: album ? album.children.length : 0, photosWithThumb: hook.game.s.photos.filter((p) => p.thumb).length, photos: hook.game.s.photos.length,
      savedBeat: saved && saved.beat, promptFrames: stats.promptFrames, promptNotShown: stats.promptOff, playerOffscreenFrames: stats.offscreen,
      perBeat: Object.fromEntries(Object.entries(stats.beats).map(([k, v]) => [k, { world: v.world, frames: v.frames, off: v.off, promptOff: v.promptOff || 0, samples: v.samples, camDist: v.maxDist ? [+v.minDist.toFixed(2), +v.maxDist.toFixed(2)] : null }])),
      heard: window.V5Debug.snapshot().heard, stuck: bot.stuck, shots: shotLog
    });
    if (SHOTS) { // contact sheets, 3 x 4 previews each
      const W = 480, H = 270, C = 3, R = 4;
      for (let k = 0; k * C * R < shotRgb.length; k++) {
        const out = new Uint8Array(W * C * H * R * 3);
        shotRgb.slice(k * C * R, (k + 1) * C * R).forEach((rgb, i) => { const ox = (i % C) * W, oy = Math.floor(i / C) * H; for (let y = 0; y < H; y++) { out.set(rgb.subarray(y * W * 3, (y + 1) * W * 3), ((oy + y) * W * C + ox) * 3); } });
        fs.writeFileSync(path.join(SHOTS, `sheet-${k + 1}.png`), preview.png(W * C, H * R, out));
      }
    }
    const outDir = path.join(root, 'test-results', 'v5-shell'); fs.mkdirSync(outDir, { recursive: true });
    Object.entries(stats.saves).forEach(([beat, raw]) => fs.writeFileSync(path.join(outDir, `save-${LANG}${ALT ? '-alt' : ''}-${beat}.json`), raw));
    report.ok = errors.length === 0 && RENDER_LOG.problems.length === 0 && stats.missingText.size === 0 && want.every((w) => credits.includes(w)) && saved && saved.beat === 'end';
  }
} catch (e) { report.error = String(e && e.stack ? e.stack : e).split('\n').slice(0, 6).join('\n'); }
report.shellErrors = errors.slice(0, 5); report.renderProblems = RENDER_LOG.problems.slice(0, 5); report.renderProblemCount = RENDER_LOG.problems.length; report.missingText = [...stats.missingText];
console.log(JSON.stringify(report, null, QUIET ? 0 : 2));
process.exit(report.ok ? 0 : 1);
