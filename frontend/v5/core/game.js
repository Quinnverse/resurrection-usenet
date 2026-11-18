// Resurrection V5: the whole game as a pure simulation. The browser feeds it input and draws what it reports;
// Node tests feed it input and play it from the first frame to the credits. No DOM, no Three.js, no timers.
//
// Chapters and beats
//   1 Catch the summer   1.study -> 1.town (restore June's bridge, Theo, Tab) -> 1.pier (era traversal) -> 1.chase (Elena, the train)
//   2 You are the view   2.train (the camera; June's photo of Elena; playful or sincere)
//   3 Our lighthouse     3.ride (bicycle) -> 3.yard (the crooked window, the lamp together) -> 3.cliff (glide or stairs)
//   4 A song for you     4.duet (Elena's melody from the archive, twice) -> confession that is not quite one
//   5 Don't stay here    5.depart (June leaves; choice of words, not of outcome) -> 5.alone (years later, the same place)
//   6 I remember too     6.cottage (2004: the confrontation, both sides, no reconciliation)
//   7 Let summer end     7.study (the unsent letter stays unsent) -> 7.town (credit, Iris, seasons, snow) -> end
import * as Ar from './archive.js';
import * as Ph from './physics.js';
import * as Co from './companion.js';
import * as Toys from './toys.js';
import { LAYOUTS, point, bridgeFloors, THEO_TOWN, IRIS_TOWN, BRIDGE, PIER } from './layout.js';

export const SCHEMA = 1, PROVENANCE_VERSION = 'v5-fixture-1';
export const CHAPTERS = [1, 2, 3, 4, 5, 6, 7];
export const BEATS = ['1.study', '1.town', '1.pier', '1.chase', '2.train', '3.ride', '3.yard', '3.cliff', '4.duet', '5.depart', '5.alone', '6.cottage', '7.study', '7.town', 'end'];
const BEAT_SCENE = { '1.study': 'study', '1.town': 'town', '1.pier': 'town', '1.chase': 'station', '2.train': 'train', '3.ride': 'ride', '3.yard': 'coast', '3.cliff': 'coast', '4.duet': 'cottage', '5.depart': 'station', '5.alone': 'station', '6.cottage': 'cottage', '7.study': 'study', '7.town': 'town', end: 'town' };
const BEAT_YEAR = { '1.chase': 1998, '2.train': 1998, '3.ride': 1998, '3.yard': 1998, '3.cliff': 1998, '4.duet': 1998, '5.depart': 1998, '5.alone': 2004, '6.cottage': 2004 };
const PLAYER = { study: 'mara', town: 'mara', station: 'elena', train: 'elena', ride: 'elena', coast: 'elena', cottage: 'elena' };
export const chapterOf = (beat) => (beat === 'end' ? 7 : parseInt(beat, 10));
const HOLD = { bridge: 4.0, crank: 3.2 };

export function newSave() {
  return { schemaVersion: SCHEMA, provenanceVersion: PROVENANCE_VERSION, beat: '1.study', era: 2004, restored: {}, photos: [], choices: {}, window: { placed: false, finish: null },
    flags: {}, seen: [], edition: {}, pos: {}, bridge: 0, crank: 0, season: 'summer' };
}

// ---- dialogue lines -------------------------------------------------------------------------------------------
// A line is [who, key] or [who, key, shot]. ['pause', seconds, shot] holds a silence. { choice: id, options: [...] }.
const L = (who, key, shot) => [who, key, shot || null];
const pause = (s, shot) => ['pause', s, shot || null];
export const DIALOGS = {
  'c1.computer': [L('mara', 'c1.mara.never'), L('screen', 'c1.screen.title'), L('mara', 'c1.mara.open')],
  'c1.theo1': [L('theo', 'c1.theo.hello', 'theo'), L('theo', 'c1.theo.almost', 'theo'), L('mara', 'c1.mara.howLong'), L('theo', 'c1.theo.dontAsk', 'theo'), L('theo', 'c1.theo.bridge', 'theo')],
  'c1.theo2': [L('theo', 'c1.theo.planks', 'theo'), L('mara', 'c1.mara.june'), L('theo', 'c1.theo.pier', 'theo'), L('theo', 'c1.theo.tab', 'theo')],
  'c1.memory': [L('mara', 'c1.mara.carved'), L('mara', 'c1.mara.show')],
  'c1.hand': [L('june', 'c1.june.thought', 'hands'), L('elena', 'c1.elena.when', 'hands'), L('june', 'c1.june.remember', 'june')],
  'c2.intro': [L('june', 'c2.june.dontMove', 'june'), L('elena', 'c2.elena.what'), L('june', 'c2.june.yourTurn', 'june')],
  'c2.snap': [L('june', 'c2.june.gotYou', 'june'), L('elena', 'c2.elena.wasntReady')],
  'c2.banter': [L('elena', 'c2.elena.why'), L('june', 'c2.june.view', 'june'), { choice: 'train', options: ['c2.choice.playful', 'c2.choice.sincere'] }],
  'c2.playful': [L('elena', 'c2.elena.playful'), L('june', 'c2.june.playful', 'june'), L('june', 'c2.june.youreTheView', 'june')],
  'c2.sincere': [L('elena', 'c2.elena.sincere'), pause(1.4, 'june'), L('june', 'c2.june.sincere', 'june'), L('june', 'c2.june.youreTheView', 'june')],
  'c2.backs': [L('screen', 'c2.back.june', 'photoback'), L('screen', 'c2.back.elena', 'photoback')],
  'c3.window': [L('june', 'c3.june.ta', 'window'), L('elena', 'c3.elena.crooked'), L('june', 'c3.june.yes'), L('elena', 'c3.elena.whyCrooked'), L('june', 'c3.june.because')],
  'c3.listen': [L('elena', 'c3.elena.complain'), L('june', 'c3.june.dontListen', 'twoshot'), pause(0.9, 'elena'), L('elena', 'c3.elena.wantTo', 'elena'), pause(1.2, 'june')],
  'c3.lamp': [L('june', 'c3.june.ready'), L('june', 'c3.june.now')],
  'c3.lit': [L('june', 'c3.june.lit', 'beam'), L('elena', 'c3.elena.itWorks'), L('june', 'c3.june.jump')],
  'c4.intro': [L('june', 'c4.june.thatOne', 'june'), L('elena', 'c4.elena.notDone'), L('june', 'c4.june.thenPlay')],
  'c4.again': [pause(1.2, 'june'), L('june', 'c4.june.again', 'june')],
  'c4.after': [pause(1.6, 'twoshot'), L('june', 'c4.june.poemIntro', 'june'), L('june', 'c4.june.poem', 'june'), L('screen', 'c4.poem.credit'), L('elena', 'c4.elena.almost', 'elena'), pause(1.6, 'twoshot'), L('june', 'c4.june.know', 'june'), L('elena', 'c4.elena.dots', 'elena')],
  'c5.news': [L('june', 'c5.june.letter', 'june'), L('june', 'c5.june.studio', 'june'), L('elena', 'c5.elena.thatsGood'), { choice: 'parting', options: ['c5.choice.stay', 'c5.choice.miss'] }],
  'c5.stay': [L('elena', 'c5.elena.stay', 'elena'), pause(1.4, 'june'), L('june', 'c5.june.cantStay', 'june'), L('june', 'c5.june.missMe', 'june'), L('june', 'c5.june.dontStay', 'june')],
  'c5.miss': [L('elena', 'c5.elena.miss', 'elena'), L('june', 'c5.june.smileMiss', 'june'), L('june', 'c5.june.missMe', 'june'), L('june', 'c5.june.dontStay', 'june')],
  'c5.alone': [pause(1.8, 'bench'), L('elena', 'c5.elena.years', 'bench'), pause(1.4, 'bench')],
  'c6.talk': [L('elena', 'c6.elena.remember', 'elena'), pause(1.4, 'june'), L('june', 'c6.june.remember', 'june'), L('june', 'c6.june.name', 'june'), pause(1.6, 'elena'),
    L('elena', 'c6.elena.studio', 'elena'), L('june', 'c6.june.loss', 'june'), L('june', 'c6.june.iris', 'june'), pause(1.2, 'twoshot'), L('elena', 'c6.elena.miss', 'elena'),
    L('june', 'c6.june.iKnow', 'june'), pause(2.0, 'twoshot'), L('elena', 'c6.elena.sorry', 'elena'), L('june', 'c6.june.notToday', 'june'), pause(1.8, 'window')],
  'c6.leave': [L('june', 'c6.june.careful', 'june')],
  'c7.letter': [L('mara', 'c7.mara.drafts'), L('mara', 'c7.mara.unsent'), L('mara', 'c7.mara.notMine')],
  'c7.theo': [L('theo', 'c7.theo.back', 'theo'), L('mara', 'c7.mara.names'), L('theo', 'c7.theo.ok', 'theo')],
  'c7.credits': [L('mara', 'c7.mara.credits'), L('theo', 'c7.theo.june', 'theo')],
  'c7.iris': [L('iris', 'c7.iris.harbor'), L('theo', 'c7.theo.iris', 'theo'), L('mara', 'c7.mara.iris')],
  'c7.seasons': [L('mara', 'c7.mara.new')],
  'c7.snow': [L('theo', 'c7.theo.snow', 'theo'), L('mara', 'c7.mara.summerEnd', 'mara')]
};

