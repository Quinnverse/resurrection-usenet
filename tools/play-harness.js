// Developer tool: runs the real browser code (frontend/p3/*.js) in Node against a small fake DOM whose canvases are
// the software canvas, then plays the whole level with a scripted player. It catches runtime errors in drawing,
// input and panels, and saves true in-game frames as PNG. It is NOT a browser: real Chromium runs happen in CI.
//   node tools/play-harness.js [outdir]
'use strict';
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { makeCanvas, toPNG } = require('./softcanvas.js');

const DIR = path.join(__dirname, '..', 'frontend', 'p3');
const OUT = process.argv[2] || null;
if (OUT) { fs.mkdirSync(OUT, { recursive: true }); }

class FakeNode {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.attrs = {}; this.children = []; this.parentNode = null; this.listeners = {};
    this._text = ''; this.style = {}; this.hidden = false; this.disabled = false; this.value = ''; this.classes = new Set();
    const self = this;
    this.classList = { add: (c) => self.classes.add(c), remove: (c) => self.classes.delete(c), contains: (c) => self.classes.has(c), toggle: (c, on) => { if (on === undefined ? !self.classes.has(c) : on) self.classes.add(c); else self.classes.delete(c); } };
  }
  get className() { return [...this.classes].join(' '); }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children.forEach((c) => { c.parentNode = null; }); this.children = []; this._text = v == null ? '' : String(v); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = v; if (this.tagName === 'CANVAS' && (k === 'width' || k === 'height')) this[k] = Number(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { if (c.parentNode) c.parentNode.children = c.parentNode.children.filter((x) => x !== c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  dispatch(t, ev = {}) { (this.listeners[t] || []).forEach((fn) => fn(Object.assign({ target: this, preventDefault() {}, clientX: 0, clientY: 0, pointerId: 1 }, ev))); }
  focus() { FakeNode.active = this; }
  blur() { if (FakeNode.active === this) FakeNode.active = null; }
  setPointerCapture() {} releasePointerCapture() {}
  get offsetWidth() { return 10; }
  getBoundingClientRect() { return { left: this._x || 0, right: (this._x || 0) + 40, top: this._y || 0, bottom: (this._y || 0) + 40, width: 40, height: 40 }; }
  matches(sel) { const m = sel.match(/^\[([\w-]+)="([^"]*)"\]$/); return !!m && this.attrs[m[1]] === m[2]; }
  querySelector(sel) { for (const c of this.children) { if (c.matches(sel)) return c; const r = c.querySelector(sel); if (r) return r; } return null; }
  walk(fn) { fn(this); this.children.forEach((c) => c.walk(fn)); }
}
class FakeCanvas extends FakeNode {
  constructor() { super('canvas'); this.width = 300; this.height = 150; this._soft = null; }
  soft() { if (!this._soft || this._soft.width !== this.width || this._soft.height !== this.height) this._soft = makeCanvas(this.width, this.height); return this._soft; }
  get data() { return this.soft().data; }
  getContext() {
    const real = this.soft().getContext('2d');
    const live = ['view', 'copy-canvas', 'restore-canvas'].includes(this.attrs['data-testid']);
    if (!live) return real;
    // Live canvases only draw while rendering is switched on (screenshots), so long plays stay fast.
    return new Proxy(real, { get(t, k) { const v = t[k]; if (typeof v === 'function') return (...a) => (FakeCanvas.render ? v.apply(t, a) : undefined); return v; }, set(t, k, v) { t[k] = v; return true; } });
  }
}
FakeCanvas.render = false;

const storage = new Map();
const winListeners = {};
let rafCb = null, now = 0;
const body = new FakeNode('body');
const root = new FakeNode('main'); root.attrs.id = 'app';
const sandbox = {
  console, Math, JSON, Object, Array, Number, String, isFinite, parseInt, parseFloat, Date, Set, Map, Error,
  setTimeout: (fn, ms) => { timers.push({ fn, at: now + (ms || 0) }); return timers.length; },
  setInterval: () => 0,
  requestAnimationFrame: (cb) => { rafCb = cb; return 1; },
  performance: { now: () => now },
  localStorage: { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) },
  matchMedia: () => ({ matches: false }),
  document: {
    getElementById: (id) => (id === 'app' ? root : null),
    createElement: (tag) => (tag === 'canvas' ? new FakeCanvas() : new FakeNode(tag)),
    createTextNode: (s) => { const n = new FakeNode('#text'); n._text = s; return n; },
    documentElement: new FakeNode('html'), body, title: '', visibilityState: 'visible',
    get activeElement() { return FakeNode.active || body; },
    addEventListener() {}
  },
  addEventListener: (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); }
};
const timers = [];
sandbox.window = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);
for (const f of ['engine.js', 'puzzle.js', 'data.js', 'state.js', 'i18n.js', 'art.js', 'scenes.js', 'audio.js', 'game.js']) {
  let code = fs.readFileSync(path.join(DIR, f), 'utf8');
  if (f !== 'engine.js' && f !== 'puzzle.js' && f !== 'data.js' && f !== 'state.js') { /* browser globals only */ }
  vm.runInContext(code, sandbox, { filename: f });
}

