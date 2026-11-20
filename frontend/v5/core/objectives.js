// What the player is trying to do right now, read straight from the game state. There is no separate quest data:
// every step below is a test on the same flags, dialogues, restorations and positions the game itself uses to move on,
// so the task list cannot drift out of step with the story.
//
//   objective(g)  -> { chapter, beat, goal, steps: [{ id, key, doKey, done, optional }], next, nextKey, target, progress }
//   track(g, dt, active, autoHelp) -> assist events when the player has made no progress for a while
//
// Text keys: 'obj.<beat>' is the goal, 'step.<beat>.<id>' the step, 'do.<beat>.<id>' how to do it (may contain {k:action}
// tokens that the interface turns into the player's own keys, pad buttons or touch buttons).
import { LAYOUTS, point } from './layout.js';

const chapterOf = (beat) => (beat === 'end' ? 7 : parseInt(beat, 10));
const pt = (scene, id) => { const p = point(scene, id); return p ? { x: p.x, z: p.z } : null; };
const at = (o) => (o ? { x: o.x, z: o.z, y: o.y || 0 } : null);
const seen = (g, id) => g.s.seen.indexOf(id) >= 0;

// Steps that depend on where the player stands (the pier) are remembered once done in this visit, so a tick never
// disappears again because the player walked back.
function remember(g, id, now) {
  const rt = g.rt; rt.objMem = rt.objMem || {};
  if (now) { rt.objMem[id] = true; }
  return !!rt.objMem[id];
}

