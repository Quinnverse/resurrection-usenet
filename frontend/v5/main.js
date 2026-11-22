// Resurrection V5 browser shell. The game itself is core/game.js (pure, tested headlessly); this file reads input,
// draws what the game reports, directs the camera, runs the interface, captures photos and saves.
import { THREE } from './render/kit.js';
import * as Gm from './core/game.js';
import * as Ar from './core/archive.js';
import * as Toys from './core/toys.js';
import { LAYOUTS } from './core/layout.js';
import { t as tr } from './core/i18n.js';
import { buildStudy } from './render/study.js';
import { buildKitchen } from './render/kitchen.js';
import { buildTown } from './render/town.js';
import { buildStation, buildCarriage, buildCoast, buildCottage } from './render/scenes.js';
import { makeCast, makeTheo, animate, setExpression, showProp } from './render/people.js';
import * as A from './render/audio.js';
import * as PT from './playtest.js';
import { ACTIONS, DEFAULT_KEYS, sanitizeKeys, rebind } from './core/keymap.js';
import * as Bn from './core/bench.js';
import { createGuide } from './guide.js';
import { objective } from './core/objectives.js';
import { counts as journalCounts } from './core/journal.js';

// Automated runs only (tools/v5-shell-run.mjs, e2e/v5.spec.js): a harness that defines window.__V5_TEST__ before this
// module loads may replace the input of each frame and receives the game's events. When it is absent (every real
// session) nothing changes.
const testHook = (typeof window !== 'undefined' && window.__V5_TEST__) || null;
// the standalone playtest page keeps its own save, settings and keys: browsers share one storage between all local files
const NS = typeof window !== 'undefined' && window.__V5_PLAYTEST__ === true ? 'v5pt' : 'v5';
const SAVE_KEY = NS + '.save.v1', PREF_KEY = NS + '.prefs.v1', KEYS_KEY = NS + '.keys.v1';
const readJSON = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } };
const mediaReduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const prefs = Object.assign({ lang: (navigator.language || '').startsWith('zh') ? 'zh' : 'en', reduce: false, quality: 'high', subs: 'normal' }, readJSON(PREF_KEY, {}));
// Review modes (RC1): ?preview=<beat> opens a saved moment of the story without touching the real save;
// ?bench=low,medium,high measures frame times on a fixed tour of scenes (see core/bench.js).
const QS = typeof location !== 'undefined' && location.search ? location.search : '';
const BENCH = Bn.parseBench(QS);
const PREVIEW = BENCH ? null : (new URLSearchParams(QS).get('preview') || null);
if (BENCH) { prefs.quality = BENCH.tiers[0]; }   // in memory only: the player's own setting is not changed
if (PREVIEW || BENCH) { const l = new URLSearchParams(QS).get('lang'); if (l === 'en' || l === 'zh') { prefs.lang = l; } }
const BENCH_KEY = 'v5.bench.v1';
let benchRun = null, benchWake = null;
const reduce = () => prefs.reduce || mediaReduce;
// {k:action} tokens in texts become the player's own controls (see guide.js); until the guide exists they are left as they are
let fillKeys = (s) => s;
const T = (k, v) => fillKeys(tr(prefs.lang, k, v));
// the device the player used last: 'kbm', 'pad' or 'touch'. Prompts, tips and hints name its controls.
let lastDev = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 'touch' : 'kbm';
const keys = sanitizeKeys(readJSON(KEYS_KEY, {})).keys;   // unknown, reserved or duplicated stored keys fall back to the defaults

// ---- DOM ------------------------------------------------------------------------------------------------------
const app = document.getElementById('app'), stage = document.getElementById('stage');
function el(tag, attrs, kids) { const n = document.createElement(tag); Object.entries(attrs || {}).forEach(([k, v]) => { if (v === null || v === undefined) { return; } if (k === 'text') { n.textContent = v; } else if (k === 'class') { n.className = v; } else if (k.startsWith('on')) { n.addEventListener(k.slice(2), v); } else { n.setAttribute(k, v); } }); (kids || []).forEach((c) => c && n.appendChild(c)); return n; }
const ui = {
  chapter: el('div', { class: 'chapter', 'data-testid': 'chapter' }), era: el('button', { class: 'era', type: 'button', 'data-testid': 'era', hidden: '' }),
  prompt: el('div', { class: 'prompt', 'data-testid': 'prompt', hidden: '' }), subs: el('div', { class: 'subs', 'data-testid': 'subs' }), choice: el('div', { class: 'choices', 'data-testid': 'choices', hidden: '' }),
  banner: el('div', { class: 'banner', 'data-testid': 'banner' }), tip: el('div', { class: 'tip', 'data-testid': 'tip' }), fade: el('div', { class: 'fade' }), aim: el('div', { class: 'aimframe', hidden: '', 'data-testid': 'aimframe' }, [el('div', { class: 'aimnote', 'data-testid': 'aim-note' })]),
  meter: el('div', { class: 'meter', hidden: '', 'data-testid': 'meter' }), paper: el('canvas', { class: 'paper', width: '520', height: '360', hidden: '', 'data-testid': 'paper' }), reticle: el('div', { class: 'reticle', hidden: '' }), lookdot: el('div', { class: 'lookdot', 'data-testid': 'lookdot' }), act: el('div', { class: 'act', 'data-testid': 'act' }),
  crt: el('div', { class: 'crtview', hidden: '', 'data-testid': 'crt' }), photo: el('canvas', { class: 'photocard', width: '520', height: '390', hidden: '', 'data-testid': 'photo-unfolded' }),
  panel: el('div', { class: 'panel', hidden: '', role: 'dialog', 'data-testid': 'panel' }), overlay: el('div', { class: 'overlay', hidden: '' }), saved: el('div', { class: 'saved' }), source: el('button', { class: 'source', type: 'button', hidden: '', 'data-testid': 'source' })
};
ui.subs.append(el('div', { class: 'who' }), el('div', { class: 'line' }), el('div', { class: 'next' }));
ui.meter.append(el('div', { class: 'dial' }, [el('span', { class: 'mid' }), el('span', { class: 'needle' })]), el('div', { class: 'strings' }));
Object.values(ui).forEach((n) => app.appendChild(n));

// ---- renderer --------------------------------------------------------------------------------------------------
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ antialias: prefs.quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: true }); } catch (e) { renderer = null; }
if (!renderer || !renderer.getContext()) { ui.overlay.hidden = false; ui.overlay.className = 'overlay title'; ui.overlay.append(el('p', { class: 'err', text: T('ui.webgl'), 'data-testid': 'webgl-error' })); throw new Error('WebGL unavailable'); }
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = prefs.quality !== 'low'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement); renderer.domElement.setAttribute('data-testid', 'canvas');
const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 900);
const Q = { high: 1.5, medium: 1.0, low: 0.75 };
let autoDrop = 0;
function resize() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q[prefs.quality] || 1) * (autoDrop ? 0.75 : 1)); renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();

// ---- game state ------------------------------------------------------------------------------------------------
let ar = null, g = null, mode = 'loading';
const worlds = {}; let world = null, worldId = null;
const cast = {};
// the on-screen guide: task bar, tips, help markers, memory journal (guide.js)
const guide = createGuide({
  app, el, T: (k, v) => T(k, v), prefs, savePrefs: () => write(PREF_KEY, prefs), keys, keyLabel: (code) => keyLabel(code), device: () => lastDev,
  snap: () => Gm.snapshot(g), game: () => g, mode: () => mode, camera, THREE, scene: () => (world ? world.scene : null), play: (n) => A.play(n), camYaw: () => cam.yaw,
  sprinting: () => down.has(keys.sprint) || down.has('ShiftRight') || (pad && (pad.btn(4) || pad.btn(5) || pad.btn(10))), pointerLocked: () => locked
});
fillKeys = guide.fill;
const cam = { yaw: 0, pitch: 0.38, dist: 4.5, pos: new THREE.Vector3(), look: new THREE.Vector3(), shotT: 0 };
const rt = { t: 0, frames: 0, fps: 60, lastSave: 0, chapterShown: 0, lastBeat: null, lastDialogLine: null, subs: null, sourceProv: null, holdKey: false, events: [], log: [] };

function getWorld(id) {
  if (worlds[id]) { return worlds[id]; }
  const lowShadow = prefs.quality === 'low' ? 512 : prefs.quality === 'medium' ? 1024 : 1536;
  const w = id === 'study' ? buildStudy({ shadow: lowShadow }) : id === 'kitchen' ? buildKitchen({ shadow: lowShadow }) : id === 'town' ? buildTown({ shadow: lowShadow, low: prefs.quality === 'low' }) : id === 'station' ? buildStation({ shadow: lowShadow }) : id === 'train' ? buildCarriage({ shadow: lowShadow }) : id === 'cottage' ? buildCottage({ shadow: lowShadow }) : buildCoast({ shadow: lowShadow });
  // a soft warm light near the camera, on only in dialogue close-ups, so a face against the sky or a lamp is still
  // readable. Added once per world (intensity 0 otherwise) so turning it on never changes the light count.
  const face = new THREE.PointLight(0xffe4cc, 0, 3.2, 2); face.name = 'faceFill'; w.scene.add(face); w.faceFill = face;
  worlds[id] = w; return w;
}
const sceneWorldId = (sc) => (sc === 'ride' || sc === 'porch' ? 'coast' : sc);
function person(id) {
  if (cast[id]) { return cast[id]; }
  cast[id] = id === 'theo' ? makeTheo() : makeCast(id); return cast[id];
}
function avatarId() { const s = Gm.snapshot(g); if (s.player === 'mara') { return 'mara'; } return (s.year || 1998) >= 2004 ? 'elena23' : 'elena17'; }
function juneId() { const s = Gm.snapshot(g); return (s.year || 1998) >= 2004 ? 'june23' : 'june17'; }

// Put the right world on stage for the current beat and dress it from the game state.
function stageWorld() {
  const s = Gm.snapshot(g); const id = sceneWorldId(s.scene); const w = getWorld(id);
  if (worldId !== id) { if (world) { Object.values(cast).forEach((p) => { if (p.parent) { p.parent.remove(p); } }); } world = w; worldId = id; }
  const add = (p) => { if (p.parent !== w.scene) { w.scene.add(p); } p.visible = true; };
  Object.values(cast).forEach((p) => { p.visible = false; });
  add(person(avatarId()));
  if (s.june) { add(person(juneId())); }
  if (s.theo && id === 'town') { add(person('theo')); }
  if (s.mother && id === 'kitchen') { add(person('elena45')); }
  if (id === 'town' && w.theo) { w.theo.visible = false; }   // the town module's own Theo; the shell draws its own
  dressWorld(s);
  A.setAmbience({ kitchen: s.beat === 'P.kitchen' ? 'rain' : 'house', study: 'room', town: s.season === 'winter' ? 'winter' : 'sea', station: 'sea', train: 'train', coast: 'wind', cottage: 'room' }[id]);
  A.setTheme(themeFor(s));
}
function themeFor(s) {
  if (s.beat === 'P.kitchen') { return 'cottage04'; }   // R4: almost no music under the argument; the rain does the work
  if (s.beat === 'P.summer') { return 'summer'; }
  if (s.beat === '4.porch') { return 'night'; }
  if (s.beat === '6.beach') { return 'cottage04'; }
  if (s.beat === '1.carve') { return 'summer'; }
  if (s.beat === 'end' || (s.beat === '7.town' && s.season === 'winter')) { return 'winter'; }
  if (s.scene === 'study') { return 'study'; }
  if (s.scene === 'town') { return s.era === 1998 ? 'summer' : 'y2004'; }
  if (s.beat === '1.chase' || s.scene === 'train') { return 'train'; }
  if (s.scene === 'ride' || s.scene === 'coast') { return 'coast'; }
  if (s.beat === '4.duet') { return 'summer'; }
  if (s.beat === '5.depart') { return 'parting'; }
  if (s.beat === '5.alone') { return 'y2004'; }
  if (s.beat === '6.cottage') { return 'cottage04'; }
  return 'summer';
}
function dressWorld(s) {
  const w = worlds[worldId]; if (!w) { return; }
  if (worldId === 'town') {
    const sg = Ar.sceneGraph(ar, s.era, g.s.restored, g.s.edition);
    w.setBuild(String(s.era), sg.assets); w.setCredits(sg.credits);
    const br = sg.objects.find((o) => o.id === 'bridge');
    const rest = g.rt.restoring ? g.rt.restoring.data : null;
    const data = br && br.state !== 'missing' ? br.data : rest;
    w.setBridgeData(data); w.setGhost(br && br.state === 'missing' ? (br.partial || null) : null, false);
    w.setBridgeProgress(br && br.state !== 'missing' ? 1 : g.s.bridge, rt.t, false);
    const win = sg.objects.find((o) => o.id === 'window'); if (win && win.data) { w.setWindow(win.data, g.s.window.finish || 'honey'); }
    const lamp = sg.objects.find((o) => o.id === 'lamp'); w.setLamp(!!(lamp && s.era === 2004 && g.s.restored.lamp), lamp && lamp.data ? parseInt(lamp.data.color, 16) : null);
    w.setSeason(s.season || 'summer');
    if (g.rt.iris) { w.iris.visible = !g.rt.iris.gone || false; }
  }
  if (worldId === 'study') {
    w.setLamp(!g.s.flags.lampOff); w.setTime(s.beat === 'E.study' ? 'evening' : 'day'); w.setPhoto(s.beat === 'E.study' ? (g.s.flags.unfolded ? 'stand' : 'flat') : 'none');
    if (s.beat === '1.study' || s.beat === '7.study') { w.setCrt(s.beat === '7.study' || g.s.seen.includes('c1.computer'), s.beat === '7.study' ? ['drafts/', ' june-7.txt  (not sent)', ' june-6.txt  (not sent)', ' ...'] : null); }
    if (s.beat === 'P.restore') { w.setCrt(true, crtLines(s)); }
    if (s.beat === 'E.study') { w.setCrt(!g.s.flags.epilogue, [T('p.e.crt1'), T('p.e.crt2'), T('p.e.crt3'), ' 2026 present edition', ' ' + T('sp.elena') + ' · ' + T('sp.june') + ' · ' + T('sp.mara')]); }
  }
  if (worldId === 'kitchen') { w.setMode(s.beat === 'P.kitchen' ? 'rain' : 'grey', { coatMara: s.beat === 'P.kitchen' && !s.leaving, keysTaken: !!g.s.flags.keys, blink: !g.s.flags.machine }); }
  if (worldId === 'station') { w.setTime(s.beat === '1.chase' ? 'morning' : s.beat === '5.depart' ? 'dusk' : 'y2004'); }
  if (worldId === 'cottage') { w.setEra(s.year || 1998); }
  if (worldId === 'coast') {
    w.setTime(s.beat === '4.porch' ? 'night' : s.beat === '6.beach' ? 'y2004' : (s.beat === '3.beam' || s.beat === '3.cliff') ? 'dusk' : 'noon', s.beat === '6.beach' ? 2004 : 1998);
    const win = Ar.sceneGraph(ar, 1998, g.s.restored, null).objects.find((o) => o.id === 'window');
    w.setWindow(g.s.window.placed && win && s.beat !== '6.beach' ? windowMesh(win.data, g.s.window.finish) : null); w.showCartWindow(!g.s.window.placed && !s.carry && s.beat !== '6.beach');
    const lamp = Ar.sceneGraph(ar, 1998, g.s.restored, null).objects.find((o) => o.id === 'lamp'); w.setLit(!!g.s.flags.lit && s.beat !== '6.beach', lamp && lamp.data);
  }
}
// The same crooked window mesh the town uses, for the coast socket.
function windowMesh(data, finish) {
  const grp = new THREE.Group(); if (!data || !data.points.length) { return grp; }
  const sh = new THREE.Shape(); data.points.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath();
  const col = { sea: 0x3f7cc4, honey: 0xe0a83a, chalk: 0xf4f0e6 }[finish] || 0xe0a83a;
  const frame = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: col, flatShading: true })); frame.scale.setScalar(1.12); frame.position.z = -0.01; grp.add(frame);
  grp.add(new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffc070, emissiveIntensity: 0.4, flatShading: true })));
  data.mullions.forEach(([x0, y0, x1, y1]) => { const len = Math.hypot(x1 - x0, y1 - y0); const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.04), new THREE.MeshStandardMaterial({ color: col })); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0.02); m.rotation.z = Math.atan2(-(x1 - x0), y1 - y0); grp.add(m); });
  return grp;
}

