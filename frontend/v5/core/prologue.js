// R4: the prologue and the epilogue as part of the same pure simulation (core/game.js installs this module).
//
//   P.kitchen  February 2026. Rain. Mara asks her mother about the girl in the photo and the computer she was never
//              allowed to touch. Three choices change the words, never the fact: Elena almost says it, the kettle
//              screams, Mara leaves. "Take care on the road." The last time they see each other.
//   P.house    October 2026, the same kitchen, emptied. The answering machine (the agent's deadline, a neighbour, and
//              Mom's saved message from the day after), her keys, the study she always kept locked.
//   1.study    (unchanged id, now in the prologue) the KEEP box, the disk, the folded photo; the computer.
//   P.restore  The archive restore tool on the CRT: read the disk, open the posts, repair the damaged 1998 summer build
//              from the disk, compare its two names with the one name of the 2004 public build, run the first memory.
//   P.summer   The end of the old pier, summer 1998: June takes the photo that was later folded in half. The memory
//              breaks where the record does, and Mara goes into the 2004 copy to put the missing pieces back (ch. 1).
//   E.study    After chapter 7: the photo unfolded for good, a letter to "M.", and goodbye.
import * as Co from './companion.js';
import { LAYOUTS, point } from './layout.js';

export const R4_BEATS = ['P.kitchen', 'P.house', 'P.restore', 'P.summer', 'E.study'];
export const owns = (beat) => R4_BEATS.indexOf(beat) >= 0;
export const HOLD_R4 = { disk: 2.2, repair: 3.0, run: 2.5, unfold: 1.8 };
// the records on the restore tool, top to bottom; 'gone' is optional
export const RECORDS = ['met', 'b98', 'b04', 'gone'];
const REQUIRED = ['met', 'b98', 'b04'];
const CRT = { x: 3.0, z: -2.75 };

let A = null;   // the game's own helpers (dialog, say, enterBeat, later, seen, moveBody, L, pause, C)
export function install(api) { A = api; Object.assign(api.DIALOGS, dialogs(api)); }

