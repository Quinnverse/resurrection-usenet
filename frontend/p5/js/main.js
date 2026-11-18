// P5 browser shell: renderer, third-person controller and camera, the narrative HUD, the light trail, dialogue,
// the archive reader, hold-to-rebuild, build switching, saving. Rules live in story.js, layout in levels.js,
// archive logic in archive.js / usenet.js, the worlds in world-*.js.
import { THREE } from './kit.js';
import * as Lv from './levels.js';
import * as St from './story.js';
import * as Ar from './archive.js';
import { t as tr } from './i18n.js';
import { makeMara, animate } from './people.js';
import { buildStudy } from './world-study.js';
import { buildTown } from './world-town.js';
import * as A from './audio.js';

const SAVE_KEY = 'p5.save.v1', PREF_KEY = 'p5.prefs.v1', TUT_KEY = 'p5.tutorial.v1', SEEN_KEY = 'p5.seenDialog.v1';
const WALK = 2.5, RUN = 4.3, HOLD_SECONDS = 4.2;
const mediaReduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0;
const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
const readJSON = (k, d) => { try { const v = JSON.parse(read(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } };

const prefs = Object.assign({ lang: 'en', reduce: false, large: false }, readJSON(PREF_KEY, {}));
const reduce = () => prefs.reduce || mediaReduce;
const T = (k, v) => tr(prefs.lang, k, v);
const seenDialogs = new Set(readJSON(SEEN_KEY, []));

let archive = null, st = St.newState();
const rt = {
  mode: 'loading', busy: false, worlds: {}, world: null, sceneId: 'study', t: 0, frames: 0, fps: 0,
  player: { x: 0, z: 0, facing: 0, speed: 0, phase: 0, stepAcc: 0 }, act: 0,
  cam: { yaw: 0, pitch: 0.4, dist: 3.3, pos: new THREE.Vector3(), look: new THREE.Vector3() }, shot: null,
  keys: new Set(), stick: { x: 0, y: 0, id: null }, near: null, caption: null, dialog: null,
  tut: { stage: read(TUT_KEY) === 'done' ? 9 : 0, moved: 0 }, uses: 0, tipsShown: new Set(readJSON('p5.tips.v1', [])), tip: null,
  hold: { down: false, src: null, plankN: 0, refusedSaid: false }, lastSave: 0, stepAt: 0, lastStep: null, autoHinted: 0,
  guide: { path: null, at: 0, from: null, phase: 0, key: '' }, theoCalled: false, log: [], safeCount: 0, particles: []
};

// ---- DOM ------------------------------------------------------------------------------------------------
const app = document.getElementById('app'), stageEl = document.getElementById('stage');
function el(tag, attrs, kids) {
  const n = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => { if (v === null || v === undefined) { return; } if (k === 'text') { n.textContent = v; } else if (k === 'class') { n.className = v; } else if (k.startsWith('on')) { n.addEventListener(k.slice(2), v); } else { n.setAttribute(k, v); } });
  (kids || []).forEach((c) => c && n.appendChild(c));
  return n;
}
const ui = {};
ui.hud = el('div', { class: 'hud', 'data-testid': 'hud' });
ui.chap = el('div', { class: 'chap', 'data-testid': 'chapter' });
ui.obj = el('button', { class: 'obj', type: 'button', 'data-testid': 'objective', onclick: () => toggleGuide() });
ui.objText = el('span', { class: 'objText' }); ui.obj.append(ui.objText);
ui.hint = el('div', { class: 'hintline', 'data-testid': 'hint' });
ui.hud.append(ui.chap, ui.obj, ui.hint);
ui.corner = el('div', { class: 'corner' });
ui.buildBtn = el('button', { class: 'cbtn', type: 'button', hidden: '', 'data-testid': 'build', onclick: () => trySwitch() });
ui.archBtn = el('button', { class: 'cbtn', type: 'button', hidden: '', 'data-testid': 'archive', onclick: () => openReader(null) });
ui.menuBtn = el('button', { class: 'cbtn', type: 'button', 'data-testid': 'menu', onclick: () => openMenu() });
ui.corner.append(ui.buildBtn, ui.archBtn, ui.menuBtn);
ui.saved = el('div', { class: 'saved' });
ui.prompt = el('button', { class: 'prompt', type: 'button', hidden: '', 'data-testid': 'prompt' });
ui.caption = el('div', { class: 'caption', 'data-testid': 'caption' }, [el('span', { class: 'who' }), el('span', { class: 'say' })]);
ui.dlgWho = el('div', { class: 'who' }); ui.dlgSay = el('div', { class: 'say', 'data-testid': 'dialog-text' }); ui.dlgHint = el('div', { class: 'next' });
ui.dlgSkip = el('button', { class: 'skip', type: 'button', hidden: '', 'data-testid': 'skip-dialog', onclick: (e) => { e.stopPropagation(); skipDialog(); } });
ui.dialog = el('div', { class: 'dialog', hidden: '', 'data-testid': 'dialog' }, [ui.dlgWho, ui.dlgSay, ui.dlgHint, ui.dlgSkip]);
ui.tip = el('div', { class: 'tip', 'data-testid': 'tip' });
ui.touch = el('div', { class: 'touch', hidden: '' });
ui.stick = el('div', { class: 'stick', 'data-testid': 'stick' }, [el('div', { class: 'nub' })]);
ui.use = el('button', { class: 'use', type: 'button', 'data-testid': 'use', 'aria-label': 'use' }); ui.use.textContent = '\u270B';
ui.touch.append(ui.stick, ui.use);
ui.banner = el('div', { class: 'banner', 'data-testid': 'banner' });
ui.fade = el('div', { class: 'fade' });
ui.panel = el('div', { class: 'panel', hidden: '', role: 'dialog', 'data-testid': 'panel' });
ui.overlay = el('div', { class: 'overlay', hidden: '' });
app.append(ui.hud, ui.corner, ui.saved, ui.prompt, ui.caption, ui.dialog, ui.tip, ui.touch, ui.banner, ui.fade, ui.panel, ui.overlay);

// ---- renderer -------------------------------------------------------------------------------------------
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
if (!renderer || !renderer.getContext()) {
  ui.overlay.hidden = false; ui.overlay.className = 'overlay title'; ui.overlay.append(el('p', { class: 'err', text: T('ui.webgl'), 'data-testid': 'webgl-error' }));
  throw new Error('WebGL unavailable');
}
const QUALITY = [{ ratio: 1.5, shadowEvery: 1 }, { ratio: 1, shadowEvery: 1 }, { ratio: 0.75, shadowEvery: 4 }];
const quality = { level: 0, slow: 0 };
function applyQuality() { const q = QUALITY[quality.level]; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.ratio)); renderer.shadowMap.autoUpdate = q.shadowEvery === 1; }
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
applyQuality();
stageEl.appendChild(renderer.domElement); renderer.domElement.setAttribute('data-testid', 'canvas');
const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 600);
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();
const mara = makeMara();
const raycaster = new THREE.Raycaster();

// ---- archive facts (always computed from the parsed data) ------------------------------------------------
const included = () => ({ disk: st.disk });
const index = () => archive.view(included());
const factsCache = new Map();
function facts() {
  if (!archive) { return { bridgeOk: false, has1998: false, has2004: false }; }
  const k = (st.disk ? 'd' : '-') + st.build;
  if (!factsCache.has(k)) { factsCache.set(k, Ar.facts(archive, included(), st.build)); }
  return factsCache.get(k);
}
function assetsNow() { return rt.sceneId === 'town' ? Ar.buildAssets(index(), st.build) : new Set(); }
function bridgeProvenance() {
  const r = Ar.resolveAsset(index(), st.build, 'bridge');
  return r.status === 'ok' ? { messageId: r.entry.messageId, source: r.use.source, crc: r.use.crc } : null;
}
function verifyBridge(p) {
  if (!archive || !p) { return false; }
  const idx = archive.view({ disk: true }); const m = idx.messages.get(p.messageId); if (!m) { return false; }
  const b = Ar.manifests(idx)['2004'] || Ar.manifests(idx)['1998']; const entry = b && b.manifest.assets.find((a) => a.id === 'bridge');
  return !!entry && entry.messageId === p.messageId && entry.crc === p.crc;
}
let levelCtx = { assets: new Set(), bridgeLen: 0 };
function refreshCtx() { levelCtx = { assets: assetsNow(), bridgeLen: rt.sceneId === 'town' && rt.world ? rt.world.builtLength() : 0 }; }

