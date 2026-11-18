// P4 browser shell: renderer, third-person controller, camera, input, HUD, dialogue, scene changes, saving.
// The rules live in story.js, the layout in levels.js, the worlds in world-*.js.
import { THREE } from './kit.js';
import * as Lv from './levels.js';
import * as St from './story.js';
import { t as tr } from './i18n.js';
import { makeMara, animate } from './people.js';
import { buildStudy } from './world-study.js';
import { buildArchive } from './world-archive.js';
import { buildTown } from './world-town.js';
import * as A from './audio.js';

const SAVE_KEY = 'p4.save.v1', LANG_KEY = 'p4.lang.v1', MOTION_KEY = 'p4.motion.v1', TUT_KEY = 'p4.tutorial.v1';
const SPAWNS = { study: Lv.SCENES.study.spawn, archive: Lv.SCENES.archive.spawn, town: Lv.SCENES.town.spawn };
const WALK = 2.4, RUN = 4.2;
const mediaReduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0;

const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* blocked */ } };

let lang = read(LANG_KEY) === 'zh' ? 'zh' : 'en';
let userReduce = read(MOTION_KEY) === 'reduce';
const reduce = () => userReduce || mediaReduce;
const T = (k, v) => tr(lang, k, v);

let st = St.newState(SPAWNS);
const rt = {
  mode: 'title', busy: false, worlds: {}, world: null, sceneId: 'study', t: 0, frames: 0, fps: 0,
  player: { x: 0, z: 0, facing: 0, speed: 0, phase: 0, stepAcc: 0 }, act: 0,
  cam: { yaw: 0, pitch: 0.4, dist: 3.3, pos: new THREE.Vector3(), look: new THREE.Vector3() }, focus: null,
  keys: new Set(), drag: null, stick: { x: 0, y: 0, id: null }, near: null, caption: null, dialog: null,
  tut: { stage: read(TUT_KEY) === 'done' ? 9 : 0, moved: 0, looked: 0 }, saveAt: 0, lastSave: 0, talking: false, plazaChecked: false,
  log: []
};

// ---- DOM ------------------------------------------------------------------------------------------------
const app = document.getElementById('app');
const stageEl = document.getElementById('stage');
const scanEl = document.getElementById('scan');
function el(tag, attrs, kids) {
  const n = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => { if (k === 'text') { n.textContent = v; } else if (k === 'class') { n.className = v; } else if (k.startsWith('on')) { n.addEventListener(k.slice(2), v); } else { n.setAttribute(k, v); } });
  (kids || []).forEach((c) => c && n.appendChild(c));
  return n;
}
const ui = {};
ui.top = el('div', { class: 'top' });
ui.objK = el('div', { class: 'k', 'data-testid': 'objective-label' }); ui.objV = el('div', { class: 'v', 'data-testid': 'objective' });
ui.obj = el('div', { class: 'objective', hidden: '' }, [ui.objK, ui.objV]);
ui.sound = el('button', { class: 'btn', type: 'button', 'data-testid': 'sound' });
ui.vol = el('input', { class: 'vol', type: 'range', min: '0', max: '100', step: '5', 'data-testid': 'volume' });
ui.motion = el('button', { class: 'btn', type: 'button', 'data-testid': 'motion' });
ui.lang = el('button', { class: 'btn', type: 'button', 'data-testid': 'lang' });
ui.top.append(ui.obj, el('div', { class: 'settings' }, [ui.sound, ui.vol, ui.motion, ui.lang]));
ui.saved = el('div', { class: 'saved' });
ui.viewing = el('div', { class: 'viewing', hidden: '', 'data-testid': 'viewing' });
ui.viewingText = el('span'); ui.viewingBtn = el('button', { class: 'btn', type: 'button', 'data-testid': 'leave-view' });
ui.viewing.append(ui.viewingText, ui.viewingBtn);
ui.prompt = el('button', { class: 'prompt', type: 'button', hidden: '', 'data-testid': 'prompt' });
ui.caption = el('div', { class: 'caption', 'data-testid': 'caption' }, [el('span', { class: 'who' }), el('span', { class: 'say' })]);
ui.dlgWho = el('div', { class: 'who' }); ui.dlgSay = el('div', { class: 'say', 'data-testid': 'dialog-text' }); ui.dlgHint = el('div', { class: 'hint' });
ui.dialog = el('div', { class: 'dialog', hidden: '', 'data-testid': 'dialog' }, [ui.dlgWho, ui.dlgSay, ui.dlgHint]);
ui.tut = el('div', { class: 'tutorial', 'data-testid': 'tutorial' });
ui.touch = el('div', { class: 'touch', hidden: '' });
ui.stick = el('div', { class: 'stick', 'data-testid': 'stick' }, [el('div', { class: 'nub' })]);
ui.use = el('button', { class: 'use', type: 'button', 'data-testid': 'use', 'aria-label': 'use' }); ui.use.textContent = '\u270B';
ui.touch.append(ui.stick, ui.use);
ui.fade = el('div', { class: 'fade' });
ui.overlay = el('div', { class: 'overlay', hidden: '' });
app.append(ui.top, ui.saved, ui.viewing, ui.prompt, ui.caption, ui.dialog, ui.tut, ui.touch, ui.fade, ui.overlay);