// ---- input ---------------------------------------------------------------------------------------------------
const down = new Set(), pressed = new Set(); let mouse = { dx: 0, dy: 0, left: false, right: false, click: false }; let locked = false;
const isTyping = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
let rebinding = null;
window.addEventListener('keydown', (e) => {
  if (isTyping(e)) { return; }
  lastDev = 'kbm';
  PT.input('keyboard'); if (e.code === 'F3') { e.preventDefault(); perfHud.hidden = !perfHud.hidden; return; }
  A.unlock();
  if (rt.journalOpen && !rebinding && (e.code === keys.journal)) { e.preventDefault(); closePanel(); return; }
  if (rebinding) {
    e.preventDefault();
    if (e.code === 'Escape') { rebinding = null; rt.keyNote = null; renderSettings(); return; }
    const r = rebind(keys, rebinding, e.code);
    if (r.ok) { Object.assign(keys, r.keys); write(KEYS_KEY, keys); rt.keyNote = r.swappedWith ? T('ui.keySwapped', { a: T('ui.k.' + r.swappedWith), b: T('ui.k.' + rebinding) }) : null; rebinding = null; }
    else { rt.keyNote = T('ui.keyReserved'); }   // stay in "press a key" so the player can pick another
    renderSettings(); return;
  }
  if (e.code === 'Escape') { e.preventDefault(); onEscape(); return; }
  if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) { if (mode === 'play') { e.preventDefault(); } }
  if (!down.has(e.code)) { pressed.add(e.code); } down.add(e.code);
  if (mode === 'play' && g) { const sn = Gm.snapshot(g); if (sn.choice || (sn.dialog && !Array.isArray(sn.dialog.line))) { if (e.code === 'Digit1') { rt.choose = 0; } if (e.code === 'Digit2') { rt.choose = 1; } if (e.code === 'Digit3') { rt.choose = 2; } } }
  // menus from the keyboard: arrows move the focus; Enter on nothing focused presses the main button
  if (mode !== 'play' && mode !== 'loading') { const root = menuRoot(); if (root) { if (e.code === 'ArrowDown' || e.code === 'ArrowRight') { e.preventDefault(); if (!(e.code === 'ArrowRight' && menuAdjust(1))) { menuMove(root, 1); } } if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') { e.preventDefault(); if (!(e.code === 'ArrowLeft' && menuAdjust(-1))) { menuMove(root, -1); } } if (e.code === 'Enter' && focusables(root).indexOf(document.activeElement) < 0) { e.preventDefault(); menuPress(root); } } }
});
window.addEventListener('keyup', (e) => { down.delete(e.code); });
window.addEventListener('blur', () => { down.clear(); mouse.left = mouse.right = false; });
const cv = renderer.domElement;
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('mousedown', (e) => {
  PT.input('mouse'); lastDev = 'kbm';
  A.unlock(); if (mode !== 'play') { return; }
  if (!locked && cv.requestPointerLock && !reduceLockPref()) { try { const r = cv.requestPointerLock(); if (r && r.catch) { r.catch(() => { /* refused: dragging still works */ }); } } catch (err) { /* refused */ } }
  // a click made while the camera is raised counts as a photo even if the right button is let go before the next frame
  // (on a slow machine both can happen within one frame: CI at 4 fps lost the shot)
  if (e.button === 0) { mouse.left = true; mouse.click = true; mouse.clickAim = mouse.right || down.has(keys.aim); } if (e.button === 2) { mouse.right = true; }
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) { mouse.left = false; } if (e.button === 2) { mouse.right = false; } });
window.addEventListener('mousemove', (e) => { if (mode !== 'play') { return; } if (locked || mouse.left || mouse.right) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; } });
// Mouse modes. Exploring: after a click on the scene the pointer is captured; moving the mouse looks around, a dot in the
// middle shows where you look, a click uses what is named. Menus, the journal and the pause screen: the pointer is free and
// visible. Esc (the browser releases the pointer on Esc) always pauses, so the cursor and the menu arrive together; Resume
// and one click on the scene capture it again. Settings › Mouse can keep the pointer free (drag to look) instead.
let ownUnlock = false;
const releasePointer = () => { if (document.pointerLockElement) { ownUnlock = true; document.exitPointerLock(); } };
document.addEventListener('pointerlockchange', () => {
  const was = locked; locked = document.pointerLockElement === cv; app.classList.toggle('locked', locked);
  if (was && !locked && !ownUnlock && mode === 'play' && g) { openPause(); }
  ownUnlock = false;
});
const reduceLockPref = () => !!prefs.noLock;
// touch: left half moves, right half looks, double tap acts
const touch = { move: null, look: null };
cv.addEventListener('touchstart', (e) => { A.unlock(); for (const tp of e.changedTouches) { if (tp.clientX < window.innerWidth / 2 && !touch.move) { touch.move = { id: tp.identifier, x0: tp.clientX, y0: tp.clientY, x: tp.clientX, y: tp.clientY }; } else if (!touch.look) { touch.look = { id: tp.identifier, x: tp.clientX, y: tp.clientY, t: performance.now() }; } } }, { passive: true });
cv.addEventListener('touchmove', (e) => { for (const tp of e.changedTouches) { if (touch.move && tp.identifier === touch.move.id) { touch.move.x = tp.clientX; touch.move.y = tp.clientY; } if (touch.look && tp.identifier === touch.look.id) { mouse.dx += (tp.clientX - touch.look.x) * 1.4; mouse.dy += (tp.clientY - touch.look.y) * 1.4; touch.look.x = tp.clientX; touch.look.y = tp.clientY; } } }, { passive: true });
cv.addEventListener('touchend', (e) => { for (const tp of e.changedTouches) { if (touch.move && tp.identifier === touch.move.id) { touch.move = null; } if (touch.look && tp.identifier === touch.look.id) { if (performance.now() - touch.look.t < 220) { mouse.click = true; } touch.look = null; } } });
// touch buttons: shown once the screen is touched. Jump, interact (hold for restore and crank), the train camera.
const tpad = { jump: false, use: false, useHeld: false, aim: false, shoot: false, tab: false, hint: false, used: false };
const tbtn = (id, label, on, off) => { const b = el('button', { type: 'button', class: 'tbtn tb-' + id, 'data-testid': 'touch-' + id, text: label }); b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); A.unlock(); on(); b.classList.add('down'); }, { passive: false }); b.addEventListener('touchend', (e) => { e.preventDefault(); if (off) { off(); } b.classList.remove('down'); }, { passive: false }); return b; };
const touchUI = el('div', { class: 'touchui', hidden: '', 'data-testid': 'touchui' }, [
  tbtn('jump', '⤒', () => { tpad.jump = true; tpad.jumpHeld = true; }, () => { tpad.jumpHeld = false; }),
  tbtn('use', 'E', () => { tpad.use = true; tpad.useHeld = true; }, () => { tpad.useHeld = false; }),
  tbtn('aim', '◉', () => { tpad.aim = !tpad.aim; }),
  tbtn('shoot', '●', () => { tpad.shoot = true; }),
  tbtn('tab', '⇄', () => { tpad.tab = true; }),
  tbtn('hint', '?', () => { tpad.hint = true; }),
  tbtn('journal', '📖', () => { tpad.journal = true; }),
  tbtn('pause', 'II', () => onEscape())
]);
app.appendChild(touchUI);
// on a touch screen (coarse pointer) the buttons are there from the start; elsewhere they appear on the first touch
if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) { tpad.used = true; touchUI.hidden = false; app.classList.add('touch'); }
cv.addEventListener('touchstart', () => { PT.input('touch'); lastDev = 'touch'; if (!tpad.used) { tpad.used = true; touchUI.hidden = false; app.classList.add('touch'); } }, { passive: true });
// ---- gamepad: polled once per frame; an "edge" is a button that is down now and was up last frame -------------
// Standard mapping: left stick move, right stick look, A (0) jump / continue / pick, X (2) interact (hold), B (1) back /
// skip a seen line, Y (3) switch era, LB/RB/L3 (4/5/10) sprint, LT (6) raise camera, RT (7) shutter, Back (8) hint,
// Start (9) pause, D-pad (12-15) move through choices and menus.
function gamepad() { const pads = navigator.getGamepads ? navigator.getGamepads() : []; return [...pads].find((p) => p && p.connected) || null; }
let padPrevB = [];
function pollPad() {
  const gp = gamepad(); const cur = gp ? gp.buttons.map((b) => !!(b && (b.pressed || b.value > 0.5))) : [];
  const prev = padPrevB; padPrevB = cur; if (gp) { PT.input('gamepad'); if (cur.some((b) => b) || gp.axes.some((a) => Math.abs(a) > 0.4)) { lastDev = 'pad'; } }
  // radial dead zone: the stick direction is kept, only the small circle in the middle is ignored
  const stick = (a, b) => { if (!gp) { return [0, 0]; } const x = gp.axes[a] || 0, y = gp.axes[b] || 0, m = Math.hypot(x, y); if (m < 0.18) { return [0, 0]; } const k = Math.min(1, (m - 0.18) / 0.82) / m; return [x * k, y * k]; };
  return { gp, btn: (i) => !!cur[i], edge: (i) => !!cur[i] && !prev[i], left: stick(0, 1), right: stick(2, 3) };
}
let pad = pollPad();

// ---- menus without a pointer: D-pad / arrow keys move the focus, A / Enter press, B / Esc go back ---------------
function menuRoot() { if (rt.confirm) { return ui.overlay.querySelector('.confirm'); } if (!ui.panel.hidden) { return ui.panel; } if (!ui.overlay.hidden) { return ui.overlay; } return null; }
function focusables(root) { return [...root.querySelectorAll('button, select, input[type=range]')].filter((e) => !e.disabled && !e.closest('[hidden]') && e.getClientRects().length > 0); }
function menuMove(root, d) {
  const list = focusables(root); if (!list.length) { return; }
  let i = list.indexOf(document.activeElement); i = i < 0 ? (d > 0 ? 0 : list.length - 1) : (i + d + list.length) % list.length; list[i].focus();
}
function menuPress(root) {
  const list = focusables(root); let f = list.indexOf(document.activeElement) >= 0 ? document.activeElement : null;
  if (!f) { f = root.querySelector('.btn.primary') || list[0]; if (f) { f.focus(); } }
  if (f && f.tagName === 'BUTTON') { f.click(); }
}
function menuAdjust(d) { const f = document.activeElement; if (f && f.type === 'range') { f.value = String(+f.value + d * (+f.step || 5)); f.dispatchEvent(new Event('input')); return true; } return false; }
function menuBack() {
  if (rebinding) { rebinding = null; renderSettings(); return; }
  if (rt.confirm) { rt.confirm(false); return; }
  if (mode === 'pause' || mode === 'panel') { closePanel(); }
}
// called every frame when the game is not being played (title, pause, settings, panels, credits, ratings)
function menuPad() {
  const root = menuRoot(); if (!root || !pad.gp) { return; }
  if (pad.edge(12) || pad.edge(14)) { if (!(pad.edge(14) && menuAdjust(-1))) { menuMove(root, -1); } }
  if (pad.edge(13) || pad.edge(15)) { if (!(pad.edge(15) && menuAdjust(1))) { menuMove(root, 1); } }
  if (pad.edge(0) || pad.edge(2)) { menuPress(root); }
  if (pad.edge(1) || (pad.edge(9) && (mode === 'pause' || mode === 'panel'))) { menuBack(); }
}

function collectInput(dt) {
  const s = Gm.snapshot(g); const k = (a) => down.has(keys[a]), p = (a) => pressed.has(keys[a]); const P = pad;
  let mx = (k('right') || down.has('ArrowRight') ? 1 : 0) - (k('left') || down.has('ArrowLeft') ? 1 : 0), mz = (k('forward') || down.has('ArrowUp') ? 1 : 0) - (k('back') || down.has('ArrowDown') ? 1 : 0);
  let stickSprint = false; if (touch.move) { const tx = (touch.move.x - touch.move.x0) / 60, tz = -(touch.move.y - touch.move.y0) / 60; mx += Math.max(-1, Math.min(1, tx)); mz += Math.max(-1, Math.min(1, tz)); stickSprint = Math.hypot(tx, tz) > 1.6; }   // push the stick far to sprint
  if (P.gp) { mx += P.left[0]; mz -= P.left[1]; mouse.dx += P.right[0] * 900 * dt; mouse.dy += P.right[1] * 600 * dt; }
  const ch = s.choice || (s.dialog && !Array.isArray(s.dialog.line) ? s.dialog.line : null);
  const padAct = P.edge(0) || P.edge(2);
  const advanceNow = p('use') || pressed.has('Space') || pressed.has('Enter') || mouse.click || tpad.use || tpad.jump || padAct;
  const input = {
    mx: Math.max(-1, Math.min(1, mx)), mz: Math.max(-1, Math.min(1, mz)), yaw: cam.yaw, navUp: p('forward') || pressed.has('ArrowUp'), navDown: p('back') || pressed.has('ArrowDown'),   // R4: a quick tap on the restore list is never lost between frames
    jump: p('jump') || tpad.jump || (P.edge(0) && !s.dialog && !ch), jumpHeld: k('jump') || P.btn(0) || !!tpad.jumpHeld, sprint: k('sprint') || down.has('ShiftRight') || P.btn(4) || P.btn(5) || P.btn(10) || stickSprint,
    use: p('use') || tpad.use || (mouse.click && !s.aim && s.scene !== 'train') || P.edge(2), useHeld: k('use') || P.btn(2) || tpad.useHeld || (mouse.left && !!(s.prompt && s.prompt.hold)),
    tab: p('tab') || P.edge(3) || tpad.tab, hint: p('hint') || P.edge(8) || tpad.hint, autoHelp: prefs.autoHelp !== false,
    aim: mouse.right || (mouse.click && mouse.clickAim) || k('aim') || P.btn(6) || (tpad.aim && s.scene === 'train'), shoot: (mouse.click && (mouse.right || mouse.clickAim || k('aim') || P.btn(6))) || (p('use') && (mouse.right || k('aim'))) || P.edge(7) || (tpad.shoot && tpad.aim),
    aimDX: mouse.dx, aimDY: mouse.dy, aspect: window.innerWidth / Math.max(1, window.innerHeight), advance: !!(s.dialog && advanceNow), skip: !!(rt.skip && s.dialog && s.dialog.seen) || !!(P.edge(1) && s.dialog && s.dialog.seen), choose: rt.choose
  };
  // choices with a pad: D-pad moves the highlight, A or X picks it
  if (ch && P.gp) {
    const n = ch.options.length; rt.padChoice = Math.max(0, Math.min(n - 1, rt.padChoice || 0));
    if (P.edge(13) || P.edge(15)) { rt.padChoice = (rt.padChoice + 1) % n; } if (P.edge(12) || P.edge(14)) { rt.padChoice = (rt.padChoice + n - 1) % n; }
    if (padAct) { input.choose = rt.padChoice; input.advance = false; rt.padChoice = 0; }
  }
  if (!ch) { rt.padChoice = 0; }
  [...ui.choice.querySelectorAll('.copt')].forEach((b, i) => b.classList.toggle('focus', !!(P.gp && ch) && i === rt.padChoice));
  if (P.edge(9) && mode === 'play') { releasePointer(); openPause(); }   // Start always pauses (B skips a seen line)
  // the camera follows the mouse unless the camera is in someone's hands
  if (s.scene !== 'train' && !s.shot) { cam.yaw -= mouse.dx * 0.0028; cam.pitch = Math.max(0.05, Math.min(1.0, cam.pitch + mouse.dy * 0.0022)); }
  rt.inputSeen = Math.abs(input.mx) + Math.abs(input.mz) > 0.1 || input.use || input.useHeld || input.jump || input.tab || input.aim || input.advance || Math.abs(mouse.dx) + Math.abs(mouse.dy) > 2 || input.choose !== null && input.choose !== undefined;
  if (input.hint) { PT.hintKey(); } if (input.skip) { PT.skipped(); }
  if (s.scene !== 'train' && tpad.aim) { tpad.aim = false; }
  touchUI.classList.toggle('train', s.scene === 'train'); touchUI.classList.toggle('can-tab', s.scene === 'town' && !!s.tab);   // not 'era': that is the year label's class and moved the buttons to the top
  if ((p('journal') || (P.edge(12) && !ch) || tpad.journal) && !s.dialog && !s.choice) { rt.openJournal = true; }
  rt.skip = false; rt.choose = null; mouse.dx = 0; mouse.dy = 0; mouse.click = false; mouse.clickAim = false; pressed.clear(); tpad.jump = tpad.use = tpad.shoot = tpad.tab = tpad.hint = tpad.journal = false;
  return input;
}