// Each beat: the goal, the ordered steps, and where the next step is (a point in this scene, or null when there is no
// place to go, e.g. sitting on the train). `ctx` lets a step say something more precise than its default instruction.
const BEATS = {
  '1.study': (g) => {
    const f = g.s.flags; const tried = !!(f.needDisk || f.disk);
    const steps = [
      { id: 'computer', done: tried },
      { id: 'disk', done: !!f.disk },
      { id: 'load', done: false }
    ];
    const target = !tried ? pt('study', 'computer') : !f.disk ? pt('study', 'keepbox') : pt('study', 'computer');
    return { steps, target };
  },
  '1.town': (g) => {
    const s = g.s, rt = g.rt; const talked = seen(g, 'c1.theo1') || !!s.restored.bridge;
    const steps = [
      { id: 'theo', done: talked },
      { id: 'bridge', done: !!s.restored.bridge },
      { id: 'meet', done: false }
    ];
    let target = pt('town', 'gap'); let ctx = null;
    if (!talked && rt.theo) { target = at(rt.theo); }
    if (!s.restored.bridge && s.bridge > 0) { ctx = 'do.1.town.bridgeGoing'; }
    if (s.restored.bridge && rt.theo) { target = at(rt.theo); ctx = 'do.1.town.wait'; }
    return { steps, target, ctx };
  },
  '1.pier': (g) => {
    const s = g.s, b = g.rt.body || { z: 0 };
    const on98 = remember(g, 'tab98', s.era === 1998);
    const deck = remember(g, 'deckEnd', s.era === 1998 && b.z > 16.6);
    const stub = remember(g, 'stub', s.era === 2004 && b.z > 17.0 && b.z < 23.5);
    const far = remember(g, 'far', s.era === 1998 && b.z > 22.0);
    const steps = [
      { id: 'tab', done: on98 || deck },
      { id: 'deck', done: deck || stub || far },
      { id: 'stub', done: stub || far },
      { id: 'cross', done: far },
      { id: 'post', done: false }
    ];
    // the instruction and the marker follow where the player is now, not only what was ticked
    let target = { x: 0, z: 17.3 }, ctx = null;
    if (s.era === 2004 && b.z < 14.6) { target = { x: 0, z: 13.4 }; if (b.z > 12.4 && Math.abs(b.x) < 2.2) { ctx = 'do.1.pier.fence'; } }   // at the fence itself: say why it does not open
    else if (s.era === 1998 && b.z < 16.6) { target = { x: 0, z: 17.3 }; }
    else if (s.era === 1998 && b.z >= 16.6 && b.z < 18.2) { ctx = 'do.1.pier.stub'; target = { x: 0, z: 17.6 }; }
    else if (s.era === 2004 && b.z >= 17.0 && b.z < 22.0) { ctx = 'do.1.pier.walkStub'; target = { x: 0, z: 22.6 }; }
    else if (s.era === 2004 && b.z >= 22.0) { ctx = 'do.1.pier.back98'; target = { x: 0, z: 22.6 }; }
    else if (s.era === 1998 && b.z >= 22.0) { target = pt('town', 'pierEnd'); }
    return { steps, target, ctx };
  },
  '1.carve': (g) => ({ steps: [{ id: 'carve', done: !!g.s.flags.carved }], target: pt('town', 'pierEnd') }),
  '1.chase': (g) => {
    const rt = g.rt, b = rt.body || { x: 0 }, tr = rt.train; let ctx = null;
    if (tr && tr.moving && Math.abs(tr.x - b.x) < 2.5) { ctx = 'do.1.chase.hand'; } else if (b.x > 0.6 && b.x < 4.2) { ctx = 'do.1.chase.cart'; }
    return { steps: [{ id: 'catch', done: !!(tr && tr.caught) }], target: tr ? { x: tr.x, z: LAYOUTS.station.train.doorZ } : null, ctx };
  },
  '2.train': (g) => {
    const f = g.s.flags, rt = g.rt; let ctx = null;
    const steps = [
      { id: 'photo', done: !!f.dares1 },
      { id: 'lighthouse', done: !!f.dare0 },
      { id: 'kite', done: !!f.dare1 },
      { id: 'sketch', done: !!f.sketched },
      { id: 'june', done: !!f.dare2 },
      { id: 'tunnel', done: !!(f.juneSnap && (rt.sleep || f.sleepShot || seen(g, 'c2.tunnelOut'))) },
      { id: 'sleep', done: false }
    ];
    if (rt.tunnel && !f.heldHand) { ctx = 'do.2.train.hand'; }
    if (rt.sleep && !rt.sleep.done) { ctx = 'do.2.train.asleep'; }
    return { steps, target: null, ctx };
  },
  '3.ride': (g) => {
    const r = g.rt.ride || {}; const ctx = r.stop === 'chain' ? 'do.3.ride.chainNow' : null;
    return { steps: [{ id: 'ride', done: !!(r.stop === 'chain' || r.chainDone) }, { id: 'chain', done: !!r.chainDone }, { id: 'arrive', done: false }, { id: 'ribbons', done: !!(r.gates && r.gates.some((x) => x === 'in')), optional: true }], target: null, ctx };
  },
  '3.yard': (g) => {
    const s = g.s, rt = g.rt; const has = rt.carry === 'window' || s.window.placed;
    const steps = [
      { id: 'window', done: has },
      { id: 'fit', done: !!s.window.placed },
      { id: 'lens', done: !!s.flags.lens },
      { id: 'lamp', done: !!s.flags.lit }
    ];
    const target = !has ? pt('coast', 'cart') : !s.window.placed ? pt('coast', 'socket') : !s.flags.lens ? pt('coast', 'pulley') : pt('coast', 'crank');
    const ctx = s.window.placed && !s.flags.lens && !(rt.june && rt.june.y > 6) ? 'do.3.yard.climbing' : null;
    return { steps, target, ctx };
  },
  '3.beam': (g) => ({ steps: [{ id: 'june', done: !!g.s.flags.foundJune }, { id: 'cottage', done: !!g.s.flags.beamDone }], target: null }),
  '3.cliff': (g) => ({ steps: [{ id: 'down', done: !!(g.s.flags.landed || (g.rt.body && g.rt.body.y < -4.5)) }, { id: 'door', done: false }], target: pt('coast', 'door') }),
  '4.cottage': (g) => {
    const s = g.s, rt = g.rt;
    const steps = [
      { id: 'portfolio', done: seen(g, 'c4.sketches') || !!s.flags.boat },
      { id: 'boat', done: !!s.flags.boat },
      { id: 'tune', done: !!s.flags.tuned }
    ];
    const ctx = rt.pen ? 'do.4.cottage.drawing' : rt.tuning ? 'do.4.cottage.tuning' : null;
    return { steps, target: !s.flags.boat ? pt('cottage', 'sketches') : pt('cottage', 'guitar'), ctx };
  },
  '4.duet': (g) => {
    const s = g.s; const ctx = g.rt.duet ? 'do.4.duet.playing' : null;
    return { steps: [{ id: 'first', done: !!s.flags.duet1 }, { id: 'again', done: false }], target: g.rt.duet ? null : pt('cottage', 'guitar'), ctx };
  },
  '4.porch': (g) => {
    const st = g.rt.stars || { i: 0 }; const n = Math.min(5, st.i || 0);
    return { steps: [{ id: 'stars', done: !!g.s.flags.stars }], target: null, progress: { n, of: 5 } };
  },
  '5.depart': (g) => {
    const s = g.s, rt = g.rt, f = s.flags;
    const steps = [
      { id: 'suitcase', done: !!f.suitcase },
      { id: 'walk', done: !!f.walked },
      { id: 'talk', done: !!f.c5talk },
      { id: 'train', done: false },
      { id: 'soda', done: !!f.kiosk98, optional: true },
      { id: 'photo', done: !!f.snap98, optional: true }
    ];
    let target = null, ctx = null;
    if (!f.suitcase) { target = rt.carry === 'suitcase' ? pt('station', 'door') : pt('station', 'suitcase'); if (rt.carry === 'suitcase') { ctx = 'do.5.depart.door'; } }
    else if (!f.c5talk) { target = at(rt.june); }
    else { ctx = 'do.5.depart.goodbye'; target = null; }
    return { steps, target, ctx };
  },
  '5.alone': (g) => ({ steps: [{ id: 'bench', done: !!g.rt.seated }, { id: 'machine', done: !!g.s.flags.kiosk04, optional: true }], target: pt('station', 'bench') }),
  '6.cottage': (g) => {
    const s = g.s, rt = g.rt, n = (s.flags.boxA ? 1 : 0) + (s.flags.boxB ? 1 : 0);
    const steps = [{ id: 'boxes', done: n >= 2 }, { id: 'june', done: false }, { id: 'letter', done: seen(g, 'c6.letter'), optional: true }];
    let target = null, ctx = null;
    if (rt.carry) { target = pt('cottage', 'drop'); ctx = 'do.6.cottage.drop'; }
    else if (n < 2) { target = !s.flags.boxA ? pt('cottage', 'boxA') : pt('cottage', 'boxB'); }
    else { target = at(rt.june); }
    return { steps, target, ctx, progress: { n, of: 2, step: 'boxes' } };
  },
  '6.beach': (g) => {
    const f = g.s.flags, rt = g.rt;
    const steps = [{ id: 'talk1', done: !!f.beachTalk1 }, { id: 'talk2', done: !!f.beachTalk2 }, { id: 'lighthouse', done: !!f.beachTalk3 }, { id: 'road', done: false }];
    return { steps, target: f.beachTalk3 ? { x: 254.0, z: 21.0 } : at(rt.june) };
  },
  '7.study': () => ({ steps: [{ id: 'drafts', done: false }], target: pt('study', 'computer') }),
  '7.town': (g) => {
    const s = g.s, rt = g.rt, e = s.edition, f = s.flags, ir = rt.iris;
    const irisGone = !!(e.iris_revived && (!ir || ir.gone));
    const steps = [
      { id: 'read98', done: !!f.read98 || !!e.credits_restored },
      { id: 'credits', done: !!e.credits_restored },
      { id: 'iris', done: !!e.iris_revived },
      { id: 'rope', done: irisGone || !!(ir && ir.boarded) },
      { id: 'lamp', done: !!s.restored.lamp },
      { id: 'seasons', done: !!e.seasons },
      { id: 'beam', done: !!f.beamPier },
      { id: 'planks', done: !!e.pier_walk },
      { id: 'end', done: false }
    ];
    let target = null, ctx = null;
    if (!e.credits_restored) { target = pt('town', 'credits'); if (!f.read98 && s.era === 2004) { ctx = 'do.7.town.tab98'; } else if (f.read98 && s.era === 1998) { ctx = 'do.7.town.tab04'; } }
    else if (!e.iris_revived) { target = pt('town', 'bakery'); if (s.era === 1998) { ctx = 'do.7.town.back04'; } }
    else if (ir && ir.leaving && !ir.gone) { target = ir.atDock ? pt('town', 'rope') : at(ir); if (!ir.atDock) { ctx = 'do.7.town.follow'; } }
    else if (!s.restored.lamp || !e.seasons) { target = pt('town', 'lighthouse'); if (s.era === 1998) { ctx = 'do.7.town.back04'; } }
    else if (!f.beamPier) { target = null; ctx = rt.beam ? null : 'do.7.town.snow'; }
    else if (!e.pier_walk) { target = { x: 0, z: 13.9 }; }
    else { target = { x: 0, z: 23.6 }; }
    return { steps, target, ctx };
  },
  end: () => ({ steps: [], target: null })
};