// ---- renderer -------------------------------------------------------------------------------------------
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (e) { renderer = null; }
if (!renderer || !renderer.getContext()) {
  ui.overlay.hidden = false; ui.overlay.textContent = ''; ui.overlay.append(el('p', { class: 'err', text: T('ui.webgl'), 'data-testid': 'webgl-error' }));
  throw new Error('WebGL unavailable');
}
// Adaptive quality: when the frame rate stays low, render fewer pixels and refresh shadows less often.
const QUALITY = [{ ratio: 1.5, shadowEvery: 1 }, { ratio: 1, shadowEvery: 1 }, { ratio: 0.75, shadowEvery: 4 }];
const quality = { level: 0, slow: 0 };
function applyQuality() { const q = QUALITY[quality.level]; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.ratio)); renderer.shadowMap.autoUpdate = q.shadowEvery === 1; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stageEl.appendChild(renderer.domElement);
renderer.domElement.setAttribute('data-testid', 'canvas');
const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 600);
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();

const mara = makeMara();
const raycaster = new THREE.Raycaster();

// ---- worlds ---------------------------------------------------------------------------------------------
function getWorld(id) {
  if (rt.worlds[id]) { return rt.worlds[id]; }
  const low = coarse;
  const w = id === 'study' ? buildStudy({ shadow: low ? 512 : 1024 }) : id === 'archive' ? buildArchive({ levels: Lv, low }) : buildTown({ shadow: low ? 1024 : 1536, low });
  // targeting ring for the objective
  const ring = (() => { const g = new THREE.Group(); const r1 = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.64, 40), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); r1.rotation.x = -Math.PI / 2; r1.position.y = 0.035; const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.58, 2.6, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); col.position.y = 1.3; g.add(r1, col); g.userData.r1 = r1; g.userData.col = col; return g; })();
  w.scene.add(ring); w.ring = ring;
  rt.worlds[id] = w;
  return w;
}
function applyWorldState(id) {
  const w = rt.worlds[id]; if (!w) { return; }
  if (id === 'study') { w.setLamp(st.flags.lamp); if (st.flags.crtOn) { w.setCrt(true); } }
  if (id === 'archive' && st.flags.account) { w.openGate(true); }
  if (id === 'town') { w.setView(null); if (st.flags.restored) { w.setRestored(true, false); } if (st.flags.lit) { w.setLit(true, false); } }
}
function enterScene(id, pos) {
  rt.sceneId = id; st = St.enterScene(st, id);
  const w = getWorld(id); rt.world = w;
  applyWorldState(id);
  if (mara.parent) { mara.parent.remove(mara); }
  w.scene.add(mara);
  const p = pos || st.pos[id];
  const ok = Lv.canStand(id, p.x, p.z);
  const sp = ok ? p : SPAWNS[id];
  rt.player.x = sp.x; rt.player.z = sp.z; rt.player.speed = 0;
  rt.cam.yaw = sp.yaw !== undefined ? sp.yaw : SPAWNS[id].yaw;
  rt.player.facing = rt.cam.yaw + Math.PI;
  const cc = Lv.SCENES[id].camera; rt.cam.dist = cc.dist; rt.cam.pitch = cc.pitch;
  rt.plazaChecked = false; rt.focus = null;
  setCanvasView(null);
  updateCamera(true);
  A.setScene(id);
  renderObjective(false);
}

// ---- saving ---------------------------------------------------------------------------------------------
function persist(show) {
  if (rt.mode === 'title' || rt.mode === 'intro') { return; }
  st.pos[rt.sceneId] = { x: Math.round(rt.player.x * 100) / 100, z: Math.round(rt.player.z * 100) / 100, yaw: Math.round(rt.cam.yaw * 1000) / 1000 };
  write(SAVE_KEY, JSON.stringify(St.serialize(st)));
  rt.lastSave = rt.t;
  if (show) { ui.saved.textContent = T('ui.saved'); ui.saved.classList.add('on'); setTimeout(() => ui.saved.classList.remove('on'), 1200); }
}
function readSave() {
  const raw = read(SAVE_KEY); if (!raw) { return null; }
  try { return St.parse(JSON.parse(raw), SPAWNS); } catch (e) { return null; }
}

