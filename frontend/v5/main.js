// Resurrection V5 browser shell. The game itself is core/game.js (pure, tested headlessly); this file reads input,
// draws what the game reports, directs the camera, runs the interface, captures photos and saves.
import { THREE } from './render/kit.js';
import * as Gm from './core/game.js';
import * as Ar from './core/archive.js';
import * as Toys from './core/toys.js';
import { LAYOUTS } from './core/layout.js';
import { t as tr } from './core/i18n.js';
import { buildStudy } from './render/study.js';
import { buildTown } from './render/town.js';
import { buildStation, buildCarriage, buildCoast, buildCottage } from './render/scenes.js';
import { makeCast, makeTheo, animate, setExpression, showProp } from './render/people.js';
import * as A from './render/audio.js';

// Automated runs only (tools/v5-shell-run.mjs, e2e/v5.spec.js): a harness that defines window.__V5_TEST__ before this
// module loads may replace the input of each frame and receives the game's events. When it is absent (every real
// session) nothing changes.
const testHook = (typeof window !== 'undefined' && window.__V5_TEST__) || null;
const SAVE_KEY = 'v5.save.v1', PREF_KEY = 'v5.prefs.v1', KEYS_KEY = 'v5.keys.v1';
const readJSON = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } };
const mediaReduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const prefs = Object.assign({ lang: (navigator.language || '').startsWith('zh') ? 'zh' : 'en', reduce: false, quality: 'high', subs: 'normal' }, readJSON(PREF_KEY, {}));
const reduce = () => prefs.reduce || mediaReduce;
const T = (k, v) => tr(prefs.lang, k, v);
const DEFAULT_KEYS = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sprint: 'ShiftLeft', use: 'KeyE', tab: 'Tab', hint: 'KeyH', aim: 'KeyQ' };
const keys = Object.assign({}, DEFAULT_KEYS, readJSON(KEYS_KEY, {}));

// ---- DOM ------------------------------------------------------------------------------------------------------
const app = document.getElementById('app'), stage = document.getElementById('stage');
function el(tag, attrs, kids) { const n = document.createElement(tag); Object.entries(attrs || {}).forEach(([k, v]) => { if (v === null || v === undefined) { return; } if (k === 'text') { n.textContent = v; } else if (k === 'class') { n.className = v; } else if (k.startsWith('on')) { n.addEventListener(k.slice(2), v); } else { n.setAttribute(k, v); } }); (kids || []).forEach((c) => c && n.appendChild(c)); return n; }
const ui = {
  chapter: el('div', { class: 'chapter', 'data-testid': 'chapter' }), era: el('button', { class: 'era', type: 'button', 'data-testid': 'era', hidden: '' }),
  prompt: el('div', { class: 'prompt', 'data-testid': 'prompt', hidden: '' }), subs: el('div', { class: 'subs', 'data-testid': 'subs' }), choice: el('div', { class: 'choices', 'data-testid': 'choices', hidden: '' }),
  banner: el('div', { class: 'banner', 'data-testid': 'banner' }), tip: el('div', { class: 'tip', 'data-testid': 'tip' }), fade: el('div', { class: 'fade' }), aim: el('div', { class: 'aimframe', hidden: '' }),
  meter: el('div', { class: 'meter', hidden: '', 'data-testid': 'meter' }), paper: el('canvas', { class: 'paper', width: '520', height: '360', hidden: '', 'data-testid': 'paper' }), reticle: el('div', { class: 'reticle', hidden: '' }), act: el('div', { class: 'act', 'data-testid': 'act' }),
  panel: el('div', { class: 'panel', hidden: '', role: 'dialog', 'data-testid': 'panel' }), overlay: el('div', { class: 'overlay', hidden: '' }), saved: el('div', { class: 'saved' }), source: el('button', { class: 'source', type: 'button', hidden: '', 'data-testid': 'source' })
};
ui.subs.append(el('div', { class: 'who' }), el('div', { class: 'line' }), el('div', { class: 'next' }));
ui.meter.append(el('div', { class: 'dial' }, [el('span', { class: 'mid' }), el('span', { class: 'needle' })]), el('div', { class: 'strings' }));
Object.values(ui).forEach((n) => app.appendChild(n));

// ---- renderer --------------------------------------------------------------------------------------------------
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ antialias: prefs.quality !== 'low', powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
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
const cam = { yaw: 0, pitch: 0.38, dist: 4.5, pos: new THREE.Vector3(), look: new THREE.Vector3(), shotT: 0 };
const rt = { t: 0, frames: 0, fps: 60, lastSave: 0, chapterShown: 0, lastBeat: null, lastDialogLine: null, subs: null, sourceProv: null, holdKey: false, events: [], log: [] };