export const OBJECTIVE_BEATS = Object.keys(BEATS);

export function objective(g) {
  const beat = g.s.beat; const fn = BEATS[beat]; if (!fn) { return null; }
  const o = fn(g);
  const steps = o.steps.map((st) => Object.assign({ key: `step.${beat}.${st.id}`, doKey: `do.${beat}.${st.id}`, optional: !!st.optional }, st));
  const req = steps.filter((st) => !st.optional); const next = req.find((st) => !st.done) || null;
  const progress = o.progress || { n: req.filter((st) => st.done).length, of: req.length };
  const nextKey = o.ctx || (next ? next.doKey : (beat === 'end' ? 'do.end.free' : null));
  return { chapter: chapterOf(beat), beat, goal: `obj.${beat}`, steps, next: next ? next.id : null, nextKey, target: o.target || null, progress };
}

// A short signature of everything that counts as progress: when it changes, the player has done something that matters.
export function progressSig(g, o) {
  const ob = o || objective(g); if (!ob) { return g.s.beat; }
  const r = g.rt;
  const sub = [r.dialog ? 'd:' + r.dialog.id : '', r.carry || '', g.s.photos.length, r.stars ? r.stars.i : '', r.tuning ? r.tuning.string : '', r.pen ? r.pen.i : '', r.ride ? Math.floor((r.ride.s || 0) / 20) : '', g.s.era];
  return ob.beat + '|' + ob.steps.map((st) => (st.done ? 1 : 0)).join('') + '|' + sub.join(',');
}

// Help that grows with time spent without progress (walking around does not count as progress).
// level 1 at 30 s: a direction marker; level 2 at 60 s: the next step is spoken; level 3 at 90 s: the full hint and
// the place is marked. Only time in play counts (not dialogue, menus or cut-scenes). `autoHelp === false` turns it off.
export const ASSIST_AT = [30, 60, 90];
export function track(g, dt, active, autoHelp) {
  const rt = g.rt; const o = objective(g); const sig = progressSig(g, o); const out = [];
  if (!rt.assist || rt.assist.sig !== sig) { const had = rt.assist && rt.assist.level; rt.assist = { sig, t: 0, level: 0 }; if (had) { out.push({ type: 'assist', level: 0 }); } return out; }
  if (!active) { return out; }
  rt.assist.t += dt;
  if (autoHelp === false) { return out; }
  const lvl = ASSIST_AT.filter((s) => rt.assist.t >= s).length;
  if (lvl > rt.assist.level) { rt.assist.level = lvl; out.push({ type: 'assist', level: lvl, nextKey: o ? o.nextKey : null }); }
  return out;
}