function dialogs({ L, pause, C }) {
  return {
    // P.kitchen
    'p.k.talk': [L('mara', 'p.k.m1', 'mara'), L('mother', 'p.k.e1', 'mother'), L('mara', 'p.k.m2', 'mara'), pause(1.0, 'mother'), L('mother', 'p.k.e2', 'mother'), L('mara', 'p.k.m3', 'mara'), pause(0.8, 'mother'), L('mother', 'p.k.e3', 'mother'), C('pk1', ['p.choice.k1a', 'p.choice.k1b'])],
    'p.k.a': [L('mara', 'p.k.a1', 'mara'), pause(0.8, 'mother'), L('mother', 'p.k.a2', 'mother')],
    'p.k.b': [L('mara', 'p.k.b1', 'mara'), L('mother', 'p.k.b2', 'mother'), pause(1.0, 'mother'), L('mother', 'p.k.b3', 'mother')],
    'p.k.mid': [L('mara', 'p.k.m4', 'mara'), L('mother', 'p.k.e4', 'mother'), L('mara', 'p.k.m5', 'mara'), pause(1.2, 'mother'), L('mother', 'p.k.e5', 'mother'), C('pk2', ['p.choice.k2a', 'p.choice.k2b'])],
    'p.k.c': [L('mara', 'p.k.c1', 'mara'), L('mother', 'p.k.c2', 'mother')],
    'p.k.d': [L('mara', 'p.k.d1', 'mara'), L('mother', 'p.k.d2', 'mother'), pause(1.0, 'mother'), L('mother', 'p.k.d3', 'mother')],
    'p.k.kettle': [pause(0.8, 'mother'), L('mother', 'p.k.e6', 'mother'), L('screen', 'p.k.kettleSfx', 'kitchen'), pause(1.4, 'kitchen'), L('mother', 'p.k.e7', 'mother'), L('mara', 'p.k.m6', 'mara'), L('mother', 'p.k.e8', 'mother'), L('mara', 'p.k.m7', 'mara')],
    'p.k.door': [pause(0.8, 'mother'), C('pk3', ['p.choice.k3a', 'p.choice.k3b'])],
    'p.k.byeA': [L('mara', 'p.k.bye', 'mara'), pause(0.9, 'mother'), L('mother', 'p.k.careful', 'mother')],
    'p.k.byeB': [pause(1.8, 'mother'), L('mother', 'p.k.careful', 'mother')],
    // P.house
    'p.h.machine': [L('screen', 'p.h.m.count'), L('machine', 'p.h.m1'), L('machine', 'p.h.m2'), L('screen', 'p.h.m.saved'), pause(0.8), L('machine', 'p.h.m3'), pause(1.4, 'mara'), L('mara', 'p.h.m.after', 'mara'), L('mara', 'p.h.m.byeA', 'mara')],
    'p.h.open': [L('mara', 'p.h.open1', 'mara'), L('mara', 'p.h.open2', 'mara')],
    // P.restore
    'p.r.met': [L('screen', 'arch.met.ask'), L('screen', 'arch.met.reply'), L('mara', 'c1.mara.met'), L('mara', 'c1.mara.junebug')],
    'p.r.b98': [L('screen', 'p.r.b98.credits'), L('mara', 'p.r.b98.mara')],
    'p.r.b04': [L('screen', 'p.r.b04.credits'), L('mara', 'p.r.b04.mara')],
    'p.r.gone': [L('screen', 'p.r.gone.body'), L('mara', 'p.r.gone.mara')],
    'p.r.question': [pause(0.8), L('mara', 'p.r.q1'), L('mara', 'p.r.q2'), pause(1.0), L('mara', 'p.r.q3'), L('mara', 'c1.mara.open'), L('screen', 'p.r.q4')],
    // P.summer
    'p.s.photo': [L('june', 'c1.june.photo', 'june'), L('elena', 'c1.elena.noFace', 'elena'), L('june', 'c1.june.oneFace', 'june'), pause(0.7, 'twoshot'), L('mara', 'p.s.mara.photo', 'twoshot'),
      L('june', 'p.s.j1', 'june'), L('elena', 'p.s.e1', 'elena'), L('june', 'p.s.j2', 'june'), L('elena', 'p.s.e2', 'elena'), L('june', 'p.s.j3', 'june'), C('ps', ['p.choice.s1', 'p.choice.s2'])],
    'p.s.a': [L('elena', 'p.s.pa', 'elena'), L('june', 'p.s.pa2', 'june'), L('june', 'p.s.j4', 'june')],
    'p.s.b': [L('elena', 'p.s.pb', 'elena'), L('june', 'p.s.pb2', 'june'), L('june', 'p.s.j4', 'june')],
    'p.s.break': [L('screen', 'p.s.err'), L('mara', 'p.s.m1'), L('mara', 'p.s.m2'), L('mara', 'p.s.m3')],
    // E.study
    'p.e.photo': [L('screen', 'p.e.ph1'), pause(1.0), L('mara', 'p.e.ph2'), L('mara', 'p.e.ph3')],
    'p.e.letter': [L('mara', 'p.e.l0'), L('screen', 'p.e.l1'), L('screen', 'p.e.l2'), L('screen', 'p.e.l3'), pause(1.4), L('mara', 'p.e.l4')],
    'p.e.final': [L('mara', 'p.e.f1'), L('mara', 'p.e.f2'), L('mara', 'p.e.f3'), pause(1.0), L('mara', 'p.e.f4'), L('mara', 'p.e.f5a'), L('screen', 'p.e.f6')]
  };
}
// the last words at the door, remembered later in the chapters and the epilogue
export const saidBye = (g) => g.s.choices.pk3 !== 'p.choice.k3b';
const swap = (lines, from, to) => lines.map((ln) => (Array.isArray(ln) && ln[1] === from ? [ln[0], to, ln[2]] : ln));

export const BEAT_START_R4 = {
  'P.kitchen': LAYOUTS.kitchen.spawn, 'P.house': LAYOUTS.kitchen.spawn, 'P.restore': { x: 3.0, z: -1.75, yaw: 0 },
  'P.summer': { x: -0.2, z: 23.0, yaw: Math.PI }, 'E.study': { x: 2.6, z: -1.2, yaw: 0.4 }
};