// ---- events from the game -----------------------------------------------------------------------------------
function handle(ev) {
  PT.event(ev);
  rt.log.push(ev.type); if (rt.log.length > 60) { rt.log.shift(); }
  switch (ev.type) {
    case 'beat': onBeat(ev); break;
    case 'world': case 'tab': case 'restored': case 'revived': case 'created': case 'placed': case 'season': case 'lit': case 'lens': if (world) { dressWorld(Gm.snapshot(g)); } break;
    default: break;
  }
  switch (ev.type) {
    case 'tab': A.play(ev.era === 1998 ? 'to98' : 'to04'); flash(); banner(T(ev.era === 1998 ? 'ui.era.1998' : (Object.keys(g.s.restored).length ? 'ui.era.2004r' : 'ui.era.2004'))); A.setTheme(themeFor(Gm.snapshot(g))); break;
    case 'tab-denied': A.play('denied'); tip(T('ui.tabDenied', { era: String(ev.to) }), 2.4); break;
    case 'tab-locked': A.play('denied'); break;
    case 'restore-start': A.play('restoreStart'); rt.sourceProv = ev.provenance; break;
    case 'plank': A.play('plank'); break;
    case 'restored': A.play(ev.id === 'credits' ? 'credit' : 'restored'); if (ev.provenance) { rt.sourceProv = ev.provenance; } save(true); break;
    case 'restore-failed': A.play('denied'); break;
    case 'revived': A.play('iris'); rt.sourceProv = ev.provenance; break;
    case 'created': A.play('season'); break;
    case 'season': if (ev.season === 'winter') { A.setTheme('winter'); A.setAmbience('winter'); } break;
    case 'rebuild': showRebuild(ev); break;
    case 'memory': cardFlash(T('ui.memory'), T('ui.memoryNote')); break;
    case 'card': cardFlash(T(ev.a), ev.b ? T(ev.b) : ''); break;
    case 'crt': if (worldId === 'study' && world.wake && ev.on) { world.wake(rt.t); A.play('crtWake'); } break;
    case 'crt-damage': rt.crtShake = rt.t; break;
    case 'glitch': A.play('glitch'); rt.glitchT = rt.t; app.classList.add('glitch'); setTimeout(() => app.classList.remove('glitch'), reduce() ? 200 : 1400); break;
    case 'unfold': A.play('unfold'); showPhoto(); if (world && world.setPhoto) { world.setPhoto('stand'); } break;
    case 'line': { const k = Array.isArray(ev.line) ? ev.line[1] : null; if (k === 'p.k.kettleSfx') { A.play('kettle'); if (world && world.setSteam) { world.setSteam(true); setTimeout(() => world.setSteam && world.setSteam(false), 3500); } } if (k === 'c1.june.oneFace') { A.play('shutter'); fadeBlinkWhite(); } if (k === 'p.e.f6') { if (world && world.setLamp) { world.setLamp(false); } } break; }
    case 'years-later': cardFlash(T('ui.years'), ''); break;
    case 'letter': showLetter(ev.text); break;
    case 'caught': A.play('caught'); break;
    case 'train-go': A.play('whistle'); break;
    case 'retry': if (ev.reason !== 'fall') { fadeBlink(); } else { fadeBlink(); } break;
    case 'photo': A.play('shutter'); capturePhoto(ev.photo); break;
    case 'june-photo': A.play('shutter'); captureJunePhoto(); break;
    case 'carry': A.play('click'); break;
    case 'crank-start': A.play('crank'); break;
    case 'lit': A.play('lit'); break;
    case 'note': A.duetNote(ev.midi, ev.dur, ev.layer, ev.cue); break;
    case 'cue-hit': A.play('blip'); break;
    case 'duet-start': A.stopMusic(); break;   // Elena's guitar is the only music while she plays
    case 'duet-done': A.setTheme(themeFor(Gm.snapshot(g))); break;
    case 'choice': A.play('choice'); break;
    case 'use': if (ev.id === 'door') { A.play('door'); } break;
    case 'tunnel': if (worldId === 'train') { world.setTunnel(ev.on); } if (ev.on) { A.play('express'); } break;
    case 'platform-photo': A.play('shutter'); rt.pendingShot = ev.photo.id; break;
    case 'sketch-done': A.play('page'); setThumb('sketch', drawSketch()); break;
    case 'drawn': A.play('page'); setThumb('boat', drawBoat()); break;
    case 'star': A.play('star'); break; case 'dot': A.play('dot'); break; case 'tuned': A.play('tuned'); break; case 'detuned': A.play('detuned'); break;
    case 'carved': A.play('carve'); break; case 'lens': A.play('lens'); break; case 'found': A.play('found'); break; case 'gate': A.play('gate'); break;
    case 'item': A.play('open'); break; case 'hold-start': if (ev.id === 'rope' || ev.id === 'chain' || ev.id === 'post') { A.play(ev.id === 'post' ? 'carve' : ev.id); } break;
    case 'body': if (ev.what === 'jump') { A.play('jump'); } if (ev.what === 'land') { A.play('land'); } if (ev.what === 'fall') { fadeBlink(); } break;
    case 'iris-board': break;
    case 'credits-roll': showCredits(); break;
    case 'save': save(false); break;
    case 'hint': A.play('hint'); break;
    case 'sfx': A.play(ev.name); break;
    default: break;
  }
}
function onBeat(ev) {
  stageWorld();
  const lay = LAYOUTS[sceneWorldId(ev.scene)];
  const s = Gm.snapshot(g); cam.yaw = s.yaw; cam.pitch = (lay && lay.camera && lay.camera.pitch) || 0.36; cam.dist = (lay && lay.camera && lay.camera.dist) || 4.5;
  syncCast(0); updateCamera(true); // place the cast first so the cut lands on where they are now
  if (ev.beat === 'end' && rt.lastChapter === 8) { /* R4: the credits follow the epilogue; the chapter card is not announced again */ } else if (ev.chapter !== rt.lastChapter) { const prev = rt.lastChapter; rt.lastChapter = ev.chapter; showChapter(ev.chapter); if (PT.active() && prev !== undefined && prev !== null && !ev.loading) { rateChapter(prev); } }
  PT.beat(ev.beat, ev.chapter);
  // R4: the way into 1998 is a colour coming back: grey, dim and flat at first, then the summer (the prologue's whole idea)
  if (ev.beat === 'P.summer' && !ev.loading) { app.classList.add('colorin'); setTimeout(() => app.classList.remove('colorin'), reduce() ? 300 : 3800); }
  if (ev.beat === '1.town') { tip(T('ui.next'), 0); }
}

// ---- acting on key lines: the faces of the speaker and the listener while a line is on screen ----------------------
// [speaker's face, listener's face]. Lines not listed keep the companion state machine's expression.
const LINE_EXPR = {
  // R4: the last Sunday
  'p.k.e3': ['quiet', 'hurt'], 'p.k.b1': ['angry', 'hurt'], 'p.k.b2': ['hurt', 'angry'], 'p.k.c1': ['angry', 'hurt'], 'p.k.c2': ['hurt', 'angry'], 'p.k.d1': ['angry', 'hurt'], 'p.k.d2': ['hurt', 'angry'], 'p.k.d3': ['quiet', 'surprise'],
  'p.k.e6': ['hurt', 'quiet'], 'p.k.e7': ['quiet', 'hurt'], 'p.k.m6': ['hurt', 'hurt'], 'p.k.e8': ['hurt', 'quiet'], 'p.k.careful': ['quiet', 'hurt'], 'p.k.bye': ['quiet', 'quiet'], 'p.k.hello': ['smile', 'neutral'],
  'p.s.j2': ['grin', 'smile'], 'p.s.pa2': ['grin', 'shy'], 'p.s.pb2': ['tease', 'smile'], 'c1.june.oneFace': ['grin', 'shy'],
  'c1.june.thought': ['hurt', 'quiet'], 'c1.elena.when': ['smile', 'shy'], 'c1.june.remember': ['tease', 'smile'],
  'c2.june.view': ['tease', 'shy'], 'c2.elena.sincere': ['shy', 'surprise'], 'c2.june.sincere': ['shy', 'shy'], 'c2.june.youreTheView': ['shy', 'surprise'], 'c2.june.coldHand': ['shy', 'shy'], 'c2.june.wishBack': ['tease', 'shy'],
  'c3.june.dontListen': ['tease', 'neutral'], 'c3.elena.wantTo': ['shy', 'surprise'],
  'c4.june.studioDream': ['grin', 'smile'], 'c4.june.notForYou': ['quiet', 'shy'], 'c4.june.poem': ['quiet', 'quiet'], 'c4.elena.almost': ['shy', 'quiet'], 'c4.june.know': ['smile', 'shy'], 'c4.elena.dots': ['quiet', 'smile'],
  'c5.june.chose': ['quiet', 'hurt'], 'c5.elena.stay': ['hurt', 'hurt'], 'c5.june.cantStay': ['hurt', 'hurt'], 'c5.june.missMe': ['smile', 'hurt'], 'c5.june.dontStay': ['quiet', 'hurt'], 'c5.elena.years': ['quiet', 'quiet'], 'c5.elena.stayed': ['hurt', 'quiet'],
  'c6.elena.remember': ['quiet', 'quiet'], 'c6.june.remember': ['hurt', 'hurt'], 'c6.elena.studio': ['hurt', 'angry'], 'c6.june.asked': ['angry', 'hurt'], 'c6.june.answered': ['hurt', 'hurt'], 'c6.elena.admit': ['hurt', 'quiet'],
  'c6.june.loss': ['angry', 'hurt'], 'c6.june.work': ['hurt', 'hurt'], 'c6.june.letterSay': ['hurt', 'hurt'], 'c6.elena.miss': ['hurt', 'quiet'], 'c6.june.iKnow': ['hurt', 'hurt'], 'c6.june.kept': ['quiet', 'hurt'], 'c6.elena.sorry': ['hurt', 'quiet'], 'c6.june.notToday': ['quiet', 'hurt'], 'c6.june.careful': ['quiet', 'hurt'],
  'c7.mara.unsent': ['quiet'], 'c7.mara.notMine': ['quiet'], 'c7.theo.snow': ['surprise'], 'c7.mara.summerEnd': ['smile'], 'c7.theo.end': ['smile'], 'c7.mara.final': ['smile']
};
function lineExpr(who) {
  const s = g ? Gm.snapshot(g) : null; const ln = s && s.dialog && Array.isArray(s.dialog.line) ? s.dialog.line : null; if (!ln || ln[0] === 'pause') { return null; }
  const e = LINE_EXPR[ln[1]]; if (!e) { return null; }
  return ln[0] === who ? e[0] : (e[1] || null);
}