// ---- worlds -----------------------------------------------------------------------------------------------
function getWorld(id) {
  if (rt.worlds[id]) { return rt.worlds[id]; }
  const w = id === 'study' ? buildStudy({ shadow: coarse ? 512 : 1024 }) : buildTown({ shadow: coarse ? 1024 : 1536, low: coarse });
  w.trail = makeTrail(); w.scene.add(w.trail.points);
  rt.worlds[id] = w; return w;
}
// Re-apply everything the world shows from the state and the archive: build, bridge planks, ghost, Theo.
function syncTown(animate) {
  const w = rt.worlds.town; if (!w) { return; }
  const idx = index();
  w.setBuild(st.build, Ar.buildAssets(idx, st.build));
  // Planks come from the copy that is usable now, or from the copy they were already built from (saved provenance).
  const r = Ar.resolveAsset(idx, st.build, 'bridge');
  const built = st.bridge > 0 && st.bridgeFrom ? Ar.resolveAsset(archive.view({ disk: true }), '2004', 'bridge') : null;
  const solid = r.status === 'ok' ? r : (built && built.status === 'ok' ? built : null);
  const key = r.status + '|' + (solid ? solid.use.source : '-');
  if (w._bridgeKey !== key) {
    w._bridgeKey = key;
    w.setBridgeData(solid ? Ar.parseBridge(solid.data) : null);
    w.setGhost(r.status === 'ok' ? Ar.parseBridge(r.data) : Ar.parseBridge(r.partial || ''), r.status === 'ok');
  }
  w.setBridgeProgress(st.bridge, rt.t, !!animate);
  refreshCtx();
}
function placeTheoFromState() {
  const w = rt.worlds.town; if (!w) { return; }
  if (!st.flags.theoCrossed) { w.placeTheo('wait'); } else if (!st.flags.theoTalked) { w.placeTheo('meet'); } else { w.placeTheo('post'); }
}
function enterScene(id, pos) {
  rt.sceneId = id; st = St.enterScene(st, id);
  const w = getWorld(id); rt.world = w;
  if (id === 'study') { w.setLamp(st.flags.lamp); if (st.flags.computer) { w.setCrt(true); } }
  if (id === 'town') { syncTown(false); placeTheoFromState(); }
  refreshCtx();
  if (mara.parent) { mara.parent.remove(mara); }
  w.scene.add(mara);
  const sp = Lv.SCENES[id].spawn, p = pos || st.pos[id] || sp;
  const safe = Lv.safeSpot(id, p.x, p.z, levelCtx, theoBlock());
  rt.player.x = safe.x; rt.player.z = safe.z; rt.player.speed = 0;
  rt.cam.yaw = p.yaw !== undefined ? p.yaw : sp.yaw; rt.player.facing = rt.cam.yaw + Math.PI;
  const cc = Lv.SCENES[id].camera; rt.cam.dist = cc.dist; rt.cam.pitch = cc.pitch;
  rt.shot = null; rt.guide.path = null; rt.guide.key = '';
  updateCamera(true);
  A.setScene(id === 'town' ? 'town' + st.build.slice(2) : 'study');
  renderHUD();
}
function theoBlock() {
  if (rt.sceneId !== 'town' || !rt.worlds.town) { return null; }
  const th = rt.worlds.town.theo.position; return [{ k: 'circ', x: th.x, z: th.z, r: 0.42 }];
}

// ---- saving -----------------------------------------------------------------------------------------------
function persist(show) {
  if (rt.mode === 'title' || rt.mode === 'intro' || rt.mode === 'loading') { return; }
  st.pos[rt.sceneId] = { x: Math.round(rt.player.x * 100) / 100, z: Math.round(rt.player.z * 100) / 100, yaw: Math.round(rt.cam.yaw * 1000) / 1000 };
  write(SAVE_KEY, JSON.stringify(St.serialize(st)));
  rt.lastSave = rt.t;
  if (show) { ui.saved.textContent = T('ui.saved'); ui.saved.classList.add('on'); setTimeout(() => ui.saved.classList.remove('on'), 1200); }
}
function readSave() { const raw = readJSON(SAVE_KEY, null); return raw ? St.parse(raw, verifyBridge) : null; }
const savePrefs = () => write(PREF_KEY, JSON.stringify(prefs));

// ---- HUD -------------------------------------------------------------------------------------------------
function currentStep() { return St.step(st, facts()); }
function renderHUD() {
  document.documentElement.lang = prefs.lang === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.classList.toggle('reduce-motion', reduce());
  document.documentElement.classList.toggle('large-text', !!prefs.large);
  document.title = T('ui.title') + ' \u2014 ' + T('ui.subtitle');
  const playing = ['play', 'reader', 'menu', 'hold'].indexOf(rt.mode) >= 0;
  ui.hud.hidden = !playing && rt.mode !== 'ending';
  ui.chap.textContent = T(St.chapter(st));
  ui.objText.textContent = T(St.objective(st, facts()));
  ui.obj.title = T('ui.guideTitle'); ui.obj.setAttribute('aria-pressed', st.guide ? 'true' : 'false');
  ui.obj.classList.toggle('lit', !!st.guide);
  ui.hint.textContent = T(St.hintKey(st, facts()));
  const town = rt.sceneId === 'town' && playing;
  ui.buildBtn.hidden = !(town && st.flags.switchUnlocked);
  ui.buildBtn.textContent = T('ui.build', { b: st.build }) + '  \u00b7  ' + T('ui.switchTo', { b: st.build === '1998' ? '2004' : '1998' });
  ui.buildBtn.classList.toggle('b98', st.build === '1998');
  ui.archBtn.hidden = !(town && st.flags.readerSeen); ui.archBtn.textContent = T('ui.archive');
  ui.menuBtn.textContent = T('ui.menuBtn'); ui.menuBtn.hidden = !playing;
  ui.dlgHint.textContent = T('ui.next'); ui.dlgSkip.textContent = T('ui.skip');
  if (rt.dialog) { renderDialogLine(true); }
  renderCaption(); renderTip();
}
// Hide the HUD while someone is talking or a cut plays.
function cinematic() { return !!rt.dialog || !!rt.shot || rt.busy || rt.mode === 'cut' || rt.mode === 'ending'; }
function renderHudFade() { app.classList.toggle('cine', cinematic()); }
function flashObjective() { ui.hud.classList.remove('new'); void ui.hud.offsetWidth; ui.hud.classList.add('new'); A.play('objective'); }
function toggleGuide(force) {
  st.guide = force === undefined ? !st.guide : !!force; rt.guide.path = null; rt.guide.key = '';
  A.play(st.guide ? 'guideOn' : 'click'); renderHUD(); persist(false);
}
function showTip(key) {
  if (rt.tipsShown.has(key)) { return; }
  rt.tipsShown.add(key); write('p5.tips.v1', JSON.stringify([...rt.tipsShown]));
  rt.tip = { key: coarse && T(key + 'Touch') !== key + 'Touch' ? key + 'Touch' : key, until: rt.t + 9 };
  renderTip();
}
function renderTip() {
  let key = null;
  if (rt.mode === 'play' && !rt.dialog) {
    const s = rt.tut.stage;
    if (s === 0) { key = coarse ? 'tut.moveTouch' : 'tut.move'; } else if (s === 1) { key = coarse ? 'tut.lookTouch' : 'tut.look'; } else if (s === 2 && rt.near) { key = coarse ? 'tut.useTouch' : 'tut.use'; } else if (rt.tip && rt.t < rt.tip.until) { key = rt.tip.key; }
  }
  const sig = key ? key + prefs.lang : '';
  if (ui.tip.getAttribute('data-sig') === sig) { return; }
  ui.tip.setAttribute('data-sig', sig); ui.tip.textContent = ''; ui.tip.setAttribute('data-key', key || '');
  if (key) { ui.tip.append(el('span', { text: T(key) })); }
}
function advanceTutorial(stage) { if (rt.tut.stage < stage) { rt.tut.stage = stage; if (stage >= 3) { write(TUT_KEY, 'done'); } renderTip(); } }
function showCaption(who, key, secs) { rt.caption = { who, key, until: rt.t + (secs || Math.max(3.0, T(key).length / (prefs.lang === 'zh' ? 7 : 15))) }; renderCaption(); }
function renderCaption() {
  const c = rt.caption, on = !!c && rt.t < c.until && !rt.dialog;
  ui.caption.style.opacity = on ? '1' : '0';
  if (!c) { return; }
  ui.caption.firstChild.textContent = T('sp.' + c.who); ui.caption.lastChild.textContent = T(c.key);
  ui.caption.setAttribute('data-key', on ? c.key : '');
}
function banner(text, secs) { ui.banner.textContent = text; ui.banner.classList.add('on'); clearTimeout(banner.tm); banner.tm = setTimeout(() => ui.banner.classList.remove('on'), (secs || 2.2) * 1000); }