// ---- the game -------------------------------------------------------------------------------------------------
export function createGame(ar, save) {
  const g = { ar, s: save ? JSON.parse(JSON.stringify(save)) : newSave(), rt: null };
  enterBeat(g, g.s.beat, true);
  return g;
}
const seen = (g, id) => g.s.seen.indexOf(id) >= 0;
function say(g, who, key, secs) { g.rt.caption = { who, key, t: g.rt.t, secs: secs || 3.4 }; g.rt.ev.push({ type: 'caption', who, key }); }
function dialog(g, id, then, lines) {
  const ls = lines || DIALOGS[id];
  g.rt.dialog = { id, lines: ls, i: 0, seen: seen(g, id), then, t0: g.rt.t, lineT: g.rt.t };
  g.rt.ev.push({ type: 'dialog', id, seen: g.rt.dialog.seen });
  lineStart(g);
}
function lineStart(g) {
  const d = g.rt.dialog; const ln = d.lines[d.i]; d.lineT = g.rt.t;
  if (Array.isArray(ln)) { g.rt.shot = ln[2] || g.rt.shot; if (ln[0] === 'pause') { g.rt.shot = ln[2] || g.rt.shot; } }
  g.rt.ev.push({ type: 'line', line: ln, i: d.i, id: d.id });
}
function endDialog(g) {
  const d = g.rt.dialog; if (!d) { return; }
  if (g.s.seen.indexOf(d.id) < 0) { g.s.seen.push(d.id); }
  g.rt.dialog = null; g.rt.shot = g.rt.baseShot || null;
  g.rt.ev.push({ type: 'dialog-end', id: d.id });
  if (d.then) { d.then(); }
}
function tickDialog(g, input) {
  const d = g.rt.dialog; if (!d) { return; }
  const ln = d.lines[d.i];
  if (input.skip && d.seen) { const then = d.then; d.then = null; endDialog(g); if (then) { then(true); } return; }
  if (!Array.isArray(ln)) {                                                               // a choice
    if (input.choose === 0 || input.choose === 1) {
      const pick = ln.options[input.choose]; g.s.choices[ln.choice] = pick; g.rt.ev.push({ type: 'choice', id: ln.choice, pick });
      d.i += 1; if (d.i >= d.lines.length) { endDialog(g); } else { lineStart(g); }
    }
    return;
  }
  if (ln[0] === 'pause') { if (g.rt.t - d.lineT >= ln[1]) { d.i += 1; if (d.i >= d.lines.length) { endDialog(g); } else { lineStart(g); } } return; }
  if (input.advance && g.rt.t - d.lineT > 0.25) { d.i += 1; if (d.i >= d.lines.length) { endDialog(g); } else { lineStart(g); } }
}

// ---- scenes and worlds -------------------------------------------------------------------------------------------
function sceneGraphNow(g) {
  const era = g.rt.scene === 'town' ? g.s.era : (BEAT_YEAR[g.s.beat] || 2004);
  return Ar.sceneGraph(g.ar, era, g.s.restored, g.s.edition);
}
export function worldFor(g, scene, era) {
  const lay = LAYOUTS[scene === 'ride' ? 'coast' : scene];
  if (scene !== 'town') { return Ph.makeWorld(lay, { assets: new Set() }); }
  const sg = Ar.sceneGraph(g.ar, era, g.s.restored, g.s.edition);
  const br = sg.objects.find((o) => o.id === 'bridge');
  let floors = [];
  if (br && br.state !== 'missing') { floors = bridgeFloors(br.data, era === 2004 && br.state === 'restored' ? 1 : 1); }
  else if (br && br.state === 'missing' && g.s.bridge > 0 && g.rt.restoring) { floors = bridgeFloors(g.rt.restoring.data, g.s.bridge); }
  return Ph.makeWorld(lay, { assets: sg.assets, floors });
}
function refreshWorld(g) {
  const sc = g.rt.scene;
  g.rt.graph = sc === 'town' ? sceneGraphNow(g) : null;
  g.rt.world = worldFor(g, sc, g.s.era);
  g.rt.ev.push({ type: 'world', scene: sc, era: g.s.era });
}
function place(g, scene, pos) {
  const lay = LAYOUTS[scene === 'ride' ? 'coast' : scene];
  const sp = pos || g.s.pos[scene] || lay.spawn;
  const b = Ph.newBody(sp.x, sp.z, sp.y || 0); b.facing = (sp.yaw !== undefined ? sp.yaw : lay.spawn.yaw) + Math.PI;
  const safe = Ph.findSafe(g.rt.world, b.x, b.z, b.y, 6, extraSolids(g)) || lay.spawn;
  b.x = safe.x; b.z = safe.z; b.y = safe.y || 0; b.safe = { x: b.x, z: b.z, y: b.y };
  g.rt.body = b; g.rt.yaw = sp.yaw !== undefined ? sp.yaw : lay.spawn.yaw;
}
function extraSolids(g) {
  const out = [];
  if (g.rt.theo && g.rt.scene === 'town') { out.push({ k: 'circ', x: g.rt.theo.x, z: g.rt.theo.z, r: 0.42, top: 2 }); }
  if (g.rt.june && (g.rt.scene === 'coast' || g.rt.scene === 'cottage')) { out.push({ k: 'circ', x: g.rt.june.x, z: g.rt.june.z, r: 0.38, top: 2 }); }
  return out;
}