// ---- camera director ------------------------------------------------------------------------------------------
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(); const ray = new THREE.Raycaster();
function headOf(p) { return p ? new THREE.Vector3(p.position.x, (p.position.y || 0) + 1.55, p.position.z) : null; }
// A close-up in front of p. If someone else's head would be in the way (or the camera inside them), swing around p.
function closeUp(p, facing, side, dist) {
  const h = headOf(p); const others = Object.values(cast).filter((q) => q !== p && q.visible && q.parent).map(headOf);
  if (others.some((o) => o.distanceTo(h) < 1.4)) { dist = (dist || 1.5) * 1.35; side = (side || 0.35) * 1.6; }   // someone right beside them: a looser close-up, so their head is not half the frame
  // R4: not only the line of sight but the camera itself keeps 0.9 m from everyone else (it used to end up 0.44 m from June
  // or Theo, so a shoulder filled the frame edge). If no angle is clear, the one that is farthest from everyone wins.
  let best = null;
  for (const swing of [0, 0.5, -0.5, 0.9, -0.9, 1.3, -1.3, 1.8, -1.8, Math.PI]) {
    const a = facing + swing; const f = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)); const r = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const pos = h.clone().addScaledVector(f, dist || 1.5).addScaledVector(r, side || 0.35).add(new THREE.Vector3(0, -0.05, 0));
    const seg = new THREE.Line3(pos, h); const blocked = others.some((o) => { const c = new THREE.Vector3(); seg.closestPointToPoint(o, true, c); return c.distanceTo(o) < 0.42; });
    const gap = others.reduce((m, o) => Math.min(m, Math.hypot(pos.x - o.x, pos.z - o.z)), 99);
    if (!blocked && gap >= 0.9) { return { pos, look: h.clone() }; }
    if (!blocked && (!best || gap > best.gap)) { best = { pos, gap }; }
  }
  if (best) { return { pos: best.pos, look: h.clone() }; }
  const f = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)); return { pos: h.clone().addScaledVector(f, dist || 1.5).add(new THREE.Vector3(0, 0.3, 0)), look: h.clone() };
}
function shotFor(name, s) {
  const me = person(avatarId()), jn = s.june ? person(juneId()) : null, th = s.theo ? person('theo') : null;
  const facingTo = (a, b) => Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z);
  const mo = s.mother ? person('elena45') : null;
  // R4 (Owner: a green model in front of the camera on the train): June's teal coat filled the frame because the
  // close-up swung round to 0.48 m from her. On the train the two faces get fixed shots from the aisle.
  if (s.scene === 'train' && s.dialog && (name === 'june' || name === 'elena' || name === 'seat' || name === 'photoback' || !name)) {
    const js = LAYOUTS.train.june, es = LAYOUTS.train.seat;
    return name !== 'elena' ? { pos: new THREE.Vector3(0.02, 1.32, 0.78), look: new THREE.Vector3(js.x, 1.12, js.z) } : { pos: new THREE.Vector3(-0.02, 1.32, -0.78), look: new THREE.Vector3(es.x, 1.12, es.z) };
  }
  switch (name) {
    case 'mother': if (mo) { return closeUp(mo, facingTo(mo, me), 0.3, 1.5); } break;
    case 'kitchen': return { pos: new THREE.Vector3(-2.9, 1.95, 2.35), look: new THREE.Vector3(1.4, 1.0, -1.7) };
    case 'crt': return { pos: new THREE.Vector3(2.05, 1.6, -1.45), look: new THREE.Vector3(3.1, 1.0, -2.9) };   // beside Mara, not through her head
    case 'june': if (jn) { return closeUp(jn, facingTo(jn, me), 0.3, 1.45); } break;
    case 'elena': case 'mara': return closeUp(me, jn ? facingTo(me, jn) : (mo ? facingTo(me, mo) : (th ? facingTo(me, th) : me.rotation.y)), -0.3, 1.45);
    case 'theo': if (th) { return closeUp(th, facingTo(th, me), 0.4, 1.8); } break;
    case 'hands': if (jn) { const mid = me.position.clone().lerp(jn.position, 0.5); return { pos: mid.clone().add(new THREE.Vector3(-1.2, 1.3, -2.4)), look: mid.clone().add(new THREE.Vector3(0, 1.2, 0)) }; } break;
    case 'twoshot': case 'window': if (jn) { const mid = me.position.clone().lerp(jn.position, 0.5); const d = jn.position.clone().sub(me.position); const n = new THREE.Vector3(-d.z, 0, d.x).normalize(); return { pos: mid.clone().addScaledVector(n, Math.max(2.2, d.length() * 1.3)).add(new THREE.Vector3(0, 1.45, 0)), look: mid.clone().add(new THREE.Vector3(0, 1.25, 0)) }; } break;
    case 'beam': return { pos: new THREE.Vector3(254, 3.5, 12), look: new THREE.Vector3(264, 7.5, 28) };
    case 'bench': return { pos: new THREE.Vector3(-6.5, 1.8, 1.8), look: new THREE.Vector3(-1.0, 0.9, -1.8) };
    // R4: from the north side of the yard, so the tower is not between the camera and June's rocks or the cottage
    case 'beamctl': return { pos: new THREE.Vector3(256, 13, 42), look: new THREE.Vector3(281, -1.5, 29) };
    case 'town-beam': return { pos: new THREE.Vector3(22.5, 9.5, 12.0), look: new THREE.Vector3(3, 0.5, 24) };
    case 'paper': return { pos: new THREE.Vector3(1.3, 2.05, 1.05), look: new THREE.Vector3(1.3, 0.75, 0.05) };
    case 'platform': return { pos: new THREE.Vector3(-6.2, 1.6, 0.4), look: new THREE.Vector3(-2.2, 1.2, 1.6) };
    case 'town-wide': return { pos: new THREE.Vector3(-14, 11, -16), look: new THREE.Vector3(4, 2, 8) };
    case 'duet': if (jn) { const mid = me.position.clone().lerp(jn.position, 0.5); const d = jn.position.clone().sub(me.position).setY(0); const n = new THREE.Vector3(-d.z, 0, d.x).normalize(); if (n.z < 0) { n.negate(); } return { pos: mid.clone().addScaledVector(n, 2.3).add(new THREE.Vector3(0, 1.15, 0)), look: mid.clone().add(new THREE.Vector3(0, 0.85, 0)) }; } break;
    default: break;
  }
  return null;
}
function updateCamera(snap) {
  const s = Gm.snapshot(g); const me = person(avatarId());
  if (benchRun) { s.shot = null; }   // free camera in the measurement tour, never a dialogue close-up
  let want = null;
  if (s.scene === 'train') {
    const seat = LAYOUTS.train.seat;
    if (s.aim) { const yaw = g.rt.aimYaw, pitch = g.rt.aimPitch; camera.fov += (40 - camera.fov) * 0.3; const pos = new THREE.Vector3(seat.x, seat.y, seat.z); const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); want = { pos, look: pos.clone().add(dir) }; }
    else { camera.fov += (55 - camera.fov) * 0.2; want = shotFor(s.shot, s) || { pos: new THREE.Vector3(seat.x - 0.75, 1.85, seat.z + 1.15), look: new THREE.Vector3(0.5, 1.15, -0.6) }; }
  } else if (s.scene === 'porch') {
    const seat = LAYOUTS.porch.seat; camera.fov += (50 - camera.fov) * 0.2;
    if (s.shot === 'twoshot') { want = { pos: new THREE.Vector3(seat.x + 0.45, seat.y + 0.35, seat.z - 2.6), look: new THREE.Vector3(seat.x + 0.4, seat.y - 0.25, seat.z + 0.2) }; }
    else if (s.shot === 'june' || s.shot === 'elena') { const jn = person(juneId()); const h = new THREE.Vector3(jn.position.x, jn.position.y + 1.2, jn.position.z); want = { pos: new THREE.Vector3(seat.x - 0.3, seat.y + 0.05, seat.z - 0.9), look: h }; }
    else { const yaw = g.rt.aimYaw, pitch = g.rt.aimPitch; const pos = new THREE.Vector3(seat.x, seat.y, seat.z); const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); want = { pos, look: pos.clone().add(dir) }; }
  } else if (s.scene === 'ride' && g.rt.ride) {
    const r = g.rt.ride; const p = Toys.ridePose(r, r.s, r.d); const ahead = Toys.ridePose(r, r.s + 6, r.d * 0.5); const f = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
    const back = 5.5 + Math.min(3, r.v * 0.2); want = { pos: new THREE.Vector3(p.x, 2.4 + r.v * 0.05, p.z).addScaledVector(f, -back), look: new THREE.Vector3(ahead.x, 1.0, ahead.z) };
    camera.fov += ((55 + Math.min(14, r.v * 1.4)) - camera.fov) * 0.1;
  } else {
    camera.fov += (55 - camera.fov) * 0.1;
    want = s.shot ? shotFor(s.shot, s) : null;
    if (!want) {
      const tgt = new THREE.Vector3(me.position.x, me.position.y + 1.35, me.position.z);
      const cp = Math.cos(cam.pitch); const dist = cam.dist * (camera.aspect < 0.8 ? 1.3 : 1);
      const pos = new THREE.Vector3(tgt.x + Math.sin(cam.yaw) * cp * dist, tgt.y + Math.sin(cam.pitch) * dist, tgt.z + Math.cos(cam.yaw) * cp * dist);
      const room = LAYOUTS[sceneWorldId(s.scene)] && LAYOUTS[sceneWorldId(s.scene)].camera && LAYOUTS[sceneWorldId(s.scene)].camera.room;
      if (room) { pos.x = Math.max(room.x0 + 0.2, Math.min(room.x1 - 0.2, pos.x)); pos.z = Math.max(room.z0 + 0.2, Math.min(room.z1 - 0.2, pos.z)); pos.y = Math.min(room.y1 - 0.12, pos.y); }
      else if (world && world.blockers && world.blockers.length) {
        const list = world.activeBlockers ? world.activeBlockers() : world.blockers; const dir = pos.clone().sub(tgt); const len = dir.length(); dir.normalize(); ray.set(tgt, dir); ray.far = len;
        const hit = ray.intersectObjects(list, false)[0]; if (hit) { pos.copy(tgt).addScaledVector(dir, Math.max(0.7, hit.distance - 0.3)); }
      }
      want = { pos, look: tgt };
    }
  }
  camera.updateProjectionMatrix();
  // a respawn or a scripted move teleports the player: cut, do not swing the camera across the map
  const b = g.rt.body; if (b && s.scene !== 'ride' && s.scene !== 'train') { if (rt.lastBody && Math.hypot(b.x - rt.lastBody.x, b.z - rt.lastBody.z) > 2.5) { snap = true; } rt.lastBody = { x: b.x, z: b.z }; } else { rt.lastBody = null; }
  if (rt.lastShot !== (s.shot || null)) { snap = true; rt.lastShot = s.shot || null; } // dialogue shots are cuts
  const k = snap || reduce() ? 1 : (s.shot ? 0.12 : 0.18);
  cam.pos.lerp(want.pos, k); cam.look.lerp(want.look, snap ? 1 : 0.22); if (snap) { cam.pos.copy(want.pos); cam.look.copy(want.look); }
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  const fill = world && world.faceFill;
  if (fill) {
    const onFace = s.shot === 'june' || s.shot === 'elena' || s.shot === 'mara' || s.shot === 'theo' || s.shot === 'mother';
    fill.intensity += ((onFace ? 1.4 : 0) - fill.intensity) * (snap ? 1 : 0.2);
    fill.position.copy(cam.pos).lerp(cam.look, 0.25).add(tmp2.set(0, 0.25, 0));
  }
}

// ---- drawing the characters from the game state ---------------------------------------------------------------
function syncCast(dt) {
  const s = Gm.snapshot(g); const me = person(avatarId()); const b = g.rt.body;
  if (s.scene === 'train') { const seat = LAYOUTS.train.seat; me.position.set(seat.x, 0.05, seat.z); me.rotation.y = Math.PI; animate(me, rt.t, 0, 0, s.aim ? 'camera' : 'sit', reduce()); showProp(me, 'camera', s.aim); me.visible = !s.aim; } // aiming is first person: the camera sits in her head
  else if (s.scene === 'ride' && g.rt.ride) {
    const r = g.rt.ride; const p = Toys.ridePose(r, r.s, r.d), j = Toys.ridePose(r, r.june.s, r.june.d);
    world.setBikes({ x: p.x, z: p.z, heading: p.heading, lean: -r.lean }, { x: j.x, z: j.z, heading: j.heading });
    me.position.set(p.x, 0.25, p.z); me.rotation.set(0, p.heading, -r.lean); animate(me, rt.t, rt.rideP = (rt.rideP || 0) + r.v * 0.016 * 2.2, 0, 'bike', reduce());
    const jn = person(juneId()); jn.visible = true; if (jn.parent !== world.scene) { world.scene.add(jn); } jn.position.set(j.x, 0.25, j.z); jn.rotation.y = j.heading; animate(jn, rt.t, rt.rideJ = (rt.rideJ || 0) + r.june.v * 0.016 * 2.2, 0, r.june.noHands ? 'nohands' : 'bike', reduce()); setExpression(jn, r.june.mode === 'overtake' || r.june.noHands ? 'grin' : (r.stop ? 'tease' : 'smile'));
  } else if (s.scene === 'porch') {
    // first person on the bench, except in the two-shot
    const seat = LAYOUTS.porch.seat; me.visible = s.shot === 'twoshot'; me.position.set(seat.x, -4.95, seat.z); me.rotation.y = Math.PI; animate(me, rt.t, 0, 0, 'sit', reduce());
  } else {
    me.position.set(b.x, b.y, b.z); me.rotation.set(0, b.facing, 0);
    // R4: footsteps, one per stride on the ground (quiet; louder indoors on a hard floor is not modelled)
    if (b.grounded && !s.seated && !s.dialog && s.scene !== 'train') { const sp = Math.hypot(b.vx, b.vz); rt.stride = (rt.stride || 0) + sp * dt; if (rt.stride > (sp > 3.2 ? 1.15 : 0.78)) { rt.stride = 0; A.play('step'); } } else if (s.dialog) { rt.stride = 0; }
    // in conversation she turns to whoever she is talking to, so close-ups see faces, not the back of a head
    if (s.dialog && !s.seated) {
      const other = s.june && g.rt.june && Math.hypot(g.rt.june.x - b.x, g.rt.june.z - b.z) < 5 ? g.rt.june : (s.theo && worldId === 'town' && Math.hypot(s.theo.x - b.x, s.theo.z - b.z) < 5 ? s.theo : (s.mother && Math.hypot(s.mother.x - b.x, s.mother.z - b.z) < 6 ? s.mother : null));
      if (other) { me.rotation.y = Math.atan2(other.x - b.x, other.z - b.z); }
    }
    const mode = s.seated ? (s.beat === '4.duet' ? 'guitar' : 'sit') : (b.gliding ? 'pose' : (!b.grounded ? 'run' : (s.carry ? 'hold' : 'walk')));
    animate(me, rt.t, (me.userData.phase = (me.userData.phase || 0) + Math.hypot(b.vx, b.vz) * dt * 4.2), s.seated ? 0 : Math.hypot(b.vx, b.vz), s.duet ? 'guitar' : mode, reduce());
    showProp(me, 'window', s.carry === 'window'); showProp(me, 'guitar', (s.beat === '4.duet' && (s.seated || !!s.duet)) || !!s.tuning); showProp(me, 'camera', false);
    showProp(me, 'suitcase', s.carry === 'suitcase'); showProp(me, 'box', !!(s.carry && s.carry.startsWith('box')));
    if (s.carry && s.carry.startsWith('box') && !s.seated) { animate(me, rt.t, me.userData.phase || 0, Math.hypot(b.vx, b.vz), 'carry', reduce()); }
    if (s.tuning) { me.position.set(LAYOUTS.cottage.guitarSeat.x, 0.1, LAYOUTS.cottage.guitarSeat.z); me.rotation.y = 0.5; animate(me, rt.t, 0, 0, 'guitar', reduce()); }
    if (s.beat === '4.duet' && s.seated) { const dp = Gm.duetPlaces(Math.abs((s.june ? s.june.x : 0) - LAYOUTS.cottage.guitarSeat.x) < (LAYOUTS.cottage.duet.apart + LAYOUTS.cottage.duet.closer) / 2); me.position.set(dp.elena.x, 0.1, dp.elena.z); me.rotation.y = dp.elena.yaw; }
  }
  if (s.june && s.scene !== 'ride') {
    const jn = person(juneId()); const j = g.rt.june;
    if (s.scene === 'porch') { const pj = LAYOUTS.porch.june; jn.position.set(pj.x, -4.95, pj.z); jn.rotation.y = Math.PI; }
    else if (s.scene === 'train') { const js = LAYOUTS.train.june; jn.position.set(js.x, 0.05, js.z); jn.rotation.y = s.dialog || s.june.anim === 'camera' || s.june.anim === 'pose' || s.june.anim === 'hideface' ? 0 : (Toys.juneMoodAt(g.rt.photoT || 0) === 'window' ? Math.PI / 2 : 0); }
    else { jn.position.set(j.x, j.y || 0, j.z); jn.rotation.y = j.facing; }
    const m = s.scene === 'porch' ? (s.dialog && Array.isArray(s.dialog.line) && s.dialog.line[0] === 'june' ? 'hum' : 'sit') : (s.scene === 'train' && s.dialog && s.june.state !== 'REACT') ? (s.june.anim === 'sleep' ? 'sleep' : 'sit') : s.scene === 'train' ? (['camera', 'pose', 'hideface', 'sleep', 'sketch'].includes(s.june.anim) ? s.june.anim : (Toys.juneMoodAt(g.rt.photoT || 0) === 'tease' ? 'camera' : 'sit')) : s.june.anim;
    animate(jn, rt.t, j.phase || 0, j.speed || 0, m, reduce()); setExpression(jn, lineExpr('june') || s.june.expr);
    showProp(jn, 'camera', m === 'camera'); showProp(jn, 'suitcase', s.beat === '5.depart' && !!g.rt.boarding); showProp(jn, 'sketch', m === 'sketch'); showProp(jn, 'box', !!g.rt.juneCarry && s.june.state === 'TRANSITION');
    if (s.scene === 'train' && (m === 'sit' || m === 'camera')) { jn.position.y = 0.05; }
  }
  if (s.mother && worldId === 'kitchen') {
    const mo = person('elena45'), m = g.rt.mother; mo.position.set(m.x, 0, m.z);
    const speaking = s.dialog && Array.isArray(s.dialog.line) && s.dialog.line[0] === 'mother';
    // in conversation she faces Mara; at the stove, before and after, she keeps her back half turned
    const face = s.dialog && !speaking && s.dialog.line && s.dialog.line[1] === 'p.k.kettleSfx' ? Math.atan2(2.3 - m.x, -2.5 - m.z) : (s.dialog || s.choice ? Math.atan2(b.x - m.x, b.z - m.z) : m.facing);
    mo.rotation.y = face; const mm = m.state === 'TRANSITION' ? 'walk' : speaking ? 'talk' : (s.dialog ? 'idle' : (m.anim === 'turnaway' ? 'idle' : (m.anim || 'idle')));
    animate(mo, rt.t, m.phase || 0, m.speed || 0, mm, reduce()); setExpression(mo, lineExpr('mother') || m.expr || 'quiet');
    mo.userData.lookAt = Math.hypot(b.x - m.x, b.z - m.z) < 5 ? new THREE.Vector3(b.x, (b.y || 0) + 1.55, b.z) : null;
    if (Math.hypot(b.x - m.x, b.z - m.z) < 5) { me.userData.lookAt = new THREE.Vector3(m.x, 1.55, m.z); }
  }
  if (s.theo && worldId === 'town') { const th = person('theo'); th.position.set(s.theo.x, 0, s.theo.z); th.rotation.y = g.rt.theo.facing; animate(th, rt.t, g.rt.theo.phase || 0, g.rt.theo.speed || 0, s.dialog && s.dialog.line && s.dialog.line[0] === 'theo' ? 'talk' : (s.theo.state === 'INVITE' && !g.s.seen.includes('c1.theo1') ? 'wave' : 'idle'), reduce()); }
  if (worldId === 'town' && g.rt.iris && world.iris) {
    const ir = g.rt.iris; world.iris.visible = !ir.gone && !ir.boarded; world.iris.position.set(ir.x, 0, ir.z); if (ir.facing !== undefined) { world.iris.rotation.y = ir.facing; }
    animate(world.iris, rt.t, rt.t * 3, ir.walking ? 1.4 : 0, ir.walking ? 'walk' : (s.era === 2004 && !ir.leaving ? 'hold' : 'idle'), reduce());
    if (ir.boarded) { world.canalBoat.position.x = -5.8 + ir.boatX; }
  }
  setExpression(me, lineExpr(s.player === 'mara' ? 'mara' : 'elena') || 'neutral');
  // eyes: whoever is speaking is looked at; otherwise June watches Elena when she is close, and Elena watches June
  {
    const head = (p) => (p && p.visible ? new THREE.Vector3(p.position.x, p.position.y + 1.55, p.position.z) : null);
    const jn = s.june ? person(juneId()) : null, th = s.theo && worldId === 'town' ? person('theo') : null;
    const speaker = s.dialog && Array.isArray(s.dialog.line) ? s.dialog.line[0] : null;
    const near = (a, b) => a && b && a.position.distanceTo(b.position) < 6;
    me.userData.lookAt = speaker === 'june' && near(me, jn) ? head(jn) : speaker === 'theo' && near(me, th) ? head(th) : (near(me, jn) ? head(jn) : (near(me, th) ? head(th) : (s.mother && worldId === 'kitchen' ? head(person('elena45')) : null)));
    if (jn) { jn.userData.lookAt = near(jn, me) && s.scene !== 'ride' ? head(me) : null; }
    if (th) { th.userData.lookAt = near(th, me) ? head(me) : null; }
  }
  if (worldId === 'station' && g.rt.train) { world.setTrain(g.rt.train.x, !g.rt.train.gone && (s.beat !== '5.alone' || g.rt.train.moving)); }
  if (worldId === 'station') { world.setSuitcase(s.beat !== '5.depart' ? 'none' : s.carry === 'suitcase' ? 'carried' : (g.s.flags.suitcase ? (g.rt.boarding ? 'none' : 'door') : 'bench')); }
  if (worldId === 'train') { world.setOutside(g.rt.outsideT || 0); }
  if ((worldId === 'coast' || worldId === 'town') && world.setBeamAim) { world.setBeamAim(beamAim(s)); }
  if (worldId === 'coast') { world.setLens(g.rt.hold.pulley || 0, !!g.s.flags.lens); world.setBeamAngle(s.beam ? s.beam.a : null); world.setStars(s.stars ? s.stars.linked.length : 0); }
  if (worldId === 'town') { world.setBeamAngle(s.beam ? s.beam.a : null); world.setRope(!(s.iris && s.iris.boarded)); world.setNewPier(s.era === 2004 ? (g.s.edition.pier_walk ? 1 : (g.rt.hold.newPier || 0)) : 0); }
  if (worldId === 'cottage') { const st = {}; ['boxA', 'boxB'].forEach((k) => { st[k] = s.carry === k ? 'carried' : (g.s.flags[k] ? 'placed' : 'floor'); }); world.setBoxes(st); }
  if (worldId === 'coast' && s.beat === '3.yard') { world.crankAngle(g.s.crank * 18); }
  if (worldId === 'town' && g.rt.restoring) { if (rt.bridgeData !== g.rt.restoring.data) { rt.bridgeData = g.rt.restoring.data; world.setBridgeData(rt.bridgeData); } world.setBridgeProgress(g.s.bridge, rt.t, true); }
}