// ---- dialogue --------------------------------------------------------------------------------------------
function showDialog(lines, id) {
  return new Promise((resolve) => {
    rt.dialog = { lines, i: 0, shown: 0, start: rt.t, resolve, id, seen: !!id && seenDialogs.has(id) };
    ui.dialog.hidden = false; ui.prompt.hidden = true; ui.dlgSkip.hidden = !rt.dialog.seen;
    renderDialogLine(true); renderTip(); renderCaption(); renderHudFade(); A.play('open');
  });
}
function renderDialogLine(full) {
  const d = rt.dialog; const [who, key] = d.lines[d.i];
  ui.dialog.setAttribute('data-who', who); ui.dialog.setAttribute('data-key', key);
  ui.dlgWho.textContent = T('sp.' + who);
  const text = T(key); if (full || reduce()) { d.shown = text.length; }
  ui.dlgSay.textContent = text.slice(0, d.shown);
}
function closeDialog() {
  const d = rt.dialog; if (!d) { return; }
  if (d.id) { seenDialogs.add(d.id); write(SEEN_KEY, JSON.stringify([...seenDialogs])); }
  ui.dialog.hidden = true; rt.dialog = null; A.play('click'); renderTip(); renderHudFade(); d.resolve();
}
function advanceDialog() {
  const d = rt.dialog; if (!d) { return; }
  const text = T(d.lines[d.i][1]);
  if (d.shown < text.length) { d.shown = text.length; ui.dlgSay.textContent = text; return; }
  if (d.i < d.lines.length - 1) { d.i += 1; d.shown = 0; d.start = rt.t; renderDialogLine(false); A.play('blip'); return; }
  closeDialog();
}
function skipDialog() { if (rt.dialog && rt.dialog.seen) { closeDialog(); } }
function tickDialog() {
  const d = rt.dialog; if (!d || reduce()) { return; }
  const text = T(d.lines[d.i][1]);
  if (d.shown < text.length) { const n = Math.min(text.length, Math.floor((rt.t - d.start) * (prefs.lang === 'zh' ? 28 : 52))); if (n > d.shown) { d.shown = n; ui.dlgSay.textContent = text.slice(0, n); if (n % 4 === 0) { A.play('blip'); } } }
}
ui.dialog.addEventListener('click', advanceDialog);

// ---- transitions -----------------------------------------------------------------------------------------
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
async function fade(on, seconds) { const s = reduce() ? 0.05 : (seconds || 0.6); ui.fade.style.transitionDuration = s + 's'; ui.fade.classList.toggle('on', on); await wait(s + 0.05); }
async function enterTown() {
  rt.busy = true; renderHudFade();
  A.play('modem');
  await fade(true, 0.9);
  const idx = index();
  ui.overlay.className = 'overlay rebuild'; ui.overlay.hidden = false; ui.overlay.textContent = '';
  const lines = el('div', { class: 'feed', 'data-testid': 'rebuild' });
  ui.overlay.append(el('p', { class: 'big', text: T('ui.rebuilding', { n: idx.messages.size, k: idx.sources.length }) }), lines, el('p', { class: 'small', text: T('ui.rebuildingNote') }));
  const list = [...idx.messages.values()].sort((a, b) => a.time - b.time);
  for (const m of list) { lines.append(el('div', { text: `${m.head.date.slice(5, 16)}  ${m.head.from.split(' <')[0].padEnd(10)}  ${m.head.subject.slice(0, 54)}` })); if (!reduce()) { await wait(0.12); } }
  await wait(reduce() ? 0.2 : 1.3);
  ui.overlay.hidden = true;
  enterScene('town', null);
  await wait(0.2);
  await fade(false, 1.0);
  rt.busy = false; renderHudFade();
  persist(true);
  const r = St.arrive(st, facts()); st = r.state; await runEvents(r.events);
}

// ---- events from the story ------------------------------------------------------------------------------
async function runEvents(events) {
  for (let n = 0; n < events.length; n++) {
    const ev = events[n], next = events[n + 1];
    rt.log.push({ t: Math.round(rt.t * 10) / 10, ev: ev.type, key: ev.key || ev.to || ev.id || null });
    if (rt.log.length > 80) { rt.log.shift(); }
    if (ev.type === 'say') {
      const text = T(ev.key);
      if (text.length > (prefs.lang === 'zh' ? 30 : 64)) { await showDialog([[ev.who, ev.key]], null); } else {
        showCaption(ev.who, ev.key);
        // a caption followed by more speech: let it be read first
        if (next && (next.type === 'say' || next.type === 'dialog' || next.type === 'theoCall')) { await wait(Math.min(3.2, rt.caption.until - rt.t)); }
      }
    } else if (ev.type === 'dialog') { await showDialog(ev.lines, ev.id); }
    else if (ev.type === 'objective') { renderHUD(); flashObjective(); rt.stepAt = rt.t; rt.autoHinted = 0; rt.guide.key = ''; persist(true); }
    else if (ev.type === 'sfx') { A.play(ev.name); }
    else if (ev.type === 'crt') { rt.world.wake(rt.t); A.play('crtWake'); }
    else if (ev.type === 'lamp') { rt.world.setLamp(ev.on); A.play('lamp'); }
    else if (ev.type === 'enterTown') { await enterTown(); }
    else if (ev.type === 'theoCall') { rt.theoCalled = true; A.play('call'); showCaption('theo', 'theo.call', 4.5); }
    else if (ev.type === 'reader') { await openReader(ev.topic); }
    else if (ev.type === 'tip') { showTip(ev.key); }
    else if (ev.type === 'bridgeDone') { A.play('bridgeDone'); burst(new THREE.Vector3(0, 0.4, Lv.BRIDGE.z0 + Lv.BRIDGE.span / 2), 34, 0xffd27a, 2.2); refreshCtx(); }
    else if (ev.type === 'theoGo') { rt.worlds.town.theoGo(ev.to); }
    else if (ev.type === 'unlockSwitch') { renderHUD(); showTip('tip.switch'); }
    else if (ev.type === 'build') { await applyBuild(ev.to); }
    else if (ev.type === 'anomaly') { await anomaly(); }
    else if (ev.type === 'ending') { await ending(); }
  }
  renderHUD(); persist(false);
}
async function interact(id) {
  if (rt.busy || rt.dialog || rt.mode !== 'play') { return; }
  rt.act = 0.5; rt.uses += 1; A.play('click'); advanceTutorial(3);
  const r = St.interact(st, id, facts()); st = r.state;
  rt.busy = true; renderHudFade();
  try { await runEvents(r.events); } finally { rt.busy = false; renderHudFade(); }
}

// ---- hold to rebuild ---------------------------------------------------------------------------------------
function holdStart(src) {
  if (rt.mode !== 'play' || rt.busy || rt.dialog || !rt.near) { return false; }
  if (!St.isHold(st, rt.near.id, facts())) { return false; }
  rt.hold.down = true; rt.hold.src = src; rt.hold.plankN = rt.worlds.town ? Math.round(st.bridge * rt.worlds.town.bridgePlanks) : 0;
  advanceTutorial(3); A.play('holdStart');
  return true;
}
function holdEnd() { if (rt.hold.down) { rt.hold.down = false; A.play('holdStop'); persist(true); } }
function holdTick(dt) {
  if (!rt.hold.down) { return; }
  if (rt.mode !== 'play' || !rt.near || rt.near.id !== 'gap' || rt.dialog) { holdEnd(); return; }
  const r = St.buildTick(st, dt / HOLD_SECONDS, facts(), bridgeProvenance());
  if (r.refused) { holdEnd(); if (!rt.hold.refusedSaid) { rt.hold.refusedSaid = true; showCaption('mara', 'say.refused'); } return; }
  st = r.state;
  const w = rt.worlds.town;
  const n = w.setBridgeProgress(st.bridge, rt.t, true);
  while (rt.hold.plankN < n) { const p = w.plankWorld(rt.hold.plankN); if (p) { burst(p.clone().setY(0.1), 7, 0xf0d39a, 0.9); } A.play('plank'); rt.hold.plankN += 1; }
  refreshCtx();
  if (r.events.length) { holdEnd(); rt.busy = true; runEvents(r.events).finally(() => { rt.busy = false; renderHudFade(); }); }
}