// ---- HUD ------------------------------------------------------------------------------------------------
function renderChrome() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.classList.toggle('reduce-motion', reduce());
  document.title = T('ui.title');
  ui.sound.textContent = A.isMuted() ? T('ui.soundOff') : T('ui.soundOn');
  ui.vol.value = String(Math.round(A.getVolume() * 100)); ui.vol.setAttribute('aria-label', T('ui.volume'));
  ui.motion.textContent = userReduce ? T('ui.motionReduced') : T('ui.motionFull');
  ui.lang.textContent = T('ui.lang');
  ui.viewingBtn.textContent = T('ui.returnPresent');
  renderObjective(false); renderTutorial(); renderCaption();
  if (rt.dialog) { renderDialogLine(true); }
  if (st.view) { ui.viewingText.textContent = T('ui.viewing', { name: T(st.view === '98' ? 'name.booth98' : 'name.booth04') }); }
  if (rt.mode === 'title') { showTitle(); }
}
function renderObjective(flash) {
  const show = rt.mode === 'play' || rt.mode === 'ending';
  ui.obj.hidden = !show;
  const o = St.objective(st);
  ui.objK.textContent = flash ? T('ui.newObjective') : T('ui.objective');
  ui.objV.textContent = T(o.key, o.vars);
  if (flash) { ui.obj.classList.add('flash'); setTimeout(() => { ui.obj.classList.remove('flash'); ui.objK.textContent = T('ui.objective'); }, 2600); }
}
function renderTutorial() {
  let key = null;
  if (rt.mode === 'play' && !rt.dialog) {
    const s = rt.tut.stage;
    if (s === 0) { key = coarse ? 'tut.moveTouch' : 'tut.move'; }
    else if (s === 1) { key = coarse ? 'tut.lookTouch' : 'tut.look'; }
    else if (s === 2 && rt.near) { key = coarse ? 'tut.inspectTouch' : 'tut.inspect'; }
  }
  const sig = key ? key + lang : '';
  if (ui.tut.getAttribute('data-sig') === sig) { return; }
  ui.tut.setAttribute('data-sig', sig); ui.tut.textContent = '';
  if (key) { ui.tut.append(el('div', { class: 'tip', text: T(key), 'data-key': key })); }
}
function advanceTutorial(stage) { if (rt.tut.stage < stage) { rt.tut.stage = stage; if (stage >= 3) { write(TUT_KEY, 'done'); } renderTutorial(); } }
function showCaption(who, key, ms) {
  rt.caption = { who, key, until: rt.t + (ms || Math.max(3.2, T(key).length / 14)) };
  renderCaption();
}
function renderCaption() {
  const c = rt.caption;
  const visible = c && rt.t < c.until && !rt.dialog;
  ui.caption.style.opacity = visible ? '1' : '0';
  if (!c) { return; }
  ui.caption.setAttribute('data-who', c.who);
  ui.caption.firstChild.textContent = T('sp.' + c.who);
  ui.caption.lastChild.textContent = T(c.key);
  ui.caption.setAttribute('data-key', visible ? c.key : '');
}
function setCanvasView(v) {
  renderer.domElement.classList.toggle('view98', v === '98'); renderer.domElement.classList.toggle('view04', v === '04');
  scanEl.classList.toggle('on', !!v);
  ui.viewing.hidden = !v;
  if (v) { ui.viewingText.textContent = T('ui.viewing', { name: T(v === '98' ? 'name.booth98' : 'name.booth04') }); }
}

// ---- dialogue -------------------------------------------------------------------------------------------
function showDialog(lines) {
  return new Promise((resolve) => {
    rt.dialog = { lines, i: 0, shown: 0, start: rt.t, resolve };
    ui.dialog.hidden = false; ui.prompt.hidden = true;
    renderDialogLine(true); renderTutorial(); renderCaption();
    A.play('open');
  });
}
function renderDialogLine(full) {
  const d = rt.dialog; const [who, key] = d.lines[d.i];
  ui.dialog.setAttribute('data-who', who); ui.dialog.setAttribute('data-key', key);
  ui.dlgWho.textContent = T('sp.' + who);
  const text = T(key);
  if (full || reduce()) { d.shown = text.length; }
  ui.dlgSay.textContent = text.slice(0, d.shown);
  ui.dlgHint.textContent = T('ui.nextHint');
}
function advanceDialog() {
  const d = rt.dialog; if (!d) { return; }
  const text = T(d.lines[d.i][1]);
  if (d.shown < text.length) { d.shown = text.length; ui.dlgSay.textContent = text; return; }
  if (d.i < d.lines.length - 1) { d.i += 1; d.shown = 0; d.start = rt.t; renderDialogLine(false); A.play('blip'); return; }
  ui.dialog.hidden = true; rt.dialog = null; A.play('click');
  renderTutorial(); d.resolve();
}
function tickDialog() {
  const d = rt.dialog; if (!d || reduce()) { return; }
  const text = T(d.lines[d.i][1]);
  if (d.shown < text.length) {
    const n = Math.min(text.length, Math.floor((rt.t - d.start) * (lang === 'zh' ? 26 : 48)));
    if (n > d.shown) { d.shown = n; ui.dlgSay.textContent = text.slice(0, n); if (n % 4 === 0) { A.play('blip'); } }
  }
}
ui.dialog.addEventListener('click', advanceDialog);

// ---- transitions ----------------------------------------------------------------------------------------
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
async function fade(on, white, seconds) {
  ui.fade.classList.toggle('white', !!white);
  ui.fade.style.transitionDuration = (reduce() ? 0.05 : (seconds || 0.6)) + 's';
  ui.fade.classList.toggle('on', on);
  await wait(reduce() ? 0.08 : (seconds || 0.6) + 0.05);
}
async function changeScene(to) {
  rt.busy = true;
  A.play(to === 'archive' ? 'modem' : 'portal');
  if (to === 'archive' && !reduce()) { rt.focus = { yaw: null, dist: 0.9, until: rt.t + 1.6, at: 'computer' }; await wait(1.2); }
  await fade(true, to === 'archive', 0.9);
  enterScene(to, null);
  await wait(0.25);
  await fade(false, to === 'archive', 1.0);
  persist(true);
  rt.busy = false;
  const r = St.arrive(st); st = r.state; await runEvents(r.events);
}