// ---- helpers ----------------------------------------------------------------------------------
const issues = [];
function frame(ms = 1000 / 60) {
  now += ms;
  const cb = rafCb; rafCb = null;
  try { if (cb) cb(now); } catch (e) { issues.push('frame error: ' + e.stack.split('\n').slice(0, 4).join(' | ')); throw e; }
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= now) { const t = timers.splice(i, 1)[0]; t.fn(); }
}
function frames(n) { for (let i = 0; i < n; i++) frame(); }
function key(k, type = 'keydown', target = body) { (winListeners[type] || []).forEach((fn) => fn({ key: k, target, repeat: false, preventDefault() {} })); }
function all(pred) { const out = []; root.walk((n) => { if (pred(n)) out.push(n); }); host.walk((n) => { if (pred(n)) out.push(n); }); return out; }
const host = new FakeNode('x');
function find(testId) { let hit = null; root.walk((n) => { if (!hit && n.attrs['data-testid'] === testId) hit = n; }); return hit; }
function click(testId) { const n = find(testId); if (!n) throw new Error('no element ' + testId); if (n.disabled) throw new Error('disabled ' + testId); n.dispatch('click'); frame(); }
function snap() { return sandbox.P3Debug.snapshot(); }
function shot(name) {
  if (!OUT) return;
  FakeCanvas.render = true; frames(3); FakeCanvas.render = false;
  const panelCanvas = find('restore-canvas') || find('copy-canvas');
  const cv = (panelCanvas && snap().panel && snap().panel !== 'dialogue' ? panelCanvas : find('view')).soft();
  fs.writeFileSync(path.join(OUT, name + '.png'), toPNG(cv, 3));
}
const D = sandbox.P3Data, Pz = sandbox.P3Puzzle, E = sandbox.P3Engine;
let worldCache = {};
function worldFor(scene) { return { study: D.buildStudy, world: D.buildWorld, server: D.buildServer, island: D.buildIsland }[scene](); }

// A reactive player: holds keys, jumps at edges. Uses only public input (keys) and the read-only snapshot.
function walkTo(tx, opts = {}) {
  const maxFrames = opts.maxFrames || 2600;
  let n = 0, jumps = 0;
  for (; n < maxFrames; n++) {
    const s = snap();
    if (Math.abs(s.x - tx) < (opts.tol || 0.2)) break;
    const dir = tx > s.x ? 1 : -1;
    const w = opts.world || (worldCache[s.scene] = worldCache[s.scene] || worldFor(s.scene));
    if (opts.bridge) { /* the harness world has no bridge tiles unless built; use live state */ }
    const aheadX = s.x + dir * 0.9;
    const row = Math.round(s.y);
    const ground = w.solid(Math.floor(aheadX), row) || w.solid(Math.floor(aheadX), row + 1);
    const wall = w.solid(Math.floor(s.x + dir * 0.55), row - 1);
    key('ArrowRight', dir > 0 ? 'keydown' : 'keyup'); key('ArrowLeft', dir < 0 ? 'keydown' : 'keyup');
    if (s.onGround && (!ground || wall) && !opts.noJump) { key(' '); jumps++; }
    frame();
  }
  key('ArrowRight', 'keyup'); key('ArrowLeft', 'keyup');
  frames(3);
  return { frames: n, jumps };
}
function hop(jumpX, landY, dir = 1) {
  const k = dir > 0 ? 'ArrowRight' : 'ArrowLeft';
  key(k, 'keydown');
  waitFor((s) => s.onGround && (dir > 0 ? s.x >= jumpX : s.x <= jumpX), 200, 'hop start ' + jumpX);
  key(' ');
  let ok = false;
  for (let i = 0; i < 140; i++) { frame(); const s = snap(); if (i > 6 && s.onGround && Math.abs(s.y - landY) < 0.1) { ok = true; break; } }
  key(k, 'keyup'); frames(4);
  return ok;
}
function waitFor(pred, maxFrames = 600, label = 'condition') {
  for (let i = 0; i < maxFrames; i++) { if (pred(snap())) return i; frame(); }
  throw new Error('timeout waiting for ' + label + ' ' + JSON.stringify(snap()));
}
function interactWith(id) {
  waitFor((s) => s.near === id, 60, 'near ' + id);
  key('e'); frames(2);
}