// ---- builds ---------------------------------------------------------------------------------------------
async function trySwitch() {
  if (rt.mode !== 'play' || rt.busy || rt.dialog || rt.hold.down) { return; }
  const r = St.switchBuild(st, facts());
  if (!r.ok) { if (r.events.length) { await runEvents(r.events); } return; }
  st = r.state; rt.busy = true;
  try { await runEvents(r.events); } finally { rt.busy = false; renderHudFade(); }
}
async function applyBuild(to) {
  A.play(to === '1998' ? 'to98' : 'to04');
  if (!reduce()) { app.classList.add('switching'); await wait(0.22); }
  syncTown(false);
  // nobody is left inside a wall or over water
  const s = Lv.safeSpot('town', rt.player.x, rt.player.z, levelCtx, theoBlock());
  if (s.moved) { rt.player.x = s.x; rt.player.z = s.z; rt.safeCount += 1; }
  const th = rt.worlds.town.theo.position; const ts = Lv.safeSpot('town', th.x, th.z, levelCtx, null);
  if (ts.moved && !rt.worlds.town.theoWalking) { th.x = ts.x; th.z = ts.z; }
  A.setScene('town' + to.slice(2));
  banner(T('ui.switching', { b: to }), 1.6);
  rt.guide.key = '';
  renderHUD();
  if (!reduce()) { await wait(0.2); app.classList.remove('switching'); }
  persist(true);
}