function enterBeat(g, beat, loading) {
  const prev = g.rt;
  const scene = BEAT_SCENE[beat];
  g.s.beat = beat;
  g.rt = { t: prev ? prev.t : 0, ev: prev ? prev.ev : [], scene, player: PLAYER[scene], beatT: 0, idleT: 0, hintLevel: 0, dialog: null, caption: null, shot: null, baseShot: null, prompt: null,
    theo: null, june: null, iris: null, train: null, ride: null, duet: null, carry: null, restoring: null, cue: null, aim: false, aimYaw: 0, aimPitch: 0, year: BEAT_YEAR[beat] || null, tabDeny: 0, season: g.s.season };
  if (scene === 'town' && beat !== '7.town' && beat !== 'end') { g.s.era = g.s.era || 2004; }
  if (beat === '7.town' || beat === 'end') { g.s.era = 2004; }
  refreshWorld(g);
  if (scene !== 'ride' && scene !== 'train') { place(g, scene, loading ? null : (BEAT_START[beat] || null)); } else { g.rt.body = Ph.newBody(0, 0, 0); g.rt.yaw = 0; }
  const setup = SETUP[beat]; if (setup) { setup(g, loading); }
  g.rt.ev.push({ type: 'beat', beat, chapter: chapterOf(beat), scene, year: g.rt.year, loading: !!loading });
  g.rt.ev.push({ type: 'save' });
}
const BEAT_START = {
  '1.town': { x: 0, z: -9.2, yaw: Math.PI }, '1.chase': LAYOUTS.station.spawn, '3.yard': { x: 259, z: 16.5, yaw: Math.PI * 1.1 }, '4.duet': LAYOUTS.cottage.guitarSeat, '5.depart': { x: -6, z: 0, yaw: -Math.PI / 2 },
  '5.alone': { x: -6, z: 0, yaw: -Math.PI / 2 }, '6.cottage': { x: 0, z: 2.3, yaw: 0 }, '7.study': LAYOUTS.study.spawn, '7.town': { x: 0, z: -12.6, yaw: Math.PI }
};

// What each beat sets up when it begins (or is loaded from a save).
const SETUP = {
  '1.study': (g) => { g.rt.baseShot = null; },
  '1.town': (g) => {
    g.rt.theo = Co.newCompanion(THEO_TOWN.wait.x, THEO_TOWN.wait.z, Math.PI); Co.invite(g.rt.theo, null, 'smile');
    if (g.s.restored.bridge) { g.rt.theo.x = THEO_TOWN.meet.x; g.rt.theo.z = THEO_TOWN.meet.z; Co.wait(g.rt.theo); }
    irisSetup(g);
    if (!g.s.flags.called) { g.s.flags.called = true; say(g, 'theo', 'c1.theo.call', 4); }
  },
  '1.pier': (g) => { g.rt.theo = Co.newCompanion(THEO_TOWN.post.x, THEO_TOWN.post.z, 0); Co.wait(g.rt.theo); irisSetup(g); g.s.flags.tab = true; },
  '1.chase': (g) => {
    const tr = LAYOUTS.station.train;
    g.rt.train = { x: tr.startX, v: 0, moving: false, caught: false, tries: g.rt.train ? g.rt.train.tries : 0 };
    g.rt.june = Co.newCompanion(tr.startX, tr.doorZ, -Math.PI / 2); Co.invite(g.rt.june, null, 'grin');
    say(g, 'june', 'c1.june.come', 3.4);
  },
  '2.train': (g) => {
    const lay = LAYOUTS.train; g.rt.june = Co.newCompanion(lay.june.x, lay.june.z, 0); Co.play(g.rt.june, 'window'); g.rt.june.anim = 'sit';
    g.rt.aimYaw = Math.PI - 0.5; g.rt.aimPitch = 0.1; g.rt.photoT = 0; g.rt.baseShot = 'seat';
    if (!g.s.flags.c2intro) { dialog(g, 'c2.intro', () => { g.s.flags.c2intro = true; }); }
  },
  '3.ride': (g) => { g.rt.ride = Toys.newRide(); g.rt.baseShot = 'ride'; say(g, 'june', 'c3.june.race', 3); },
  '3.yard': (g) => {
    const c = LAYOUTS.coast.cart; g.rt.june = Co.newCompanion(c.x + 0.4, c.z - 1.3, 0);
    if (!g.s.window.placed) { Co.invite(g.rt.june, null, 'grin'); } else { Co.cooperate(g.rt.june, { x: 264, z: 25.2 }, 'lens'); }
  },
  '3.cliff': (g) => { g.rt.june = Co.newCompanion(272.4, 22.6, Math.PI / 2); Co.wait(g.rt.june, null, 'grin'); if (!g.rt.body || g.rt.body.x < 255) { /* loaded */ } },
  '4.duet': (g) => {
    g.rt.june = Co.newCompanion(LAYOUTS.cottage.juneSeat.x, LAYOUTS.cottage.juneSeat.z, Math.PI); Co.wait(g.rt.june, null, 'smile'); g.rt.june.anim = 'sit';
    g.rt.body.x = LAYOUTS.cottage.guitarSeat.x; g.rt.body.z = LAYOUTS.cottage.guitarSeat.z; g.rt.seated = true; g.rt.baseShot = 'duet';
    g.rt.duetN = g.s.flags.duet1 ? 1 : 0;
    if (!g.s.flags.c4intro) { dialog(g, 'c4.intro', () => { g.s.flags.c4intro = true; }); }
  },
  '5.depart': (g) => {
    const tr = LAYOUTS.station.train;
    g.rt.train = { x: -2, v: 0, moving: false, departing: false };
    g.rt.june = Co.newCompanion(-3.2, 1.2, -Math.PI / 2); Co.wait(g.rt.june, null, 'quiet'); g.rt.june.anim = 'hold';
    g.rt.trainZ = tr.z;
  },
  '5.alone': (g) => { g.rt.baseShot = null; say(g, 'screen', 'c5.title.years', 4); },
  '6.cottage': (g) => { g.rt.june = Co.newCompanion(LAYOUTS.cottage.juneWindow.x, LAYOUTS.cottage.juneWindow.z, Math.PI * 0.9); Co.wait(g.rt.june, null, 'quiet'); g.rt.june.anim = 'turnaway'; },
  '7.study': (g) => { g.rt.baseShot = null; },
  '7.town': (g) => {
    g.rt.theo = Co.newCompanion(1.2, -11.6, Math.PI); Co.invite(g.rt.theo, null, 'smile'); irisSetup(g);
    if (g.s.edition.iris_revived) { g.rt.iris.gone = true; }
  },
  end: (g) => { g.rt.theo = Co.newCompanion(14.2, 15.6, Math.PI); Co.wait(g.rt.theo); irisSetup(g); if (g.rt.iris) { g.rt.iris.gone = true; } g.rt.season = 'winter'; }
};
function irisSetup(g) {
  const sg = Ar.sceneGraph(g.ar, g.s.era, g.s.restored, g.s.edition); const o = sg.objects.find((x) => x.id === 'iris');
  g.rt.iris = { x: IRIS_TOWN.bakery.x, z: IRIS_TOWN.bakery.z, script: o ? o.data : null, state: o ? o.state : 'missing', route: [], gone: false, boatX: 0, leaving: false };
}