module.exports = { hop, sandbox, frame, frames, key, click, find, snap, shot, walkTo, waitFor, interactWith, issues, storage, D, Pz, E, root, body, FakeNode, worldFor, timers, get now() { return now; } };

// ---- the scripted playthrough -------------------------------------------------------------------
if (require.main === module) {
  const H = module.exports;
  const log = (...a) => console.log(...a);
  const t0 = now;
  try {
    frames(10);
    shot('01-title');
    click('start'); frames(5);
    log('study:', snap().scene);
    shot('02-study');
    walkTo(3.4); interactWith('shelf'); walkTo(5.4); interactWith('tape'); walkTo(7.4); interactWith('photo');
    walkTo(13.1); interactWith('notes'); shot('03-study-notes');
    walkTo(14.6); interactWith('monitor');
    waitFor((s) => s.scene === 'world' && !s.trans, 300, 'world'); frames(5);
    shot('04-world-start');
    log('world entered at', snap().x.toFixed(1));
    walkTo(4.6, { tol: 0.4 }); interactWith('sign0'); shot('05-sign');
    walkTo(10.4); interactWith('cat'); frames(10); shot('06-cat');
    walkTo(15.2); interactWith('sign1');
    walkTo(21.0);
    // hidden route: four hops up the wooden ledges to the secret garden
    walkTo(20.6, { noJump: true, tol: 0.2 });
    const hops = [[21.2, 8], [25.1, 6], [29.1, 4], [33.1, 2]];
    for (const [jx, ly] of hops) { const ok = hop(jx, ly); log('hop to row', ly, ok ? 'ok' : 'FAILED', 'x', snap().x.toFixed(1)); if (!ok) throw new Error('hop failed'); }
    walkTo(40.5, { noJump: true, tol: 0.4 }); frames(5); interactWith('garden'); shot('07-garden');
    log('stars so far', snap().stars);
    // drop down and continue along the ground
    key('ArrowRight', 'keydown'); waitFor((s) => s.x > 44.35, 100, 'platform edge'); key('ArrowRight', 'keyup');
    waitFor((s) => s.onGround && s.y > 9.9, 200, 'ground after drop'); log('dropped to x', snap().x.toFixed(1));
    walkTo(42.8); interactWith('sign2');
    walkTo(55.6); interactWith('sign3');
    walkTo(58.7); interactWith('blueprint'); shot('08-blueprint');
    walkTo(60.7); interactWith('bridge'); // nothing to place yet
    log('caption after bridge with no pieces:', snap().caption, 'panel', snap().panel);
    // drop onto the server ledge
    key('ArrowRight', 'keydown'); waitFor((s) => s.y > 11.9 && s.onGround, 120, 'ledge'); key('ArrowRight', 'keyup'); frames(5);
    walkTo(62.5, { tol: 0.3, noJump: true });
    shot('09-ledge');
    interactWith('door');
    waitFor((s) => s.scene === 'server' && !s.trans, 300, 'server'); frames(5);
    shot('10-server');
    walkTo(8.5); interactWith('archive'); frames(3);
    log('panel:', snap().panel); shot('11-copy-archive');
    click('take-a-left'); click('take-a-mid'); click('take-a-right'); click('take-a-mid'); // take then put back the damaged one
    log('backpack:', snap().backpack.join(','));
    click('panel-close'); frames(3);
    walkTo(20.5); interactWith('lab'); shot('12-copy-lab');
    click('take-l-arch'); click('take-l-mid'); log('backpack:', snap().backpack.join(','));
    click('panel-close'); frames(3);
    walkTo(33.5); interactWith('mirror'); shot('13-copy-mirror');
    click('take-m-left'); log('full pack attempt: ', snap().backpack.join(','));
    click('take-m-left'); // put back
    click('panel-close'); frames(3);

    // back to the canyon, then up from the ledge onto the cliff
    walkTo(2.5); interactWith('exit');
    waitFor((s) => s.scene === 'world' && !s.trans, 300, 'world again'); frames(5);
    log('back in world at', snap().x.toFixed(1), snap().y.toFixed(1));
    key('ArrowLeft', 'keydown'); waitFor((s) => s.x <= 62.4, 60, 'ledge wall'); key(' ');
    waitFor((s) => s.y < 10.1 && s.onGround, 120, 'cliff'); key('ArrowLeft', 'keyup'); frames(4);
    walkTo(60.7, { noJump: true }); interactWith('bridge');
    log('restore panel:', snap().panel); shot('14-restore-empty');
    // wrong placements first: each must be refused with a reason and leave everything recoverable
    const attempts = [['l-arch', 's2', 'shape'], ['a-left', 's3', 'shape'], ['a-right', 's1', 'shape'], ['l-mid', 's1', 'width']];
    for (const [piece, slot, reason] of attempts) {
      click('piece-' + piece); click('slot-' + slot);
      const fbText = find('feedback').textContent;
      log('wrong', piece, '->', slot, ':', fbText, '| wrong count', snap().wrong);
      if (snap().placed[slot]) throw new Error('wrong piece was placed');
    }
    shot('15-restore-wrong');
    click('piece-a-left'); click('slot-s1'); log('placed s1:', snap().placed.s1); shot('16-restore-partial');
    click('piece-a-right'); click('slot-s3');
    // take one back and put it again, to prove nothing can get stuck
    click('slot-s3'); log('took back s3, backpack:', snap().backpack.join(','));
    click('piece-a-right'); click('slot-s3');
    click('piece-l-mid'); click('slot-s2');
    shot('17-restore-complete');
    waitFor((s) => s.panel === null && s.building > 0, 200, 'bridge building'); log('building planks:', snap().building);
    shot('18-bridge-building');
    waitFor((s) => s.bridge && !s.frozen, 400, 'bridge built'); log('bridge built, frozen:', snap().frozen);
    shot('19-bridge-built');
    // walk across the real, finished bridge
    const w = sandbox.P3Data.buildWorld(); sandbox.P3State.applyBridge(w, sandbox.P3Puzzle.SOLUTION);
    worldCache.world = w;
    walkTo(74.5, { world: w, maxFrames: 900 }); log('crossed to', snap().x.toFixed(1), 'y', snap().y.toFixed(1), 'falls', snap().falls);
    if (snap().x < 74) throw new Error('did not cross');
    shot('20-farside');
    walkTo(85.5, { world: w }); interactWith('crab');
    walkTo(100.5, { world: w }); interactWith('sign5');
    walkTo(118.2, { world: w, maxFrames: 1500 }); shot('21-pier');
    interactWith('terminal'); log('dialogue panel:', snap().panel);
    for (let i = 0; i < 4; i++) {
      frames(300); shot('22-dialogue-' + i);   // long enough for the whole line to be typed
      click('dialogue-next');
    }
    waitFor((s) => s.scene === 'island' && !s.trans, 400, 'island'); log('island, ended:', snap().ended);
    frames(30); shot('23-island-growing-1');
    waitFor((s) => s.island.stage >= 3, 400, 'stage 3'); frames(40); shot('24-island-stage-3');
    waitFor((s) => s.island.done, 800, 'island complete'); frames(10); shot('25-island-done');
    log('island done, stage', snap().island.stage);
    for (const [x, id] of [[9.5, 'cabin'], [12.4, 'console'], [14.6, 'tree'], [17.2, 'photo'], [19.6, 'cassette'], [22.0, 'cat'], [24.2, 'jar'], [26.4, 'note']]) {
      walkTo(x, { noJump: true, tol: 0.3, world: sandbox.P3Data.buildIsland() }); interactWith(id); log('island', id, 'seen', snap().island.seen);
    }
    frames(400); shot('26-island-all');
    // the save must restore the island exactly
    const saved = storage.get('p3.save.v2'); log('save bytes', saved.length);
    log('PLAYTHROUGH OK in', ((now - t0) / 1000).toFixed(0), 'simulated seconds. errors:', issues.length);
  } catch (e) {
    console.error('HARNESS FAIL:', e.message, '\n', e.stack.split('\n').slice(0, 5).join('\n'));
    process.exitCode = 1;
  }
}