function getWorld(id) {
  if (worlds[id]) { return worlds[id]; }
  const lowShadow = prefs.quality === 'low' ? 512 : prefs.quality === 'medium' ? 1024 : 1536;
  const w = id === 'study' ? buildStudy({ shadow: lowShadow }) : id === 'town' ? buildTown({ shadow: lowShadow, low: prefs.quality === 'low' }) : id === 'station' ? buildStation({ shadow: lowShadow }) : id === 'train' ? buildCarriage({ shadow: lowShadow }) : id === 'cottage' ? buildCottage({ shadow: lowShadow }) : buildCoast({ shadow: lowShadow });
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
  if (id === 'town' && w.theo) { w.theo.visible = false; }   // the town module's own Theo; the shell draws its own
  dressWorld(s);
  A.setAmbience({ study: 'room', town: s.season === 'winter' ? 'winter' : 'sea', station: 'sea', train: 'train', coast: 'wind', cottage: 'room' }[id]);
  A.setTheme(themeFor(s));
}
function themeFor(s) {
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
  if (worldId === 'study') { w.setLamp(!g.s.flags.lampOff); if (s.beat === '1.study' || s.beat === '7.study') { w.setCrt(s.beat === '7.study' || g.s.seen.includes('c1.computer'), s.beat === '7.study' ? ['drafts/', ' june-7.txt  (not sent)', ' june-6.txt  (not sent)', ' ...'] : null); } }
  if (worldId === 'station') { w.setTime(s.beat === '1.chase' ? 'morning' : s.beat === '5.depart' ? 'dusk' : 'y2004'); }
  if (worldId === 'cottage') { w.setEra(s.year || 1998); }
  if (worldId === 'coast') {
    w.setTime(s.beat === '4.porch' ? 'night' : s.beat === '6.beach' ? 'y2004' : 'noon', s.beat === '6.beach' ? 2004 : 1998);
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
const isTyping = (e) => e.target && e.target.tagName === 'INPUT';
let rebinding = null;
window.addEventListener('keydown', (e) => {
  if (isTyping(e)) { return; }
  A.unlock();
  if (rebinding) { e.preventDefault(); keys[rebinding] = e.code; write(KEYS_KEY, keys); rebinding = null; renderSettings(); return; }
  if (e.code === 'Escape') { e.preventDefault(); onEscape(); return; }
  if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) { if (mode === 'play') { e.preventDefault(); } }
  if (!down.has(e.code)) { pressed.add(e.code); } down.add(e.code);
  if (mode === 'play' && g && Gm.snapshot(g).choice) { if (e.code === 'Digit1') { rt.choose = 0; } if (e.code === 'Digit2') { rt.choose = 1; } if (e.code === 'Digit3') { rt.choose = 2; } }
});
window.addEventListener('keyup', (e) => { down.delete(e.code); });
window.addEventListener('blur', () => { down.clear(); mouse.left = mouse.right = false; });
const cv = renderer.domElement;
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('mousedown', (e) => {
  A.unlock(); if (mode !== 'play') { return; }
  if (!locked && cv.requestPointerLock && !reduceLockPref()) { try { cv.requestPointerLock(); } catch (err) { /* refused */ } }
  if (e.button === 0) { mouse.left = true; mouse.click = true; } if (e.button === 2) { mouse.right = true; }
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) { mouse.left = false; } if (e.button === 2) { mouse.right = false; } });
window.addEventListener('mousemove', (e) => { if (mode !== 'play') { return; } if (locked || mouse.left || mouse.right) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; } });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === cv; });
const reduceLockPref = () => !!prefs.noLock;
// touch: left half moves, right half looks, double tap acts
const touch = { move: null, look: null };
cv.addEventListener('touchstart', (e) => { A.unlock(); for (const tp of e.changedTouches) { if (tp.clientX < window.innerWidth / 2 && !touch.move) { touch.move = { id: tp.identifier, x0: tp.clientX, y0: tp.clientY, x: tp.clientX, y: tp.clientY }; } else if (!touch.look) { touch.look = { id: tp.identifier, x: tp.clientX, y: tp.clientY, t: performance.now() }; } } }, { passive: true });
cv.addEventListener('touchmove', (e) => { for (const tp of e.changedTouches) { if (touch.move && tp.identifier === touch.move.id) { touch.move.x = tp.clientX; touch.move.y = tp.clientY; } if (touch.look && tp.identifier === touch.look.id) { mouse.dx += (tp.clientX - touch.look.x) * 1.4; mouse.dy += (tp.clientY - touch.look.y) * 1.4; touch.look.x = tp.clientX; touch.look.y = tp.clientY; } } }, { passive: true });
cv.addEventListener('touchend', (e) => { for (const tp of e.changedTouches) { if (touch.move && tp.identifier === touch.move.id) { touch.move = null; } if (touch.look && tp.identifier === touch.look.id) { if (performance.now() - touch.look.t < 220) { mouse.click = true; } touch.look = null; } } });
function gamepad() { const pads = navigator.getGamepads ? navigator.getGamepads() : []; return [...pads].find((p) => p && p.connected) || null; }
const padPrev = {};
function collectInput(dt) {
  const s = Gm.snapshot(g); const k = (a) => down.has(keys[a]), p = (a) => pressed.has(keys[a]);
  let mx = (k('right') || down.has('ArrowRight') ? 1 : 0) - (k('left') || down.has('ArrowLeft') ? 1 : 0), mz = (k('forward') || down.has('ArrowUp') ? 1 : 0) - (k('back') || down.has('ArrowDown') ? 1 : 0);
  if (touch.move) { mx += Math.max(-1, Math.min(1, (touch.move.x - touch.move.x0) / 60)); mz += Math.max(-1, Math.min(1, -(touch.move.y - touch.move.y0) / 60)); }
  const gp = gamepad(); const btn = (i) => !!(gp && gp.buttons[i] && gp.buttons[i].pressed); const edge = (i) => { const v = btn(i), was = padPrev[i]; padPrev[i] = v; return v && !was; };
  if (gp) { const ax = (i) => (Math.abs(gp.axes[i] || 0) > 0.18 ? gp.axes[i] : 0); mx += ax(0); mz -= ax(1); mouse.dx += ax(2) * 900 * dt; mouse.dy += ax(3) * 600 * dt; }
  const advanceNow = p('use') || pressed.has('Space') || pressed.has('Enter') || mouse.click || (gp && (edge(0) || edge(2)));
  const input = {
    mx: Math.max(-1, Math.min(1, mx)), mz: Math.max(-1, Math.min(1, mz)), yaw: cam.yaw,
    jump: p('jump') || (gp && btn(0) && !s.dialog && padPrev.j !== true), jumpHeld: k('jump') || btn(0), sprint: k('sprint') || down.has('ShiftRight') || btn(10) || btn(5),
    use: p('use') || (mouse.click && !s.aim && s.scene !== 'train') || (gp && btn(2) && !padPrev.u), useHeld: k('use') || btn(2) || (mouse.left && !!(s.prompt && s.prompt.hold)),
    tab: p('tab') || (gp && edge(3)), hint: p('hint'),
    aim: mouse.right || k('aim') || btn(6), shoot: (mouse.click && (mouse.right || k('aim') || btn(6))) || (p('use') && (mouse.right || k('aim'))) || (gp && btn(7) && !padPrev.s),
    aimDX: mouse.dx, aimDY: mouse.dy, advance: !!(s.dialog && advanceNow), skip: !!(rt.skip && s.dialog && s.dialog.seen), choose: rt.choose
  };
  if (gp) { padPrev.j = btn(0); padPrev.u = btn(2); padPrev.s = btn(7); if (edge(9)) { onEscape(); } if (edge(1) && s.dialog && s.dialog.seen) { input.skip = true; } }
  // the camera follows the mouse unless the camera is in someone's hands
  if (s.scene !== 'train' && !s.shot) { cam.yaw -= mouse.dx * 0.0028; cam.pitch = Math.max(0.05, Math.min(1.0, cam.pitch + mouse.dy * 0.0022)); }
  rt.skip = false; rt.choose = null; mouse.dx = 0; mouse.dy = 0; mouse.click = false; pressed.clear();
  return input;
}