// ---- interaction points available right now -----------------------------------------------------------------------
function points(g) {
  const sc = g.rt.scene, beat = g.s.beat, out = [];
  const add = (id, x, z, r, extra) => out.push(Object.assign({ id, x, z, r }, extra || {}));
  const lay = LAYOUTS[sc] || {};
  const p = (id) => point(sc, id);
  if (sc === 'study') {
    if (beat === '1.study' || beat === '7.study') { const c = p('computer'); add('computer', c.x, c.z, c.r, { verb: beat === '7.study' ? 'verb.read' : 'verb.use' }); }
    ['photo', 'keepbox', 'drawing', 'shelf', 'window', 'lamp'].forEach((id) => { const q = p(id); add(id, q.x, q.z, q.r, { verb: id === 'lamp' ? 'verb.toggle' : 'verb.look', optional: true }); });
  } else if (sc === 'town') {
    const th = g.rt.theo;
    if (th) { const across = th.z > 11.6 && g.rt.body.z < 8.4; add('theo', th.x, th.z, across ? 4.9 : 1.9, { verb: 'verb.talk', moving: true, priority: beat === '1.town' && !seen(g, 'c1.theo1') ? 4 : 0 }); }
    if (beat === '1.town' && !g.s.restored.bridge && g.s.era === 2004) { const q = p('gap'); add('gap', q.x, q.z, q.r, { verb: 'verb.restore', hold: true }); }
    if (beat === '1.pier' && g.s.era === 1998) { const q = p('pierEnd'); add('pierEnd', q.x, q.z, q.r, { verb: 'verb.touch' }); }
    if (beat === '7.town') {
      if (!g.s.edition.credits_restored) { const q = p('credits'); add('credits', q.x, q.z, q.r, { verb: 'verb.restoreCredit' }); }
      else if (!g.s.edition.iris_revived && g.rt.iris && !g.rt.iris.leaving && g.s.era === 2004) { const q = p('bakery'); add('iris', q.x, q.z, q.r, { verb: 'verb.revive' }); }
      else if (g.s.edition.iris_revived && !g.s.edition.seasons && g.s.era === 2004) { const q = p('lighthouse'); add('seasons', q.x, q.z, q.r, { verb: 'verb.recompose' }); }
    }
    const nb = p('notice'); add('notice', nb.x, nb.z, nb.r, { verb: 'verb.read', optional: true });
  } else if (sc === 'station') {
    if (beat === '1.chase' && g.rt.train && !g.rt.train.caught) { const d = { x: g.rt.train.x, z: lay.train.doorZ }; add('hand', d.x, d.z - 0.6, lay.train.catchR, { verb: 'verb.hand', moving: true }); }
    if (beat === '5.depart' && g.rt.june && !g.s.flags.c5talk) { add('june', g.rt.june.x, g.rt.june.z, 1.8, { verb: 'verb.talk', moving: true }); }
    if (beat === '5.alone') { const q = p('bench'); add('bench', q.x, q.z, q.r, { verb: 'verb.sit' }); }
  } else if (sc === 'coast') {
    if (beat === '3.yard') {
      if (!g.s.window.placed && !g.rt.carry) { const q = p('cart'); add('cart', q.x, q.z, q.r, { verb: 'verb.window' }); }
      if (g.rt.carry === 'window') { const q = p('socket'); add('socket', q.x, q.z, q.r, { verb: 'verb.place' }); }
      if (g.s.window.placed && !g.s.flags.lit) { const q = p('crank'); add('crank', q.x, q.z, q.r, { verb: 'verb.crank', hold: true }); }
    }
    if (beat === '3.cliff') { const q = p('door'); add('door', q.x, q.z, q.r, { verb: 'verb.enter' }); }
  } else if (sc === 'cottage') {
    if (beat === '4.duet' && !g.rt.duet && !g.rt.dialog) { const q = p('guitar'); add('guitar', q.x, q.z, 2.0, { verb: 'verb.play' }); }
    if (beat === '6.cottage' && g.rt.june && !g.s.flags.c6talk) { add('june', g.rt.june.x, g.rt.june.z, 1.7, { verb: 'verb.speak', moving: true }); }
    if (beat === '6.cottage' && g.s.flags.c6talk) { const q = p('door'); add('door', q.x, q.z, q.r, { verb: 'verb.leave' }); }
  }
  return out;
}
function nearest(g) {
  const b = g.rt.body; let best = null, bd = Infinity;
  for (const p of points(g)) { const d = Math.hypot(p.x - b.x, p.z - b.z); if (d <= p.r && d - (p.priority || 0) < bd) { best = p; bd = d - (p.priority || 0); } }
  return best;
}

// ---- interactions ---------------------------------------------------------------------------------------------
function use(g, p) {
  const s = g.s, rt = g.rt, ev = rt.ev;
  ev.push({ type: 'use', id: p.id });
  switch (p.id) {
    case 'computer':
      if (s.beat === '1.study') { dialog(g, 'c1.computer', () => { ev.push({ type: 'rebuild', messages: g.ar.publicView().messages.size, sources: g.ar.publicView().sources.length }); enterBeat(g, '1.town'); }); }
      else { ev.push({ type: 'letter', text: g.ar.drafts }); dialog(g, 'c7.letter', () => { s.flags.letterRead = true; enterBeat(g, '7.town'); }); }
      return;
    case 'photo': case 'keepbox': case 'drawing': case 'shelf': case 'window': say(g, 'mara', 'look.' + p.id + (s.beat === '7.study' ? '7' : ''), 4.5); return;
    case 'lamp': s.flags.lampOff = !s.flags.lampOff; ev.push({ type: 'sfx', name: 'lamp' }); return;
    case 'notice': say(g, 'mara', 'look.notice.' + (s.edition.credits_restored ? 'restored' : s.era), 4.5); return;
    case 'theo':
      if (s.beat === '1.town' && !seen(g, 'c1.theo1')) { dialog(g, 'c1.theo1'); return; }
      say(g, 'theo', s.beat === '7.town' ? 'c7.theo.idle' : (s.restored.bridge ? 'c1.theo.idle' : 'c1.theo.wait'), 3.2); return;
    case 'pierEnd': dialog(g, 'c1.memory', () => { ev.push({ type: 'memory' }); enterBeat(g, '1.chase'); }); return;
    case 'hand':
      rt.train.caught = true; ev.push({ type: 'caught' }); Co.react(rt.june, 'grin', 'reach', 2);
      dialog(g, 'c1.hand', () => { s.flags.chased = true; enterBeat(g, '2.train'); }); return;
    case 'cart':
      if (!seen(g, 'c3.window')) { dialog(g, 'c3.window', () => { rt.carry = 'window'; ev.push({ type: 'carry', what: 'window' }); }); } else { rt.carry = 'window'; ev.push({ type: 'carry', what: 'window' }); }
      return;
    case 'socket': {
      const w = Ar.sceneGraph(g.ar, 1998, s.restored, null).objects.find((o) => o.id === 'window');
      rt.choice = { id: 'finish', options: (w && w.data.finishes.length ? w.data.finishes : ['sea', 'honey', 'chalk']).map((f) => 'finish.' + f) };
      ev.push({ type: 'choose', id: 'finish', options: rt.choice.options });
      return;
    }
    case 'door':
      if (s.beat === '3.cliff') { ev.push({ type: 'fade' }); enterBeat(g, '4.duet'); }
      else { ev.push({ type: 'fade' }); enterBeat(g, '7.study'); }
      return;
    case 'guitar': startDuet(g); return;
    case 'june':
      if (s.beat === '5.depart') { s.flags.c5talk = true; dialog(g, 'c5.news', () => { const pick = s.choices.parting === 'c5.choice.stay' ? 'c5.stay' : 'c5.miss'; Co.react(rt.june, pick === 'c5.stay' ? 'hurt' : 'smile', 'idle', 2.5); dialog(g, pick, () => juneBoards(g)); }); }
      if (s.beat === '6.cottage') { s.flags.c6talk = true; Co.react(rt.june, 'quiet', 'turnaway', 1.5); dialog(g, 'c6.talk', () => { Co.react(rt.june, 'quiet', 'idle', 1.5); dialog(g, 'c6.leave', () => { s.flags.toldCareful = true; }); }); }
      return;
    case 'bench': rt.seated = true; dialog(g, 'c5.alone', () => { ev.push({ type: 'fade' }); enterBeat(g, '6.cottage'); }); return;
    case 'credits': restoreCredits(g); return;
    case 'iris': reviveIris(g); return;
    case 'seasons': createSeasons(g); return;
    default: return;
  }
}