export const SETUP_R4 = {
  'P.kitchen': (g) => {
    const K = LAYOUTS.kitchen; g.rt.baseShot = null; g.rt.rain = true;
    g.rt.mother = Co.newCompanion(K.stove.x, K.stove.z, K.stove.yaw); Co.wait(g.rt.mother, null, 'quiet'); g.rt.mother.anim = 'turnaway';
    if (!g.s.flags.kCard) { g.s.flags.kCard = true; g.rt.ev.push({ type: 'card', a: 'p.card.kitchen.a', b: 'p.card.kitchen.b' }); }
    if (!A.seen(g, 'p.k.talk')) { A.later(g, 2.6, () => { if (!g.rt.dialog) { A.say(g, 'mother', 'p.k.hello', 4); Co.react(g.rt.mother, 'smile', 'idle', 2); } }); }
    else if (g.s.flags.kArgued) { motherByDoor(g, true); }
  },
  'P.house': (g) => {
    g.rt.baseShot = null; g.rt.rain = false;
    if (!g.s.flags.hCard) { g.s.flags.hCard = true; g.rt.ev.push({ type: 'card', a: 'p.card.house.a', b: 'p.card.house.b' }); A.later(g, 3.8, () => A.say(g, 'mara', 'p.h.enter', 4.5)); }
  },
  'P.restore': (g) => {
    g.rt.seated = true; g.rt.baseShot = 'crt'; g.rt.shot = 'crt';
    const f = g.s.flags; const opened = {}; RECORDS.forEach((r) => { if (f['rec_' + r]) { opened[r] = true; } });
    g.rt.crt = { stage: f.mounted ? (f.restoreAsked ? 'run' : 'list') : 'mount', sel: 0, opened, lastMz: 0 };
    g.rt.ev.push({ type: 'crt', on: true });
  },
  'P.summer': (g) => {
    g.rt.june = Co.newCompanion(0.55, 24.5, Math.PI); Co.invite(g.rt.june, null, 'grin'); g.rt.june.anim = 'camera';
    if (A.seen(g, 'p.s.photo')) { startFollow(g); }
    else { A.later(g, 1.6, () => { if (!g.rt.dialog) { A.say(g, 'june', 'p.s.call', 3.6); } }); }
  },
  'E.study': (g) => {
    g.rt.baseShot = null; g.rt.ev.push({ type: 'crt', on: true });
    if (!g.s.flags.eEnter) { g.s.flags.eEnter = true; A.later(g, 1.2, () => A.say(g, 'mara', 'p.e.enter', 5.5)); }
  }
};

function motherByDoor(g, now) {
  const K = LAYOUTS.kitchen, m = g.rt.mother; if (!m) { return; }
  if (now) { m.x = K.byDoor.x + 0.6; m.z = K.byDoor.z - 0.7; Co.wait(m, null, 'quiet'); return; }
  Co.transition(m, [[1.2, -0.9], [-0.9, -0.5], [K.byDoor.x + 0.6, K.byDoor.z - 0.7]], 1.1);
}
function startFollow(g) { const j = g.rt.june; if (!j) { return; } j.anim = 'idle'; Co.lead(j, [[0.4, 23.6], [0.1, 22.5]], { ahead: 2.2, waitR: 5, speed: 1.1 }); g.rt.following = true; }