// ---- the archive reader ------------------------------------------------------------------------------------
let readerResolve = null, readerTab = 'bridge', readerTech = false;
function openReader(topic) {
  if (rt.mode !== 'play' && rt.mode !== 'reader') { return Promise.resolve(); }
  if (rt.sceneId !== 'town') { return Promise.resolve(); }
  st = St.readerOpened(st); readerTab = topic || readerTab;
  rt.mode = 'reader'; holdEnd(); rt.keys.clear(); A.play('open');
  renderReader(); ui.panel.hidden = false; renderHUD(); renderHudFade();
  if (!rt.tipsShown.has('tip.reader')) { setTimeout(() => showTip('tip.reader'), 50); }
  return new Promise((r) => { readerResolve = r; });
}
function closeReader() {
  if (rt.mode !== 'reader') { return; }
  ui.panel.hidden = true; rt.mode = 'play'; A.play('click');
  syncTown(false); renderHUD(); renderHudFade(); persist(true);
  const r = readerResolve; readerResolve = null; if (r) { r(); }
}
function setDiskFromReader(on) {
  const before = facts();
  const nextFacts = Ar.facts(archive, { disk: on }, on || st.build === '2004' ? st.build : '2004');
  const r = St.setDisk(st, on, before, nextFacts); st = r.state;
  if (!on && st.build === '1998' && !nextFacts.has1998) { st.build = '2004'; }
  r.events.forEach((ev) => { if (ev.type === 'sfx') { A.play(ev.name); } if (ev.type === 'objective') { rt.stepAt = rt.t; flashObjective(); } });
  syncTown(true);
  const s = Lv.safeSpot('town', rt.player.x, rt.player.z, levelCtx, theoBlock()); if (s.moved) { rt.player.x = s.x; rt.player.z = s.z; rt.safeCount += 1; }
  A.setScene('town' + st.build.slice(2));
  renderReader(); renderHUD(); persist(true);
}
const srcName = (id) => T('rd.src.' + id);
function fmtDate(d) {
  const t = Date.parse(d); if (!t) { return d; }
  const x = new Date(t);
  return prefs.lang === 'zh' ? `${x.getUTCFullYear()} \u5e74 ${x.getUTCMonth() + 1} \u6708 ${x.getUTCDate()} \u65e5` : x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function renderReader() {
  const idx = index(), all = archive.view({ disk: true });
  ui.panel.textContent = '';
  const head = el('div', { class: 'ph' }, [el('h2', { text: T('rd.heading') }), el('button', { class: 'pclose', type: 'button', text: T('rd.close'), 'data-testid': 'reader-close', onclick: closeReader })]);
  const tabs = el('div', { class: 'tabs', role: 'tablist' });
  const tabIds = ['bridge'].concat(st.flags.switchUnlocked ? ['builds'] : []).concat(st.flags.pierReached ? ['light'] : []);
  if (tabIds.indexOf(readerTab) < 0) { readerTab = 'bridge'; }
  tabIds.forEach((id) => tabs.append(el('button', { type: 'button', role: 'tab', class: 'tab' + (id === readerTab ? ' on' : ''), 'aria-selected': id === readerTab ? 'true' : 'false', text: T('rd.tab.' + id), 'data-testid': 'tab-' + id, onclick: () => { readerTab = id; renderReader(); } })));
  // sources: always listed, the disk can be added or removed
  const srcs = el('div', { class: 'sources', 'data-testid': 'sources' });
  Ar.SOURCES.forEach((s) => {
    const on = !s.optional || st.disk;
    const row = el('div', { class: 'src' + (on ? ' on' : ''), 'data-testid': 'src-' + s.id, 'data-on': on ? '1' : '0' }, [el('span', { class: 'dot' }), el('span', { class: 'sname', text: srcName(s.id) }), el('span', { class: 'sstate', text: s.optional ? (on ? '' : T('rd.notSearched')) : T('rd.always') })]);
    if (s.optional) { row.append(el('button', { type: 'button', class: 'sbtn', text: on ? T('rd.remove') : T('rd.add'), 'data-testid': 'toggle-' + s.id, onclick: () => setDiskFromReader(!st.disk) })); }
    srcs.append(row);
  });
  const body = el('div', { class: 'pbody' });
  if (readerTab === 'bridge') {
    const r = Ar.resolveAsset(idx, '2004', 'bridge');
    const rAll = Ar.resolveAsset(all, '2004', 'bridge');
    const art = (r.copies[0] || rAll.copies[0] || {}).article;
    body.append(el('h3', { text: T('rd.bridge.title') }));
    if (art) { body.append(el('p', { class: 'from', text: T('rd.bridge.from', { who: art.from.split(' <')[0], date: fmtDate(art.date), subject: art.subject }) })); }
    body.append(el('div', { class: 'label', text: T('rd.copies') }));
    const list = el('ul', { class: 'copies', 'data-testid': 'copies' });
    Ar.SOURCES.forEach((s) => {
      const c = rAll.copies.find((x) => x.source === s.id); const searched = !s.optional || st.disk;
      const li = el('li', { class: 'copy ' + (c ? c.status : 'none') + (searched ? '' : ' off'), 'data-testid': 'copy-' + s.id, 'data-status': c ? c.status : 'none' }, [el('span', { class: 'cs', text: srcName(s.id) }), el('span', { class: 'cv', text: c ? T('rd.status.' + c.status) : T('rd.noCopy') })]);
      if (c && c.status !== 'stripped') { const bar = el('span', { class: 'bar' }); bar.append(el('span', { class: 'fill', style: `width:${Math.round(100 * c.size / Math.max(1, c.status === 'ok' ? c.size : r.entry ? r.entry.size : c.size))}%` })); li.append(bar); }
      if (readerTech && c) { li.append(el('code', { class: 'tech', text: `Message-ID: ${c.article.messageId}\nPath: ${c.article.path.join('!')}\n${c.name || '-'}  ${c.size} bytes  crc32 ${c.crc || '-'}` })); }
      list.append(li);
    });
    body.append(list, el('p', { class: 'result ' + (r.status === 'ok' ? 'good' : 'bad'), 'data-testid': 'bridge-result', 'data-status': r.status, text: T(r.status === 'ok' ? 'rd.result.ok' : 'rd.result.bad') }));
    if (readerTech && r.entry) { body.append(el('code', { class: 'tech', text: `manifest ${r.manifestId}\nasset bridge attach ${r.entry.messageId} ${r.entry.file} ${r.entry.size} ${r.entry.crc}\nReferences: ${(art ? art.references : []).join(' ')}` })); }
  } else if (readerTab === 'builds') {
    body.append(el('h3', { text: T('rd.builds.title') }));
    const mans = Ar.manifests(idx), mAll = Ar.manifests(all);
    ['1998', '2004'].forEach((b) => {
      const m = mans[b] || null, mm = mAll[b];
      const box = el('div', { class: 'buildbox', 'data-testid': 'build-' + b }, [el('div', { class: 'bt', text: T('rd.build.' + b) })]);
      if (m) { box.append(el('div', { text: T('rd.credits', { c: m.manifest.credits.map((c) => c.who).join(', ') }) }), el('div', { class: 'dim', text: T('rd.on', { s: m.sources.map(srcName).join(', ') }) })); }
      else { box.append(el('div', { class: 'dim', text: T('rd.build.missing') })); }
      if (b === '1998' && idx.cancels.some((c) => mm && c.target === mm.messageId)) { box.append(el('div', { class: 'dim', text: T('rd.build.cancelled') })); }
      if (readerTech && (m || mm)) { const x = m || mm; box.append(el('code', { class: 'tech', text: `Message-ID: ${x.messageId}\n${x.manifest.assets.length} assets\n` + idx.cancels.filter((c) => c.target === x.messageId).map((c) => `cancelled by ${c.messageId} on ${c.source}`).join('\n') })); }
      body.append(box);
    });
  } else if (readerTab === 'light') {
    body.append(el('h3', { text: T('rd.light.title') }), el('p', { text: T('rd.light.wanted') }));
    const w = Ar.resolveWanted(all, '1998', 'lighthouse_rule');
    body.append(el('p', { 'data-testid': 'light-status', 'data-status': w.status, text: w.status === 'envelope' ? T('rd.light.envelope', { date: fmtDate(w.article.date) }) : T('rd.light.none') }));
    if (readerTech && w.article) { body.append(el('code', { class: 'tech', text: `Message-ID: ${w.article.messageId}\nFrom: ${w.article.from}\nReferences: ${w.article.references.join(' ')}\nX-Archive: ${w.article.headers['x-archive'] || ''}` })); }
  }
  body.append(el('p', { class: 'dim note', text: T('rd.note') }));
  const techBtn = el('button', { type: 'button', class: 'techbtn', text: T(readerTech ? 'rd.tech.hide' : 'rd.tech.show'), 'data-testid': 'tech', 'aria-expanded': readerTech ? 'true' : 'false', onclick: () => { readerTech = !readerTech; renderReader(); } });
  ui.panel.append(head, tabs, srcs, body, techBtn);
}

// ---- menu -------------------------------------------------------------------------------------------------
function openMenu() {
  if (rt.mode === 'reader') { closeReader(); return; }
  if (rt.mode !== 'play' || rt.busy) { return; }
  rt.mode = 'menu'; holdEnd(); rt.keys.clear(); renderMenu(); ui.panel.hidden = false; renderHUD();
}
function closeMenu() { if (rt.mode === 'menu') { ui.panel.hidden = true; rt.mode = 'play'; renderHUD(); } }
function renderMenu() {
  ui.panel.textContent = '';
  const b = (text, id, fn) => el('button', { type: 'button', class: 'mbtn', text, 'data-testid': id, onclick: fn });
  ui.panel.append(el('div', { class: 'ph' }, [el('h2', { text: T('ui.menu') }), el('button', { class: 'pclose', type: 'button', text: T('ui.resume'), 'data-testid': 'resume', onclick: closeMenu })]));
  const vol = el('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(A.getVolume() * 100)), 'aria-label': T('ui.volume'), 'data-testid': 'volume', oninput: (e) => A.setVolume(e.target.value / 100) });
  ui.panel.append(el('div', { class: 'menu' }, [
    b(A.isMuted() ? T('ui.soundOff') : T('ui.soundOn'), 'sound', () => { A.setMuted(!A.isMuted()); renderMenu(); }), el('label', { class: 'vol' }, [el('span', { text: T('ui.volume') }), vol]),
    b(prefs.reduce ? T('ui.motionReduced') : T('ui.motionFull'), 'motion', () => { prefs.reduce = !prefs.reduce; savePrefs(); renderMenu(); renderHUD(); }),
    b(prefs.large ? T('ui.textLarge') : T('ui.textNormal'), 'textsize', () => { prefs.large = !prefs.large; savePrefs(); renderMenu(); renderHUD(); }),
    b(T('ui.lang'), 'lang', () => { prefs.lang = prefs.lang === 'zh' ? 'en' : 'zh'; savePrefs(); renderMenu(); renderHUD(); }),
    b(T('ui.safeSpot'), 'safe-spot', () => { returnToSafeSpot(); closeMenu(); }),
    b(T('ui.backTitle'), 'back-title', () => { persist(false); ui.panel.hidden = true; showTitle(); })
  ]), el('p', { class: 'dim controls', text: T('ui.controls') }));
}
function returnToSafeSpot() {
  // anti-stuck: back to the scene's start, or the near side of the canal in town
  const sp = Lv.SCENES[rt.sceneId].spawn;
  const s = Lv.safeSpot(rt.sceneId, sp.x, sp.z, levelCtx, theoBlock());
  rt.player.x = s.x; rt.player.z = s.z; rt.cam.yaw = sp.yaw; rt.safeCount += 1; persist(true);
}

// ---- light trail: a few warm motes along a walkable path to the current place to investigate -------------------
function makeTrail() {
  const N = 22;
  const tex = (() => { if (typeof document === 'undefined') { return null; } const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.35, 'rgba(255,200,110,0.7)'); gr.addColorStop(1, 'rgba(255,170,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffc870, size: 0.22, map: tex, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  points.frustumCulled = false; points.visible = false; points.renderOrder = 3;
  return { points, N };
}
function navGoal() {
  const nav = St.navTarget(st, facts()); if (!nav || nav.scene !== rt.sceneId) { return null; }
  let best = null, bd = Infinity;
  nav.ids.forEach((id) => {
    const p = id === 'theo' && rt.worlds.town ? rt.worlds.town.theo.position : Lv.point(rt.sceneId, id); if (!p) { return; }
    const d = Math.hypot(p.x - rt.player.x, p.z - rt.player.z); if (d < bd) { bd = d; best = { id, x: p.x, z: p.z }; }
  });
  return best;
}
function updateTrail(dt) {
  const w = rt.world; if (!w || !w.trail) { return; }
  const tr2 = w.trail; const on = st.guide && rt.mode === 'play' && !cinematic();
  if (!on) { tr2.points.visible = false; return; }
  const goal = navGoal();
  if (!goal) { tr2.points.visible = false; rt.guide.path = null; return; }
  const key = `${rt.sceneId}|${st.build}|${goal.id}|${levelCtx.bridgeLen.toFixed(1)}|${[...levelCtx.assets].length}`;
  const moved = !rt.guide.from || Math.hypot(rt.guide.from.x - rt.player.x, rt.guide.from.z - rt.player.z) > 0.8;
  if (key !== rt.guide.key || (moved && rt.t - rt.guide.at > 0.35) || (goal.id === 'theo' && rt.t - rt.guide.at > 0.6)) {
    rt.guide.path = Lv.findPath(rt.sceneId, { x: rt.player.x, z: rt.player.z }, goal, levelCtx, { reach: 2.4 });
    rt.guide.key = key; rt.guide.at = rt.t; rt.guide.from = { x: rt.player.x, z: rt.player.z };
  }
  const path = rt.guide.path;
  if (!path || path.length < 2) { tr2.points.visible = false; return; }
  const segs = []; let L = 0;
  for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); segs.push([path[i - 1], path[i], L, d]); L += d; }
  const span = Math.min(L, 9);                       // only the next few metres are lit
  rt.guide.phase = (rt.guide.phase + dt * (reduce() ? 0.25 : 0.9)) % 1;
  const arr = tr2.points.geometry.attributes.position.array;
  for (let i = 0; i < tr2.N; i++) {
    const s = Math.min(L, 0.7 + ((i / tr2.N + rt.guide.phase) % 1) * span);
    const sg = segs.find((g) => s <= g[2] + g[3]) || segs[segs.length - 1];
    const k = sg[3] ? (s - sg[2]) / sg[3] : 0;
    arr[i * 3] = sg[0][0] + (sg[1][0] - sg[0][0]) * k; arr[i * 3 + 2] = sg[0][1] + (sg[1][1] - sg[0][1]) * k;
    arr[i * 3 + 1] = 0.22 + (reduce() ? 0 : Math.sin(rt.t * 3 + i) * 0.05);
  }
  tr2.points.geometry.attributes.position.needsUpdate = true; tr2.points.visible = true;
}

// ---- particles (plank dust, bridge finish) -----------------------------------------------------------------
let dustTex = null;
function burst(pos, n, color, speed) {
  if (!rt.world) { return; }
  if (!dustTex) { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); dustTex = new THREE.CanvasTexture(c); }
  const count = reduce() ? Math.ceil(n / 3) : n;
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.copy(pos); s.scale.setScalar(0.25 + Math.random() * 0.25);
    const a = Math.random() * Math.PI * 2, u = Math.random();
    s.userData = { v: new THREE.Vector3(Math.cos(a) * u * speed, 0.6 + Math.random() * speed, Math.sin(a) * u * speed), life: 0.8 + Math.random() * 0.5, age: 0 };
    rt.world.scene.add(s); rt.particles.push(s);
  }
}
function tickParticles(dt) {
  rt.particles = rt.particles.filter((s) => {
    const u = s.userData; u.age += dt; if (u.age > u.life) { s.parent && s.parent.remove(s); s.material.dispose(); return false; }
    u.v.y -= dt * 1.6; s.position.addScaledVector(u.v, dt); s.material.opacity = 1 - u.age / u.life; return true;
  });
}