// ---- Restore: June's bridge ---------------------------------------------------------------------------------------
function restoreTick(g, dt) {
  const s = g.s, rt = g.rt;
  if (!rt.restoring) {
    const c = Ar.restoreCandidate(g.ar, 'bridge', 2004);
    if (!c.ok) { rt.ev.push({ type: 'restore-failed', id: 'bridge', damage: c.res.copies.map((x) => x.status) }); return; }
    rt.restoring = { data: Ar.parseBridge(c.res.data), provenance: c.provenance, planks: 0 };
    rt.ev.push({ type: 'restore-start', id: 'bridge', provenance: c.provenance });
  }
  s.bridge = Math.min(1, s.bridge + dt / HOLD.bridge);
  const n = Math.round(s.bridge * rt.restoring.data.planks.length);
  while (rt.restoring.planks < n) { rt.ev.push({ type: 'plank', i: rt.restoring.planks }); rt.restoring.planks += 1; }
  rt.world = worldFor(g, 'town', s.era);
  if (s.bridge >= 1) {
    s.restored.bridge = rt.restoring.provenance; rt.restoring = null; refreshWorld(g);
    rt.ev.push({ type: 'restored', id: 'bridge', provenance: s.restored.bridge }); rt.ev.push({ type: 'save' });
    Co.transition(rt.theo, THEO_TOWN.path, 1.5); rt.theoCrossing = true;
  }
}

// ---- Tab: switch the town between the 1998 build and the 2004 layer -------------------------------------------------
function tryTab(g) {
  const s = g.s, rt = g.rt;
  if (rt.scene !== 'town' || !s.flags.tab) { if (rt.scene !== 'town' || s.beat === '1.town') { rt.ev.push({ type: 'tab-locked' }); } return; }
  const to = s.era === 2004 ? 1998 : 2004;
  const w = worldFor(g, 'town', to); const b = rt.body;
  const spot = Ph.findSafe(w, b.x, b.z, b.y, 0.8, extraSolids(g));
  if (!spot) { rt.tabDeny += 1; rt.ev.push({ type: 'tab-denied', to }); return; }               // postponed: nowhere safe to land here
  s.era = to; b.x = spot.x; b.z = spot.z; b.y = spot.y; b.vx *= 0.5; b.vz *= 0.5; b.safe = { x: b.x, z: b.z, y: b.y };
  refreshWorld(g); irisSetup(g);
  if (rt.theo) { const ts = Ph.findSafe(rt.world, rt.theo.x, rt.theo.z, 0, 4, null); if (ts && ts.moved) { rt.theo.x = ts.x; rt.theo.z = ts.z; } }
  rt.ev.push({ type: 'tab', era: to, moved: spot.moved }); rt.ev.push({ type: 'save' });
  if (s.beat === '7.town' && !s.flags.c7tab) { s.flags.c7tab = true; say(g, 'mara', to === 1998 ? 'c7.mara.tab98' : 'c7.mara.tab04', 4); }
}

// ---- Chapter 7: credit, Iris, seasons -------------------------------------------------------------------------------
function restoreCredits(g) {
  const s = g.s; const b98 = Ar.buildFor(g.ar.all(), 1998);
  s.edition.credits_restored = true;
  s.restored.credits = { recordId: b98.messageId, status: Ar.STATUS.RESTORED, source: b98.sources.join(','), lines: b98.manifest.credits.map((c) => `${c.who} ${c.roles.join(' ')}`) };
  refreshWorld(g); g.rt.ev.push({ type: 'restored', id: 'credits', credits: b98.manifest.credits }); g.rt.ev.push({ type: 'save' });
  dialog(g, 'c7.credits');
}
function reviveIris(g) {
  const s = g.s; const c = Ar.reviveCandidate(g.ar, 'iris');
  if (!c.ok) { g.rt.ev.push({ type: 'restore-failed', id: 'iris' }); return; }
  s.restored.iris = Object.assign({}, c.provenance, { era: 1998 }); s.edition.iris_revived = true;
  refreshWorld(g); irisSetup(g);
  g.rt.iris.leaving = true; g.rt.iris.route = IRIS_TOWN.path.map(([x, z]) => ({ x, z })); g.rt.iris.stage = 0;
  g.rt.ev.push({ type: 'revived', id: 'iris', script: c.script, provenance: s.restored.iris }); g.rt.ev.push({ type: 'save' });
}
function createSeasons(g) {
  const s = g.s; const lamp = Ar.restoreCandidate(g.ar, 'lamp', 1998);
  if (lamp.ok) { s.restored.lamp = Object.assign({}, lamp.provenance, { era: 1998 }); }
  s.edition.seasons = true; refreshWorld(g);
  g.rt.ev.push({ type: 'created', id: 'seasons', status: Ar.STATUS.CREATED }); g.rt.ev.push({ type: 'save' });
  dialog(g, 'c7.seasons', () => { g.rt.seasonRun = { t: 0 }; g.rt.shot = 'town-wide'; g.rt.baseShot = 'town-wide'; });
}

// ---- Chapter 4: the duet -----------------------------------------------------------------------------------------
function startDuet(g) {
  const t = Ar.sceneGraph(g.ar, 1998, g.s.restored, null).objects.find((o) => o.id === 'tune');
  const tune = t && t.state !== 'missing' ? t.data : { tempo: 88, phrases: [[{ midi: 64, beats: 2 }, { midi: 67, beats: 2 }]] };
  g.rt.duet = Toys.newDuet(tune, g.rt.duetN ? { phrases: [2, 3] } : null); g.rt.duet.second = !!g.rt.duetN;
  if (g.rt.duetN) { g.rt.duet.layers = 2; }
  g.rt.ev.push({ type: 'duet-start', second: !!g.rt.duetN, tempo: tune.tempo }); g.rt.shot = 'duet';
  Co.react(g.rt.june, 'smile', 'hum', 999);
}