// ---- interaction points --------------------------------------------------------------------------------------------
export function points(g) {
  const s = g.s, rt = g.rt, f = s.flags, beat = s.beat, out = [];
  const add = (id, x, z, r, extra) => out.push(Object.assign({ id, x, z, r }, extra || {}));
  const at = (sc, id, extra) => { const q = point(sc, id); if (q) { add(id, q.x, q.z, q.r, extra); } };
  if (beat === 'P.kitchen') {
    if (rt.leaving) { return out; }
    const m = rt.mother;
    if (m && !f.kArgued && !rt.dialog) { add('mother', m.x, m.z, 1.75, { verb: 'verb.talk', moving: true, priority: 1 }); }
    at('kitchen', 'frontdoor', { verb: 'verb.leave', priority: f.kArgued ? 2 : 0 });
    ['coat', 'kwindow', 'fridge', 'studydoor', 'kettle'].forEach((id) => at('kitchen', id, { verb: 'verb.look', optional: true }));
  } else if (beat === 'P.house') {
    at('kitchen', 'machine', { verb: f.machine ? 'verb.look' : 'verb.listen', optional: !!f.machine, priority: f.machine ? 0 : 1 });
    if (!f.keys) { at('kitchen', 'keys', { verb: 'verb.take', priority: 1 }); }
    at('kitchen', 'studydoor', { verb: 'verb.open', priority: 1 });
    ['mugs', 'cards', 'coat', 'calendar', 'kwindow', 'boxes', 'kettle', 'fridge'].forEach((id) => at('kitchen', id, { verb: 'verb.look', optional: true }));
  } else if (beat === 'P.restore') {
    const c = rt.crt; if (!c) { return out; }
    const st = c.stage;
    if (st === 'mount') { add('disk', CRT.x, CRT.z, 99, { verb: 'verb.readDisk', hold: true }); }
    else if (st === 'repair') { add('repair', CRT.x, CRT.z, 99, { verb: 'verb.repair', hold: true }); }
    else if (st === 'run' && c.sel === RECORDS.length) { add('run', CRT.x, CRT.z, 99, { verb: 'verb.restoreMemory', hold: true }); }
    else { add('record', CRT.x, CRT.z, 99, { verb: 'verb.open' }); }
  } else if (beat === 'P.summer') {
    const j = rt.june; if (j && !A.seen(g, 'p.s.photo')) { add('june', j.x, j.z, 1.9, { verb: 'verb.talk', moving: true }); }
  } else if (beat === 'E.study') {
    if (!f.unfolded) { at('study', 'unfold', { verb: 'verb.unfold', hold: true, priority: 1 }); }
    if (!f.letterM) { at('study', 'keepbox', { verb: 'verb.open', priority: 1 }); }
    if (f.unfolded && f.letterM) { at('study', 'computer', { verb: 'verb.switchOff', priority: 1 }); }
    ['drawing', 'shelf', 'window', 'notebook', 'envelope', 'photo'].forEach((id) => at('study', id, { verb: 'verb.look', optional: true }));
    at('study', 'lamp', { verb: 'verb.toggle', optional: true });
  }
  return out;
}

const LOOK = {
  'P.kitchen': { coat: 'p.look.coat', kwindow: 'p.look.window', fridge: 'p.look.fridge', studydoor: 'p.look.studydoor', kettle: 'p.look.kettle' },
  'P.house': { mugs: 'p.look.h.mugs', cards: 'p.look.h.cards', coat: 'p.look.h.coat', calendar: 'p.look.h.calendar', kwindow: 'p.look.h.window', boxes: 'p.look.h.boxes', kettle: 'p.look.h.kettle', fridge: 'p.look.h.fridge', machine: 'p.h.m.after' },
  'E.study': { drawing: 'look.drawing7', shelf: 'look.shelf7', window: 'look.window7', notebook: 'look.notebook7', envelope: 'look.envelope7', photo: 'look.photo7' }
};