// ---- interface ----------------------------------------------------------------------------------------------
function showChapter(c) { ui.chapter.textContent = T('chap.' + c); ui.chapter.classList.add('on'); clearTimeout(showChapter.tm); showChapter.tm = setTimeout(() => ui.chapter.classList.remove('on'), 6000); }
function banner(text) { ui.banner.textContent = text; ui.banner.classList.add('on'); clearTimeout(banner.tm); banner.tm = setTimeout(() => ui.banner.classList.remove('on'), 1800); }
function tip(text, secs) { ui.tip.textContent = text; ui.tip.classList.toggle('on', !!secs); clearTimeout(tip.tm); if (secs) { tip.tm = setTimeout(() => ui.tip.classList.remove('on'), secs * 1000); } }
function flash() { if (reduce()) { return; } app.classList.add('shift'); setTimeout(() => app.classList.remove('shift'), 380); }
function fadeBlink() { ui.fade.classList.add('on'); setTimeout(() => ui.fade.classList.remove('on'), reduce() ? 80 : 420); }
function cardFlash(a, b) { ui.overlay.className = 'overlay card'; ui.overlay.hidden = false; ui.overlay.textContent = ''; ui.overlay.append(el('div', { class: 'cardbox', 'data-testid': 'card' }, [el('div', { class: 'a', text: a }), el('div', { class: 'b', text: b })])); setTimeout(() => { if (ui.overlay.className === 'overlay card') { ui.overlay.hidden = true; } }, reduce() ? 1200 : 3200); }
const PLAY_SHOTS = ['beamctl', 'town-beam', 'paper', 'seat', 'ride', 'duet', 'crt'];
function renderHud() {
  const s = Gm.snapshot(g);
  // prompt near the thing you can use: a key glyph, the verb, the name. Nothing else on screen.
  // a cut-scene is a dialogue, a choice or a story camera; the cameras the player plays in (the train seat, the bike, the
  // guitar, the beam, the drawing paper) are not, so the task bar, tips and prompts stay on screen there
  const pr = s.prompt; const cine = !!s.dialog || (!!s.shot && !PLAY_SHOTS.includes(s.shot)) || s.choice;
  app.classList.toggle('cine', cine);
  if (pr && !cine && mode === 'play' && s.beat !== 'P.restore') {   // R4: on the restore tool the screen itself says what E does
    const key = guide.glyph();
    const sig = pr.id + pr.verb + prefs.lang + (pr.hold ? 'h' : '') + lastDev + key;
    if (ui.prompt.getAttribute('data-sig') !== sig) { ui.prompt.setAttribute('data-sig', sig); ui.prompt.textContent = ''; ui.prompt.append(el('span', { class: 'key', text: key }), el('span', { class: 'verb', text: (pr.hold ? T('ui.hold') + ' · ' : '') + T(pr.verb) }), el('span', { class: 'name', text: T('name.' + pr.id) })); if (pr.hold) { ui.prompt.append(el('span', { class: 'ring' }, [el('span', { class: 'fill' })])); } ui.prompt.setAttribute('data-id', pr.id); }
    if (pr.hold) { const f = ui.prompt.querySelector('.fill'); if (f) { f.style.width = Math.round((pr.progress || 0) * 100) + '%'; } }
    const p3 = new THREE.Vector3(pr.x, (s.y || 0) + 1.7, pr.z); if (pr.id === 'theo' || pr.id === 'june' || pr.id === 'hand') { p3.y += 0.6; } p3.project(camera);
    ui.prompt.style.left = Math.max(110, Math.min(window.innerWidth - 110, (p3.x * 0.5 + 0.5) * window.innerWidth)) + 'px'; ui.prompt.style.top = Math.max(90, Math.min(window.innerHeight - 160, (-p3.y * 0.5 + 0.5) * window.innerHeight)) + 'px';
    ui.prompt.hidden = p3.z > 1;
  } else { ui.prompt.hidden = true; }
  // subtitles: dialogue lines and short spoken captions
  let who = null, key = null, seenDlg = false;
  if (s.dialog && Array.isArray(s.dialog.line) && s.dialog.line[0] !== 'pause') { who = s.dialog.line[0]; key = s.dialog.line[1]; seenDlg = s.dialog.seen; } else if (s.caption && g.rt.caption) { who = g.rt.caption.who; key = s.caption; }
  const sig = who + '|' + key + '|' + prefs.lang;
  if (ui.subs.getAttribute('data-sig') !== sig) {
    ui.subs.setAttribute('data-sig', sig); ui.subs.setAttribute('data-key', key || ''); ui.subs.classList.toggle('on', !!key); ui.subs.setAttribute('data-who', who || '');
    ui.subs.children[0].textContent = who ? T('sp.' + who) : ''; ui.subs.children[1].textContent = key ? T(key) : '';
    ui.subs.children[2].textContent = s.dialog ? (seenDlg ? T('ui.next') + '   ·   ' + T('ui.skipHint') : T('ui.next')) : '';
    if (key && s.dialog) { A.play('blip'); }
  }
  ui.subs.classList.toggle('large', prefs.subs === 'large');
  // choices, the only buttons that ever appear during play
  const ch = s.choice || (s.dialog && !Array.isArray(s.dialog.line) ? { id: s.dialog.line.choice, options: s.dialog.line.options } : null);
  const csig = ch ? ch.id + prefs.lang : '';
  if (ui.choice.getAttribute('data-sig') !== csig) {
    ui.choice.setAttribute('data-sig', csig); ui.choice.textContent = ''; ui.choice.hidden = !ch;
    if (ch) { if (ch.id === 'finish') { ui.choice.append(el('div', { class: 'ctitle', text: T('choose.finish') })); } ch.options.forEach((o, i) => ui.choice.append(el('button', { type: 'button', class: 'copt', 'data-testid': 'choice-' + i, text: `${i + 1}  ${T(o)}`, onclick: (e) => { e.stopPropagation(); rt.choose = i; } }))); }
  }
  // the era, tiny and only where it matters; the optional source chip next to it
  const showEra = s.scene === 'town' && s.tab && mode === 'play' && !cine;
  ui.era.hidden = !showEra; if (showEra) { ui.era.textContent = T(s.era === 1998 ? 'ui.era.1998' : (Object.keys(g.s.restored).length ? 'ui.era.2004r' : 'ui.era.2004')) + '  ·  Tab'; }
  ui.source.hidden = !(rt.sourceProv && mode === 'play' && !cine && s.scene === 'town'); ui.source.textContent = T('ui.source');
  ui.aim.hidden = !(s.scene === 'train' && s.aim);
  // the viewfinder says what it sees: gold when a picture now would count, an arrow toward the subject when it is out of
  // the frame, and for June's candid shot, when to wait
  const ah = s.scene === 'train' && s.aim ? s.aimHelp : null;
  ui.aim.classList.toggle('ready', !!(ah && ah.ready)); ['left', 'right', 'up', 'down'].forEach((d) => ui.aim.classList.toggle(d, !!(ah && ah.side === d)));
  const an = !ah ? '' : ah.ready ? T('ui.aim.now') : ah.inFrame && ah.id === 'june' ? T('ui.aim.waitJune') : ah.inFrame && !ah.seen ? T('ui.aim.waitWindow') : ah.side ? T('ui.aim.' + ah.side) : '';
  const noteEl = ui.aim.firstChild; if (noteEl && noteEl.textContent !== an) { noteEl.textContent = an; }
  if (s.scene === 'train' && !s.aim && !cine && mode === 'play' && !g.s.flags.juneSnap) { if (!ui.tip.classList.contains('on')) { tip(T('ui.aimHint'), 0.1); ui.tip.classList.add('on'); } } else if (s.scene === 'train' && (cine || s.aim)) { ui.tip.classList.remove('on'); }
  if (s.duet && s.duet.cueIn !== null && s.duet.cueIn !== undefined) { app.classList.toggle('cue', Math.abs(s.duet.cueIn) < 0.45); } else { app.classList.remove('cue'); }
  // activity overlays: only while the activity runs
  ui.meter.hidden = !(s.tuning && !s.dialog);
  if (s.tuning) { ui.meter.querySelector('.needle').style.left = (50 + s.tuning.needle * 46) + '%'; ui.meter.querySelector('.mid').classList.toggle('in', Math.abs(s.tuning.needle) < 0.2); ui.meter.querySelector('.strings').textContent = ['E', 'A', 'D'].map((n, i) => (i < s.tuning.string ? n + '✓' : n)).join('  '); }
  ui.paper.hidden = !s.pen; if (s.pen) { drawPaper(s.pen); }
  app.classList.toggle('noDot', s.scene === 'porch' || s.scene === 'train' || s.scene === 'ride' || !!s.tuning || !!s.pen || !!s.duet);   // these have their own frame, reticle or none
  ui.reticle.hidden = !(s.scene === 'porch' && !s.dialog); ui.reticle.classList.toggle('on', !!(s.stars && s.stars.onStar));
  const act = s.dialog || s.choice ? '' : s.tuning ? T('ui.tune') : s.pen ? T('ui.pen') : s.sketch ? T('ui.sketch') : (s.scene === 'porch' && s.stars && s.stars.i < 5) ? T('ui.stars') : s.beam && !s.beam.done && (s.beam.ready || s.beam.target === 'june') ? beamText(s) : (s.scene === 'ride' && s.ride && s.ride.s < 40) ? T('ui.ride') : '';
  if (ui.act.textContent !== act) { ui.act.textContent = act; ui.act.classList.toggle('on', !!act); }
  ui.act.classList.toggle('good', !!(s.beam && s.beam.onTarget)); ui.act.classList.toggle('warm', !!(s.beam && !s.beam.onTarget && s.beam.gap < 0.4));
  // R4: the restore tool on Mom's computer, and the photo unfolded in the epilogue
  renderCrt(s, cine);
  ui.photo.hidden = !(s.dialog && s.dialog.id === 'p.e.photo'); if (!ui.photo.hidden && !ui.photo.dataset.drawn) { ui.photo.dataset.drawn = '1'; const c = ui.photo.getContext('2d'); if (c) { drawPhoto(c, ui.photo.width, ui.photo.height, false); } }
}
// ---- R4: the beam says where the light lands, which key brings it to the target, and when to hold -------------------
const BEAM_SPOT = { june: { x: 272.6, z: 33.2, y: 0 }, cottage: { x: 300, z: 30, y: -5 }, pier: { x: 0, z: 24.4, y: 0 } };
function beamGeom(s) {
  if (!s.beam) { return null; }
  const town = s.scene === 'town'; const from = town ? { x: 17.2, z: 19.6 } : LAYOUTS.coast.lamp; const tg = BEAM_SPOT[s.beam.target]; if (!tg) { return null; }
  return { from, tg, dist: Math.hypot(tg.x - from.x, tg.z - from.z) };
}
function beamAim(s) {
  const bg = beamGeom(s); if (!bg || !s.beam.ready) { return null; }
  return { dist: bg.dist, groundY: bg.tg.y, target: bg.tg, on: !!s.beam.onTarget, arm: s.beam.arm || 0, hold: s.beam.hold || 0 };
}
function beamText(s) {
  if (!s.beam.ready) { return T('r4.ui.beam.wait'); }
  if (s.beam.onTarget) { return T('r4.ui.beam.hold'); }
  const bg = beamGeom(s); if (!bg) { return T('ui.beam'); }
  // the key comes from the game: the one that closes the gap (the left key raises the angle). No left/right words: as the
  // light sweeps round the tower the on-screen direction can flip while the right key stays the same.
  const useLeft = (s.beam.dir || 1) > 0; const key = lastDev === 'kbm' ? keyLabel(useLeft ? keys.left : keys.right) : '{k:steer}';
  const who = T('r4.beam.' + s.beam.target);
  if (s.beam.gap < 0.4) { return T('r4.ui.beam.near', { key }); }
  return T('r4.ui.beam.turn', { who, key });
}
function crtLines(s) {
  const c = s.crt; if (!c) { return null; }
  if (c.stage === 'mount') { return ['LAST LIGHT ARCHIVE TOOL v0.3', 'backup disk: LAST LIGHT', ' read? (hold E)']; }
  return ['alt.games.homebrew / Last Light', ...Gm.RECORDS.map((r, i) => (i === c.sel ? '>' : ' ') + (c.opened[r] ? '* ' : '  ') + r), c.stage === 'run' ? (c.sel === Gm.RECORDS.length ? '>' : ' ') + ' RUN summer-0.9' : ''];
}
const scramble = (text, k, seed) => { const ch = '#%&@$*+=?/<>'; let out = ''; for (let i = 0; i < text.length; i++) { const r = Math.abs(Math.sin((i + 1) * 12.9898 + seed) * 43758.5453) % 1; out += text[i] === ' ' || r < k ? text[i] : ch[Math.floor(r * ch.length)]; } return out; };
function renderCrt(s, cine) {
  const c = s.crt; const on = !!c && s.beat === 'P.restore' && mode === 'play';
  ui.crt.hidden = !on; if (!on) { return; }
  const rec = (r) => (r === 'b98' ? (s.flags.repaired ? 'p.r.rec.b98ok' : 'p.r.rec.b98') : 'p.r.rec.' + r);
  const hold = c.stage === 'mount' ? (c.hold.disk || 0) : c.stage === 'repair' ? (c.hold.repair || 0) : c.stage === 'run' ? (c.hold.run || 0) : 0;
  const sig = [c.stage, c.sel, Object.keys(c.opened).join(','), s.flags.repaired, prefs.lang, Math.round(hold * 40), !!cine, lastDev].join('|');
  if (ui.crt.getAttribute('data-sig') === sig) { return; } ui.crt.setAttribute('data-sig', sig); ui.crt.textContent = '';
  ui.crt.setAttribute('data-stage', c.stage); ui.crt.classList.toggle('dim', !!cine);
  ui.crt.append(el('div', { class: 'ct', text: T('p.r.title') }));
  if (c.stage === 'mount') {
    ui.crt.append(el('div', { class: 'cl', text: T('p.r.mount') }), el('div', { class: 'cl', text: hold > 0 ? T('p.r.reading') : '' }), el('div', { class: 'cbar' }, [el('span', { style: `width:${Math.round(hold * 100)}%` })]));
  } else if (c.stage === 'repair') {
    const full = T('p.r.b98.credits'); ui.crt.append(el('div', { class: 'cl bad', text: T('p.r.rec.b98') }), el('div', { class: 'cl', text: T('p.r.damage') }), el('div', { class: 'cl code', 'data-testid': 'crt-repair', text: scramble(full, hold, 3) }), el('div', { class: 'cl', text: hold > 0 ? T('p.r.repairing') : '' }), el('div', { class: 'cbar' }, [el('span', { style: `width:${Math.round(hold * 100)}%` })]));
  } else {
    ui.crt.append(el('div', { class: 'cl dimt', text: T('p.r.listHead') }));
    const list = el('ol', { class: 'crec' }); Gm.RECORDS.forEach((r, i) => list.append(el('li', { class: (i === c.sel ? 'sel ' : '') + (c.opened[r] ? 'open ' : '') + (r === 'b98' && !s.flags.repaired ? 'bad' : ''), 'data-testid': 'crt-rec-' + r, text: (i === c.sel ? '▸ ' : '  ') + (c.opened[r] ? '✓ ' : '  ') + T(rec(r)) })));
    if (c.stage === 'run') { list.append(el('li', { class: 'run' + (c.sel === Gm.RECORDS.length ? ' sel' : ''), 'data-testid': 'crt-run', text: (c.sel === Gm.RECORDS.length ? '▸ ' : '  ') + 'RUN · ' + T('p.r.runHead') })); }
    ui.crt.append(list); if (c.stage === 'run' && c.sel === Gm.RECORDS.length) { ui.crt.append(el('div', { class: 'cbar' }, [el('span', { style: `width:${Math.round(hold * 100)}%` })])); }
  }
  ui.crt.append(el('div', { class: 'cf', text: c.stage === 'list' || (c.stage === 'run' && c.sel !== Gm.RECORDS.length) ? T('p.ui.crt') : T('p.ui.crtHold') }), el('div', { class: 'cfx', text: T('p.r.fiction') }));
}
// the photo from the KEEP box, unfolded: Elena squinting on the left, June laughing with the camera on the right
function drawPhoto(ctx, w, h) {
  const g0 = ctx.createLinearGradient(0, 0, 0, h); g0.addColorStop(0, '#9fd0f0'); g0.addColorStop(0.55, '#eef6fa'); g0.addColorStop(0.56, '#5a90b8'); g0.addColorStop(1, '#3a6a90'); ctx.fillStyle = g0; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b08458'; ctx.fillRect(0, h * 0.74, w, h * 0.26); ctx.fillStyle = '#8a6440'; for (let x = 0; x < w; x += 26) { ctx.fillRect(x, h * 0.74, 2, h * 0.26); }
  ctx.fillStyle = '#6b4128'; ctx.fillRect(w * 0.47, h * 0.5, 14, h * 0.26);
  const kid = (x, coat, hair, cam, smile) => { ctx.fillStyle = coat; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 40, h * 0.42, 80, h * 0.34, 16) : ctx.rect(x - 40, h * 0.42, 80, h * 0.34); ctx.fill(); ctx.fillStyle = '#f2c8a2'; ctx.beginPath(); ctx.arc(x, h * 0.33, 32, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(x, h * 0.3, 34, Math.PI * 1.02, Math.PI * 1.98); ctx.fill(); ctx.strokeStyle = '#2b2a38'; ctx.lineWidth = 3; ctx.beginPath(); if (smile) { ctx.arc(x, h * 0.35, 12, 0.2, Math.PI - 0.2); } else { ctx.moveTo(x - 8, h * 0.37); ctx.lineTo(x + 8, h * 0.37); } ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 14, h * 0.31); ctx.lineTo(x - 6, smile ? h * 0.305 : h * 0.315); ctx.moveTo(x + 6, smile ? h * 0.305 : h * 0.315); ctx.lineTo(x + 14, h * 0.31); ctx.stroke(); if (cam) { ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 70, h * 0.4, 40, 26); ctx.fillStyle = '#6a6a74'; ctx.beginPath(); ctx.arc(x - 50, h * 0.4 + 13, 8, 0, Math.PI * 2); ctx.fill(); } };
  kid(w * 0.3, '#f2ad3d', '#4b3568', false, false); kid(w * 0.7, '#6fb8a8', '#c0602a', true, true);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 22; ctx.strokeRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(43,42,56,0.7)'; ctx.font = '18px "Courier New", monospace'; ctx.fillText('summer ’98', 26, h - 22);
}
function showPhoto() { ui.photo.dataset.drawn = ''; }