// ---- anomaly and the chapter end ---------------------------------------------------------------------------
async function anomaly() {
  rt.mode = 'cut'; renderHudFade(); holdEnd();
  const w = rt.worlds.town;
  rt.shot = { pos: new THREE.Vector3(-2.4, 2.8, 27.0), look: new THREE.Vector3(14, 4.6, 20.4) };   // over Mara's shoulder, the lighthouse and its beam in frame
  A.play('anomaly'); w.startAnomaly(rt.t);
  await wait(reduce() ? 1.2 : 5.0);
  rt.mode = 'play';
}
async function ending() {
  rt.shot = null; rt.mode = 'ending'; renderHUD(); renderHudFade(); A.setScene('ending');
  await wait(reduce() ? 0.2 : 0.8);
  ui.overlay.className = 'overlay ending'; ui.overlay.hidden = false; ui.overlay.textContent = '';
  ui.overlay.append(el('div', { class: 'endcard', 'data-testid': 'ending' }, [
    el('div', { class: 'a', text: T('ui.toBeContinued') }), el('div', { class: 'b', text: T('ui.chapterDone') }), el('div', { class: 'c', text: T('ui.nextChapter') }),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn primary', type: 'button', text: T('ui.keepExploring'), 'data-testid': 'keep-exploring', onclick: () => { ui.overlay.hidden = true; rt.mode = 'play'; A.setScene('town' + st.build.slice(2)); renderHUD(); renderHudFade(); persist(true); } }),
      el('button', { class: 'btn', type: 'button', text: T('ui.backTitle'), 'data-testid': 'back-to-title', onclick: () => { ui.overlay.hidden = true; showTitle(); } })])
  ]));
  persist(true);
}

// ---- title and intro --------------------------------------------------------------------------------------
function showTitle() {
  rt.mode = 'title'; ui.touch.hidden = true; ui.prompt.hidden = true; ui.panel.hidden = true; holdEnd();
  if (!rt.world || rt.sceneId !== 'study') { enterScene('study', Lv.SCENES.study.spawn); }
  renderHUD(); renderHudFade();
  const saved = readSave();
  ui.overlay.className = 'overlay title'; ui.overlay.hidden = false; ui.overlay.textContent = '';
  const row = el('div', { class: 'row' });
  if (saved) {
    row.append(el('button', { class: 'btn primary', type: 'button', text: T('ui.continue'), 'data-testid': 'continue', onclick: () => begin(saved, false) }));
    row.append(el('button', { class: 'btn', type: 'button', text: T('ui.newGame'), 'data-testid': 'new-game', onclick: () => { if (window.confirm(T('ui.confirmNew'))) { begin(null, true); } } }));
  } else { row.append(el('button', { class: 'btn primary', type: 'button', text: T('ui.start'), 'data-testid': 'start', onclick: () => begin(null, true) })); }
  const langBtn = el('button', { class: 'btn ghost', type: 'button', text: T('ui.lang'), 'data-testid': 'lang', onclick: () => { prefs.lang = prefs.lang === 'zh' ? 'en' : 'zh'; savePrefs(); showTitle(); } });
  ui.overlay.append(el('div', { class: 'titlebox', 'data-testid': 'title' }, [el('h1', { text: T('ui.title') }), el('div', { class: 'sub', text: T('ui.subtitle') }), el('div', { class: 'tag', text: T('ui.tagline') }), row, el('div', { class: 'note', text: T('ui.saveNote') })]), el('div', { class: 'tl' }, [langBtn]));
}
async function begin(saved, fresh) {
  A.unlock(); ui.overlay.hidden = true;
  if (fresh) {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    st = St.newState(); rt.worlds = {}; rt.world = null; rt.mode = 'intro';
    enterScene('study', Lv.SCENES.study.spawn);
    await intro();
  } else { st = saved; rt.worlds = {}; rt.world = null; enterScene(st.scene, null); }
  rt.mode = 'play'; rt.stepAt = rt.t; rt.lastStep = currentStep();
  if (coarse) { ui.touch.hidden = false; }
  renderHUD(); renderHudFade(); persist(false);
}
async function intro() {
  ui.overlay.className = 'overlay intro'; ui.overlay.hidden = false; ui.overlay.textContent = '';
  let skipped = false;
  const lines = ['intro.1', 'intro.2', 'intro.3'].map((k) => el('p', { text: T(k) }));
  ui.overlay.append(el('div', { 'data-testid': 'intro' }, lines), el('button', { class: 'btn ghost skipintro', type: 'button', text: T('ui.skipIntro'), 'data-testid': 'skip-intro', onclick: () => { skipped = true; } }));
  for (const p of lines) { if (skipped) { break; } p.classList.add('on'); for (let i = 0; i < (reduce() ? 4 : 20) && !skipped; i++) { await wait(0.1); } }
  ui.overlay.hidden = true;
}