// ---- events from the story ------------------------------------------------------------------------------
function anchorWorld(id) {
  const p = Lv.point(rt.sceneId, id); if (!p) { return null; }
  return new THREE.Vector3(p.x, p.y, p.z);
}
async function runEvents(events) {
  for (const ev of events) {
    rt.log.push({ t: Math.round(rt.t * 10) / 10, ev: ev.type, key: ev.key || ev.step || ev.to || ev.copy || null });
    if (ev.type === 'say') {
      const text = T(ev.key);
      if (text.length > (lang === 'zh' ? 24 : 46)) { await showDialog([[ev.who, ev.key]]); } else { showCaption(ev.who, ev.key); }
    } else if (ev.type === 'dialog') {
      rt.talking = ev.lines.some((l) => l[0] === 'theo');
      await showDialog(ev.lines);
      rt.talking = false;
    } else if (ev.type === 'objective') {
      renderObjective(true); A.play('objective'); persist(true);
    } else if (ev.type === 'crtWake') {
      rt.busy = true;
      A.play('crtWake'); rt.world.wake(rt.t);
      const c = Lv.point('study', 'computer');
      rt.focus = { x: c.x, z: c.z, until: rt.t + 2.4 };
      await wait(reduce() ? 0.3 : 1.2);
      showCaption('mara', 'say.crtWake', 3.5);
      rt.busy = false;
    } else if (ev.type === 'lamp') { rt.world.setLamp(ev.on); A.play('lamp'); }
    else if (ev.type === 'sfx') { A.play(ev.name); }
    else if (ev.type === 'scene') { await changeScene(ev.to); }
    else if (ev.type === 'gateOpen') {
      rt.world.openGate(false); A.play('gateOpen');
      const g = Lv.point('archive', 'gate'); rt.focus = { x: g.x, z: g.z, until: rt.t + 2.6 };
    } else if (ev.type === 'view') {
      rt.world.setView(ev.copy); setCanvasView(ev.copy); A.play(ev.copy ? 'viewIn' : 'viewOut');
    } else if (ev.type === 'restore') {
      rt.busy = true; A.play('restore');
      rt.world.setRestored(true, true);
      rt.focus = { shot: LIGHTHOUSE_SHOT, until: rt.t + 99 };
      await waitFor(() => !rt.world.restoring, 8);
      await wait(reduce() ? 0.4 : 1.6);                   // hold on the restored lamp for a moment
      rt.focus = null; rt.busy = false;
    } else if (ev.type === 'theoLight') {
      rt.busy = true; rt.world.startLighting();
      rt.focus = { shot: LIGHTHOUSE_SHOT, until: rt.t + 99 };
      await waitFor(() => !rt.world.lighting, 20);
      rt.focus = null; rt.busy = false;
      const r = St.lightDone(st); st = r.state; await runEvents(r.events);
    } else if (ev.type === 'ending') { await ending(); }
  }
  persist(false);
}
function waitFor(cond, maxSeconds) {
  return new Promise((resolve) => { const t0 = rt.t; const iv = setInterval(() => { if (cond() || rt.t - t0 > maxSeconds) { clearInterval(iv); resolve(); } }, 50); });
}
async function interact(id) {
  if (rt.busy || rt.dialog || rt.mode !== 'play') { return; }
  rt.act = 0.5; A.play('click');
  advanceTutorial(3);
  const r = St.interact(st, id); st = r.state;
  rt.busy = true;
  try { await runEvents(r.events); } finally { rt.busy = false; }
}
function townEvent(name) {
  if (name === 'ignite') { A.play('ignite'); }
}

// ---- ending ---------------------------------------------------------------------------------------------
async function ending() {
  rt.mode = 'ending'; A.setScene('ending'); ui.touch.hidden = true;
  await wait(reduce() ? 0.2 : 1.4);
  A.play('message');
  const today = new Date();
  const date = lang === 'zh' ? `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日` : today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  ui.overlay.className = 'overlay ending'; ui.overlay.hidden = false; ui.overlay.textContent = '';
  const tbc = el('div', { class: 'tbc' }, [el('div', { class: 'a', text: T('ui.toBeContinued') }), el('div', { class: 'b', text: T('ui.nextChapter') }),
    el('div', { class: 'row' }, [el('button', { class: 'btn big primary', type: 'button', text: T('ui.next'), 'data-testid': 'keep-exploring', onclick: () => { ui.overlay.hidden = true; rt.mode = 'play'; showTouch(); A.setScene(null); A.setScene('town'); renderObjective(false); persist(true); } }),
      el('button', { class: 'btn big', type: 'button', text: T('ui.backToTitle'), 'data-testid': 'back-to-title', onclick: () => { ui.overlay.hidden = true; rt.mode = 'title'; showTitle(); } })])]);
  const box = el('div', { 'data-testid': 'ending' }, [
    el('div', { class: 'mail' }, [el('div', { class: 'h', text: T('end.head') }), el('div', { class: 'l', text: T('end.from') }), el('div', { class: 'l', text: T('end.date', { date }) }), el('div', { class: 'l', text: T('end.subject') }), el('div', { class: 'b', text: T('end.body') })]),
    tbc]);
  ui.overlay.append(box);
  await wait(reduce() ? 0.2 : 2.6);
  tbc.classList.add('on');
}