// the sketchbook page in chapter 4: dots to reach, the line so far, the pen
function drawPaper(pen) {
  const c = ui.paper.getContext('2d'); if (!c) { return; } const W = ui.paper.width, H = ui.paper.height;
  c.fillStyle = '#fbf3e2'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(120,150,190,.25)'; for (let y = 30; y < H; y += 28) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.lineWidth = 4; c.lineCap = 'round'; c.strokeStyle = '#2b2a38'; c.beginPath(); pen.trail.forEach(([x, y], i) => (i ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H))); if (pen.trail.length && !pen.done) { c.lineTo(pen.x * W, pen.y * H); } c.stroke();
  Toys.BOAT.forEach(([x, y], i) => { c.fillStyle = i < pen.i ? '#2b2a38' : i === pen.i ? '#e4506f' : 'rgba(43,42,56,.25)'; c.beginPath(); c.arc(x * W, y * H, i === pen.i ? 9 : 6, 0, Math.PI * 2); c.fill(); });
  c.fillStyle = '#e4506f'; c.beginPath(); c.arc(pen.x * W, pen.y * H, 5, 0, Math.PI * 2); c.fill();
}
// June's drawing of Elena and Elena's boat, as album pictures
function paperCanvas(draw) { try { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#fbf3e2'; x.fillRect(0, 0, 320, 200); x.strokeStyle = '#2b2a38'; x.lineWidth = 3; x.lineCap = 'round'; draw(x); return c.toDataURL('image/jpeg', 0.8); } catch (e) { return null; } }
function drawSketch() { return paperCanvas((x) => { x.beginPath(); x.ellipse(160, 92, 48, 58, 0, 0, Math.PI * 2); x.stroke(); x.beginPath(); x.moveTo(130, 80); x.lineTo(146, 78); x.moveTo(174, 78); x.lineTo(190, 80); x.moveTo(160, 86); x.lineTo(172, 112); x.lineTo(158, 114); x.moveTo(144, 128); x.quadraticCurveTo(160, 138, 176, 128); x.moveTo(112, 70); x.quadraticCurveTo(160, 10, 210, 70); x.lineTo(236, 150); x.stroke(); x.font = '16px "Courier New", monospace'; x.fillStyle = '#2b2a38'; x.fillText('E., on the train', 96, 186); }); }
function drawBoat() { const tr = g && g.rt.pen ? g.rt.pen.trail : Toys.BOAT; return paperCanvas((x) => { x.beginPath(); tr.forEach(([a, b], i) => (i ? x.lineTo(a * 320, b * 200) : x.moveTo(a * 320, b * 200))); x.stroke(); x.strokeStyle = '#3f7cc4'; x.beginPath(); for (let i = 0; i < 6; i++) { x.moveTo(30 + i * 50, 172); x.quadraticCurveTo(45 + i * 50, 162, 60 + i * 50, 172); } x.stroke(); }); }
function setThumb(id, url) { const p = g && g.s.photos.find((q) => q.id === id); if (p && url) { p.thumb = url; save(false); } }
const keyLabel = (code) => (code || '').replace(/^Key/, '').replace(/^Digit/, '').replace('Space', 'Space').replace('ShiftLeft', 'Shift');

// ---- photos ---------------------------------------------------------------------------------------------------
function thumbFromCanvas() { try { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const x = c.getContext('2d'); x.drawImage(renderer.domElement, 0, 0, 320, 200); return c.toDataURL('image/jpeg', 0.72); } catch (e) { return null; } }
function capturePhoto(photo) {
  // render the aimed view right now and copy it before the browser clears the buffer
  renderer.render(world.scene, camera); const thumb = thumbFromCanvas();
  const p = g.s.photos.find((q) => q.id === photo.id); if (p && thumb) { p.thumb = thumb; } fadeBlinkWhite(); save(true);
}
function captureJunePhoto() {
  const seat = LAYOUTS.train.seat, js = LAYOUTS.train.june; const c2 = camera.clone(); c2.fov = 46; c2.position.set(js.x + 0.1, 1.25, js.z - 0.35); c2.lookAt(seat.x, 1.22, seat.z); c2.updateProjectionMatrix();
  const me = person(avatarId()); const vis = me.visible; me.visible = true; animate(me, rt.t, 0, 0, 'sit', true); showProp(me, 'camera', false); me.userData.lookAt = null; setExpression(me, 'surprise'); renderer.render(world.scene, c2); me.visible = vis; const thumb = thumbFromCanvas(); setExpression(me, 'neutral');
  const p = g.s.photos.find((q) => q.id === 'june-elena'); if (p && thumb) { p.thumb = thumb; } fadeBlinkWhite(); save(true);
}
function fadeBlinkWhite() { ui.fade.classList.add('white', 'on'); setTimeout(() => ui.fade.classList.remove('on', 'white'), reduce() ? 60 : 160); }

// ---- full-screen moments --------------------------------------------------------------------------------------
function showRebuild(ev) {
  const idx = ar.publicView(); mode = 'cut';
  ui.overlay.className = 'overlay rebuild'; ui.overlay.hidden = false; ui.overlay.textContent = '';
  const feed = el('div', { class: 'feed', 'data-testid': 'rebuild' });
  ui.overlay.append(el('p', { class: 'big', text: T('ui.rebuild', { n: ev.messages, k: ev.sources }) }), feed, el('p', { class: 'small', text: T('ui.rebuildNote') }), el('p', { class: 'small dim', text: T('ui.fixture') }));
  A.play('modem');
  const list = [...idx.messages.values()].sort((a, b) => a.time - b.time); let i = 0;
  const step = () => { if (i < list.length) { const m = list[i]; feed.append(el('div', { text: `${m.id.padEnd(42).slice(0, 42)} ${m.head.from.split(' <')[0].padEnd(9)} ${m.head.subject.slice(0, 44)}` })); i += 1; setTimeout(step, reduce() ? 20 : 140); } else { setTimeout(() => { ui.overlay.hidden = true; mode = 'play'; }, reduce() ? 300 : 1400); } };
  step();
}
function showLetter(text) {
  const box = el('div', { class: 'letter', 'data-testid': 'letter' }, [el('div', { class: 'lt', text: T('ui.letter') }), el('pre', { text: String(text || '').split('\n').filter((l) => !/^(X-Fixture|Folder|To|Status):/.test(l)).join('\n').trim() })]);
  ui.overlay.className = 'overlay letterbg'; ui.overlay.hidden = false; ui.overlay.textContent = ''; ui.overlay.append(box); A.play('page');
  setTimeout(() => { if (ui.overlay.className === 'overlay letterbg') { ui.overlay.hidden = true; } }, reduce() ? 4000 : 9000);
  ui.overlay.addEventListener('click', () => { ui.overlay.hidden = true; }, { once: true });
}
function showCredits() {
  if (PT.active() && !rt.rated7) { rt.rated7 = true; rateChapter(8, showCredits); return; }   // R4: the credits come after the epilogue
  PT.finish();
  mode = 'credits'; A.setTheme('ending'); save(true);
  ui.overlay.className = 'overlay credits'; ui.overlay.hidden = false; ui.overlay.textContent = '';
  const album = el('div', { class: 'album', 'data-testid': 'album' });
  g.s.photos.forEach((p) => { const fig = el('figure', {}, [p.thumb ? el('img', { src: p.thumb, alt: '' }) : el('div', { class: 'noimg' }), el('figcaption', { text: p.id === 'june-elena' ? T('c2.back.june') : T('c2.react.' + p.reaction) })]); album.append(fig); });
  const sg = Ar.sceneGraph(ar, 2004, g.s.restored, g.s.edition);
  ui.overlay.append(el('div', { class: 'roll', 'data-testid': 'credits' }, [
    el('div', { class: 'end', text: T('ui.end') }), el('div', { class: 'h', text: T('end.roles') }), el('div', { class: 'role', text: T('end.elena') }), el('div', { class: 'role', text: T('end.june') }),
    el('div', { class: 'small', text: Ar.creditLine(sg.credits.slice(0, 2)).join('   ·   ') + '   (' + T('status.RESTORED') + ')' }), el('div', { class: 'mara', text: T('end.mara') }), el('div', { class: 'small', text: T('status.CREATED') }),
    el('div', { class: 'h2', text: T('ui.album') }), album, el('p', { class: 'unsent', text: T('end.unsent') }), el('p', { class: 'small', text: T('end.fiction') }), el('p', { class: 'small', text: T('end.poem') }),
    el('div', { class: 'row' }, [PT.active() ? el('button', { type: 'button', class: 'btn', text: T('pt.download'), 'data-testid': 'pt-download-end', onclick: () => PT.download() }) : null, el('button', { type: 'button', class: 'btn primary', text: T('ui.keepExploring'), 'data-testid': 'keep-exploring', onclick: () => { ui.overlay.hidden = true; mode = 'play'; } }), el('button', { type: 'button', class: 'btn', text: T('ui.backTitle'), onclick: () => { ui.overlay.hidden = true; showTitle(); } })])
  ]));
  const ke = ui.overlay.querySelector('[data-testid="keep-exploring"]'); if (ke) { ke.focus(); }
}
function showProvenance() {
  const p = rt.sourceProv; if (!p) { return; }
  mode = 'panel'; ui.panel.hidden = false; ui.panel.textContent = '';
  const rows = [[T('prov.record'), p.recordId], ['manifest', p.manifestId || ''], [T('prov.status'), T('status.' + p.status)], ['file', `${p.file}  ${p.size} bytes  (${p.encoding})`], ['CRC-32', p.crc32], ['SHA-256', p.sha256], ['source', p.source]];
  const tb = el('table', { class: 'prov' }); rows.forEach(([a, b]) => tb.append(el('tr', {}, [el('th', { text: a }), el('td', { text: String(b) })])));
  const copies = el('ul', { class: 'copies' }); (p.evidence || []).forEach((c) => copies.append(el('li', { text: `${c.source}: ${T('copy.' + c.status)}` })));
  ui.panel.append(el('h2', { text: T('prov.title') }), tb, el('div', { class: 'lbl', text: T('prov.copies') }), copies, el('p', { class: 'dim', text: T('ui.fixture') }), el('button', { type: 'button', class: 'btn', text: T('prov.close'), 'data-testid': 'prov-close', onclick: closePanel }));
}
ui.source.addEventListener('click', showProvenance);
ui.era.addEventListener('click', () => { if (mode === 'play') { rt.forceTab = true; } });
function closePanel() { PT.resume(); rt.journalOpen = false; rt.keyNote = null; rebinding = null; ui.panel.hidden = true; mode = 'play'; if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); } }