// ---- using things --------------------------------------------------------------------------------------------------
export function use(g, p) {
  const s = g.s, rt = g.rt, f = s.flags, beat = s.beat;
  const look = LOOK[beat] && LOOK[beat][p.id];
  if (p.id === 'lamp' && beat === 'E.study') { f.lampOff = !f.lampOff; rt.ev.push({ type: 'sfx', name: 'lamp' }); return; }
  if (beat === 'P.kitchen') {
    if (p.id === 'mother') {
      Co.wait(rt.mother, null, 'quiet');
      const after = () => {
        f.kTalked = true; f.kArgued = true; rt.ev.push({ type: 'save' });
        A.dialog(g, 'p.k.kettle', () => { motherByDoor(g); rt.ev.push({ type: 'save' }); });
      };
      A.branch(g, 'p.k.talk', 'pk1', { 'p.choice.k1a': 'p.k.a', 'p.choice.k1b': 'p.k.b' }, () => A.branch(g, 'p.k.mid', 'pk2', { 'p.choice.k2a': 'p.k.c', 'p.choice.k2b': 'p.k.d' }, after));
      return;
    }
    if (p.id === 'frontdoor') {
      if (!f.kArgued) { A.say(g, 'mara', 'p.k.notYet', 3.2); return; }
      A.branch(g, 'p.k.door', 'pk3', { 'p.choice.k3a': 'p.k.byeA', 'p.choice.k3b': 'p.k.byeB' }, () => {
        f.kLeft = true; rt.leaving = true; rt.seated = true; rt.ev.push({ type: 'sfx', name: 'door' }); rt.ev.push({ type: 'card', a: 'p.k.last', b: '' }); rt.ev.push({ type: 'save' });
        A.later(g, 3.4, () => A.enterBeat(g, 'P.house'));
      });
      return;
    }
  }
  if (beat === 'P.house') {
    if (p.id === 'machine' && !f.machine) {
      f.machine = true; rt.ev.push({ type: 'sfx', name: 'machine' });
      A.dialog(g, 'p.h.machine', () => rt.ev.push({ type: 'save' }), saidBye(g) ? null : swap(A.DIALOGS['p.h.machine'], 'p.h.m.byeA', 'p.h.m.byeB'));
      return;
    }
    if (p.id === 'keys') { f.keys = true; rt.ev.push({ type: 'item', id: 'keys' }); rt.ev.push({ type: 'save' }); A.say(g, 'mara', 'p.h.keys', 3.6); return; }
    if (p.id === 'studydoor') {
      if (!f.keys) { A.say(g, 'mara', 'p.h.locked', 3); return; }
      if (!f.machine) { A.say(g, 'mara', 'p.h.machineFirst', 3.2); return; }
      rt.ev.push({ type: 'sfx', name: 'door' });
      A.dialog(g, 'p.h.open', () => { g.rt.ev.push({ type: 'fade' }); A.enterBeat(g, '1.study'); });
      return;
    }
  }
  if (beat === 'P.restore' && p.id === 'record') { openRecord(g); return; }
  if (beat === 'P.summer' && p.id === 'june') {
    Co.wait(rt.june, null, 'grin'); rt.june.anim = 'camera';
    A.branch(g, 'p.s.photo', 'ps', { 'p.choice.s1': 'p.s.a', 'p.choice.s2': 'p.s.b' }, () => { rt.ev.push({ type: 'save' }); startFollow(g); });
    return;
  }
  if (beat === 'E.study') {
    if (p.id === 'keepbox' && !f.letterM) { f.letterM = true; rt.ev.push({ type: 'sfx', name: 'page' }); A.dialog(g, 'p.e.letter', () => rt.ev.push({ type: 'save' })); return; }
    if (p.id === 'computer' && f.unfolded && f.letterM) {
      A.dialog(g, 'p.e.final', () => { f.epilogue = true; f.lampOff = true; g.rt.ev.push({ type: 'crt', on: false }); g.rt.ev.push({ type: 'save' }); g.rt.ev.push({ type: 'credits-roll' }); A.enterBeat(g, 'end'); },
        saidBye(g) ? null : swap(A.DIALOGS['p.e.final'], 'p.e.f5a', 'p.e.f5b'));
      return;
    }
  }
  if (look) { f['looked_' + p.id] = true; A.say(g, beat === 'P.summer' ? 'elena' : 'mara', look, 4.5); }
}

// ---- the restore tool ------------------------------------------------------------------------------------------------
function openRecord(g) {
  const rt = g.rt, c = rt.crt, f = g.s.flags; const id = RECORDS[c.sel];
  if (!id) { return; }
  if (id === 'b98' && !f.repaired) { c.stage = 'repair'; rt.ev.push({ type: 'sfx', name: 'denied' }); rt.ev.push({ type: 'crt-damage' }); return; }
  rt.ev.push({ type: 'sfx', name: 'open' });
  A.dialog(g, 'p.r.' + id, () => { f['rec_' + id] = true; c.opened[id] = true; g.rt.ev.push({ type: 'save' }); afterRecord(g); });
}
function afterRecord(g) {
  const rt = g.rt, c = rt.crt, f = g.s.flags;
  if (!f.restoreAsked && REQUIRED.every((r) => c.opened[r])) {
    A.dialog(g, 'p.r.question', () => { f.restoreAsked = true; c.stage = 'run'; c.sel = RECORDS.length; g.rt.ev.push({ type: 'save' }); });
    return;
  }
  // move the selection to the next record nobody has opened yet, so W/S is rarely needed
  const next = RECORDS.findIndex((r) => !c.opened[r] && r !== 'gone'); if (next >= 0) { c.sel = next; }
}