// ---- title and intro ------------------------------------------------------------------------------------
function showTitle() {
  rt.mode = 'title';
  ui.touch.hidden = true; ui.obj.hidden = true; ui.prompt.hidden = true; ui.tut.textContent = '';
  if (!rt.world || rt.sceneId !== 'study') { enterScene('study', SPAWNS.study); }
  const saved = readSave();
  ui.overlay.className = 'overlay title'; ui.overlay.hidden = false; ui.overlay.textContent = '';
  const row = el('div', { class: 'row' });
  if (saved) {
    row.append(el('button', { class: 'btn big primary', type: 'button', text: T('ui.continue'), 'data-testid': 'continue', onclick: () => begin(saved, false) }));
    row.append(el('button', { class: 'btn big', type: 'button', text: T('ui.newGame'), 'data-testid': 'new-game', onclick: () => { if (window.confirm(T('ui.confirmNew'))) { begin(null, true); } } }));
  } else {
    row.append(el('button', { class: 'btn big primary', type: 'button', text: T('ui.start'), 'data-testid': 'start', onclick: () => begin(null, true) }));
  }
  ui.overlay.append(el('div', { 'data-testid': 'title' }, [el('h1', { text: T('ui.title') }), el('div', { class: 'chap', text: T('ui.chapter') }), el('div', { class: 'tag', text: T('ui.tagline') }), row, el('div', { class: 'note', text: T('ui.saveNote') })]));
}
async function begin(saved, fresh) {
  A.unlock();
  ui.overlay.hidden = true;
  if (fresh) {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    st = St.newState(SPAWNS); rt.worlds = {}; rt.world = null;
    rt.mode = 'intro';
    enterScene('study', SPAWNS.study);
    await intro();
  } else {
    st = saved; rt.worlds = {}; rt.world = null;
    enterScene(st.scene, null);
  }
  rt.mode = 'play';
  showTouch();
  renderChrome();
  persist(false);
  if (fresh) { showCaption('mara', 'intro.2', 3.6); }
}
async function intro() {
  ui.overlay.className = 'overlay intro'; ui.overlay.hidden = false; ui.overlay.textContent = '';
  let skipped = false;
  const lines = ['intro.1', 'intro.2', 'intro.3'].map((k) => el('p', { text: T(k) }));
  const skip = el('button', { class: 'btn skip', type: 'button', text: T('ui.skip'), 'data-testid': 'skip-intro', onclick: () => { skipped = true; } });
  ui.overlay.append(el('div', { 'data-testid': 'intro' }, lines), skip);
  A.setScene('study');
  for (const p of lines) {
    if (skipped) { break; }
    p.classList.add('on');
    for (let i = 0; i < (reduce() ? 4 : 22) && !skipped; i++) { await wait(0.1); }
  }
  ui.overlay.hidden = true;
  st.flags.introSeen = true;
}