// ---- menus ----------------------------------------------------------------------------------------------------
function onEscape() {
  if (rt.confirm) { rt.confirm(false); return; }
  if (mode === 'panel') { closePanel(); return; }
  if (mode === 'pause') { closePanel(); return; }
  if (mode !== 'play' || !g) { return; }
  // with the pointer captured the browser releases it on Esc and that pauses (pointerlockchange); otherwise Esc skips a seen line
  const s = Gm.snapshot(g); if (s.dialog && s.dialog.seen && !locked) { rt.skip = true; return; }
  releasePointer();
  openPause();
}
function openJournal() {
  PT.pause(); mode = 'pause'; rt.journalOpen = true; ui.panel.hidden = false; down.clear();
  releasePointer();
  guide.journal(ui.panel);
  const close = el('button', { type: 'button', class: 'btn', text: T('jr.close') + '  (' + guide.label('journal') + ')', 'data-testid': 'journal-close', onclick: closePanel });
  ui.panel.append(close); close.focus();
}
function openPause() {
  PT.pause();
  mode = 'pause'; ui.panel.hidden = false; ui.panel.textContent = ''; down.clear();
  const b = (text, id, fn) => el('button', { type: 'button', class: 'mbtn', text, 'data-testid': id, onclick: fn });
  ui.panel.append(el('h2', { text: T('ui.pause') }), el('div', { class: 'menu' }, [b(T('ui.resume'), 'resume', closePanel), b(T('ui.settings'), 'settings', renderSettings), b(T('ui.journal'), 'journal', () => openJournal()), PT.active() && PT.recording() ? b(T('pt.download'), 'pt-download', () => PT.download()) : null, PT.active() && PT.recording() ? b(T('pt.delete'), 'pt-delete', () => { PT.reset(); closePanel(); tip(T('pt.deleted'), 4); }) : null, b(T('ui.safe'), 'safe-spot', safeSpot), b(T('ui.backTitle'), 'back-title', () => { save(true); closePanel(); showTitle(); })]));
  const r = ui.panel.querySelector('[data-testid="resume"]'); if (r) { r.focus(); }
}
function renderSettings() {
  const keepFocus = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.testid : null;
  mode = 'pause'; ui.panel.hidden = false; ui.panel.textContent = '';
  const ap = A.getPrefs(); const row = (label, kids) => el('div', { class: 'srow' }, [el('span', { class: 'sl', text: label }), el('span', { class: 'sv' }, kids)]);
  const btn = (text, id, fn) => el('button', { type: 'button', class: 'sbtn', text, 'data-testid': id, onclick: fn });
  const range = (v, id, fn) => el('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(v * 100)), 'data-testid': id, oninput: (e) => fn(e.target.value / 100) });
  const setP = (k, v) => { prefs[k] = v; write(PREF_KEY, prefs); renderSettings(); };
  const kb = el('div', { class: 'keys' }); ACTIONS.forEach((a) => kb.append(el('button', { type: 'button', class: 'kbtn', 'data-testid': 'key-' + a, text: `${T('ui.k.' + a)}: ${rebinding === a ? T('ui.rebind') : keyLabel(keys[a])}`, onclick: () => { rebinding = a; renderSettings(); } })));
  ui.panel.append(el('h2', { text: T('ui.settings') }),
    row(T('ui.sound'), [btn(ap.muted ? T('ui.off') : T('ui.on'), 'sound', () => { A.setPref('muted', !ap.muted); renderSettings(); })]),
    row(T('ui.music'), [range(ap.music, 'music', (v) => A.setPref('music', v))]), row(T('ui.sfx'), [range(ap.sfx, 'sfx', (v) => A.setPref('sfx', v))]),
    row(T('ui.quality'), ['low', 'medium', 'high'].map((q) => btn(T('ui.q.' + q) + (prefs.quality === q ? ' ✓' : ''), 'q-' + q, () => { prefs.quality = q; write(PREF_KEY, prefs); resize(); renderer.shadowMap.enabled = q !== 'low'; renderSettings(); }))),
    row(T('ui.motion'), [btn(prefs.reduce ? T('ui.motionReduced') : T('ui.motionFull'), 'motion', () => setP('reduce', !prefs.reduce))]),
    row(T('ui.tutorial'), [btn(prefs.tips === false ? T('ui.off') : T('ui.on'), 'tips', () => { if (prefs.tips === false) { prefs.tut = {}; } setP('tips', prefs.tips === false); })]),
    row(T('ui.autoHelp'), [btn(prefs.autoHelp === false ? T('ui.off') : T('ui.on'), 'auto-help', () => setP('autoHelp', prefs.autoHelp === false))]),
    row(T('ui.mouse'), [btn(prefs.noLock ? T('ui.mouse.free') : T('ui.mouse.capture'), 'mouse-mode', () => setP('noLock', !prefs.noLock))]),
    row(T('ui.subs'), [btn(prefs.subs === 'large' ? T('ui.subsLarge') : T('ui.subsNormal'), 'subs', () => setP('subs', prefs.subs === 'large' ? 'normal' : 'large'))]),
    row(T('ui.language'), [btn(T('ui.lang'), 'lang', () => { setP('lang', prefs.lang === 'zh' ? 'en' : 'zh'); applyLang(); })]),
    row(T('ui.keys'), [kb, btn(T('ui.resetKeys'), 'reset-keys', () => { Object.assign(keys, DEFAULT_KEYS); write(KEYS_KEY, keys); rebinding = null; rt.keyNote = null; renderSettings(); })]),
    ...(rt.keyNote ? [el('p', { class: 'dim', 'data-testid': 'key-note', text: rt.keyNote })] : []),
    el('button', { type: 'button', class: 'btn', text: T('ui.resume'), 'data-testid': 'resume', onclick: closePanel }));
  const f = (keepFocus && ui.panel.querySelector(`[data-testid="${keepFocus}"]`)) || ui.panel.querySelector('button'); if (f) { f.focus(); }
}
function safeSpot() { const lay = LAYOUTS[sceneWorldId(Gm.snapshot(g).scene)]; if (lay && g.rt.body && lay.spawn) { const sp = lay.spawn; Object.assign(g.rt.body, { x: sp.x, z: sp.z, y: 0, vx: 0, vz: 0, vy: 0, grounded: true }); } closePanel(); }
function applyLang() { document.documentElement.lang = prefs.lang === 'zh' ? 'zh-CN' : 'en'; document.title = T('ui.title') + ' — ' + T('ui.subtitle'); ui.subs.removeAttribute('data-sig'); ui.prompt.removeAttribute('data-sig'); ui.choice.removeAttribute('data-sig'); }

// ---- title -----------------------------------------------------------------------------------------------------
function readSave() { const raw = readJSON(SAVE_KEY, null); return raw ? Gm.parseSave(raw, ar) : null; }
function save(show) { if (!g || mode === 'title' || mode === 'loading' || rt.preview) { return; } write(SAVE_KEY, Gm.serialize(g)); rt.lastSave = rt.t; if (show) { ui.saved.textContent = T('ui.saved'); ui.saved.classList.add('on'); setTimeout(() => ui.saved.classList.remove('on'), 1200); } }
function showTitle() {
  mode = 'title'; applyLang();
  if (!g) { g = Gm.createGame(ar); }
  if (!world) { stageWorld(); }
  const saved = readSave();
  ui.overlay.className = 'overlay title'; ui.overlay.hidden = false; ui.overlay.textContent = '';
  const row = el('div', { class: 'row' });
  if (saved) { row.append(el('button', { class: 'btn primary', type: 'button', text: T('ui.continue'), 'data-testid': 'continue', onclick: () => begin(saved) }), el('button', { class: 'btn', type: 'button', text: T('ui.newGame'), 'data-testid': 'new-game', onclick: () => askConfirm(T('ui.confirmNew'), (yes) => { if (yes) { begin(null); } }) })); }
  else { row.append(el('button', { class: 'btn primary', type: 'button', text: T('ui.start'), 'data-testid': 'start', onclick: () => begin(null) })); }
  rt.testerField = PT.active() ? el('input', { type: 'text', class: 'ptid', maxlength: '40', placeholder: T('pt.tester'), 'data-testid': 'pt-tester' }) : null;
  ui.overlay.append(el('div', { class: 'titlebox', 'data-testid': 'title' }, [el('h1', { text: T('ui.title') }), el('div', { class: 'sub', text: T('ui.subtitle') }), el('div', { class: 'tag', text: T('ui.tagline') }), PT.active() ? el('div', { class: 'note pt', text: T('pt.mode') }) : null, rt.testerField, row, el('div', { class: 'note', text: T('ui.saveNote') }), el('div', { class: 'note', text: T('ui.fixture') })]),
    el('button', { class: 'btn ghost langbtn', type: 'button', text: T('ui.lang'), 'data-testid': 'lang', onclick: () => { prefs.lang = prefs.lang === 'zh' ? 'en' : 'zh'; write(PREF_KEY, prefs); showTitle(); } }));
  const pb = ui.overlay.querySelector('.btn.primary'); if (pb) { pb.focus(); }
}
function askConfirm(text, then) {
  const box = el('div', { class: 'confirm', role: 'alertdialog', 'data-testid': 'confirm' });
  const before = document.activeElement;
  const done = (yes) => { rt.confirm = null; box.remove(); if (before && before.focus) { before.focus(); } then(yes); };
  const no = el('button', { type: 'button', class: 'btn primary', text: T('ui.no'), 'data-testid': 'confirm-no', onclick: () => done(false) });
  box.append(el('p', { text }), el('div', { class: 'row' }, [no, el('button', { type: 'button', class: 'btn', text: T('ui.yes'), 'data-testid': 'confirm-yes', onclick: () => done(true) })]));
  ui.overlay.append(box); rt.confirm = done; no.focus();
}
function begin(saved) {
  if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); }
  A.unlock(); ui.overlay.hidden = true; if (PT.active()) { PT.begin(rt.testerField ? rt.testerField.value : undefined); }
  if (!saved) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
  g = Gm.createGame(ar, saved || null); Object.values(worlds).forEach((w) => { void w; });
  worldId = null; rt.lastChapter = null; mode = 'play'; if (testHook) { testHook.game = g; }
  const tune = Ar.sceneGraph(ar, 1998).objects.find((o) => o.id === 'tune'); if (tune && tune.data) { A.setTune(tune.data); }
  onBeat({ beat: g.s.beat, chapter: Gm.chapterOf(g.s.beat), scene: g.rt.scene }); save(false); guide.resetForGame();
}