// ---- held actions ------------------------------------------------------------------------------------------------------
export function hold(g, id, dt) {
  const s = g.s, rt = g.rt, f = s.flags;
  if (!HOLD_R4[id]) { return false; }
  const v = rt.hold[id] = Math.min(1, (rt.hold[id] || 0) + dt / HOLD_R4[id]);
  if (!rt.holdStarted || rt.holdStarted !== id) { rt.holdStarted = id; rt.ev.push({ type: 'hold-start', id }); }
  if (v < 1) { return true; }
  rt.hold[id] = 0; rt.holdStarted = null;
  if (id === 'disk') { f.mounted = true; rt.crt.stage = 'list'; rt.crt.sel = 0; rt.ev.push({ type: 'sfx', name: 'modem' }); rt.ev.push({ type: 'save' }); }
  if (id === 'repair') { f.repaired = true; rt.crt.stage = 'list'; rt.ev.push({ type: 'restored', id: 'summer-0.9' }); rt.ev.push({ type: 'save' }); A.dialog(g, 'p.r.b98', () => { f.rec_b98 = true; rt.crt.opened.b98 = true; g.rt.ev.push({ type: 'save' }); afterRecord(g); }); }
  if (id === 'run') { f.ranSummer = true; rt.ev.push({ type: 'save' }); rt.ev.push({ type: 'crt', on: false }); rt.ev.push({ type: 'memory' }); A.enterBeat(g, 'P.summer'); }
  if (id === 'unfold') { f.unfolded = true; rt.ev.push({ type: 'unfold' }); rt.ev.push({ type: 'save' }); A.dialog(g, 'p.e.photo'); }
  return true;
}
export function holdProgress(g, id) { return g.rt.hold[id] || 0; }

// ---- every frame ----------------------------------------------------------------------------------------------------------
export function tick(g, dt, input, active) {
  const s = g.s, rt = g.rt, beat = s.beat, f = s.flags;
  if (beat === 'P.restore') { crtTick(g, input, active); return; }
  if (active && !rt.seated) { A.moveBody(g, dt, input, false); }
  if (rt.mother) {
    Co.tick(rt.mother, dt, { x: rt.body.x, z: rt.body.z });
    // she does not wait to be spoken to: if Mara hangs in the doorway, she says so (once)
    if (beat === 'P.kitchen' && !f.kArgued && !A.seen(g, 'p.k.talk') && active && !rt.caption && rt.beatT > 15 && !rt.waitSaid) { rt.waitSaid = true; A.say(g, 'mother', 'p.k.waiting', 3.6); Co.react(rt.mother, 'tease', 'idle', 2); }
  }
  if (beat === 'P.summer' && rt.june) {
    if (rt.following && !rt.broke && rt.body.z < 22.65 && !rt.dialog) {
      rt.broke = true; rt.ev.push({ type: 'glitch' });
      A.dialog(g, 'p.s.break', () => { g.s.flags.summerBroke = true; g.rt.ev.push({ type: 'fade' }); g.rt.ev.push({ type: 'save' }); A.enterBeat(g, '1.town'); });
    }
  }
}
function crtTick(g, input, active) {
  const c = g.rt.crt; if (!c || !active) { if (c) { c.lastMz = input.mz || 0; } return; }
  if (c.stage === 'list' || c.stage === 'run') {
    const mz = input.mz || 0; const n = RECORDS.length + (c.stage === 'run' ? 1 : 0);
    const up = input.navUp || (mz > 0.5 && c.lastMz <= 0.5), down = input.navDown || (mz < -0.5 && c.lastMz >= -0.5);
    if (up) { c.sel = (c.sel + n - 1) % n; g.rt.ev.push({ type: 'sfx', name: 'blip' }); }
    else if (down) { c.sel = (c.sel + 1) % n; g.rt.ev.push({ type: 'sfx', name: 'blip' }); }
    c.lastMz = mz;
  }
}
// what the restore screen shows, for the renderer and the tests
export function crtView(g) {
  const c = g.rt.crt; if (!c) { return null; }
  return { stage: c.stage, sel: c.sel, opened: Object.assign({}, c.opened), repaired: !!g.s.flags.repaired, hold: Object.assign({}, g.rt.hold) };
}