// ---- input ----------------------------------------------------------------------------------------------
const isTyping = (e) => e.target && (e.target.tagName === 'INPUT');
window.addEventListener('keydown', (e) => {
  if (isTyping(e)) { return; }
  A.unlock();
  const k = e.key.toLowerCase();
  if (rt.dialog) { if (k === 'e' || k === ' ' || k === 'enter' || k === 'f') { e.preventDefault(); if (!e.repeat) { advanceDialog(); } } return; }
  if (rt.mode !== 'play') { return; }
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) { rt.keys.add(k); if (k.startsWith('arrow')) { e.preventDefault(); } }
  if ((k === 'e' || k === 'f' || k === 'enter') && !e.repeat && rt.near) { e.preventDefault(); interact(rt.near.id); }
  if (k === 'escape' && st.view) { const r = St.leaveView(st); st = r.state; runEvents(r.events); }
});
window.addEventListener('keyup', (e) => { rt.keys.delete(e.key.toLowerCase()); });
window.addEventListener('blur', () => { rt.keys.clear(); });
const cv = renderer.domElement;
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  A.unlock();
  if (e.pointerType === 'touch') { return; }
  rt.drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; cv.classList.add('dragging');
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
});
cv.addEventListener('pointermove', (e) => {
  if (!rt.drag || rt.drag.id !== e.pointerId) { return; }
  const dx = e.clientX - rt.drag.x, dy = e.clientY - rt.drag.y; rt.drag.x = e.clientX; rt.drag.y = e.clientY;
  look(dx, dy);
});
const endDrag = () => { rt.drag = null; cv.classList.remove('dragging'); };
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('wheel', (e) => { const c = Lv.SCENES[rt.sceneId].camera; rt.cam.dist = Math.max(c.dist * 0.6, Math.min(c.dist * 1.5, rt.cam.dist + e.deltaY * 0.004)); }, { passive: true });
function look(dx, dy) {
  if (rt.mode !== 'play' || rt.dialog) { return; }
  rt.cam.yaw -= dx * 0.0055;
  const c = Lv.SCENES[rt.sceneId].camera;
  rt.cam.pitch = Math.max(c.minPitch, Math.min(c.maxPitch, rt.cam.pitch + dy * 0.004));
  rt.tut.looked += Math.abs(dx) * 0.0055;
  if (rt.tut.stage === 1 && rt.tut.looked > 0.6) { advanceTutorial(2); }
}
// touch: left stick, drag anywhere else to look, hand button to use
let touchLook = null, touchSeen = false;
function showTouch() { if (rt.mode === 'play' && (coarse || touchSeen)) { ui.touch.hidden = false; } }
ui.stick.addEventListener('pointerdown', (e) => { e.preventDefault(); rt.stick.id = e.pointerId; try { ui.stick.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } stickMove(e); });
ui.stick.addEventListener('pointermove', (e) => { if (rt.stick.id === e.pointerId) { stickMove(e); } });
const stickEnd = (e) => { if (rt.stick.id === e.pointerId || e.type === 'pointerleave') { rt.stick = { x: 0, y: 0, id: null }; ui.stick.firstChild.style.transform = ''; } };
ui.stick.addEventListener('pointerup', stickEnd); ui.stick.addEventListener('pointercancel', stickEnd);
function stickMove(e) {
  const r = ui.stick.getBoundingClientRect(); let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  rt.stick.x = x; rt.stick.y = y; ui.stick.firstChild.style.transform = `translate(${x * 36}px, ${y * 36}px)`;
}
cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { touchSeen = true; showTouch(); touchLook = { id: e.pointerId, x: e.clientX, y: e.clientY }; } });
cv.addEventListener('pointermove', (e) => { if (touchLook && touchLook.id === e.pointerId) { look((e.clientX - touchLook.x) * 1.2, (e.clientY - touchLook.y) * 1.2); touchLook.x = e.clientX; touchLook.y = e.clientY; } });
cv.addEventListener('pointerup', (e) => { if (touchLook && touchLook.id === e.pointerId) { touchLook = null; } });
ui.use.addEventListener('pointerdown', (e) => { e.preventDefault(); A.unlock(); if (rt.dialog) { advanceDialog(); } else if (rt.near) { interact(rt.near.id); } });
ui.prompt.addEventListener('click', () => { if (rt.near) { interact(rt.near.id); } });
ui.viewingBtn.addEventListener('click', () => { const r = St.leaveView(st); st = r.state; runEvents(r.events); });
ui.sound.addEventListener('click', () => { A.setMuted(!A.isMuted()); renderChrome(); });
ui.vol.addEventListener('input', () => A.setVolume(Number(ui.vol.value) / 100));
ui.motion.addEventListener('click', () => { userReduce = !userReduce; write(MOTION_KEY, userReduce ? 'reduce' : 'full'); renderChrome(); });
ui.lang.addEventListener('click', () => { lang = lang === 'en' ? 'zh' : 'en'; write(LANG_KEY, lang); renderChrome(); });
window.addEventListener('pagehide', () => persist(false));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { persist(false); } });

// ---- simulation -----------------------------------------------------------------------------------------
function moveInput() {
  let fx = 0, fz = 0;
  const k = rt.keys;
  if (k.has('w') || k.has('arrowup')) { fz += 1; } if (k.has('s') || k.has('arrowdown')) { fz -= 1; }
  if (k.has('d') || k.has('arrowright')) { fx += 1; } if (k.has('a') || k.has('arrowleft')) { fx -= 1; }
  if (rt.stick.id !== null) { fx += rt.stick.x; fz -= rt.stick.y; }
  const m = Math.hypot(fx, fz); if (m > 1) { fx /= m; fz /= m; }
  return { fx, fz, run: k.has('shift') };
}
function step(dt) {
  const p = rt.player;
  const free = rt.mode === 'play' && !rt.busy && !rt.dialog;
  let speed = 0;
  if (free) {
    const { fx, fz, run } = moveInput();
    if (fx || fz) {
      const yaw = rt.cam.yaw;
      const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw), rgtX = Math.cos(yaw), rgtZ = -Math.sin(yaw);
      const dx = (fwdX * fz + rgtX * fx), dz = (fwdZ * fz + rgtZ * fx);
      const sp = (run ? RUN : WALK) * Math.min(1, Math.hypot(fx, fz));
      const extra = rt.sceneId === 'town' && rt.world.theo.visible ? [{ k: 'circ', x: rt.world.theo.position.x, z: rt.world.theo.position.z, r: 0.42 }] : null;
      const np = Lv.move(rt.sceneId, p.x, p.z, dx * sp * dt, dz * sp * dt, extra);
      const moved = Math.hypot(np.x - p.x, np.z - p.z);
      speed = moved / dt;
      p.x = np.x; p.z = np.z;
      const want = Math.atan2(dx, dz);
      p.facing += Math.atan2(Math.sin(want - p.facing), Math.cos(want - p.facing)) * Math.min(1, dt * 12);
      p.phase += moved * 4.4;
      p.stepAcc += moved; if (p.stepAcc > 0.62) { p.stepAcc = 0; A.play('step'); }
      rt.tut.moved += moved;
      if (rt.tut.stage === 0 && rt.tut.moved > 1.5) { advanceTutorial(1); }
    }
  }
  p.speed = speed;
  // face whoever we talk to
  if (rt.dialog && rt.talking && rt.sceneId === 'town') { const th = rt.world.theo.position; const want = Math.atan2(th.x - p.x, th.z - p.z); p.facing += Math.atan2(Math.sin(want - p.facing), Math.cos(want - p.facing)) * Math.min(1, dt * 6); }
  mara.position.set(p.x, 0, p.z); mara.rotation.y = p.facing;
  if (rt.act > 0) { rt.act -= dt; }
  animate(mara, rt.t, p.phase, speed, rt.act > 0 ? 'reach' : 'idle', reduce());
  // what can be used here
  const avail = (id) => St.available(st, rt.sceneId, id) && !(rt.sceneId === 'town' && id === 'theo' && !rt.world.theo.visible);
  rt.near = free ? Lv.nearest(rt.sceneId, p.x, p.z, avail) : null;
  if (rt.tut.stage === 2 || (rt.tut.stage < 3 && rt.near && rt.tut.stage >= 1)) { renderTutorial(); }
  // archive: the plaza reacts when you arrive, the guide tone follows the objective
  if (rt.sceneId === 'archive') {
    const pc = rt.world.plazaCentre;
    if (!rt.plazaChecked && Math.hypot(p.x - pc.x, p.z - pc.z) < 10) { rt.plazaChecked = true; const r = St.enterPlaza(st); st = r.state; if (r.events.length) { runEvents(r.events); } }
    const tid = St.target(st); const tp = tid && Lv.point('archive', tid);
    A.setGuide(tp ? Math.max(0, 1 - Math.hypot(tp.x - p.x, tp.z - p.z) / 28) : 0);
  } else { A.setGuide(0); }
}