// ---- input ------------------------------------------------------------------------------------------------
const isTyping = (e) => e.target && e.target.tagName === 'INPUT';
window.addEventListener('keydown', (e) => {
  if (isTyping(e)) { return; }
  A.unlock();
  const k = e.key.toLowerCase();
  if (k === 'escape') { e.preventDefault(); if (rt.mode === 'reader') { closeReader(); } else if (rt.mode === 'menu') { closeMenu(); } else { openMenu(); } return; }
  if (rt.mode === 'reader') { if (k === 'r') { closeReader(); } return; }
  if (rt.dialog) { if (k === 'e' || k === ' ' || k === 'enter' || k === 'f') { e.preventDefault(); if (!e.repeat) { advanceDialog(); } } if (k === 'x' || k === 'tab') { e.preventDefault(); skipDialog(); } return; }
  if (rt.mode !== 'play') { return; }
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) { rt.keys.add(k); if (k.startsWith('arrow')) { e.preventDefault(); } }
  if ((k === 'e' || k === 'f' || k === 'enter') && !e.repeat && rt.near) { e.preventDefault(); if (!holdStart('key')) { interact(rt.near.id); } }
  if (k === 'h' && !e.repeat) { st = St.nextHint(st, facts()); renderHUD(); A.play('hint'); persist(false); }
  if (k === 'g' && !e.repeat) { toggleGuide(); }
  if (k === 'v' && !e.repeat) { trySwitch(); }
  if (k === 'r' && !e.repeat && st.flags.readerSeen) { openReader(null); }
});
window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); rt.keys.delete(k); if ((k === 'e' || k === 'f' || k === 'enter') && rt.hold.src === 'key') { holdEnd(); } });
window.addEventListener('blur', () => { rt.keys.clear(); holdEnd(); });
const cv = renderer.domElement;
let drag = null;
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => { A.unlock(); if (e.pointerType === 'touch') { ui.touch.hidden = rt.mode !== 'play'; } drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } cv.style.cursor = 'grabbing'; });
cv.addEventListener('pointermove', (e) => { if (drag && drag.id === e.pointerId) { look(e.clientX - drag.x, e.clientY - drag.y, e.pointerType === 'touch' ? 1.2 : 1); drag.x = e.clientX; drag.y = e.clientY; } });
const endDrag = (e) => { if (drag && drag.id === e.pointerId) { drag = null; cv.style.cursor = ''; } };
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
function look(dx, dy, k) {
  if (rt.mode !== 'play' || rt.shot) { return; }
  const c = Lv.SCENES[rt.sceneId].camera;
  rt.cam.yaw -= dx * 0.0055 * (k || 1); rt.cam.pitch = Math.max(c.minPitch, Math.min(c.maxPitch, rt.cam.pitch + dy * 0.004 * (k || 1)));
  if (rt.tut.stage === 1 && (Math.abs(dx) + Math.abs(dy) > 0)) { rt.tut.looked = (rt.tut.looked || 0) + Math.abs(dx) + Math.abs(dy); if (rt.tut.looked > 140) { advanceTutorial(2); } }
}
ui.stick.addEventListener('pointerdown', (e) => { e.preventDefault(); rt.stick.id = e.pointerId; try { ui.stick.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } stickMove(e); });
ui.stick.addEventListener('pointermove', (e) => { if (rt.stick.id === e.pointerId) { stickMove(e); } });
const stickEnd = (e) => { if (rt.stick.id === e.pointerId) { rt.stick = { x: 0, y: 0, id: null }; ui.stick.firstChild.style.transform = ''; } };
ui.stick.addEventListener('pointerup', stickEnd); ui.stick.addEventListener('pointercancel', stickEnd);
function stickMove(e) {
  const r = ui.stick.getBoundingClientRect(); let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  rt.stick.x = x; rt.stick.y = y; ui.stick.firstChild.style.transform = `translate(${x * 36}px, ${y * 36}px)`;
}
ui.use.addEventListener('pointerdown', (e) => { e.preventDefault(); A.unlock(); if (rt.dialog) { advanceDialog(); } else if (rt.near && !holdStart('touch')) { interact(rt.near.id); } });
ui.use.addEventListener('pointerup', () => { if (rt.hold.src === 'touch') { holdEnd(); } });
ui.use.addEventListener('pointercancel', () => { if (rt.hold.src === 'touch') { holdEnd(); } });
ui.prompt.addEventListener('pointerdown', (e) => { if (rt.near && St.isHold(st, rt.near.id, facts())) { e.preventDefault(); holdStart('prompt'); } });
ui.prompt.addEventListener('pointerup', () => { if (rt.hold.src === 'prompt') { holdEnd(); } });
ui.prompt.addEventListener('click', () => { if (rt.near && !St.isHold(st, rt.near.id, facts())) { interact(rt.near.id); } });

// ---- simulation -------------------------------------------------------------------------------------------
function moveInput() {
  let fx = 0, fz = 0; const k = rt.keys;
  if (k.has('w') || k.has('arrowup')) { fz += 1; } if (k.has('s') || k.has('arrowdown')) { fz -= 1; }
  if (k.has('d') || k.has('arrowright')) { fx += 1; } if (k.has('a') || k.has('arrowleft')) { fx -= 1; }
  if (rt.stick.id !== null) { fx += rt.stick.x; fz -= rt.stick.y; }
  const m = Math.hypot(fx, fz); if (m > 1) { fx /= m; fz /= m; }
  return { fx, fz, run: k.has('shift') };
}
function whereOf(id) {
  if (id === 'theo' && rt.worlds.town) {
    const th = rt.worlds.town.theo.position;
    const across = th.z > Lv.CANAL.z1 && rt.player.z < Lv.CANAL.z0;
    return { x: th.x, z: th.z, r: across ? Lv.THEO_SHOUT_REACH : 1.8 };
  }
  return null;
}
function step(dt) {
  const p = rt.player;
  const free = rt.mode === 'play' && !rt.busy && !rt.dialog && !rt.hold.down;
  let speed = 0;
  if (free) {
    const { fx, fz, run } = moveInput();
    if (fx || fz) {
      const yaw = rt.cam.yaw, fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw), rgtX = Math.cos(yaw), rgtZ = -Math.sin(yaw);
      const dx = fwdX * fz + rgtX * fx, dz = fwdZ * fz + rgtZ * fx;
      const sp = (run ? RUN : WALK) * Math.min(1, Math.hypot(fx, fz));
      const np = Lv.move(rt.sceneId, p.x, p.z, dx * sp * dt, dz * sp * dt, levelCtx, theoBlock());
      const moved = Math.hypot(np.x - p.x, np.z - p.z);
      speed = moved / dt; p.x = np.x; p.z = np.z;
      const want = Math.atan2(dx, dz); p.facing += Math.atan2(Math.sin(want - p.facing), Math.cos(want - p.facing)) * Math.min(1, dt * 12);
      p.phase += moved * 4.4; p.stepAcc += moved; if (p.stepAcc > 0.62) { p.stepAcc = 0; A.play('step'); }
      rt.tut.moved += moved; if (rt.tut.stage === 0 && rt.tut.moved > 1.5) { advanceTutorial(1); }
    }
  }
  p.speed = speed;
  if (rt.dialog && rt.sceneId === 'town' && rt.dialog.lines.some((l) => l[0] === 'theo')) { const th = rt.worlds.town.theo.position; const want = Math.atan2(th.x - p.x, th.z - p.z); p.facing += Math.atan2(Math.sin(want - p.facing), Math.cos(want - p.facing)) * Math.min(1, dt * 6); }
  mara.position.set(p.x, 0, p.z); mara.rotation.y = p.facing;
  if (rt.act > 0) { rt.act -= dt; }
  animate(mara, rt.t, p.phase, speed, rt.hold.down ? 'reach' : (rt.act > 0 ? 'reach' : 'idle'), reduce());
  const f = facts();
  const avail = (id) => St.available(st, id, f);
  rt.near = (free || rt.hold.down) ? Lv.nearest(rt.sceneId, p.x, p.z, avail, whereOf, levelCtx) : null;
  if (rt.near && rt.near.id === 'gap' && St.isHold(st, 'gap', f)) { showTip('tip.hold'); }
  // pier triggers (only the 1998 build has a pier to stand on)
  if (rt.sceneId === 'town' && rt.mode === 'play' && !rt.busy && !rt.dialog) {
    if (st.build === '1998' && p.z > 15.2 && !st.flags.pierReached) { const r = St.onPier(st, f); if (r.events.length) { st = r.state; runEvents(r.events); } }
    if (st.build === '1998' && p.z > 23.4 && st.flags.pierReached && !st.flags.anomaly) { const r = St.atPierEnd(st, f); if (r.events.length) { st = r.state; rt.busy = true; runEvents(r.events).finally(() => { rt.busy = false; renderHudFade(); }); } }
  }
}
// Hints come by themselves when the player seems stuck: one level per 70 s on the same objective (max level 2).
function autoHints() {
  if (rt.mode !== 'play') { return; }
  const s = currentStep();
  if (s !== rt.lastStep) { rt.lastStep = s; rt.stepAt = rt.t; rt.autoHinted = 0; renderHUD(); }
  if (s === 'END') { return; }
  const lvl = st.hint && st.hint.step === s ? st.hint.level : 0;
  if (rt.t - rt.stepAt > 70 * (rt.autoHinted + 1) && lvl < 2 && !rt.dialog && !rt.busy) {
    rt.autoHinted += 1; st = St.nextHint(st, facts()); renderHUD(); A.play('hint');
    if (!st.guide) { showTip('tip.guide'); }
  }
}