// ---- playtest: chapter ratings, device info, and the F3 frame-time overlay ------------------------------------
function rateChapter(ch, then) {
  const back = mode; mode = 'rate'; const pick = { fun: 0, moved: 0 };
  ui.panel.hidden = false; ui.panel.textContent = '';
  const row = (k) => el('div', { class: 'srow' }, [el('span', { class: 'sl', text: T('pt.' + k) }), el('span', { class: 'sv' }, [1, 2, 3, 4, 5].map((n) => el('button', { type: 'button', class: 'sbtn', 'data-testid': `rate-${k}-${n}`, text: String(n), onclick: (e) => { pick[k] = n; [...e.target.parentNode.children].forEach((c) => c.classList.toggle('on', c === e.target)); } })))]);
  const note = el('textarea', { class: 'ptnote', rows: '2', maxlength: '400', placeholder: T('pt.note') });
  const done = () => { PT.rate(ch, pick.fun, pick.moved, note.value); ui.panel.hidden = true; mode = back === 'rate' ? 'play' : back; if (then) { then(); } };
  ui.panel.append(el('h2', { text: ch === 0 || ch === 8 ? T('pt.title.' + ch) : T('pt.title', { n: ch }) }), el('p', { class: 'dim', text: T('pt.why') }), row('fun'), row('moved'), note,
    el('div', { class: 'row' }, [el('button', { type: 'button', class: 'btn', 'data-testid': 'rate-skip', text: T('pt.skip'), onclick: () => { pick.fun = pick.moved = 0; done(); } }), el('button', { type: 'button', class: 'btn primary', 'data-testid': 'rate-done', text: T('pt.continue'), onclick: done })]));
}
function deviceInfo() {
  let gpu = null; try { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { gpu = null; }
  return { userAgent: navigator.userAgent, platform: navigator.platform || null, language: navigator.language, screen: window.screen ? [window.screen.width, window.screen.height] : null, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, cores: navigator.hardwareConcurrency || null, memoryGB: navigator.deviceMemory || null, gpu, webgl2: !!(renderer.capabilities && renderer.capabilities.isWebGL2), quality: prefs.quality, reducedMotion: reduce(), touchScreen: 'ontouchstart' in window };
}
const perfHud = el('div', { class: 'perfhud', hidden: '', 'data-testid': 'perfhud' }); app.appendChild(perfHud);
const ft = []; let perfT = 0;
function perfSample(ms) {
  ft.push(ms); if (ft.length > 240) { ft.shift(); }
  if (perfHud.hidden || (perfT += ms) < 500) { return; } perfT = 0;
  const sorted = ft.slice().sort((a, b) => a - b); const avg = ft.reduce((a, b) => a + b, 0) / ft.length; const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : '–';
  perfHud.textContent = `${Math.round(1000 / avg)} fps · avg ${avg.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · worst ${Math.round(sorted[sorted.length - 1] || 0)} ms · heap ${mem} · ${prefs.quality}${autoDrop ? ' (auto-lowered)' : ''}\n${gpuName}`;
}
window.V5Perf = () => { const sorted = ft.slice().sort((a, b) => a - b); const avg = ft.reduce((a, b) => a + b, 0) / (ft.length || 1); return { frames: ft.length, avgMs: avg, p95Ms: sorted[Math.floor(sorted.length * 0.95)] || 0, worstMs: sorted[sorted.length - 1] || 0, gpu: gpuName || null }; };

// ---- the loop ---------------------------------------------------------------------------------------------------
let last = 0, fpsAcc = 0, fpsN = 0, slowSecs = 0;
function frame(now) {
  try { tick(now); } catch (e) { if ((frame.errs = (frame.errs || 0) + 1) < 4) { console.error('V5 frame error', e && e.stack ? e.stack : e); } }
  requestAnimationFrame(frame);
}
function tick(now) {
  const rawMs = last ? now - last : 16; perfSample(rawMs);
  if (benchWake) { const w = benchWake; benchWake = null; w(rawMs); }
  touchUI.classList.toggle('off', mode !== 'play');   // the round buttons belong to play: on the title and in menus they only get in the way
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016; last = now; rt.t += dt; rt.frames += 1;
  // fps from the real frame time, not the capped simulation step
  fpsAcc += rawMs / 1000; fpsN += 1; if (fpsAcc > 1) { rt.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; if (rt.fps < 24 && !autoDrop && !BENCH) { slowSecs += 1; if (slowSecs > 3) { autoDrop = 1; resize(); } } else { slowSecs = 0; } }
  if (!g || !world) { return; }
  pad = pollPad();
  if (mode === 'play' && benchRun) {
    // measurement tour: a few real ticks so the scene is set up, then the game is frozen and the camera orbits
    if (benchRun.ticks > 0) { benchRun.ticks -= 1; Gm.tick(g, dt, {}).forEach(handle); }
    cam.yaw += dt * 0.5; if (g.rt.scene === 'porch') { g.rt.aimYaw = Math.sin(rt.t * 0.4) * 0.9; g.rt.aimPitch = 0.35 + Math.sin(rt.t * 0.3) * 0.2; }
  } else if (mode === 'play') {
    let input = collectInput(dt); if (rt.forceTab) { input.tab = true; rt.forceTab = false; }
    if (testHook && testHook.input) { input = testHook.input(input) || input; }
    const evs = Gm.tick(g, dt, input); evs.forEach(handle); guide.events(evs); if (testHook && testHook.events) { testHook.events(evs); }
  } else {
    pressed.clear(); mouse.dx = mouse.dy = 0; mouse.click = false;
    menuPad();
  }
  syncCast(dt);
  world.update(dt, rt.t, reduce());
  updateCamera(false);
  renderHud();
  guide.update(dt, app.classList.contains('cine'));
  if (rt.openJournal) { rt.openJournal = false; if (mode === 'play') { openJournal(); } }
  if (mode === 'play' && rt.t - rt.lastSave > 5) { save(false); }
  PT.frame(rawMs, mode === 'play', mode === 'play' ? Gm.snapshot(g) : null, !!rt.inputSeen); rt.inputSeen = false;
  renderer.render(world.scene, camera);
  if (rt.pendingShot && (rt.pendingT = (rt.pendingT || 0) + 1) > 6) { const id = rt.pendingShot; rt.pendingShot = null; rt.pendingT = 0; setThumb(id, thumbFromCanvas()); fadeBlinkWhite(); }
}

// Read-only view for automated browser tests. It cannot change anything.
window.V5Debug = { text(k, v) { return T(k, v); },
  // R4: what stands between the camera and the speaker's head under a given shot? Used by tools/r4-camera-scan.mjs.
  // Returns the first solid thing on the ray (its colour, name, which character it belongs to, how far), the distance to
  // the nearest character body, and leaves the camera where the shot puts it so a screenshot shows the same view.
  probeShot(shot, speaker) {
    if (!g || !world) { return null; }
    g.rt.shot = shot; const fake = !g.rt.dialog; if (fake) { g.rt.dialog = { id: 'probe', lines: [[speaker, 'probe', shot]], i: 0, seen: true }; } updateCamera(true); camera.updateMatrixWorld(true); renderer.render(world.scene, camera);
    const ids = { june: juneId(), elena: avatarId(), mara: avatarId(), theo: 'theo', mother: 'elena45' }; const tid = ids[speaker]; const tp = tid && cast[tid]; if (!tp || !tp.visible) { return { shot, speaker, error: 'speaker not on stage' }; }
    const seated = Gm.snapshot(g).scene === 'train'; const head = new THREE.Vector3(tp.position.x, tp.position.y + (seated ? 1.2 : 1.55), tp.position.z);
    const dir = head.clone().sub(camera.position); const dist = dir.length(); dir.normalize();
    const rc = new THREE.Raycaster(camera.position.clone(), dir, 0.02, Math.max(0.05, dist - 0.12)); rc.camera = camera;   // sprites need it
    const isIn = (o, root) => { for (let q = o; q; q = q.parent) { if (q === root) { return true; } } return false; };
    const castOf = (o) => { for (const [id, p] of Object.entries(cast)) { if (isIn(o, p)) { return id; } } return null; };
    const hit = rc.intersectObjects(world.scene.children, true).find((h) => { if (castOf(h.object) === tid) { return false; }   // the speaker's own face is the target, not an obstacle
      const m = h.object.material; const mm = Array.isArray(m) ? m[0] : m; return h.object.isMesh && mm && !(mm.transparent && mm.opacity < 0.6) && mm.blending !== THREE.AdditiveBlending && mm.visible !== false && (() => { for (let q = h.object; q; q = q.parent) { if (!q.visible) { return false; } } return true; })(); });   // Raycaster ignores visibility, so check the whole chain
    if (fake) { g.rt.dialog = null; }
    let near = { id: null, d: 99 }; Object.entries(cast).forEach(([id, p]) => { if (!p.visible || !p.parent || p === person(avatarId())) { return; } const d = Math.hypot(camera.position.x - p.position.x, camera.position.z - p.position.z); if (d < near.d) { near = { id, d }; } });
    const col = hit && hit.object.material && (Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material).color;
    return { shot, speaker, cameraAt: camera.position.toArray().map((v) => +v.toFixed(2)), headDist: +dist.toFixed(2), blocked: !!hit, blocker: hit ? { dist: +hit.distance.toFixed(2), color: col ? '#' + col.getHexString() : null, owner: castOf(hit.object), name: hit.object.name || hit.object.parent && hit.object.parent.name || '', geo: hit.object.geometry && hit.object.geometry.type, size: hit.object.geometry && hit.object.geometry.boundingBox === null ? (hit.object.geometry.computeBoundingBox(), hit.object.geometry.boundingBox.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2))) : null, at: hit.point.toArray().map((v) => +v.toFixed(2)) } : null, nearestBody: { id: near.id, d: +near.d.toFixed(2) } };
  }, bodySpeed() { const b = g && g.rt.body; return b ? Math.hypot(b.vx || 0, b.vz || 0) : 0; }, cameraClearance() { const c = camera.position; let min = 99, who = null; Object.entries(cast).forEach(([id, p]) => { if (!p.visible || !p.parent || p === person(avatarId())) { return; } const y = Math.max(p.position.y, Math.min(p.position.y + 1.7, c.y)); const d = Math.hypot(c.x - p.position.x, c.y - y, c.z - p.position.z); if (d < min) { min = d; who = id; } }); return { min, who, shot: g ? Gm.snapshot(g).shot : null }; }, objective() { return g ? objective(g) : null; }, journal() { return g ? journalCounts(g) : null; }, guide() { return { quest: !guide.el.bar.hidden && guide.el.bar.textContent, tip: guide.el.tipBox.hidden ? null : guide.el.tipBox.getAttribute('data-id'), arrow: !guide.el.arrow.hidden, toast: !guide.el.toast.hidden, device: lastDev, camYaw: cam.yaw, pointerLocked: locked }; }, snapshot() { const s = g ? Gm.snapshot(g) : null; const shell = { mode, fps: rt.fps, frames: rt.frames, world: worldId, heard: A.heardList(), audio: A.level ? A.level() : null, log: rt.log.slice(-30), locked, lang: prefs.lang, photos: g ? g.s.photos.map((p) => ({ id: p.id, reaction: p.reaction, thumb: !!p.thumb })) : [] }; return Object.assign({}, s || {}, shell); } };

// ---- RC1 review modes: preview a saved moment (?preview=<beat>) and measure frame times (?bench=...) -------------
async function previewSaves() { const r = await fetch('/v5/data/preview-saves.json'); if (!r.ok) { throw new Error('preview-saves ' + r.status); } return JSON.parse(await r.text()).saves || {}; }
async function startPreview(id) {
  const raw = (await previewSaves())[id]; const saved = raw ? Gm.parseSave(raw, ar) : null;
  if (!saved) { showTitle(); return; }
  rt.preview = id; begin(saved); tip(T('ui.preview', { beat: id }), 9);
}
const nextFrame = () => new Promise((resolve) => { benchWake = resolve; });
const waitMs = async (ms, sink) => { const end = performance.now() + ms; while (performance.now() < end) { const f = await nextFrame(); if (sink) { sink.push(f); } } };
function benchDevice(refresh) {
  const d = deviceInfo(); const ua = navigator.userAgent || '';
  return Object.assign({}, d, { browser: Bn.browserName(ua), refreshHz: refresh, pixelRatioUsed: renderer.getPixelRatio ? renderer.getPixelRatio() : null, canvas: renderer.domElement ? [renderer.domElement.width, renderer.domElement.height] : null, touchPoints: navigator.maxTouchPoints || 0, gamepads: gamepad() ? gamepad().id : null });
}
async function runBenchTier(tier, saves) {
  const out = []; const idle = []; for (let i = 0; i < 90; i++) { idle.push(await nextFrame()); }
  const refresh = Bn.refreshHz(idle.slice(10));
  for (const beat of BENCH.beats) {
    const raw = saves[beat]; if (!raw) { out.push({ tier, beat, error: 'no preview save' }); continue; }
    benchRun = { ticks: 12 }; rt.preview = 'bench:' + beat; const heap0 = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null;
    const t0 = performance.now(); begin(Gm.parseSave(raw, ar)); mode = 'play'; benchRun = { ticks: 12 };
    await nextFrame(); const first = await nextFrame(); const loadMs = performance.now() - t0;
    await waitMs(BENCH.warm * 1000);
    let hidden = false; const onVis = () => { if (document.hidden) { hidden = true; } }; document.addEventListener('visibilitychange', onVis); hidden = !!document.hidden;
    const fr = []; await waitMs(BENCH.secs * 1000, fr); document.removeEventListener('visibilitychange', onVis);
    const info = renderer.info || {}; const heap1 = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null;
    out.push({ tier, beat, loadMs, firstFrameMs: first, interrupted: hidden, stats: Bn.summarize(fr), heapMB: heap1 === null ? null : Math.round(heap1), heapGrowthMB: heap1 === null || heap0 === null ? null : Math.round(heap1 - heap0), calls: info.render && info.render.calls !== undefined ? info.render.calls : null, triangles: info.render && info.render.triangles !== undefined ? info.render.triangles : null, geometries: info.memory ? info.memory.geometries : null, textures: info.memory ? info.memory.textures : null, scene: worldId });
  }
  benchRun = null; return { results: out, refresh };
}
async function startBench() {
  mode = 'loading'; ui.overlay.hidden = false; ui.overlay.textContent = '';
  const status = el('p', { class: 'loading', 'data-testid': 'bench-status', text: `Measuring (${BENCH.tiers[0]})…` }); ui.overlay.append(status);
  const saves = await previewSaves(); const tier = BENCH.tiers[0]; const rest = BENCH.tiers.slice(1);
  const build = window.__V5_BUILD__ || await fetch('/v5/data/build.json').then((r) => (r.ok ? r.text() : null)).then((t) => (t ? JSON.parse(t).build : null)).catch(() => null);
  let store = readJSON(BENCH_KEY, null); const run = BENCH.run || ('b' + Date.now().toString(36));
  if (!store || store.run !== run) { store = { run, startedAt: new Date().toISOString(), readyMs: performance.now(), results: [], device: null, build: build || null }; }
  g = Gm.createGame(ar); ui.overlay.hidden = true; mode = 'play';
  const { results, refresh } = await runBenchTier(tier, saves);
  store.results = store.results.concat(results); store.device = benchDevice(refresh); store.tiers = (store.tiers || []).concat([tier]); write(BENCH_KEY, store);
  if (rest.length) { location.replace(Bn.benchUrl(location.pathname, { tiers: rest, beats: BENCH.beats, secs: BENCH.secs, warm: BENCH.warm, run }) + (new URLSearchParams(QS).get('lang') ? '&lang=' + new URLSearchParams(QS).get('lang') : '')); return; }
  showBenchReport(store);
}
function showBenchReport(store) {
  mode = 'bench-report'; ui.overlay.hidden = true; ui.panel.hidden = false; ui.panel.textContent = '';
  const report = { version: 1, run: store.run, when: store.startedAt, build: store.build, readyMs: store.readyMs, device: store.device, results: store.results.filter((r) => !r.error).map((r) => Object.assign({}, r)), errors: store.results.filter((r) => r.error) };
  const md = Bn.markdown(report);
  const act = (text, id, fn) => el('button', { type: 'button', class: 'btn', text, 'data-testid': id, onclick: fn });
  const pre = el('pre', { class: 'benchmd', 'data-testid': 'bench-md', text: md }); pre.style.cssText = 'white-space:pre-wrap;font:12px/1.5 var(--mono);max-height:48vh;overflow:auto;user-select:text;text-align:left;margin:10px 0';
  ui.panel.append(el('h2', { text: 'Frame-time report' }), el('p', { class: 'dim', text: `${store.results.length} measurements, ${(store.tiers || []).join(' / ')}${store.results.some((r) => r.interrupted) ? ' — the tab was hidden during some measurements: repeat those' : ''}. Copy the table into docs/V5-RC1-PERF.md, or download the JSON.` }), pre,
    el('div', { class: 'row' }, [
      act('Copy markdown', 'bench-copy', () => { try { navigator.clipboard.writeText(md); } catch (e) { const r = document.createRange ? document.createRange() : null; if (r) { r.selectNodeContents(pre); } } }),
      act('Download JSON', 'bench-json', () => { const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })), download: 'v5-bench-' + store.run + '.json' }); document.body.append(a); a.click(); a.remove(); }),
      act('Run again', 'bench-again', () => { try { localStorage.removeItem(BENCH_KEY); } catch (e) { /* ignore */ } location.replace(Bn.benchUrl(location.pathname, { tiers: Bn.TIERS, beats: BENCH.beats, secs: BENCH.secs, warm: BENCH.warm })); })]));
  window.V5BenchReport = report;
}

// ---- start ------------------------------------------------------------------------------------------------------
async function loadArchive() {
  const files = Object.assign({}, Object.fromEntries(Ar.SOURCES.map((s) => [s.id, s.file])), Ar.EXTRA_FILES);
  const texts = {}; await Promise.all(Object.entries(files).map(async ([id, f]) => { const r = await fetch('/v5/data/' + f); if (!r.ok) { throw new Error(f + ' ' + r.status); } texts[id] = await r.text(); }));
  ar = Ar.createArchive(texts);
}
ui.overlay.className = 'overlay title'; ui.overlay.hidden = false; ui.overlay.append(el('p', { class: 'loading', text: T('ui.loading') }));
requestAnimationFrame(frame);
let gpuName = ''; try { gpuName = deviceInfo().gpu || ''; } catch (e) { gpuName = ''; }
try { PT.start(deviceInfo()); } catch (e) { /* no device info here */ }
loadArchive().then(() => (BENCH ? startBench() : PREVIEW ? startPreview(PREVIEW) : showTitle())).catch((e) => { ui.overlay.textContent = ''; ui.overlay.append(el('p', { class: 'err', text: T('ui.loadError'), 'data-testid': 'load-error' })); console.error(e); });