// Fixed view from the promenade that frames the whole lighthouse, the lamp room, Mara and Theo.
const LIGHTHOUSE_SHOT = { pos: new THREE.Vector3(10.4, 2.6, 12.0), look: new THREE.Vector3(16.6, 4.6, 18.6) };
function updateCamera(snap) {
  const sh = rt.focus && rt.t < rt.focus.until && rt.focus.shot;
  if (sh) {
    // a cut, like in film: jump straight to the view, then hold it
    const c = rt.cam; c.pos.copy(sh.pos); c.look.copy(sh.look);
    camera.position.copy(c.pos); camera.lookAt(c.look); return;
  }
  const p = rt.player, c = rt.cam;
  let yaw = c.yaw, dist = c.dist, pitch = c.pitch;
  const f = rt.focus;
  const target = new THREE.Vector3(p.x, 1.35, p.z);
  if (f && rt.t < f.until) {
    if (f.at === 'computer') { const cp = Lv.point('study', 'computer'); target.set(cp.x, 1.15, cp.z); dist = f.dist; yaw = Math.atan2(p.x - cp.x, p.z - cp.z); pitch = 0.18; }
    else { const toward = Math.atan2(p.x - f.x, p.z - f.z); yaw = toward; c.yaw += Math.atan2(Math.sin(toward - c.yaw), Math.cos(toward - c.yaw)) * 0.05; if (f.y) { target.lerp(new THREE.Vector3(f.x, f.y, f.z), 0.45); pitch = Math.min(pitch, 0.15); dist = c.dist * 1.25; } }
  } else if (f) { rt.focus = null; }
  if (camera.aspect < 0.8) { dist *= 1.3; }      // portrait phones: pull back so the world, not Mara, fills the screen
  const cp = Math.cos(pitch);
  const want = new THREE.Vector3(target.x + Math.sin(yaw) * cp * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * cp * dist);
  // keep the camera out of walls and buildings
  const room = Lv.SCENES[rt.sceneId].camera.room;
  if (room) { want.x = Math.max(room.x0 + 0.15, Math.min(room.x1 - 0.15, want.x)); want.z = Math.max(room.z0 + 0.15, Math.min(room.z1 - 0.15, want.z)); want.y = Math.min(room.y1 - 0.1, want.y); }
  else if (rt.world && rt.world.blockers.length) {
    const dir = want.clone().sub(target); const len = dir.length(); dir.normalize();
    raycaster.set(target, dir); raycaster.far = len;
    const hit = raycaster.intersectObjects(rt.world.blockers, false)[0];
    if (hit) { want.copy(target).addScaledVector(dir, Math.max(0.6, hit.distance - 0.35)); }
  }
  const k = snap || reduce() ? 1 : 0.16;
  c.pos.lerp(want, k); if (snap) { c.pos.copy(want); }
  c.look.lerp(target, snap ? 1 : 0.2);
  camera.position.copy(c.pos); camera.lookAt(c.look);
}

function updateTarget() {
  const w = rt.world; if (!w || !w.ring) { return; }
  const id = St.target(st);
  const p = id ? Lv.point(rt.sceneId, id) : null;
  const show = !!p && rt.mode === 'play' && !(rt.near && rt.near.id === id);
  w.ring.visible = show;
  if (p) {
    let x = p.x, z = p.z;
    if (id === 'theo') { x = w.theo.position.x; z = w.theo.position.z; }
    w.ring.position.set(x, 0, z);
    const k = reduce() ? 0.6 : 0.5 + 0.5 * Math.sin(rt.t * 3);
    w.ring.userData.r1.material.opacity = 0.45 + 0.4 * k; w.ring.userData.col.material.opacity = 0.04 + 0.05 * k;
    w.ring.userData.r1.scale.setScalar(0.9 + 0.15 * k);
  }
}