// ---- Chapter 5: June boards ---------------------------------------------------------------------------------------
function juneBoards(g) {
  const rt = g.rt; Co.transition(rt.june, [[-2.6, 1.6], [-2.0, 2.1]], 1.2); rt.boarding = { t: 0 };
}

// ---- the main tick ------------------------------------------------------------------------------------------------
// input: { mx, mz, yaw, jump, jumpHeld, sprint, use, useHeld, tab, aim, shoot, aimDX, aimDY, choose, advance, skip, hint }
export function tick(g, dt, input0) {
  const input = Object.assign({ mx: 0, mz: 0, yaw: g.rt.yaw }, input0 || {});
  const rt = g.rt, s = g.s; rt.ev = []; rt.t += dt; rt.beatT += dt;
  if (input.yaw !== undefined) { rt.yaw = input.yaw; }
  const busy = !!rt.dialog || !!rt.choice;
  tickDialog(g, input);
  if (g.rt !== rt) { return g.rt.ev; }
  if (rt.choice && (input.choose === 0 || input.choose === 1 || input.choose === 2) && input.choose < rt.choice.options.length) {
    const c = rt.choice; rt.choice = null; const pick = c.options[input.choose];
    if (c.id === 'finish') { s.window = { placed: true, finish: pick.replace('finish.', '') }; rt.carry = null; rt.ev.push({ type: 'placed', id: 'window', finish: s.window.finish }); rt.ev.push({ type: 'save' }); Co.react(rt.june, 'smile', 'idle', 1.5); dialog(g, 'c3.listen', () => { Co.cooperate(rt.june, { x: 264, z: 25.2 }, 'lens'); say(g, 'june', 'c3.june.crank', 3.2); }); }
  }
  const active = !busy && !rt.dialog && !rt.choice;
  const anyInput = Math.abs(input.mx) + Math.abs(input.mz) > 0.1 || input.use || input.jump || input.shoot || input.tab;
  rt.idleT = anyInput ? 0 : rt.idleT + dt;
  if (input.hint) { rt.hintLevel = Math.min(3, rt.hintLevel + 1); rt.idleT = 0; }
  if (active && rt.idleT > 22 * (rt.hintLevel + 1) && rt.hintLevel < 2) { rt.hintLevel += 1; rt.ev.push({ type: 'hint', level: rt.hintLevel }); nudge(g); }
  const fn = TICK[rt.scene]; if (fn) { fn(g, dt, input, active); }
  if (g.rt !== rt) { return g.rt.ev; }
  // companions
  if (rt.june) { Co.tick(rt.june, dt, { x: rt.body.x, z: rt.body.z }).forEach((e) => { if (e.type === 'june-say' && active) { say(g, 'june', e.key, 3); } }); }
  if (rt.theo) {
    Co.tick(rt.theo, dt, { x: rt.body.x, z: rt.body.z }).forEach((e) => {
      if (e.type === 'arrived' && rt.theoCrossing) { rt.theoCrossing = false; Co.wait(rt.theo); dialog(g, 'c1.theo2', () => { s.flags.tab = true; enterBeat(g, '1.pier'); }, seen(g, 'c1.theo1') ? DIALOGS['c1.theo2'] : DIALOGS['c1.theo1'].slice(0, 4).concat(DIALOGS['c1.theo2'])); }
    });
  }
  // prompt
  const near = active && !rt.seatedLock ? nearest(g) : null;
  rt.prompt = near ? { id: near.id, verb: near.verb, hold: !!near.hold, x: near.x, z: near.z, optional: !!near.optional } : null;
  if (near && near.hold) { rt.prompt.progress = near.id === 'gap' ? s.bridge : s.crank; }
  if (near && input.use && !near.hold) { use(g, near); if (g.rt !== rt) { return g.rt.ev; } }
  if (near && near.hold && input.useHeld) { if (near.id === 'gap') { restoreTick(g, dt); } if (near.id === 'crank') { crankTick(g, dt); } }
  if (input.tab && active) { tryTab(g); }
  if (rt.caption && rt.t - rt.caption.t > rt.caption.secs) { rt.caption = null; }
  return rt.ev;
}
function nudge(g) {
  const who = g.rt.june ? 'june' : (g.rt.theo ? 'theo' : 'mara');
  say(g, who, 'hint.' + g.s.beat + '.' + g.rt.hintLevel, 4.5);
}
function crankTick(g, dt) {
  const s = g.s, rt = g.rt;
  s.crank = Math.min(1, s.crank + dt / HOLD.crank);
  if (!rt.cranking) { rt.cranking = true; rt.ev.push({ type: 'crank-start' }); if (!seen(g, 'c3.lamp')) { say(g, 'june', 'c3.june.now', 2.4); } }
  if (s.crank >= 1 && !s.flags.lit) {
    s.flags.lit = true; const lamp = Ar.sceneGraph(g.ar, 1998, s.restored, null).objects.find((o) => o.id === 'lamp');
    rt.ev.push({ type: 'lit', lamp: lamp && lamp.data }); rt.ev.push({ type: 'save' }); Co.react(rt.june, 'grin', 'wave', 3);
    rt.baseShot = null; dialog(g, 'c3.lit', () => { enterBeat(g, '3.cliff'); });
  }
}