// ---- events from the game -----------------------------------------------------------------------------------
function handle(ev) {
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
    case 'duet-start': break;
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
  if (ev.chapter !== rt.lastChapter) { rt.lastChapter = ev.chapter; showChapter(ev.chapter); }
  if (ev.beat === '1.town') { tip(T('ui.next'), 0); }
}

// ---- camera director ------------------------------------------------------------------------------------------
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(); const ray = new THREE.Raycaster();
function headOf(p) { return p ? new THREE.Vector3(p.position.x, (p.position.y || 0) + 1.55, p.position.z) : null; }
function closeUp(p, facing, side, dist) { const h = headOf(p); const f = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing)); const r = new THREE.Vector3(Math.cos(facing), 0, -Math.sin(facing)); return { pos: h.clone().addScaledVector(f, dist || 1.5).addScaledVector(r, side || 0.35).add(new THREE.Vector3(0, -0.05, 0)), look: h.clone() }; }
function shotFor(name, s) {
  const me = person(avatarId()), jn = s.june ? person(juneId()) : null, th = s.theo ? person('theo') : null;
  const facingTo = (a, b) => Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z);
  switch (name) {
    case 'june': if (jn) { return closeUp(jn, facingTo(jn, me), 0.3, 1.45); } break;
    case 'elena': case 'mara': return closeUp(me, jn ? facingTo(me, jn) : (th ? facingTo(me, th) : me.rotation.y), -0.3, 1.45);
    case 'theo': if (th) { return closeUp(th, facingTo(th, me), 0.4, 1.8); } break;
    case 'hands': if (jn) { const mid = me.position.clone().lerp(jn.position, 0.5); return { pos: mid.clone().add(new THREE.Vector3(-1.2, 1.3, -2.4)), look: mid.clone().add(new THREE.Vector3(0, 1.2, 0)) }; } break;
    case 'twoshot': case 'window': if (jn) { const mid = me.position.clone().lerp(jn.position, 0.5); const d = jn.position.clone().sub(me.position); const n = new THREE.Vector3(-d.z, 0, d.x).normalize(); return { pos: mid.clone().addScaledVector(n, Math.max(2.2, d.length() * 1.3)).add(new THREE.Vector3(0, 1.45, 0)), look: mid.clone().add(new THREE.Vector3(0, 1.25, 0)) }; } break;
    case 'beam': return { pos: new THREE.Vector3(254, 3.5, 12), look: new THREE.Vector3(264, 7.5, 28) };
    case 'bench': return { pos: new THREE.Vector3(-6.5, 1.8, 1.8), look: new THREE.Vector3(-1.0, 0.9, -1.8) };
    case 'beamctl': return { pos: new THREE.Vector3(256.5, 10.5, 15.5), look: new THREE.Vector3(278, -1, 31) };
    case 'town-beam': return { pos: new THREE.Vector3(22.5, 9.5, 12.0), look: new THREE.Vector3(3, 0.5, 24) };
    case 'paper': return { pos: new THREE.Vector3(1.3, 2.05, 1.05), look: new THREE.Vector3(1.3, 0.75, 0.05) };
    case 'platform': return { pos: new THREE.Vector3(-6.2, 1.6, 0.4), look: new THREE.Vector3(-2.2, 1.2, 1.6) };
    case 'town-wide': return { pos: new THREE.Vector3(-14, 11, -16), look: new THREE.Vector3(4, 2, 8) };
    case 'duet': if (jn) { const mid = me.position.clone().lerp(jn.position, 0.5); return { pos: mid.clone().add(new THREE.Vector3(1.6, 1.25, 1.8)), look: mid.clone().add(new THREE.Vector3(0, 0.9, 0)) }; } break;
    default: break;
  }
  return null;
}
function updateCamera(snap) {
  const s = Gm.snapshot(g); const me = person(avatarId());
  let want = null;
  if (s.scene === 'train') {
    const seat = LAYOUTS.train.seat;
    if (s.aim) { const yaw = g.rt.aimYaw, pitch = g.rt.aimPitch; camera.fov += (40 - camera.fov) * 0.3; const pos = new THREE.Vector3(seat.x, seat.y, seat.z); const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)); want = { pos, look: pos.clone().add(dir) }; }
    else { camera.fov += (55 - camera.fov) * 0.2; want = shotFor(s.shot, s) || { pos: new THREE.Vector3(seat.x - 0.35, 1.55, seat.z + 1.35), look: new THREE.Vector3(0.45, 1.05, -0.7) }; }
  } else if (s.scene === 'porch') {
    const seat = LAYOUTS.porch.seat; camera.fov += (50 - camera.fov) * 0.2;
    if (s.shot === 'june' || s.shot === 'twoshot') { const jn = person(juneId()); const h = new THREE.Vector3(jn.position.x, jn.position.y + 1.2, jn.position.z); want = { pos: new THREE.Vector3(seat.x - 0.3, seat.y + 0.05, seat.z - 0.9), look: h }; }
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
    me.visible = false;
  } else {
    me.position.set(b.x, b.y, b.z); me.rotation.set(0, b.facing, 0);
    // in conversation she turns to whoever she is talking to, so close-ups see faces, not the back of a head
    if (s.dialog && !s.seated) {
      const other = s.june && g.rt.june && Math.hypot(g.rt.june.x - b.x, g.rt.june.z - b.z) < 5 ? g.rt.june : (s.theo && worldId === 'town' && Math.hypot(s.theo.x - b.x, s.theo.z - b.z) < 5 ? s.theo : null);
      if (other) { me.rotation.y = Math.atan2(other.x - b.x, other.z - b.z); }
    }
    const mode = s.seated ? (s.beat === '4.duet' ? 'guitar' : 'sit') : (b.gliding ? 'pose' : (!b.grounded ? 'run' : (s.carry ? 'hold' : 'walk')));
    animate(me, rt.t, (me.userData.phase = (me.userData.phase || 0) + Math.hypot(b.vx, b.vz) * dt * 4.2), s.seated ? 0 : Math.hypot(b.vx, b.vz), s.duet ? 'guitar' : mode, reduce());
    showProp(me, 'window', s.carry === 'window'); showProp(me, 'guitar', (s.beat === '4.duet' && (s.seated || !!s.duet)) || !!s.tuning); showProp(me, 'camera', false);
    showProp(me, 'suitcase', s.carry === 'suitcase'); showProp(me, 'box', !!(s.carry && s.carry.startsWith('box')));
    if (s.carry && s.carry.startsWith('box') && !s.seated) { animate(me, rt.t, me.userData.phase || 0, Math.hypot(b.vx, b.vz), 'carry', reduce()); }
    if (s.tuning) { me.position.set(LAYOUTS.cottage.guitarSeat.x, 0.1, LAYOUTS.cottage.guitarSeat.z); me.rotation.y = 0.5; animate(me, rt.t, 0, 0, 'guitar', reduce()); }
    if (s.beat === '4.duet' && s.seated) { me.position.set(LAYOUTS.cottage.guitarSeat.x, 0.1, LAYOUTS.cottage.guitarSeat.z); me.rotation.y = 0.5; }
  }
  if (s.june && s.scene !== 'ride') {
    const jn = person(juneId()); const j = g.rt.june;
    if (s.scene === 'porch') { const pj = LAYOUTS.porch.june; jn.position.set(pj.x, -4.95, pj.z); jn.rotation.y = Math.PI; }
    else if (s.scene === 'train') { const js = LAYOUTS.train.june; jn.position.set(js.x, 0.05, js.z); jn.rotation.y = s.dialog || s.june.anim === 'camera' || s.june.anim === 'pose' || s.june.anim === 'hideface' ? 0 : (Toys.juneMoodAt(g.rt.photoT || 0) === 'window' ? Math.PI / 2 : 0); }
    else { jn.position.set(j.x, j.y || 0, j.z); jn.rotation.y = j.facing; }
    const m = s.scene === 'porch' ? (s.dialog && Array.isArray(s.dialog.line) && s.dialog.line[0] === 'june' ? 'hum' : 'sit') : s.scene === 'train' ? (['camera', 'pose', 'hideface', 'sleep', 'sketch'].includes(s.june.anim) ? s.june.anim : (Toys.juneMoodAt(g.rt.photoT || 0) === 'tease' ? 'camera' : 'sit')) : s.june.anim;
    animate(jn, rt.t, j.phase || 0, j.speed || 0, m, reduce()); setExpression(jn, s.june.expr);
    showProp(jn, 'camera', m === 'camera'); showProp(jn, 'suitcase', s.beat === '5.depart' && !!g.rt.boarding); showProp(jn, 'sketch', m === 'sketch'); showProp(jn, 'box', !!g.rt.juneCarry && s.june.state === 'TRANSITION');
    if (s.scene === 'train' && (m === 'sit' || m === 'camera')) { jn.position.y = 0.05; }
  }
  if (s.theo && worldId === 'town') { const th = person('theo'); th.position.set(s.theo.x, 0, s.theo.z); th.rotation.y = g.rt.theo.facing; animate(th, rt.t, g.rt.theo.phase || 0, g.rt.theo.speed || 0, s.dialog && s.dialog.line && s.dialog.line[0] === 'theo' ? 'talk' : (s.theo.state === 'INVITE' && !g.s.seen.includes('c1.theo1') ? 'wave' : 'idle'), reduce()); }
  if (worldId === 'town' && g.rt.iris && world.iris) {
    const ir = g.rt.iris; world.iris.visible = !ir.gone && !ir.boarded; world.iris.position.set(ir.x, 0, ir.z); if (ir.facing !== undefined) { world.iris.rotation.y = ir.facing; }
    animate(world.iris, rt.t, rt.t * 3, ir.walking ? 1.4 : 0, ir.walking ? 'walk' : (s.era === 2004 && !ir.leaving ? 'hold' : 'idle'), reduce());
    if (ir.boarded) { world.canalBoat.position.x = -5.8 + ir.boatX; }
  }
  // eyes: whoever is speaking is looked at; otherwise June watches Elena when she is close, and Elena watches June
  {
    const head = (p) => (p && p.visible ? new THREE.Vector3(p.position.x, p.position.y + 1.55, p.position.z) : null);
    const jn = s.june ? person(juneId()) : null, th = s.theo && worldId === 'town' ? person('theo') : null;
    const speaker = s.dialog && Array.isArray(s.dialog.line) ? s.dialog.line[0] : null;
    const near = (a, b) => a && b && a.position.distanceTo(b.position) < 6;
    me.userData.lookAt = speaker === 'june' && near(me, jn) ? head(jn) : speaker === 'theo' && near(me, th) ? head(th) : (near(me, jn) ? head(jn) : (near(me, th) ? head(th) : null));
    if (jn) { jn.userData.lookAt = near(jn, me) && s.scene !== 'ride' ? head(me) : null; }
    if (th) { th.userData.lookAt = near(th, me) ? head(me) : null; }
  }
  if (worldId === 'station' && g.rt.train) { world.setTrain(g.rt.train.x, !g.rt.train.gone && (s.beat !== '5.alone' || g.rt.train.moving)); }
  if (worldId === 'station') { world.setSuitcase(s.beat !== '5.depart' ? 'none' : s.carry === 'suitcase' ? 'carried' : (g.s.flags.suitcase ? (g.rt.boarding ? 'none' : 'door') : 'bench')); }
  if (worldId === 'train') { world.setOutside(g.rt.photoT || 0); }
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
function renderHud() {
  const s = Gm.snapshot(g);
  // prompt near the thing you can use: a key glyph, the verb, the name. Nothing else on screen.
  const pr = s.prompt; const cine = !!s.dialog || !!s.shot || s.choice;
  app.classList.toggle('cine', cine);
  if (pr && !cine && mode === 'play') {
    const key = keyLabel(keys.use);
    const sig = pr.id + pr.verb + prefs.lang + (pr.hold ? 'h' : '');
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
  if (s.scene === 'train' && !s.aim && !cine && mode === 'play' && !g.s.flags.juneSnap) { if (!ui.tip.classList.contains('on')) { tip(T('ui.aimHint'), 0.1); ui.tip.classList.add('on'); } } else if (s.scene === 'train' && (cine || s.aim)) { ui.tip.classList.remove('on'); }
  if (s.duet && s.duet.cueIn !== null && s.duet.cueIn !== undefined) { app.classList.toggle('cue', Math.abs(s.duet.cueIn) < 0.45); } else { app.classList.remove('cue'); }
  // activity overlays: only while the activity runs
  ui.meter.hidden = !(s.tuning && !s.dialog);
  if (s.tuning) { ui.meter.querySelector('.needle').style.left = (50 + s.tuning.needle * 46) + '%'; ui.meter.querySelector('.mid').classList.toggle('in', Math.abs(s.tuning.needle) < 0.2); ui.meter.querySelector('.strings').textContent = ['E', 'A', 'D'].map((n, i) => (i < s.tuning.string ? n + '✓' : n)).join('  '); }
  ui.paper.hidden = !s.pen; if (s.pen) { drawPaper(s.pen); }
  ui.reticle.hidden = !(s.scene === 'porch' && !s.dialog); ui.reticle.classList.toggle('on', !!(s.stars && s.stars.onStar));
  const act = s.dialog || s.choice ? '' : s.tuning ? T('ui.tune') : s.pen ? T('ui.pen') : s.sketch ? T('ui.sketch') : (s.scene === 'porch' && s.stars && s.stars.i < 5) ? T('ui.stars') : (s.beam && s.beam.ready && !s.beam.done) ? T('ui.beam') : (s.scene === 'ride' && s.ride && s.ride.s < 40) ? T('ui.ride') : '';
  if (ui.act.textContent !== act) { ui.act.textContent = act; ui.act.classList.toggle('on', !!act); }
}
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
  const seat = LAYOUTS.train.seat, js = LAYOUTS.train.june; const c2 = camera.clone(); c2.fov = 42; c2.position.set(js.x, 1.15, js.z + 0.1); c2.lookAt(seat.x, 1.1, seat.z); c2.updateProjectionMatrix();
  const me = person(avatarId()); const vis = me.visible; me.visible = true; setExpression(me, 'surprise'); renderer.render(world.scene, c2); me.visible = vis; const thumb = thumbFromCanvas(); setExpression(me, 'neutral');
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
  mode = 'credits'; A.setTheme('ending'); save(true);
  ui.overlay.className = 'overlay credits'; ui.overlay.hidden = false; ui.overlay.textContent = '';
  const album = el('div', { class: 'album', 'data-testid': 'album' });
  g.s.photos.forEach((p) => { const fig = el('figure', {}, [p.thumb ? el('img', { src: p.thumb, alt: '' }) : el('div', { class: 'noimg' }), el('figcaption', { text: p.by === 'june' ? T('c2.back.june') : T('c2.react.' + p.reaction) })]); album.append(fig); });
  const sg = Ar.sceneGraph(ar, 2004, g.s.restored, g.s.edition);
  ui.overlay.append(el('div', { class: 'roll', 'data-testid': 'credits' }, [
    el('div', { class: 'end', text: T('ui.end') }), el('div', { class: 'h', text: T('end.roles') }), el('div', { class: 'role', text: T('end.elena') }), el('div', { class: 'role', text: T('end.june') }),
    el('div', { class: 'small', text: Ar.creditLine(sg.credits.slice(0, 2)).join('   ·   ') + '   (' + T('status.RESTORED') + ')' }), el('div', { class: 'mara', text: T('end.mara') }), el('div', { class: 'small', text: T('status.CREATED') }),
    el('div', { class: 'h2', text: T('ui.album') }), album, el('p', { class: 'unsent', text: T('end.unsent') }), el('p', { class: 'small', text: T('end.fiction') }), el('p', { class: 'small', text: T('end.poem') }),
    el('div', { class: 'row' }, [el('button', { type: 'button', class: 'btn primary', text: T('ui.keepExploring'), 'data-testid': 'keep-exploring', onclick: () => { ui.overlay.hidden = true; mode = 'play'; } }), el('button', { type: 'button', class: 'btn', text: T('ui.backTitle'), onclick: () => { ui.overlay.hidden = true; showTitle(); } })])
  ]));
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
function closePanel() { ui.panel.hidden = true; mode = 'play'; }

// ---- menus ----------------------------------------------------------------------------------------------------
function onEscape() {
  if (mode === 'panel') { closePanel(); return; }
  if (mode === 'pause') { closePanel(); return; }
  if (mode !== 'play' || !g) { return; }
  const s = Gm.snapshot(g); if (s.dialog && s.dialog.seen) { rt.skip = true; return; }
  if (document.pointerLockElement) { document.exitPointerLock(); }
  openPause();
}
function openPause() {
  mode = 'pause'; ui.panel.hidden = false; ui.panel.textContent = ''; down.clear();
  const b = (text, id, fn) => el('button', { type: 'button', class: 'mbtn', text, 'data-testid': id, onclick: fn });
  ui.panel.append(el('h2', { text: T('ui.pause') }), el('div', { class: 'menu' }, [b(T('ui.resume'), 'resume', closePanel), b(T('ui.settings'), 'settings', renderSettings), b(T('ui.safe'), 'safe-spot', safeSpot), b(T('ui.backTitle'), 'back-title', () => { save(true); closePanel(); showTitle(); })]));
}
function renderSettings() {
  mode = 'pause'; ui.panel.hidden = false; ui.panel.textContent = '';
  const ap = A.getPrefs(); const row = (label, kids) => el('div', { class: 'srow' }, [el('span', { class: 'sl', text: label }), el('span', { class: 'sv' }, kids)]);
  const btn = (text, id, fn) => el('button', { type: 'button', class: 'sbtn', text, 'data-testid': id, onclick: fn });
  const range = (v, id, fn) => el('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(v * 100)), 'data-testid': id, oninput: (e) => fn(e.target.value / 100) });
  const setP = (k, v) => { prefs[k] = v; write(PREF_KEY, prefs); renderSettings(); };
  const kb = el('div', { class: 'keys' }); ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'use', 'tab', 'aim', 'hint'].forEach((a) => kb.append(el('button', { type: 'button', class: 'kbtn', 'data-testid': 'key-' + a, text: `${a}: ${rebinding === a ? T('ui.rebind') : keyLabel(keys[a])}`, onclick: () => { rebinding = a; renderSettings(); } })));
  ui.panel.append(el('h2', { text: T('ui.settings') }),
    row(T('ui.sound'), [btn(ap.muted ? T('ui.off') : T('ui.on'), 'sound', () => { A.setPref('muted', !ap.muted); renderSettings(); })]),
    row(T('ui.music'), [range(ap.music, 'music', (v) => A.setPref('music', v))]), row(T('ui.sfx'), [range(ap.sfx, 'sfx', (v) => A.setPref('sfx', v))]),
    row(T('ui.quality'), ['low', 'medium', 'high'].map((q) => btn(T('ui.q.' + q) + (prefs.quality === q ? ' ✓' : ''), 'q-' + q, () => { prefs.quality = q; write(PREF_KEY, prefs); resize(); renderer.shadowMap.enabled = q !== 'low'; renderSettings(); }))),
    row(T('ui.motion'), [btn(prefs.reduce ? T('ui.motionReduced') : T('ui.motionFull'), 'motion', () => setP('reduce', !prefs.reduce))]),
    row(T('ui.subs'), [btn(prefs.subs === 'large' ? T('ui.subsLarge') : T('ui.subsNormal'), 'subs', () => setP('subs', prefs.subs === 'large' ? 'normal' : 'large'))]),
    row(T('ui.language'), [btn(T('ui.lang'), 'lang', () => { setP('lang', prefs.lang === 'zh' ? 'en' : 'zh'); applyLang(); })]),
    row(T('ui.keys'), [kb, btn(T('ui.resetKeys'), 'reset-keys', () => { Object.assign(keys, DEFAULT_KEYS); write(KEYS_KEY, keys); renderSettings(); })]),
    el('button', { type: 'button', class: 'btn', text: T('ui.resume'), 'data-testid': 'resume', onclick: closePanel }));
}
function safeSpot() { const lay = LAYOUTS[sceneWorldId(Gm.snapshot(g).scene)]; if (lay && g.rt.body && lay.spawn) { const sp = lay.spawn; Object.assign(g.rt.body, { x: sp.x, z: sp.z, y: 0, vx: 0, vz: 0, vy: 0, grounded: true }); } closePanel(); }
function applyLang() { document.documentElement.lang = prefs.lang === 'zh' ? 'zh-CN' : 'en'; document.title = T('ui.title') + ' — ' + T('ui.subtitle'); ui.subs.removeAttribute('data-sig'); ui.prompt.removeAttribute('data-sig'); ui.choice.removeAttribute('data-sig'); }

// ---- title -----------------------------------------------------------------------------------------------------
function readSave() { const raw = readJSON(SAVE_KEY, null); return raw ? Gm.parseSave(raw, ar) : null; }
function save(show) { if (!g || mode === 'title' || mode === 'loading') { return; } write(SAVE_KEY, Gm.serialize(g)); rt.lastSave = rt.t; if (show) { ui.saved.textContent = T('ui.saved'); ui.saved.classList.add('on'); setTimeout(() => ui.saved.classList.remove('on'), 1200); } }
function showTitle() {
  mode = 'title'; applyLang();
  if (!g) { g = Gm.createGame(ar); }
  if (!world) { stageWorld(); }
  const saved = readSave();
  ui.overlay.className = 'overlay title'; ui.overlay.hidden = false; ui.overlay.textContent = '';
  const row = el('div', { class: 'row' });
  if (saved) { row.append(el('button', { class: 'btn primary', type: 'button', text: T('ui.continue'), 'data-testid': 'continue', onclick: () => begin(saved) }), el('button', { class: 'btn', type: 'button', text: T('ui.newGame'), 'data-testid': 'new-game', onclick: () => { if (window.confirm(T('ui.confirmNew'))) { begin(null); } } })); }
  else { row.append(el('button', { class: 'btn primary', type: 'button', text: T('ui.start'), 'data-testid': 'start', onclick: () => begin(null) })); }
  ui.overlay.append(el('div', { class: 'titlebox', 'data-testid': 'title' }, [el('h1', { text: T('ui.title') }), el('div', { class: 'sub', text: T('ui.subtitle') }), el('div', { class: 'tag', text: T('ui.tagline') }), row, el('div', { class: 'note', text: T('ui.saveNote') }), el('div', { class: 'note', text: T('ui.fixture') })]),
    el('button', { class: 'btn ghost langbtn', type: 'button', text: T('ui.lang'), 'data-testid': 'lang', onclick: () => { prefs.lang = prefs.lang === 'zh' ? 'en' : 'zh'; write(PREF_KEY, prefs); showTitle(); } }));
}
function begin(saved) {
  A.unlock(); ui.overlay.hidden = true;
  if (!saved) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
  g = Gm.createGame(ar, saved || null); Object.values(worlds).forEach((w) => { void w; });
  worldId = null; rt.lastChapter = null; mode = 'play'; if (testHook) { testHook.game = g; }
  const tune = Ar.sceneGraph(ar, 1998).objects.find((o) => o.id === 'tune'); if (tune && tune.data) { A.setTune(tune.data); }
  onBeat({ beat: g.s.beat, chapter: Gm.chapterOf(g.s.beat), scene: g.rt.scene }); save(false);
}

// ---- the loop ---------------------------------------------------------------------------------------------------
let last = 0, fpsAcc = 0, fpsN = 0, slowSecs = 0;
function frame(now) {
  try { tick(now); } catch (e) { if ((frame.errs = (frame.errs || 0) + 1) < 4) { console.error('V5 frame error', e && e.stack ? e.stack : e); } }
  requestAnimationFrame(frame);
}
function tick(now) {
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016; last = now; rt.t += dt; rt.frames += 1;
  fpsAcc += dt; fpsN += 1; if (fpsAcc > 1) { rt.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; if (rt.fps < 24 && !autoDrop) { slowSecs += 1; if (slowSecs > 3) { autoDrop = 1; resize(); } } else { slowSecs = 0; } }
  if (!g || !world) { return; }
  if (mode === 'play') {
    let input = collectInput(dt); if (rt.forceTab) { input.tab = true; rt.forceTab = false; }
    if (testHook && testHook.input) { input = testHook.input(input) || input; }
    const evs = Gm.tick(g, dt, input); evs.forEach(handle); if (testHook && testHook.events) { testHook.events(evs); }
  } else { pressed.clear(); mouse.dx = mouse.dy = 0; mouse.click = false; }
  syncCast(dt);
  world.update(dt, rt.t, reduce());
  updateCamera(false);
  renderHud();
  if (mode === 'play' && rt.t - rt.lastSave > 5) { save(false); }
  renderer.render(world.scene, camera);
  if (rt.pendingShot && (rt.pendingT = (rt.pendingT || 0) + 1) > 6) { const id = rt.pendingShot; rt.pendingShot = null; rt.pendingT = 0; setThumb(id, thumbFromCanvas()); fadeBlinkWhite(); }
}

// Read-only view for automated browser tests. It cannot change anything.
window.V5Debug = { snapshot() { const s = g ? Gm.snapshot(g) : null; return Object.assign({ mode, fps: rt.fps, frames: rt.frames, world: worldId, heard: A.heardList(), audio: A.level ? A.level() : null, log: rt.log.slice(-30), locked, lang: prefs.lang, photos: g ? g.s.photos.map((p) => ({ id: p.id, reaction: p.reaction, thumb: !!p.thumb })) : [] }, s || {}); } };

// ---- start ------------------------------------------------------------------------------------------------------
async function loadArchive() {
  const files = Object.assign({}, Object.fromEntries(Ar.SOURCES.map((s) => [s.id, s.file])), Ar.EXTRA_FILES);
  const texts = {}; await Promise.all(Object.entries(files).map(async ([id, f]) => { const r = await fetch('/v5/data/' + f); if (!r.ok) { throw new Error(f + ' ' + r.status); } texts[id] = await r.text(); }));
  ar = Ar.createArchive(texts);
}
ui.overlay.className = 'overlay title'; ui.overlay.hidden = false; ui.overlay.append(el('p', { class: 'loading', text: T('ui.loading') }));
requestAnimationFrame(frame);
loadArchive().then(() => { showTitle(); }).catch((e) => { ui.overlay.textContent = ''; ui.overlay.append(el('p', { class: 'err', text: T('ui.loadError'), 'data-testid': 'load-error' })); console.error(e); });