const tmpV = new THREE.Vector3();
function updatePrompt() {
  const n = rt.near;
  if (!n || rt.mode !== 'play' || rt.dialog || rt.busy) { ui.prompt.hidden = true; return; }
  let y = n.y;
  tmpV.set(n.x, y, n.z);
  if (n.id === 'theo') { tmpV.set(rt.world.theo.position.x, 2.2, rt.world.theo.position.z); }
  tmpV.project(camera);
  if (tmpV.z > 1) { ui.prompt.hidden = true; return; }
  const x = (tmpV.x * 0.5 + 0.5) * window.innerWidth, yy = (1 - (tmpV.y * 0.5 + 0.5)) * window.innerHeight;
  const verb = St.verbFor(st, rt.sceneId, n);
  ui.prompt.hidden = false;
  ui.prompt.style.left = Math.max(90, Math.min(window.innerWidth - 90, x)) + 'px';
  ui.prompt.style.top = Math.max(70, Math.min(window.innerHeight - 20, yy)) + 'px';
  const key = coarse ? '\u270B' : 'E';
  if (ui.prompt.getAttribute('data-id') !== n.id + verb + lang) {
    ui.prompt.setAttribute('data-id', n.id + verb + lang); ui.prompt.setAttribute('data-target', n.id);
    ui.prompt.textContent = '';
    ui.prompt.append(el('span', { class: 'key', text: key }), el('span', { text: T(verb) }), el('span', { class: 'name', text: '· ' + T('name.' + n.id) }));
  }
}

let last = 0, fpsAcc = 0, fpsN = 0;
function frame(now) {
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016; last = now;
  rt.t += dt; rt.frames += 1;
  fpsAcc += dt; fpsN += 1;
  if (fpsAcc > 1) {
    rt.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
    if (rt.frames > 60 && rt.fps < 26 && quality.level < QUALITY.length - 1) { quality.slow += 1; if (quality.slow >= 2) { quality.level += 1; quality.slow = 0; applyQuality(); resize(); } } else { quality.slow = 0; }
  }
  if (!renderer.shadowMap.autoUpdate && rt.frames % QUALITY[quality.level].shadowEvery === 0) { renderer.shadowMap.needsUpdate = true; }
  if (rt.world) {
    if (rt.mode === 'title') { rt.cam.yaw = SPAWNS.study.yaw + Math.sin(rt.t * 0.12) * 0.35; }
    step(dt);
    if (rt.sceneId === 'study') { rt.world.update(dt, rt.t, reduce()); }
    else if (rt.sceneId === 'archive') { rt.world.update(dt, rt.t, reduce(), rt.player, St.target(st), camera.position); }
    else {
      rt.world.update(dt, rt.t, reduce(), townEvent);
      const th = rt.world.theo; const near = Math.hypot(th.position.x - rt.player.x, th.position.z - rt.player.z) < 4;
      if (near) { rt.world.theoFace(rt.player.x, rt.player.z); }
      const a = rt.world.theoAnim(rt.t, reduce(), rt.talking && !!rt.dialog);
      animate(th, rt.t, a.phase, a.speed, a.mode, reduce());
    }
    tickDialog();
    updateCamera(false);
    updateTarget();
    updatePrompt();
    if (rt.caption && rt.t > rt.caption.until && ui.caption.style.opacity !== '0') { renderCaption(); }
    if (rt.mode === 'play' && rt.t - rt.lastSave > 4) { persist(false); }
    renderer.render(rt.world.scene, camera);
  }
  requestAnimationFrame(frame);
}

// Read-only view of the game for automated tests. It cannot change anything.
window.P4Debug = {
  snapshot() {
    return {
      mode: rt.mode, busy: rt.busy, scene: rt.sceneId, step: st.step, view: st.view, flags: Object.assign({}, st.flags), seen: st.seen.slice(),
      x: rt.player.x, z: rt.player.z, facing: rt.player.facing, yaw: rt.cam.yaw, pitch: rt.cam.pitch,
      near: rt.near ? rt.near.id : null, target: St.target(st), dialog: rt.dialog ? { who: rt.dialog.lines[rt.dialog.i][0], key: rt.dialog.lines[rt.dialog.i][1], i: rt.dialog.i, n: rt.dialog.lines.length } : null,
      caption: rt.caption && rt.t < rt.caption.until ? rt.caption.key : null, tutorial: rt.tut.stage, fps: rt.fps, quality: quality.level, frames: rt.frames, t: rt.t,
      theo: rt.sceneId === 'town' && rt.world ? { x: rt.world.theo.position.x, z: rt.world.theo.position.z, visible: rt.world.theo.visible } : null,
      lighting: rt.sceneId === 'town' && rt.world ? rt.world.lighting : false, heard: A.heardList(), log: rt.log.slice(-40)
    };
  }
};

renderChrome();
showTitle();
requestAnimationFrame(frame);