const TICK = {
  study(g, dt, input, active) { if (active) { moveBody(g, dt, input, false); } },
  town(g, dt, input, active) {
    const rt = g.rt, s = g.s;
    if (active) { moveBody(g, dt, input, false); }
    // Iris walks to the dock and leaves by boat, once revived
    const ir = rt.iris;
    if (ir && ir.leaving && !ir.gone) {
      const goal = ir.route[0];
      if (goal) { const dx = goal.x - ir.x, dz = goal.z - ir.z, d = Math.hypot(dx, dz); if (d < 0.08) { ir.route.shift(); } else { const st = Math.min(d, 1.4 * dt); ir.x += (dx / d) * st; ir.z += (dz / d) * st; ir.facing = Math.atan2(dx, dz); ir.walking = true; } }
      else if (!ir.boarded) { ir.boarded = true; ir.walking = false; rt.ev.push({ type: 'iris-board' }); dialog(g, 'c7.iris'); }
      else { ir.boatX -= dt * 1.8; if (ir.boatX < -30) { ir.gone = true; rt.ev.push({ type: 'iris-gone' }); } }
    }
    // the first winter, newly made
    if (rt.seasonRun) {
      rt.seasonRun.t += dt; const t = rt.seasonRun.t;
      const season = t < 4 ? 'summer' : t < 9 ? 'autumn' : 'winter';
      if (season !== rt.season) { rt.season = season; s.season = season; rt.ev.push({ type: 'season', season }); if (season === 'winter') { s.edition.snow = true; s.edition.winter_theme = true; rt.ev.push({ type: 'save' }); } }
      if (t > 12 && !rt.snowTalk) { rt.snowTalk = true; rt.theo.x = 14.2; rt.theo.z = 15.6; dialog(g, 'c7.snow', () => { rt.ev.push({ type: 'credits-roll' }); enterBeat(g, 'end'); }); }
    }
    if (s.beat === '7.town' && !s.flags.c7theo && rt.beatT > 1.5 && !rt.dialog) { s.flags.c7theo = true; dialog(g, 'c7.theo'); }
  },
  station(g, dt, input, active) {
    const rt = g.rt, s = g.s, lay = LAYOUTS.station, tr = rt.train;
    if (s.beat === '1.chase') {
      if (active) { moveBody(g, dt, input, false); }
      if (!tr.moving && (rt.beatT > 2.2 || Math.hypot(input.mx, input.mz) > 0.1)) { tr.moving = true; rt.ev.push({ type: 'train-go' }); }
      if (tr.moving && !tr.caught) {
        const gap = tr.x - rt.body.x;
        const want = gap > 14 ? lay.train.crawl : gap > 8 ? lay.train.slow : lay.train.base;
        tr.v += Math.max(-2, Math.min(1.2, want - tr.v)) * dt * 1.5; tr.x += tr.v * dt;
        if (gap > 8 && !rt.saidWait) { rt.saidWait = true; say(g, 'june', 'c1.june.wait', 2.6); }
        if (tr.x > lay.train.endX) { tr.tries += 1; rt.ev.push({ type: 'retry', tries: tr.tries }); const tries = tr.tries; enterBeat(g, '1.chase'); g.rt.train.tries = tries; say(g, 'june', 'c1.june.again', 3); }
      }
      if (rt.june) { rt.june.x = tr.x; rt.june.z = lay.train.doorZ; rt.june.anim = Math.abs(tr.x - rt.body.x) < 4 ? 'reach' : 'wave'; rt.june.facing = -Math.PI / 2 + 0.6; }
    } else if (s.beat === '5.depart') {
      if (active) { moveBody(g, dt, input, false); }
      if (rt.boarding) {
        rt.boarding.t += dt;
        if (rt.boarding.t > 2.2 && !tr.departing) { tr.departing = true; rt.june.state = 'WAIT'; rt.june.x = tr.x - 1.2; rt.june.z = lay.train.doorZ; rt.june.anim = 'wave'; rt.ev.push({ type: 'train-go' }); }
        if (tr.departing && !tr.gone) { tr.v = Math.min(5, tr.v + dt * 0.7); tr.x += tr.v * dt; if (rt.june) { rt.june.x = tr.x - 1.2; rt.june.z = lay.train.doorZ; } }
        if (tr.departing && tr.x > 34) { rt.june = null; tr.gone = true; }
        if (tr.gone && !rt.yearCut) { rt.yearCut = { t: 0 }; }
        if (rt.yearCut) { rt.yearCut.t += dt; if (rt.yearCut.t > 2.5) { rt.ev.push({ type: 'years-later' }); enterBeat(g, '5.alone'); } }
      }
    } else if (s.beat === '5.alone') { if (active && !rt.seated) { moveBody(g, dt, input, false); } }
  },
  train(g, dt, input, active) {
    const rt = g.rt, s = g.s;
    rt.photoT += dt;
    if (active) {
      rt.aim = !!input.aim;
      rt.aimYaw -= (input.aimDX || 0) * 0.004; rt.aimPitch = Math.max(-0.5, Math.min(0.6, rt.aimPitch + (input.aimDY || 0) * 0.003));
      if (input.shoot && rt.aim) {
        const lay = LAYOUTS.train; const cam = { x: lay.seat.x, y: lay.seat.y, z: lay.seat.z, yaw: rt.aimYaw, pitch: rt.aimPitch, fov: 40, aspect: 1.5 };
        const p = Toys.takePhoto(cam, { x: lay.june.x, y: 1.15, z: lay.june.z }, rt.photoT, s.photos.length);
        s.photos.push(p); const rx = Toys.REACTIONS[p.reaction]; Co.react(rt.june, rx.expr, rx.anim, 2.2);
        rt.ev.push({ type: 'photo', photo: p }); rt.ev.push({ type: 'save' }); say(g, 'june', 'c2.react.' + p.reaction, 3);
      }
    }
    const taken = s.photos.filter((p) => p.id.startsWith('photo')).length;
    if (!s.flags.juneSnap && active && (taken >= 3 || (taken >= 1 && rt.photoT > 26) || rt.photoT > 60)) {
      s.flags.juneSnap = true; rt.aim = false; s.photos.push({ id: 'june-elena', by: 'june', reaction: 'secret', back: 'c2.back.june' });
      rt.ev.push({ type: 'june-photo' }); Co.react(rt.june, 'grin', 'camera', 2.5);
      dialog(g, 'c2.snap', () => dialog(g, 'c2.banter', () => { const pick = s.choices.train === 'c2.choice.sincere' ? 'c2.sincere' : 'c2.playful'; dialog(g, pick, () => dialog(g, 'c2.backs', () => { rt.ev.push({ type: 'fade' }); enterBeat(g, '3.ride'); })); }));
    }
    if (active && taken === 0 && rt.photoT > 14 && !rt.nudged) { rt.nudged = true; say(g, 'june', 'c2.june.go', 3); }
  },
  ride(g, dt, input, active) {
    const rt = g.rt;
    if (!active) { return; }
    const ev = Toys.tickRide(rt.ride, dt, { throttle: input.mz, steer: input.mx, sprint: input.sprint });
    ev.forEach((e) => { if (e.type === 'overtake') { say(g, 'june', 'c3.june.overtake', 2.6); rt.ev.push({ type: 'sfx', name: 'bell' }); } if (e.type === 'june-say') { say(g, 'june', e.key, 2.6); } if (e.type === 'arrive') { rt.ev.push({ type: 'fade' }); enterBeat(g, '3.yard'); } });
  },
  coast(g, dt, input, active) {
    const rt = g.rt, s = g.s;
    if (active) { moveBody(g, dt, input, s.beat === '3.cliff'); }
    if (rt.cranking && !input.useHeld) { rt.cranking = false; }
    if (s.beat === '3.cliff' && rt.body.y < -4.5 && !s.flags.landed) { s.flags.landed = true; if (rt.landedByGlide) { say(g, 'elena', 'c3.elena.flew', 3); } }
  },
  cottage(g, dt, input, active) {
    const rt = g.rt, s = g.s;
    if (s.beat === '4.duet') {
      if (rt.duet && active) {
        const ev = Toys.tickDuet(rt.duet, dt, input.use || input.shoot || input.jump);
        ev.forEach((e) => rt.ev.push(Object.assign({}, e)));
        if (rt.duet.done) {
          const second = rt.duet.second; rt.duet = null; rt.duetN = 1; s.flags.duet1 = true; rt.shot = null;
          Co.react(rt.june, 'smile', 'sit', 1); rt.june.anim = 'sit';
          if (!second) { dialog(g, 'c4.again'); } else { dialog(g, 'c4.after', () => { rt.ev.push({ type: 'fade' }); enterBeat(g, '5.depart'); }); }
        }
      }
      return;
    }
    if (active) { moveBody(g, dt, input, false); }
  }
};
function moveBody(g, dt, input, glide) {
  const rt = g.rt;
  const yaw = rt.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const dx = fx * input.mz + rx * input.mx, dz = fz * input.mz + rz * input.mx;
  const ev = Ph.stepBody(rt.body, { dx, dz, sprint: input.sprint, jump: input.jump, jumpHeld: input.jumpHeld, glide }, dt, rt.world, extraSolids(g));
  ev.forEach((e) => { rt.ev.push({ type: 'body', what: e }); if (e === 'fall') { rt.ev.push({ type: 'retry', reason: 'fall' }); } });
  if (rt.body.gliding) { rt.landedByGlide = true; }
}