function updateCamera(snap) {
  if (rt.shot) { rt.cam.pos.copy(rt.shot.pos); rt.cam.look.copy(rt.shot.look); camera.position.copy(rt.cam.pos); camera.lookAt(rt.cam.look); return; }
  const p = rt.player, c = rt.cam;
  let dist = c.dist; const pitch = c.pitch, yaw = c.yaw;
  if (camera.aspect < 0.8) { dist *= 1.3; }
  const target = new THREE.Vector3(p.x, 1.35, p.z);
  const cp = Math.cos(pitch);
  const want = new THREE.Vector3(target.x + Math.sin(yaw) * cp * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * cp * dist);
  const room = Lv.SCENES[rt.sceneId].camera.room;
  if (room) { want.x = Math.max(room.x0 + 0.15, Math.min(room.x1 - 0.15, want.x)); want.z = Math.max(room.z0 + 0.15, Math.min(room.z1 - 0.15, want.z)); want.y = Math.min(room.y1 - 0.1, want.y); }
  else if (rt.world) {
    const bl = rt.world.activeBlockers ? rt.world.activeBlockers() : rt.world.blockers;
    const dir = want.clone().sub(target); const len = dir.length(); dir.normalize();
    raycaster.set(target, dir); raycaster.far = len;
    const hit = raycaster.intersectObjects(bl, false)[0];
    if (hit) { want.copy(target).addScaledVector(dir, Math.max(0.6, hit.distance - 0.35)); }
  }
  const k = snap || reduce() ? 1 : 0.16;
  c.pos.lerp(want, k); if (snap) { c.pos.copy(want); }
  c.look.lerp(target, snap ? 1 : 0.2);
  camera.position.copy(c.pos); camera.lookAt(c.look);
}
const v3 = new THREE.Vector3();
function updatePrompt() {
  const n = rt.near;
  const show = !!n && (rt.mode === 'play') && !rt.dialog && !rt.busy;
  ui.prompt.hidden = !show; if (!show) { return; }
  const f = facts(); const hold = St.isHold(st, n.id, f);
  const verb = T(St.verbFor(st, n.id, f) || n.verb);
  const key = coarse ? '\u270B' : 'E';
  const sig = `${n.id}|${verb}|${hold}|${rt.uses < 6}|${prefs.lang}`;
  if (ui.prompt.getAttribute('data-sig') !== sig) {
    ui.prompt.setAttribute('data-sig', sig); ui.prompt.textContent = '';
    ui.prompt.classList.toggle('compact', rt.uses >= 6 && !hold);
    ui.prompt.append(el('span', { class: 'key', text: key }), el('span', { class: 'verb', text: (hold ? (prefs.lang === 'zh' ? '\u6309\u4f4f ' : 'Hold \u00b7 ') : '') + verb }), el('span', { class: 'name', text: T('name.' + n.id) }));
    if (hold) { ui.prompt.append(el('span', { class: 'ring' }, [el('span', { class: 'ringfill' })])); }
    ui.prompt.setAttribute('data-id', n.id);
  }
  if (hold) { const fill = ui.prompt.querySelector('.ringfill'); if (fill) { fill.style.width = Math.round(st.bridge * 100) + '%'; } }
  const wp = whereOf(n.id) || n;
  v3.set(wp.x, n.y || 1.6, wp.z); if (n.id === 'theo') { v3.y = 2.3; }
  v3.project(camera);
  const x = (v3.x * 0.5 + 0.5) * window.innerWidth, y = (-v3.y * 0.5 + 0.5) * window.innerHeight;
  const cx = Math.max(90, Math.min(window.innerWidth - 90, x)), cy = Math.max(110, Math.min(window.innerHeight - 140, y));
  ui.prompt.style.left = cx + 'px'; ui.prompt.style.top = cy + 'px';
}

let last = 0, fpsAcc = 0, fpsN = 0, frameErrors = 0;
function frame(now) {
  try { tickFrame(now); } catch (e) { frameErrors += 1; if (frameErrors < 4) { console.error('P5 frame error', e && e.stack ? e.stack : e); } }
  requestAnimationFrame(frame);
}
function tickFrame(now) {
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016; last = now;
  rt.t += dt; rt.frames += 1; fpsAcc += dt; fpsN += 1;
  if (fpsAcc > 1) {
    rt.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
    if (rt.frames > 60 && rt.fps < 26 && quality.level < QUALITY.length - 1) { quality.slow += 1; if (quality.slow >= 2) { quality.level += 1; quality.slow = 0; applyQuality(); resize(); } } else { quality.slow = 0; }
  }
  if (!renderer.shadowMap.autoUpdate && rt.frames % QUALITY[quality.level].shadowEvery === 0) { renderer.shadowMap.needsUpdate = true; }
  if (rt.world) {
    if (rt.mode === 'title') { rt.cam.yaw = Lv.SCENES.study.spawn.yaw + Math.sin(rt.t * 0.12) * 0.35; }
    step(dt); holdTick(dt); autoHints();
    if (rt.sceneId === 'study') { rt.world.update(dt, rt.t, reduce()); }
    else {
      const w = rt.world; w.update(dt, rt.t, reduce());
      const th = w.theo; const d = Math.hypot(th.position.x - rt.player.x, th.position.z - rt.player.z);
      if (d < 7) { w.theoFace(rt.player.x, rt.player.z); }
      const calling = !st.flags.theoMet && rt.theoCalled;
      const talking = !!rt.dialog && rt.dialog.lines.some((l) => l[0] === 'theo');
      const a = w.theoAnim(rt.t, reduce(), talking || (rt.caption && rt.caption.who === 'theo' && rt.t < rt.caption.until), calling);
      animate(th, rt.t, a.phase, a.speed, a.mode, reduce());
      if (calling && Math.floor(rt.t) % 9 === 0 && Math.floor(rt.t - dt) % 9 !== 0 && !rt.dialog && !rt.busy) { A.play('call'); }
    }
    tickDialog(); tickParticles(dt);
    updateCamera(false); updatePrompt(); updateTrail(dt);
    if (rt.caption && rt.t > rt.caption.until && ui.caption.style.opacity !== '0') { renderCaption(); }
    if (rt.tip && rt.t > rt.tip.until && ui.tip.getAttribute('data-sig')) { rt.tip = null; renderTip(); }
    if (rt.tut.stage === 2 || (rt.tut.stage < 3 && rt.near)) { renderTip(); }
    renderHudFade();
    if (rt.mode === 'play' && rt.t - rt.lastSave > 4) { persist(false); }
    renderer.render(rt.world.scene, camera);
  }
}

// Read-only view of the game for automated tests. It cannot change anything.
window.P5Debug = {
  snapshot() {
    const w = rt.worlds.town, f = facts();
    return {
      mode: rt.mode, busy: rt.busy, scene: rt.sceneId, step: currentStep(), build: st.build, disk: st.disk, bridge: st.bridge, bridgeFrom: st.bridgeFrom, flags: Object.assign({}, st.flags), clues: st.clues.slice(),
      facts: f, x: rt.player.x, z: rt.player.z, yaw: rt.cam.yaw, near: rt.near ? rt.near.id : null, hold: rt.hold.down, nearHold: !!rt.near && St.isHold(st, rt.near.id, f),
      dialog: rt.dialog ? { who: rt.dialog.lines[rt.dialog.i][0], key: rt.dialog.lines[rt.dialog.i][1], i: rt.dialog.i, n: rt.dialog.lines.length, id: rt.dialog.id, seen: rt.dialog.seen } : null,
      caption: rt.caption && rt.t < rt.caption.until ? rt.caption.key : null, tip: ui.tip.getAttribute('data-key') || null, hint: St.hintKey(st, f), guide: st.guide,
      guidePath: rt.guide.path ? rt.guide.path.map((q) => [q[0], q[1]]) : null, guideVisible: !!(rt.world && rt.world.trail && rt.world.trail.points.visible),
      assets: [...levelCtx.assets], bridgeLen: levelCtx.bridgeLen, standable: Lv.canStand(rt.sceneId, rt.player.x, rt.player.z, levelCtx),
      theo: w ? { x: w.theo.position.x, z: w.theo.position.z, walking: w.theoWalking } : null, hudHidden: app.classList.contains('cine'),
      shot: !!rt.shot, safeCount: rt.safeCount, fps: rt.fps, quality: quality.level, frames: rt.frames, tutorial: rt.tut.stage, heard: A.heardList(), log: rt.log.slice(-30)
    };
  }
};

// ---- start: read the archive files, then the title -----------------------------------------------------------
async function loadArchive() {
  const texts = {};
  await Promise.all(Ar.SOURCES.map(async (s) => { const r = await fetch('/p5/data/' + s.file); if (!r.ok) { throw new Error(s.file + ' ' + r.status); } texts[s.id] = await r.text(); }));
  archive = Ar.createArchive(texts);
  if (!Ar.buildAvailable(archive.view({ disk: false }), '2004')) { throw new Error('no public build in the archive'); }
}
renderHUD();
ui.overlay.className = 'overlay title'; ui.overlay.hidden = false; ui.overlay.append(el('p', { class: 'loading', text: T('ui.loading') }));
requestAnimationFrame(frame);
loadArchive().then(() => { showTitle(); }).catch((e) => {
  ui.overlay.textContent = ''; ui.overlay.append(el('p', { class: 'err', text: T('ui.loadError'), 'data-testid': 'load-error' }));
  console.error(e);
});