// ---- save and snapshot ---------------------------------------------------------------------------------------------
export function serialize(g) {
  const s = JSON.parse(JSON.stringify(g.s));
  const lay = LAYOUTS[g.rt.scene];
  if (lay && g.rt.body && g.rt.scene !== 'ride' && g.rt.scene !== 'train') { s.pos = {}; s.pos[g.rt.scene] = { x: Math.round(g.rt.body.x * 100) / 100, z: Math.round(g.rt.body.z * 100) / 100, y: Math.round(g.rt.body.y * 100) / 100, yaw: Math.round(g.rt.yaw * 1000) / 1000 }; }
  return s;
}
// Reads a save, migrates and repairs it. Anything that claims a restoration must still point at real bytes.
export function parseSave(raw, ar) {
  if (!raw || typeof raw !== 'object') { return null; }
  if (raw.schemaVersion !== SCHEMA) { return null; }
  const s = newSave();
  s.beat = BEATS.indexOf(raw.beat) >= 0 ? raw.beat : '1.study';
  s.era = raw.era === 1998 ? 1998 : 2004;
  ['flags', 'choices', 'edition'].forEach((k) => { if (raw[k] && typeof raw[k] === 'object') { Object.entries(raw[k]).forEach(([a, v]) => { if (typeof v === 'boolean' || typeof v === 'string') { s[k][a] = v; } }); } });
  s.seen = Array.isArray(raw.seen) ? raw.seen.filter((x) => typeof x === 'string' && DIALOGS[x]).slice(0, 80) : [];
  s.photos = Array.isArray(raw.photos) ? raw.photos.filter((p) => p && typeof p.id === 'string').slice(0, 6).map((p) => ({ id: p.id, reaction: String(p.reaction || ''), mood: p.mood || null, by: p.by || null, back: p.back || null, thumb: typeof p.thumb === 'string' && p.thumb.startsWith('data:image/') && p.thumb.length < 60000 ? p.thumb : null })) : [];
  s.window = raw.window && raw.window.placed === true ? { placed: true, finish: ['sea', 'honey', 'chalk'].indexOf(raw.window.finish) >= 0 ? raw.window.finish : 'sea' } : { placed: false, finish: null };
  s.bridge = typeof raw.bridge === 'number' && isFinite(raw.bridge) ? Math.max(0, Math.min(1, raw.bridge)) : 0;
  s.crank = typeof raw.crank === 'number' && isFinite(raw.crank) ? Math.max(0, Math.min(1, raw.crank)) : 0;
  s.season = ['summer', 'autumn', 'winter'].indexOf(raw.season) >= 0 ? raw.season : 'summer';
  if (raw.pos && typeof raw.pos === 'object') { Object.entries(raw.pos).forEach(([k, p]) => { if (LAYOUTS[k] && p && isFinite(p.x) && isFinite(p.z)) { s.pos[k] = { x: +p.x, z: +p.z, y: isFinite(p.y) ? +p.y : 0, yaw: isFinite(p.yaw) ? +p.yaw : 0 }; } }); }
  if (raw.restored && typeof raw.restored === 'object') {
    Object.entries(raw.restored).forEach(([k, p]) => {
      if (k === 'credits') { if (p && p.recordId) { s.restored.credits = p; } return; }
      if (Ar.verifyProvenance(ar, p)) { s.restored[k] = Object.assign({}, p); }
    });
  }
  // repair in story order: nothing after a beat can be claimed without the beat's own result
  const at = (b) => BEATS.indexOf(s.beat) >= BEATS.indexOf(b);
  if (at('1.pier') && !s.restored.bridge) { s.beat = '1.town'; }
  if (s.restored.bridge) { s.bridge = 1; } else if (s.beat !== '1.town' || s.bridge >= 1) { s.bridge = 0; }
  if (!at('1.pier')) { s.flags.tab = false; s.era = 2004; }
  if (at('3.cliff') && !s.window.placed) { s.beat = '3.yard'; }
  if (at('3.cliff') && !s.flags.lit) { s.beat = '3.yard'; }
  if (!at('3.yard')) { s.window = { placed: false, finish: null }; s.flags.lit = false; s.crank = 0; }
  if (!at('7.town')) { s.edition = {}; delete s.restored.credits; delete s.restored.iris; delete s.restored.lamp; }
  if (s.edition.iris_revived && !s.edition.credits_restored) { s.edition.iris_revived = false; delete s.restored.iris; }
  if (s.edition.seasons && !s.edition.iris_revived) { s.edition.seasons = false; s.edition.snow = false; }
  if (s.beat === 'end' && !s.edition.seasons) { s.beat = '7.town'; }
  if (s.edition.iris_revived && !s.restored.iris) { s.edition.iris_revived = false; s.edition.seasons = false; s.edition.snow = false; if (s.beat === 'end') { s.beat = '7.town'; } }
  return s;
}
export function snapshot(g) {
  const rt = g.rt, s = g.s, b = rt.body;
  return {
    beat: s.beat, chapter: chapterOf(s.beat), scene: rt.scene, player: rt.player, year: rt.year, era: s.era,
    x: b.x, y: b.y, z: b.z, grounded: b.grounded, gliding: b.gliding, yaw: rt.yaw, facing: b.facing,
    prompt: rt.prompt ? Object.assign({}, rt.prompt) : null, dialog: rt.dialog ? { id: rt.dialog.id, i: rt.dialog.i, n: rt.dialog.lines.length, line: rt.dialog.lines[rt.dialog.i], seen: rt.dialog.seen } : null,
    choice: rt.choice ? Object.assign({}, rt.choice) : null, caption: rt.caption ? rt.caption.key : null, shot: rt.shot,
    june: rt.june ? { x: rt.june.x, z: rt.june.z, state: rt.june.state, anim: rt.june.anim, expr: rt.june.expr } : null,
    theo: rt.theo ? { x: rt.theo.x, z: rt.theo.z, state: rt.theo.state } : null, iris: rt.iris ? { x: rt.iris.x, z: rt.iris.z, state: rt.iris.state, leaving: rt.iris.leaving, gone: rt.iris.gone, loops: !!(rt.iris.script && rt.iris.script.loops) } : null,
    train: rt.train ? { x: rt.train.x, v: rt.train.v, moving: rt.train.moving, caught: !!rt.train.caught, tries: rt.train.tries || 0 } : null,
    ride: rt.ride ? { s: rt.ride.s, d: rt.ride.d, v: rt.ride.v, length: rt.ride.road.length, june: { s: rt.ride.june.s, mode: rt.ride.june.mode }, overtook: rt.ride.overtook } : null,
    duet: rt.duet ? { t: rt.duet.t, layers: rt.duet.layers, hits: rt.duet.hits, misses: rt.duet.misses, cueIn: rt.duet.cueIn, second: rt.duet.second } : null,
    aim: rt.aim, carry: rt.carry, seated: !!rt.seated, bridge: s.bridge, crank: s.crank, restored: Object.keys(s.restored), edition: Object.assign({}, s.edition), window: Object.assign({}, s.window), photos: s.photos.map((p) => ({ id: p.id, reaction: p.reaction })),
    choices: Object.assign({}, s.choices), season: rt.season, assets: rt.graph ? [...rt.graph.assets] : [], credits: rt.graph ? rt.graph.credits : null, tab: !!s.flags.tab, hintLevel: rt.hintLevel, idleT: rt.idleT
  };
}
export { points as availablePoints };
