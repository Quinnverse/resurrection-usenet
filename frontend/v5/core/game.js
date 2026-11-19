// Resurrection V5: the whole game as a pure simulation. The browser feeds it input and draws what it reports;
// Node tests feed it input and play it from the first frame to the credits. No DOM, no Three.js, no timers.
//
// Chapters and beats (each chapter has at least one activity of its own)
//   1 Catch the summer   1.study (find Elena's backup disk, start the rebuild) -> 1.town (restore June's bridge) ->
//                        1.pier (cross the pier by switching 1998/2004) -> 1.chase (run for the train, jump the cart)
//   2 You are the view   2.train (June's photo dares: the lighthouse, the kite, June unawares; her photo of Elena;
//                        June dozes off on the way)
//   3 Our lighthouse     3.ride (bicycles: ribbon gates, the slipped chain, the bell) -> 3.yard (the crooked window,
//                        the lens on the pulley, the lamp together) -> 3.beam (steer the beam to find June, then the
//                        way down) -> 3.cliff (glide or the stairs)
//   4 A song for you     4.cottage (June's portfolio, tuning the guitar) -> 4.duet (Elena's melody from the archive,
//                        twice; sitting closer) -> the confession that is not quite one
//   5 Don't stay here    5.depart (June's suitcase, the soda machine, a last photo, the news, the train) ->
//                        5.alone (six years later: the same actions, nobody answering)
//   6 I remember too     6.cottage (2004: packing June's cottage together, her letter, the confrontation, no
//                        reconciliation)
//   7 Let summer end     7.study (the unsent letters stay unsent) -> 7.town (read the 1998 sign and restore the
//                        names, free Iris's boat, light the lamp for seasons that never existed) -> end
import * as Ar from './archive.js';
import * as Ph from './physics.js';
import * as Co from './companion.js';
import * as Toys from './toys.js';
import { LAYOUTS, point, bridgeFloors, THEO_TOWN, IRIS_TOWN, LIGHTHOUSE } from './layout.js';
const PIER_END = { x: 0, z: 24.4 };

export const SCHEMA = 1, PROVENANCE_VERSION = 'v5-fixture-1';
export const CHAPTERS = [1, 2, 3, 4, 5, 6, 7];
export const BEATS = ['1.study', '1.town', '1.pier', '1.carve', '1.chase', '2.train', '3.ride', '3.yard', '3.beam', '3.cliff', '4.cottage', '4.duet', '4.porch', '5.depart', '5.alone', '6.cottage', '6.beach', '7.study', '7.town', 'end'];
const BEAT_SCENE = { '1.study': 'study', '1.town': 'town', '1.pier': 'town', '1.carve': 'town', '1.chase': 'station', '4.porch': 'porch', '6.beach': 'coast', '2.train': 'train', '3.ride': 'ride', '3.yard': 'coast', '3.beam': 'coast', '3.cliff': 'coast', '4.cottage': 'cottage', '4.duet': 'cottage', '5.depart': 'station', '5.alone': 'station', '6.cottage': 'cottage', '7.study': 'study', '7.town': 'town', end: 'town' };
const BEAT_YEAR = { '1.carve': 1998, '4.porch': 1998, '6.beach': 2004, '1.chase': 1998, '2.train': 1998, '3.ride': 1998, '3.yard': 1998, '3.beam': 1998, '3.cliff': 1998, '4.cottage': 1998, '4.duet': 1998, '5.depart': 1998, '5.alone': 2004, '6.cottage': 2004 };
const PLAYER = { study: 'mara', town: 'mara', station: 'elena', train: 'elena', ride: 'elena', coast: 'elena', cottage: 'elena', porch: 'elena' };
const BEAT_PLAYER = { '1.carve': 'elena' };
export const chapterOf = (beat) => (beat === 'end' ? 7 : parseInt(beat, 10));
export const HOLD = { bridge: 4.0, crank: 3.2, pulley: 3.0, chain: 2.0, credits: 2.5, rope: 2.0, seasons: 3.0, post: 2.5, lampRestore: 3.0, newPier: 4.0 };
const MAX_PHOTOS = 10;

export function newSave() {
  return { schemaVersion: SCHEMA, provenanceVersion: PROVENANCE_VERSION, beat: '1.study', era: 2004, restored: {}, photos: [], choices: {}, window: { placed: false, finish: null },
    flags: {}, seen: [], edition: {}, pos: {}, bridge: 0, crank: 0, season: 'summer' };
}

// ---- dialogue lines -------------------------------------------------------------------------------------------
// A line is [who, key] or [who, key, shot]. ['pause', seconds, shot] holds a silence. { choice: id, options: [...] }.
// Dialogue advances only when the player presses; a dialogue seen before can be skipped.
const L = (who, key, shot) => [who, key, shot || null];
const pause = (s, shot) => ['pause', s, shot || null];
const C = (id, options) => ({ choice: id, options });
export const DIALOGS = {
  // chapter 1
  'c1.noDisk': [L('mara', 'c1.mara.never'), L('screen', 'c1.screen.noDisk'), L('mara', 'c1.mara.disk')],
  'c1.disk': [L('mara', 'c1.mara.found'), L('mara', 'c1.mara.note')],
  'c1.computer': [L('screen', 'c1.screen.reading'), L('screen', 'c1.screen.title'), L('mara', 'c1.mara.open')],
  'c1.theo1': [L('theo', 'c1.theo.hello', 'theo'), L('theo', 'c1.theo.almost', 'theo'), L('mara', 'c1.mara.howLong'), L('theo', 'c1.theo.dontAsk', 'theo'), L('theo', 'c1.theo.bridge', 'theo')],
  'c1.theo2': [L('theo', 'c1.theo.planks', 'theo'), L('mara', 'c1.mara.june'), L('theo', 'c1.theo.beard', 'theo'), L('theo', 'c1.theo.pier', 'theo'), L('theo', 'c1.theo.tab', 'theo')],
  'c1.memory': [L('mara', 'c1.mara.carved'), L('mara', 'c1.mara.show')],
  'c1.carveIntro': [L('june', 'c1.june.carve', 'june'), L('elena', 'c1.elena.carveWhat'), L('june', 'c1.june.carveUs', 'june')],
  'c1.carved': [L('june', 'c1.june.crookedE', 'june'), L('elena', 'c1.elena.likeYou', 'elena'), L('june', 'c1.june.exactly', 'june'), L('june', 'c1.june.train', 'june')],
  'c1.hand': [L('june', 'c1.june.thought', 'hands'), L('elena', 'c1.elena.when', 'hands'), L('june', 'c1.june.remember', 'june'), L('elena', 'c1.elena.bag', 'elena'), L('june', 'c1.june.bag', 'june')],
  // chapter 2
  'c2.intro': [L('june', 'c2.june.dontMove', 'june'), L('elena', 'c2.elena.what'), L('june', 'c2.june.yourTurn', 'june')],
  'c2.dare1': [L('june', 'c2.dare.intro', 'june'), L('elena', 'c2.elena.dare'), L('june', 'c2.dare.rules', 'june'), L('june', 'c2.dare.lighthouse', 'june')],
  'c2.dare1ok': [L('june', 'c2.dare.lighthouse.ok', 'june'), L('elena', 'c2.elena.lighthouse'), L('june', 'c2.dare.kite', 'june')],
  'c2.dare2ok': [L('june', 'c2.dare.kite.ok', 'june'), L('elena', 'c2.elena.kite')],
  'c2.sketch': [L('june', 'c2.june.sketch', 'june'), L('elena', 'c2.elena.howLong'), L('june', 'c2.june.untilISay', 'june')],
  'c2.sketchDone': [L('june', 'c2.june.sketchDone', 'june'), L('elena', 'c2.elena.nose'), L('june', 'c2.june.nose', 'june'), L('june', 'c2.dare.june', 'june'), L('elena', 'c2.elena.impossible')],
  'c2.dareGive': [L('june', 'c2.dare.give', 'june')],
  'c2.snap': [L('june', 'c2.june.thatsCheating', 'june'), L('june', 'c2.june.gotYou', 'june'), L('elena', 'c2.elena.wasntReady')],
  'c2.banter': [L('elena', 'c2.elena.why'), L('june', 'c2.june.view', 'june'), C('train', ['c2.choice.playful', 'c2.choice.sincere'])],
  'c2.playful': [L('elena', 'c2.elena.playful'), L('june', 'c2.june.playful', 'june'), L('june', 'c2.june.youreTheView', 'june')],
  'c2.sincere': [L('elena', 'c2.elena.sincere'), pause(1.4, 'june'), L('june', 'c2.june.sincere', 'june'), L('june', 'c2.june.youreTheView', 'june')],
  'c2.tunnel': [L('june', 'c2.june.tunnel', 'june')],
  'c2.tunnelHand': [L('june', 'c2.june.coldHand'), L('elena', 'c2.elena.coldHand')],
  'c2.tunnelOut': [L('june', 'c2.june.wish', 'june'), L('elena', 'c2.elena.wish'), L('june', 'c2.june.wishBack', 'june')],
  'c2.sleep': [pause(1.0, 'seat'), L('june', 'c2.june.yawn', 'june'), L('june', 'c2.june.wakeMe', 'june')],
  'c2.wakeShot': [L('june', 'c2.june.wokeShot', 'june'), L('elena', 'c2.elena.no'), L('june', 'c2.june.liar', 'june')],
  'c2.wake': [L('june', 'c2.june.woke', 'june'), L('elena', 'c2.elena.ferry'), L('june', 'c2.june.ferry', 'june')],
  'c2.backs': [L('screen', 'c2.back.june', 'photoback'), L('screen', 'c2.back.elena', 'photoback')],
  // chapter 3
  'c3.chain': [L('june', 'c3.june.chain', 'june'), L('elena', 'c3.elena.chain'), L('june', 'c3.june.chainHold', 'june')],
  'c3.chainFixed': [L('june', 'c3.june.fixed', 'june'), L('elena', 'c3.elena.grease'), L('june', 'c3.june.grease', 'june')],
  'c3.window': [L('june', 'c3.june.ta', 'window'), L('elena', 'c3.elena.crooked'), L('june', 'c3.june.yes'), L('elena', 'c3.elena.whyCrooked'), L('june', 'c3.june.because')],
  'c3.listen': [L('elena', 'c3.elena.complain'), L('june', 'c3.june.dontListen', 'twoshot'), pause(0.9, 'elena'), L('elena', 'c3.elena.wantTo', 'elena'), pause(1.2, 'june'), L('june', 'c3.june.lens', 'june')],
  'c3.lensUp': [L('june', 'c3.june.lensUp'), L('elena', 'c3.elena.careful'), L('june', 'c3.june.careful'), L('june', 'c3.june.crank')],
  'c3.lit': [L('june', 'c3.june.lit', 'beam'), L('elena', 'c3.elena.itWorks'), L('june', 'c3.june.steer', 'beam')],
  'c3.findMe': [L('june', 'c3.june.findMe')],
  'c3.found': [L('june', 'c3.june.found', 'beamctl'), L('elena', 'c3.elena.found'), L('june', 'c3.june.cottage', 'beamctl')],
  'c3.beamDone': [L('elena', 'c3.elena.cottage', 'beamctl'), L('june', 'c3.june.jump', 'beamctl')],
  // chapter 4
  'c4.arrive': [L('june', 'c4.june.arrive', 'june'), L('elena', 'c4.elena.ceiling'), L('june', 'c4.june.grandma', 'june')],
  'c4.sketches': [L('elena', 'c4.elena.sketches'), L('june', 'c4.june.portfolio', 'june'), L('june', 'c4.june.studioDream', 'june'), L('elena', 'c4.elena.theyllWant', 'elena'), L('june', 'c4.june.notForYou', 'june')],
  'c4.boat': [L('june', 'c4.june.boat', 'june'), L('elena', 'c4.elena.cantDraw'), L('june', 'c4.june.guide', 'june')],
  'c4.boatDone': [L('june', 'c4.june.boatDone', 'june'), L('elena', 'c4.elena.boatDone'), L('june', 'c4.june.keepIt', 'june')],
  'c4.tuned': [L('june', 'c4.june.tuned', 'june'), L('elena', 'c4.elena.tuned')],
  'c4.intro': [L('june', 'c4.june.thatOne', 'june'), L('elena', 'c4.elena.notDone'), L('june', 'c4.june.thenPlay')],
  'c4.again': [pause(1.2, 'june'), L('june', 'c4.june.again', 'june'), C('closer', ['c4.choice.scoot', 'c4.choice.keep'])],
  'c4.scoot': [L('elena', 'c4.elena.scoot', 'elena'), pause(1.0, 'twoshot'), L('june', 'c4.june.scoot', 'june')],
  'c4.keep': [L('elena', 'c4.elena.keep', 'elena'), L('june', 'c4.june.keep', 'june')],
  'c4.after': [pause(1.6, 'twoshot'), L('june', 'c4.june.outside', 'june'), L('elena', 'c4.elena.outside')],
  'c4.porch': [L('june', 'c4.june.stars', 'june'), L('june', 'c4.june.connect', 'june')],
  'c4.porchEnd': [L('june', 'c4.june.window', 'june'), pause(1.4, 'twoshot'), L('june', 'c4.june.poemIntro', 'june'), L('june', 'c4.june.poem', 'june'), L('screen', 'c4.poem.credit'), L('elena', 'c4.elena.almost', 'elena'), pause(1.6, 'twoshot'), L('june', 'c4.june.know', 'june'), L('elena', 'c4.elena.dots', 'elena')],
  // chapter 5
  'c5.arrive': [L('june', 'c5.june.platform', 'june'), L('elena', 'c5.elena.early'), L('june', 'c5.june.early', 'june')],
  'c5.walk': [L('june', 'c5.june.walk', 'june'), L('elena', 'c5.elena.walk')],
  'c5.news': [L('june', 'c5.june.letter', 'june'), L('june', 'c5.june.studio', 'june'), L('elena', 'c5.elena.thatsGood'), L('june', 'c5.june.chose', 'june'), C('parting', ['c5.choice.stay', 'c5.choice.miss'])],
  'c5.stay': [L('elena', 'c5.elena.stay', 'elena'), pause(1.4, 'june'), L('june', 'c5.june.cantStay', 'june'), L('june', 'c5.june.missMe', 'june'), L('june', 'c5.june.dontStay', 'june')],
  'c5.miss': [L('elena', 'c5.elena.miss', 'elena'), L('june', 'c5.june.smileMiss', 'june'), L('june', 'c5.june.missMe', 'june'), L('june', 'c5.june.dontStay', 'june')],
  'c5.alone': [pause(1.8, 'bench'), L('elena', 'c5.elena.years', 'bench'), L('elena', 'c5.elena.stayed', 'bench'), pause(1.4, 'bench')],
  // chapter 6
  'c6.arrive': [pause(1.0, 'june'), L('june', 'c6.june.found', 'june'), L('elena', 'c6.elena.selling'), L('june', 'c6.june.someone', 'june'), L('june', 'c6.june.boxes', 'june')],
  'c6.box1': [L('june', 'c6.june.books', 'june'), L('elena', 'c6.elena.books'), L('june', 'c6.june.twelve', 'june')],
  'c6.box2': [L('june', 'c6.june.residency', 'june'), L('elena', 'c6.elena.residency'), L('june', 'c6.june.myself', 'june')],
  'c6.walk': [L('june', 'c6.june.walk', 'june'), L('elena', 'c6.elena.walk')],
  'c6.socket': [pause(1.2, 'june'), L('june', 'c6.june.socket', 'june'), L('elena', 'c6.elena.socket'), L('june', 'c6.june.kept', 'june')],
  'c6.letter': [L('elena', 'c6.elena.letterRead'), L('screen', 'c6.screen.letter'), L('elena', 'c6.elena.letterThis')],
  'c6.talk': [L('elena', 'c6.elena.remember', 'elena'), pause(1.4, 'june'), L('june', 'c6.june.remember', 'june'), pause(1.2, 'elena'), C('defend', ['c6.choice.defend', 'c6.choice.admit'])],
  'c6.defend': [L('elena', 'c6.elena.studio', 'elena'), L('june', 'c6.june.asked', 'june'), L('june', 'c6.june.answered', 'june')],
  'c6.admit': [L('elena', 'c6.elena.admit', 'elena'), pause(1.0, 'june'), L('june', 'c6.june.admitted', 'june')],
  'c6.loss': [L('june', 'c6.june.loss', 'june'), L('june', 'c6.june.work', 'june'), L('june', 'c6.june.letterSay', 'june'), L('june', 'c6.june.iris', 'june'), pause(1.2, 'twoshot'), L('elena', 'c6.elena.miss', 'elena'),
    L('june', 'c6.june.iKnow', 'june'), pause(1.6, 'twoshot'), C('offer', ['c6.choice.fix', 'c6.choice.forgive'])],
  'c6.fix': [L('elena', 'c6.elena.fix', 'elena'), L('june', 'c6.june.fix', 'june')],
  'c6.forgive': [L('elena', 'c6.elena.forgive', 'elena'), L('june', 'c6.june.forgive', 'june')],
  'c6.end': [L('elena', 'c6.elena.sorry', 'elena'), L('june', 'c6.june.notToday', 'june'), pause(1.8, 'window')],
  'c6.leave': [pause(1.2, 'june'), L('june', 'c6.june.careful', 'june'), pause(1.0, 'elena')],
  // chapter 7
  'c7.letter': [L('mara', 'c7.mara.drafts'), L('mara', 'c7.mara.unsent'), C('letter', ['c7.choice.read', 'c7.choice.close'])],
  'c7.read': [L('screen', 'c7.screen.draft'), L('mara', 'c7.mara.notMine')],
  'c7.close': [L('mara', 'c7.mara.close'), L('mara', 'c7.mara.notMine')],
  'c7.theo': [L('theo', 'c7.theo.back', 'theo'), L('mara', 'c7.mara.names'), L('theo', 'c7.theo.ok', 'theo')],
  'c7.creditsNeed': [L('mara', 'c7.mara.oneName'), L('mara', 'c7.mara.original')],
  'c7.credits98': [L('mara', 'c7.mara.read98'), L('mara', 'c7.mara.back04')],
  'c7.credits': [L('mara', 'c7.mara.credits'), L('theo', 'c7.theo.june', 'theo')],
  'c7.irisLoop': [L('iris', 'c7.iris.loop'), L('mara', 'c7.mara.loop'), L('iris', 'c7.iris.loop2'), L('mara', 'c7.mara.record')],
  'c7.irisRope': [L('iris', 'c7.iris.rope')],
  'c7.iris': [L('iris', 'c7.iris.harbor'), L('theo', 'c7.theo.iris', 'theo'), L('mara', 'c7.mara.iris'), L('iris', 'c7.iris.thanks')],
  'c7.lamp': [L('mara', 'c7.mara.lamp'), L('theo', 'c7.theo.lampLit', 'theo'), L('mara', 'c7.mara.notYet')],
  'c7.seasons': [L('mara', 'c7.mara.new')],
  'c7.snow': [L('theo', 'c7.theo.snow', 'theo'), L('mara', 'c7.mara.summerEnd', 'mara'), L('theo', 'c7.theo.honours', 'theo')],
  'c7.beamPier': [L('theo', 'c7.theo.evening', 'theo'), L('mara', 'c7.mara.noPier', 'mara'), L('theo', 'c7.theo.edition', 'theo')],
  'c7.newPier': [L('mara', 'c7.mara.planks', 'mara'), L('theo', 'c7.theo.walk', 'theo')],
  'c7.final': [L('theo', 'c7.theo.end', 'theo'), L('mara', 'c7.mara.final', 'mara'), L('theo', 'c7.theo.goodnight', 'theo')]
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
// a dialogue, then another chosen by what was picked in it
const branch = (g, id, choiceId, map, then) => dialog(g, id, () => dialog(g, map[g.s.choices[choiceId]] || Object.values(map)[0], then));
function lineStart(g) {
  const d = g.rt.dialog; const ln = d.lines[d.i]; d.lineT = g.rt.t;
  if (Array.isArray(ln)) { g.rt.shot = ln[2] || g.rt.shot; }
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
  if (input.skip && d.seen) {
    // skipping still makes any choice in it, so what follows is the same
    d.lines.slice(d.i).forEach((x) => { if (!Array.isArray(x) && !g.s.choices[x.choice]) { g.s.choices[x.choice] = x.options[0]; } });
    endDialog(g); return;
  }
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
  if (br && br.state !== 'missing') { floors = bridgeFloors(br.data, 1); }
  else if (br && br.state === 'missing' && g.s.bridge > 0 && g.rt && g.rt.restoring) { floors = bridgeFloors(g.rt.restoring.data, g.s.bridge); }
  const w = Ph.makeWorld(lay, { assets: sg.assets, floors: floors.concat(era === 2004 && g.s.edition.pier_walk ? NEW_PIER : []) });
  if (era === 2004 && g.s.edition.pier_walk) { w.solids = w.solids.filter((sd) => sd.asset !== 'pier_closed'); }   // the fence opens in the present edition only
  return w;
}
// New planks Mara lays in the present edition (CREATED): from the plaza to the 2004 stub, and from the stub to the end.
const NEW_PIER = [{ k: 'rect', x0: -1, x1: 1, z0: 14.3, z1: 17.2, y: 0, created: true }, { k: 'rect', x0: -1, x1: 1, z0: 22.8, z1: 25.2, y: 0, created: true }];
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
  if (g.rt.june && (g.rt.scene === 'coast' || g.rt.scene === 'cottage') && !(g.rt.june.y > 1)) { out.push({ k: 'circ', x: g.rt.june.x, z: g.rt.june.z, r: 0.38, top: 2 }); }
  return out;
}

function enterBeat(g, beat, loading) {
  const prev = g.rt;
  const scene = BEAT_SCENE[beat];
  g.s.beat = beat;
  g.rt = { t: prev ? prev.t : 0, ev: prev ? prev.ev : [], scene, player: BEAT_PLAYER[beat] || PLAYER[scene], beatT: 0, idleT: 0, hintLevel: 0, dialog: null, caption: null, shot: null, baseShot: null, prompt: null,
    theo: null, june: null, iris: null, train: null, ride: null, duet: null, tuning: null, beam: null, carry: null, restoring: null, aim: false, aimYaw: 0, aimPitch: 0, year: BEAT_YEAR[beat] || null,
    tabDeny: 0, season: g.s.season, hold: {}, timers: [] };
  if (beat === '7.town' || beat === 'end') { g.s.era = 2004; }
  if (beat === '1.carve') { g.s.era = 1998; }
  refreshWorld(g);
  if (scene !== 'ride' && scene !== 'train' && scene !== 'porch') { place(g, scene, loading && beat !== '6.beach' && beat !== '1.carve' ? null : (BEAT_START[beat] || null)); } else { g.rt.body = Ph.newBody(0, 0, 0); g.rt.yaw = 0; }
  const setup = SETUP[beat]; if (setup) { setup(g, loading); }
  if (beat === '3.beam' && !g.rt.dialog) { g.rt.shot = g.rt.baseShot; }
  g.rt.ev.push({ type: 'beat', beat, chapter: chapterOf(beat), scene, year: g.rt.year, loading: !!loading });
  g.rt.ev.push({ type: 'save' });
}
const BEAT_START = {
  '1.town': { x: 0, z: -9.2, yaw: Math.PI }, '1.chase': LAYOUTS.station.spawn, '3.yard': { x: 259, z: 16.5, yaw: Math.PI * 1.1 }, '3.beam': { x: 266.2, z: 25.0, yaw: Math.PI * 0.3 },
  '3.cliff': { x: 266.4, z: 24.6, yaw: Math.PI * 0.6 }, '1.carve': { x: -0.2, z: 22.9, yaw: Math.PI }, '6.beach': { x: 298.0, z: 29.0, y: -5, yaw: Math.PI / 2 }, '4.cottage': { x: 0, z: 2.3, yaw: 0 }, '4.duet': LAYOUTS.cottage.guitarSeat,
  '5.depart': { x: -9.5, z: 0.2, yaw: -Math.PI / 2 }, '5.alone': { x: -9.5, z: 0.2, yaw: -Math.PI / 2 }, '6.cottage': { x: 0, z: 2.3, yaw: 0 }, '7.study': LAYOUTS.study.spawn, '7.town': { x: 0, z: -12.6, yaw: Math.PI }
};
// someone does something a little later (a reply that does not come at once, a train announcement)
const later = (g, secs, fn) => g.rt.timers.push({ at: g.rt.t + secs, fn });

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
  '1.carve': (g) => { g.rt.june = Co.newCompanion(0.75, 23.7, -Math.PI / 2); Co.wait(g.rt.june, null, 'grin'); irisSetup(g); if (!seen(g, 'c1.carveIntro')) { dialog(g, 'c1.carveIntro'); } },
  '1.chase': (g) => {
    const tr = LAYOUTS.station.train;
    g.rt.train = { x: tr.startX, v: 0, moving: false, caught: false, tries: g.rt.train ? g.rt.train.tries : 0 };
    g.rt.june = Co.newCompanion(tr.startX, tr.doorZ, -Math.PI / 2); Co.invite(g.rt.june, null, 'grin');
    say(g, 'june', 'c1.june.come', 3.4);
  },
  '2.train': (g) => {
    const lay = LAYOUTS.train; g.rt.june = Co.newCompanion(lay.june.x, lay.june.z, 0); Co.play(g.rt.june, 'window'); g.rt.june.anim = 'sit';
    g.rt.aimYaw = Math.PI - 0.5; g.rt.aimPitch = 0.1; g.rt.photoT = 0; g.rt.baseShot = 'seat'; g.rt.dareT = 0;
    g.rt.dare = g.s.flags.dares1 ? ['dare0', 'dare1', 'dare2'].filter((k) => g.s.flags[k]).length : null;
    if (g.s.flags.juneSnap) { g.rt.dare = 3; g.rt.sleep = { t: 0 }; Co.play(g.rt.june, 'sleep'); }
    else if (g.s.flags.dare1 && !g.s.flags.sketched) { g.rt.dare = 2; g.rt.sketch = { still: 0, resets: 0 }; }
    if (!g.s.flags.c2intro) { dialog(g, 'c2.intro', () => { g.s.flags.c2intro = true; }); }
  },
  '3.ride': (g) => { g.rt.ride = Toys.newRide(); g.rt.ride.gates = []; g.rt.ride.bells = 0; g.rt.baseShot = 'ride'; say(g, 'june', 'c3.june.race', 3); },
  '3.yard': (g) => {
    const c = LAYOUTS.coast.cart; g.rt.june = Co.newCompanion(c.x + 0.4, c.z - 1.3, 0);
    if (!g.s.window.placed) { Co.invite(g.rt.june, null, 'grin'); }
    else { juneOnGallery(g); }
  },
  '3.beam': (g) => {
    const Y = LAYOUTS.coast; g.rt.seated = true; g.rt.baseShot = 'beamctl';
    g.rt.june = Co.newCompanion(263.0, 25.6, 0); Co.transition(g.rt.june, [[266.8, 22.4], [270.6, 23.4], [272.4, 26.5], [Y.rocks.x, Y.rocks.z]], 2.6);
    g.rt.beam = { a: 1.7, target: g.s.flags.foundJune ? 'cottage' : 'june', holdT: 0, ready: false };
  },
  '3.cliff': (g) => { g.rt.june = Co.newCompanion(272.4, 22.6, Math.PI / 2); Co.wait(g.rt.june, null, 'grin'); },
  '4.cottage': (g) => {
    g.rt.june = Co.newCompanion(2.3, 0.75, -Math.PI / 2); Co.invite(g.rt.june, null, 'smile');
    if (!g.s.flags.c4arrive) { dialog(g, 'c4.arrive', () => { g.s.flags.c4arrive = true; Co.wait(g.rt.june, null, 'smile'); }); }
  },
  '4.duet': (g) => {
    const near = g.s.choices.closer ? -0.55 : 0;
    const js = LAYOUTS.cottage.juneSeat, gs = LAYOUTS.cottage.guitarSeat;
    g.rt.june = Co.newCompanion(js.x + near, js.z, Math.atan2(gs.x - js.x - near, gs.z - js.z)); Co.wait(g.rt.june, null, 'smile'); g.rt.june.anim = 'sit';
    g.rt.body.x = LAYOUTS.cottage.guitarSeat.x; g.rt.body.z = LAYOUTS.cottage.guitarSeat.z; g.rt.seated = true; g.rt.baseShot = 'duet';
    g.rt.duetN = g.s.flags.duet1 ? 1 : 0;
    if (!g.s.flags.c4intro) { dialog(g, 'c4.intro', () => { g.s.flags.c4intro = true; }); }
  },
  '5.depart': (g) => {
    const tr = LAYOUTS.station.train;
    g.rt.train = { x: -2, v: 0, moving: false, departing: false };
    const at = g.s.flags.walked ? STATION_WALK[STATION_WALK.length - 1] : g.s.flags.suitcase ? [-3.2, 1.2] : [-4.3, -0.9];
    g.rt.june = Co.newCompanion(at[0], at[1], -Math.PI / 2); Co.wait(g.rt.june, null, 'smile');
    if (g.s.flags.suitcase && !g.s.flags.walked) { startPlatformWalk(g); }
    g.rt.trainZ = tr.z;
    if (!g.s.flags.c5arrive) { dialog(g, 'c5.arrive', () => { g.s.flags.c5arrive = true; }); }
  },
  '4.porch': (g) => {
    const lay = LAYOUTS.porch; g.rt.june = Co.newCompanion(lay.june.x, lay.june.z, Math.PI); Co.wait(g.rt.june, null, 'smile'); g.rt.june.anim = 'sit'; g.rt.june.y = -5;
    g.rt.aimYaw = 0.1; g.rt.aimPitch = -0.15; g.rt.stars = { i: 0, holdT: 0, linked: [] }; g.rt.baseShot = null;
    dialog(g, 'c4.porch');
  },
  '5.alone': (g) => { g.rt.baseShot = null; g.rt.train = { x: -70, v: 0, moving: false, passing: true }; say(g, 'screen', 'c5.title.years', 4); },
  '6.cottage': (g) => {
    g.rt.june = Co.newCompanion(LAYOUTS.cottage.juneWindow.x, LAYOUTS.cottage.juneWindow.z, Math.PI * 0.9); Co.wait(g.rt.june, null, 'quiet'); g.rt.june.anim = 'turnaway';
    if (!g.s.flags.c6arrive) { dialog(g, 'c6.arrive', () => { g.s.flags.c6arrive = true; }); }
  },
  '6.beach': (g) => {
    g.rt.june = Co.newCompanion(299.0, 28.6, -Math.PI / 2); g.rt.june.y = -5; g.rt.leg = 0; Co.lead(g.rt.june, BEACH_LEGS[0], { ahead: 3, waitR: 6.5, speed: 1.4 }); g.rt.june.expr = 'quiet';
    say(g, 'june', 'c6.june.beach', 4);
  },
  '7.study': (g) => { g.rt.baseShot = null; },
  '7.town': (g) => {
    g.rt.theo = Co.newCompanion(1.2, -11.6, Math.PI); Co.invite(g.rt.theo, null, 'smile'); irisSetup(g);
    if (g.s.edition.iris_revived) { g.rt.iris.gone = true; g.rt.theo.x = 14.2; g.rt.theo.z = 15.6; Co.wait(g.rt.theo); }
    if (g.s.edition.seasons && !g.s.flags.beamPier) { g.rt.seasonRun = { t: 20 }; g.rt.snowTalk = true; g.rt.season = 'winter'; g.rt.beam = { a: 2.4, target: 'pier', holdT: 0, ready: true }; g.rt.seated = true; g.rt.shot = g.rt.baseShot = 'town-beam'; }
    if (g.s.flags.beamPier) { g.rt.seasonRun = { t: 20 }; g.rt.snowTalk = true; g.rt.season = 'winter'; g.rt.theo.x = 0.6; g.rt.theo.z = 12.6; }
    if (g.s.edition.pier_walk) { Co.lead(g.rt.theo, [[0.2, 16.0], [0.1, 20.0], [0.2, 24.0]], { ahead: 2.5, waitR: 6, speed: 1.3 }); g.rt.theoPier = true; }
  },
  end: (g) => { g.rt.theo = Co.newCompanion(14.2, 15.6, Math.PI); Co.wait(g.rt.theo); irisSetup(g); if (g.rt.iris) { g.rt.iris.gone = true; } g.rt.season = 'winter'; }
};
// June's walks: along the platform in 1998, and along the beach and up to the dark lighthouse in 2004
const STATION_WALK = [[-12, 0.9], [-19, 0.6], [-27.5, 0.3]];
const BEACH_LEGS = [[[295, 27.5], [290, 24.6]], [[284, 21.2], [278.4, 18.4], [275.4, 16.6]], [[272.6, 16.2], [270.4, 16.4], [268.2, 18.8], [264.6, 22.6]]];
function startPlatformWalk(g) { Co.lead(g.rt.june, STATION_WALK, { ahead: 3, waitR: 7, speed: 1.5 }); g.rt.walkSaid = 0; }
function irisSetup(g) {
  const sg = Ar.sceneGraph(g.ar, g.s.era, g.s.restored, g.s.edition); const o = sg.objects.find((x) => x.id === 'iris');
  g.rt.iris = { x: IRIS_TOWN.bakery.x, z: IRIS_TOWN.bakery.z, script: o ? o.data : null, state: o ? o.state : 'missing', route: [], gone: false, boatX: 0, leaving: false, talks: 0 };
}
function juneOnGallery(g) {
  const G = LAYOUTS.coast.gallery; const j = g.rt.june;
  if (g.s.flags.lens) { j.x = G.x; j.z = G.z; j.y = G.y; Co.cooperate(j, null, 'lens'); return; }
  Co.cooperate(j, { x: G.x, z: G.z }, 'lens');
}

// ---- interaction points available right now -----------------------------------------------------------------------
function points(g) {
  const sc = g.rt.scene, beat = g.s.beat, s = g.s, rt = g.rt, out = [];
  const add = (id, x, z, r, extra) => out.push(Object.assign({ id, x, z, r }, extra || {}));
  const lay = LAYOUTS[sc] || {};
  const p = (id) => point(sc, id);
  const at = (id, extra) => { const q = p(id); add(id, q.x, q.z, q.r, extra); };
  if (sc === 'study') {
    if (beat === '1.study' || beat === '7.study') { at('computer', { verb: beat === '7.study' ? 'verb.read' : 'verb.use' }); }
    ['photo', 'keepbox', 'drawing', 'shelf', 'window', 'lamp'].forEach((id) => at(id, { verb: id === 'lamp' ? 'verb.toggle' : (id === 'keepbox' && beat === '1.study' && !s.flags.disk ? 'verb.open' : 'verb.look'), optional: !(id === 'keepbox' && s.flags.needDisk && !s.flags.disk) }));
  } else if (sc === 'town') {
    const th = rt.theo;
    if (th && !rt.theoPier) { const across = th.z > 11.6 && rt.body.z < 8.4; add('theo', th.x, th.z, across ? 4.9 : 1.9, { verb: 'verb.talk', moving: true, priority: beat === '1.town' && !seen(g, 'c1.theo1') ? 4 : 0 }); }
    if (beat === '1.town' && !s.restored.bridge && s.era === 2004) { at('gap', { verb: 'verb.restore', hold: true }); }
    if (beat === '1.pier' && s.era === 1998) { at('pierEnd', { verb: 'verb.touch' }); }
    if (beat === '1.carve' && !s.flags.carved) { const q = p('pierEnd'); add('post', q.x, q.z, 1.4, { verb: 'verb.carve', hold: true }); }
    const ir = rt.iris;
    if ((beat === '1.town' || beat === '1.pier') && ir && !ir.leaving) { add('irisTalk', ir.x, ir.z, 1.7, { verb: 'verb.talk', optional: true }); }
    if (beat === '7.town') {
      if (!s.edition.credits_restored) {
        if (s.era === 1998) { at('credits', { verb: 'verb.read' }); }
        else { at('credits', s.flags.read98 ? { verb: 'verb.restoreCredit', hold: true } : { verb: 'verb.read' }); }
      } else if (!s.edition.iris_revived && ir && !ir.leaving && s.era === 2004) { const q = p('bakery'); add('iris', q.x, q.z, q.r, { verb: s.flags.irisMet ? 'verb.revive' : 'verb.talk' }); }
      else if (ir && ir.leaving && ir.atDock && !ir.boarded) { at('rope', { verb: 'verb.untie', hold: true }); }
      else if (s.edition.iris_revived && (!ir || ir.gone) && !s.restored.lamp && s.era === 2004) { const q = p('lighthouse'); add('lampRestore', q.x, q.z, q.r, { verb: 'verb.restoreLamp', hold: true }); }
      else if (s.edition.iris_revived && (!ir || ir.gone) && s.restored.lamp && !s.edition.seasons && s.era === 2004) { const q = p('lighthouse'); add('seasons', q.x, q.z, q.r, { verb: 'verb.recompose', hold: true }); }
      else if (s.flags.beamPier && !s.edition.pier_walk && s.era === 2004 && !rt.beam) { add('newPier', 0, 13.9, 1.6, { verb: 'verb.build', hold: true }); }
    }
    at('notice', { verb: 'verb.read', optional: true });
  } else if (sc === 'station') {
    if (beat === '1.chase' && rt.train && !rt.train.caught) { const d = { x: rt.train.x, z: lay.train.doorZ }; add('hand', d.x, d.z - 0.6, lay.train.catchR, { verb: 'verb.hand', moving: true }); }
    if (beat === '5.depart' && !s.flags.c5talk) {
      if (!s.flags.suitcase && rt.carry !== 'suitcase') { at('suitcase', { verb: 'verb.carry' }); }
      if (rt.carry === 'suitcase') { at('door', { verb: 'verb.put' }); }
      at('kiosk', { verb: 'verb.buy', optional: true });
      if (!s.flags.snap98 && rt.june) { at('snap', { verb: 'verb.photo', optional: true }); }
      if (rt.june && !rt.carry && (!s.flags.suitcase || (s.flags.walked && rt.june.state !== 'LEAD'))) { add('june', rt.june.x, rt.june.z, 1.8, { verb: 'verb.talk', moving: true }); }
    }
    if (beat === '5.alone' && !rt.seated) {
      at('kiosk', { verb: 'verb.buy', optional: true }); if (!s.flags.snap04) { at('snap', { verb: 'verb.photo', optional: true }); }
      if (!rt.called) { at('door', { verb: 'verb.call', optional: true }); }
      if (!s.flags.sea04) { const q = STATION_WALK[STATION_WALK.length - 1]; add('seaview', q[0], q[1], 1.6, { verb: 'verb.look', optional: true }); }
      at('bench', { verb: 'verb.sit' });
    }
  } else if (sc === 'train') {
    if (rt.tunnel && rt.tunnel.t > 1.2 && !s.flags.heldHand && !rt.dialog) { add('juneHand', 0.3, -0.1, 99, { verb: 'verb.reach' }); }
  } else if (sc === 'ride') {
    if (rt.ride && rt.ride.stop === 'chain' && !rt.dialog) { add('chain', rt.body.x, rt.body.z, 99, { verb: 'verb.fixChain', hold: true }); }
  } else if (sc === 'coast') {
    if (beat === '3.yard') {
      if (!s.window.placed && !rt.carry) { at('cart', { verb: 'verb.window' }); }
      if (rt.carry === 'window') { at('socket', { verb: 'verb.place' }); }
      if (s.window.placed && !s.flags.lens && rt.june && rt.june.y > 6) { at('pulley', { verb: 'verb.pull', hold: true }); }
      if (s.window.placed && s.flags.lens && !s.flags.lit) { at('crank', { verb: 'verb.crank', hold: true }); }
    }
    if (beat === '3.cliff') { at('door', { verb: 'verb.enter' }); }
    if (beat === '6.beach' && s.flags.beachTalk3) { add('road', 254.0, 21.0, 1.8, { verb: 'verb.leave' }); }
  } else if (sc === 'cottage') {
    if (beat === '4.cottage' && !rt.tuning && !rt.pen) {
      if (s.flags.boat) { at('guitar', { verb: 'verb.tune' }); } at('sketches', { verb: 'verb.look', optional: !!s.flags.boat }); at('shelf', { verb: 'verb.look', optional: true }); at('window', { verb: 'verb.look', optional: true });
    }
    if (beat === '4.duet' && !rt.duet && !rt.dialog) { at('guitar', { verb: 'verb.play', r: 2.0 }); out[out.length - 1].r = 2.0; }
    if (beat === '6.cottage') {
      if (!rt.carry) { ['boxA', 'boxB'].forEach((id) => { if (!s.flags[id]) { at(id, { verb: 'verb.carry' }); } }); }
      if (rt.carry) { at('drop', { verb: 'verb.put' }); }
      if (!rt.carry) { at('gamebox', { verb: 'verb.look', optional: true }); at('letter', { verb: 'verb.read', optional: true }); at('window', { verb: 'verb.look', optional: true }); }
      if (rt.june && s.flags.boxA && s.flags.boxB && !rt.carry && !rt.juneCarry) { add('june', rt.june.x, rt.june.z, 1.7, { verb: 'verb.speak', moving: true }); }
    }
  }
  return out;
}
function nearest(g) {
  const b = g.rt.body; let best = null, bd = Infinity;
  for (const p of points(g)) { const d = Math.hypot(p.x - b.x, p.z - b.z); if (d <= p.r && d - (p.priority || 0) - (p.optional ? -0.4 : 0) < bd) { best = p; bd = d - (p.priority || 0) - (p.optional ? -0.4 : 0); } }
  return best;
}

// ---- interactions ---------------------------------------------------------------------------------------------
function use(g, p) {
  const s = g.s, rt = g.rt, ev = rt.ev;
  ev.push({ type: 'use', id: p.id });
  const looked = (id) => { s.flags['looked_' + id] = true; };
  switch (p.id) {
    case 'computer':
      if (s.beat === '1.study') {
        if (!s.flags.disk) { s.flags.needDisk = true; dialog(g, 'c1.noDisk'); return; }
        const lines = seen(g, 'c1.noDisk') ? null : [L('mara', 'c1.mara.never')].concat(DIALOGS['c1.computer']);
        dialog(g, 'c1.computer', () => { g.rt.ev.push({ type: 'rebuild', messages: g.ar.publicView().messages.size, sources: g.ar.publicView().sources.length }); enterBeat(g, '1.town'); }, lines);
      } else {
        ev.push({ type: 'letter', text: g.ar.drafts });
        branch(g, 'c7.letter', 'letter', { 'c7.choice.read': 'c7.read', 'c7.choice.close': 'c7.close' }, () => { s.flags.letterRead = true; enterBeat(g, '7.town'); });
      }
      return;
    case 'keepbox':
      if (s.beat === '1.study' && !s.flags.disk) { s.flags.disk = true; ev.push({ type: 'item', id: 'disk' }); dialog(g, 'c1.disk'); return; }
      looked(p.id); say(g, 'mara', 'look.keepbox' + (s.beat === '7.study' ? '7' : ''), 4.5); return;
    case 'photo': case 'drawing': case 'shelf': case 'window':
      looked(p.id);
      if (rt.scene === 'study') { say(g, 'mara', 'look.' + p.id + (s.beat === '7.study' ? '7' : ''), 4.5); return; }
      if (s.beat === '4.cottage') { say(g, 'elena', 'c4.look.' + p.id, 4.5); return; }
      say(g, 'elena', 'c6.look.' + p.id, 4.5); return;
    case 'lamp': s.flags.lampOff = !s.flags.lampOff; ev.push({ type: 'sfx', name: 'lamp' }); return;
    case 'notice': say(g, 'mara', 'look.notice.' + (s.edition.credits_restored ? 'restored' : s.era), 4.5); return;
    case 'irisTalk': rt.iris.talks += 1; say(g, 'iris', 'iris.loop' + (((rt.iris.talks - 1) % 3) + 1), 3.6); return;
    case 'theo':
      if (s.beat === '1.town' && !seen(g, 'c1.theo1')) { dialog(g, 'c1.theo1'); return; }
      say(g, 'theo', s.beat === '7.town' ? 'c7.theo.idle' : (s.restored.bridge ? 'c1.theo.idle' : 'c1.theo.wait'), 3.2); return;
    case 'pierEnd': dialog(g, 'c1.memory', () => { g.rt.ev.push({ type: 'memory' }); enterBeat(g, '1.carve'); }); return;
    case 'seaview': s.flags.sea04 = true; say(g, 'elena', 'c5.sea04', 4.5); return;
    case 'road': { const go = () => { g.rt.ev.push({ type: 'fade' }); enterBeat(g, '7.study'); }; if (!s.flags.toldCareful) { Co.react(rt.june, 'quiet', 'idle', 4); dialog(g, 'c6.leave', () => { s.flags.toldCareful = true; go(); }); } else { go(); } return; }
    case 'hand':
      rt.train.caught = true; ev.push({ type: 'caught' }); Co.react(rt.june, 'grin', 'reach', 2);
      dialog(g, 'c1.hand', () => { s.flags.chased = true; enterBeat(g, '2.train'); }); return;
    // chapter 3
    case 'cart':
      if (!seen(g, 'c3.window')) { dialog(g, 'c3.window', () => { rt.carry = 'window'; g.rt.ev.push({ type: 'carry', what: 'window' }); }); } else { rt.carry = 'window'; ev.push({ type: 'carry', what: 'window' }); }
      return;
    case 'socket': {
      const w = Ar.sceneGraph(g.ar, 1998, s.restored, null).objects.find((o) => o.id === 'window');
      rt.choice = { id: 'finish', options: (w && w.data.finishes.length ? w.data.finishes : ['sea', 'honey', 'chalk']).map((f) => 'finish.' + f) };
      ev.push({ type: 'choose', id: 'finish', options: rt.choice.options });
      return;
    }
    case 'door':
      if (s.beat === '3.cliff') { ev.push({ type: 'fade' }); enterBeat(g, '4.cottage'); return; }
      if (s.beat === '5.depart') { rt.carry = null; s.flags.suitcase = true; ev.push({ type: 'placed', id: 'suitcase' }); ev.push({ type: 'save' }); Co.react(rt.june, 'grin', 'wave', 1.5); dialog(g, 'c5.walk', () => startPlatformWalk(g)); return; }
      if (s.beat === '5.alone') { rt.called = true; say(g, 'elena', 'c5.call04', 3); later(g, 3.6, () => say(g, 'screen', 'c5.announce', 4.5)); return; }
      if (s.beat === '6.cottage') {
        const go = () => { g.rt.ev.push({ type: 'fade' }); enterBeat(g, '7.study'); };
        if (!s.flags.toldCareful) { Co.react(rt.june, 'quiet', 'idle', 4); dialog(g, 'c6.leave', () => { s.flags.toldCareful = true; go(); }); } else { go(); }
      }
      return;
    // chapter 4
    case 'sketches': looked(p.id); if (!s.flags.boat) { dialog(g, seen(g, 'c4.sketches') ? 'c4.boat' : 'c4.sketches', () => { if (!seen(g, 'c4.boat')) { dialog(g, 'c4.boat', () => startPen(g)); } else { startPen(g); } }); } else { say(g, 'elena', 'c4.look.sketches', 4); } return;
    case 'guitar':
      if (s.beat === '4.cottage') { rt.tuning = Toys.newTuning(); rt.seated = true; rt.body.x = LAYOUTS.cottage.guitarSeat.x; rt.body.z = LAYOUTS.cottage.guitarSeat.z; rt.shot = rt.baseShot = 'duet'; ev.push({ type: 'tuning-start' }); say(g, 'june', 'c4.tune.start', 3.6); return; }
      startDuet(g); return;
    // chapter 5
    case 'juneHand': s.flags.heldHand = true; rt.ev.push({ type: 'sfx', name: 'touch' }); dialog(g, 'c2.tunnelHand'); return;
    case 'suitcase': rt.carry = 'suitcase'; ev.push({ type: 'carry', what: 'suitcase' }); say(g, 'june', 'c5.june.noodles', 3.4); return;
    case 'kiosk':
      if (s.beat === '5.depart') { if (!s.flags.kiosk98) { s.flags.kiosk98 = true; ev.push({ type: 'sfx', name: 'can' }); later(g, 0.5, () => g.rt.ev.push({ type: 'sfx', name: 'can' })); say(g, 'june', 'c5.kiosk98', 3.8); Co.react(rt.june, 'grin', 'wave', 1.6); } else { say(g, 'elena', 'c5.kiosk98b', 3); } return; }
      s.flags.kiosk04 = true; ev.push({ type: 'sfx', name: 'can' }); say(g, 'elena', 'c5.kiosk04', 4); return;
    case 'snap': platformPhoto(g); return;
    case 'bench': rt.seated = true; dialog(g, 'c5.alone', () => { g.rt.ev.push({ type: 'fade' }); enterBeat(g, '6.cottage'); }); return;
    // chapter 6
    case 'boxA': case 'boxB':
      rt.carry = p.id; ev.push({ type: 'carry', what: 'box' });
      if (!s.flags.juneCarried && rt.june) { s.flags.juneCarried = true; Co.transition(rt.june, [[2.3, -1.0], [2.3, 0.9], [1.6, 1.9], [2.3, 0.9], [2.3, -1.0], [1.4, -2.3]], 1.3); rt.juneCarry = true; }
      return;
    case 'drop': {
      const id = rt.carry; rt.carry = null; s.flags[id] = true; ev.push({ type: 'placed', id: 'box' }); const n = (s.flags.boxA ? 1 : 0) + (s.flags.boxB ? 1 : 0);
      if (n === 1) { dialog(g, 'c6.box1'); } else { dialog(g, 'c6.box2'); }
      return;
    }
    case 'gamebox': looked(p.id); say(g, 'elena', 'c6.look.gamebox', 5); return;
    case 'letter': looked(p.id); if (!seen(g, 'c6.letter')) { dialog(g, 'c6.letter'); } else { say(g, 'elena', 'c6.elena.letterThis', 3.4); } return;
    case 'june':
      if (s.beat === '5.depart') {
        if (!s.flags.suitcase) { say(g, 'june', 'c5.june.suitcaseFirst', 3.2); return; }
        s.flags.c5talk = true;
        branch(g, 'c5.news', 'parting', { 'c5.choice.stay': 'c5.stay', 'c5.choice.miss': 'c5.miss' }, () => juneBoards(g));
        return;
      }
      if (s.beat === '6.cottage') { dialog(g, 'c6.walk', () => { g.rt.ev.push({ type: 'fade' }); enterBeat(g, '6.beach'); }); }
      return;
    // chapter 7
    case 'credits':
      if (s.era === 1998) { s.flags.read98 = true; dialog(g, 'c7.credits98'); return; }
      s.flags.needOriginal = true; dialog(g, 'c7.creditsNeed'); return;
    case 'iris':
      if (!s.flags.irisMet) { s.flags.irisMet = true; dialog(g, 'c7.irisLoop'); return; }
      reviveIris(g); return;
    default: return;
  }
}

// ---- held actions --------------------------------------------------------------------------------------------
function startPen(g) { g.rt.pen = Toys.newPen(); g.rt.shot = g.rt.baseShot = 'paper'; g.rt.ev.push({ type: 'pen-start' }); }
function holdTick(g, id, dt) {
  const s = g.s, rt = g.rt;
  if (id === 'gap') { restoreTick(g, dt); return; }
  if (id === 'crank') { crankTick(g, dt); return; }
  const v = rt.hold[id] = Math.min(1, (rt.hold[id] || 0) + dt / HOLD[id]);
  if (!rt.holdStarted || rt.holdStarted !== id) { rt.holdStarted = id; rt.ev.push({ type: 'hold-start', id }); }
  if (v < 1) { return; }
  rt.hold[id] = 0; rt.holdStarted = null;
  if (id === 'post') { s.flags.carved = true; rt.ev.push({ type: 'carved' }); rt.ev.push({ type: 'save' }); Co.react(rt.june, 'grin', 'idle', 2); dialog(g, 'c1.carved', () => { g.rt.ev.push({ type: 'fade' }); enterBeat(g, '1.chase'); }); return; }
  if (id === 'pulley') { s.flags.lens = true; rt.ev.push({ type: 'lens' }); rt.ev.push({ type: 'save' }); dialog(g, 'c3.lensUp'); }
  if (id === 'chain') { rt.ride.stop = null; rt.ride.chainDone = true; rt.ev.push({ type: 'sfx', name: 'chain' }); dialog(g, 'c3.chainFixed'); }
  if (id === 'credits') { restoreCredits(g); }
  if (id === 'rope') { rt.iris.boarded = true; rt.iris.walking = false; rt.ev.push({ type: 'iris-board' }); rt.ev.push({ type: 'sfx', name: 'rope' }); dialog(g, 'c7.iris'); }
  if (id === 'seasons') { createSeasons(g); }
  if (id === 'newPier') {
    s.edition.pier_walk = true; refreshWorld(g); rt.ev.push({ type: 'created', id: 'pier_walk', status: Ar.STATUS.CREATED }); rt.ev.push({ type: 'save' });
    dialog(g, 'c7.newPier', () => { Co.lead(g.rt.theo, [[0.4, 13.6], [0.2, 16.0], [0.1, 20.0], [0.2, 24.0]], { ahead: 2.5, waitR: 6, speed: 1.3 }); g.rt.theoPier = true; });
  }
  if (id === 'lampRestore') {
    const c = Ar.restoreCandidate(g.ar, 'lamp', 1998);
    if (!c.ok) { rt.ev.push({ type: 'restore-failed', id: 'lamp' }); return; }
    s.restored.lamp = Object.assign({}, c.provenance, { era: 1998 }); refreshWorld(g);
    rt.ev.push({ type: 'restored', id: 'lamp', provenance: s.restored.lamp }); rt.ev.push({ type: 'save' }); dialog(g, 'c7.lamp');
  }
}
function crankTick(g, dt) {
  const s = g.s, rt = g.rt;
  s.crank = Math.min(1, s.crank + dt / HOLD.crank);
  if (!rt.cranking) { rt.cranking = true; rt.ev.push({ type: 'crank-start' }); say(g, 'june', 'c3.june.now', 2.4); }
  if (s.crank >= 1 && !s.flags.lit) {
    s.flags.lit = true; const lamp = Ar.sceneGraph(g.ar, 1998, s.restored, null).objects.find((o) => o.id === 'lamp');
    rt.ev.push({ type: 'lit', lamp: lamp && lamp.data }); rt.ev.push({ type: 'save' }); Co.react(rt.june, 'grin', 'wave', 3);
    rt.baseShot = null; dialog(g, 'c3.lit', () => { enterBeat(g, '3.beam'); });
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
  if (rt.iris && rt.iris.leaving && !rt.iris.gone) { rt.ev.push({ type: 'tab-locked', reason: 'iris' }); say(g, 'mara', 'c7.mara.notNow', 2.6); return; }
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
  const s = g.s;
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

// ---- Chapter 5 -----------------------------------------------------------------------------------------------------
function juneBoards(g) { const rt = g.rt; Co.transition(rt.june, [[-19, 0.8], [-8, 1.2], [-2.6, 1.6], [-2.0, 2.1]], 2.6); rt.boarding = { t: 0, walking: true }; }
function platformPhoto(g) {
  const s = g.s, rt = g.rt; const y98 = s.beat === '5.depart';
  const p = { id: y98 ? 'platform-1998' : 'platform-2004', reaction: y98 ? 'last' : 'empty', by: 'elena' };
  addPhoto(g, p); if (y98) { s.flags.snap98 = true; Co.react(rt.june, 'grin', 'pose', 2.4); say(g, 'june', 'c5.june.pose', 3.2); } else { s.flags.snap04 = true; say(g, 'elena', 'c5.snap04', 3.4); }
  rt.shot = y98 ? 'june' : 'platform'; rt.shotUntil = rt.t + 1.6;
  rt.ev.push({ type: 'platform-photo', photo: p }); rt.ev.push({ type: 'save' });
}
function addPhoto(g, p) {
  const ph = g.s.photos; ph.push(p);
  while (ph.length > MAX_PHOTOS) { const i = ph.findIndex((q) => q.kind === 'free'); ph.splice(i >= 0 ? i : 0, 1); }
}

// ---- Chapter 2: the camera on the train -------------------------------------------------------------------------
const trainCam = (rt) => { const lay = LAYOUTS.train; return { x: lay.seat.x, y: lay.seat.y, z: lay.seat.z, yaw: rt.aimYaw, pitch: rt.aimPitch, fov: 40, aspect: 1.5 }; };
function shootTrain(g) {
  const s = g.s, rt = g.rt, lay = LAYOUTS.train, cam = trainCam(rt);
  const free = s.photos.filter((q) => q.kind === 'free').length;
  const p = Toys.takePhoto(cam, { x: lay.june.x, y: 1.15, z: lay.june.z }, rt.photoT, free); p.kind = 'free'; p.id = 'photo-' + (s.photos.length + 1) + '-' + Math.round(rt.photoT * 10);
  if (rt.sleep && !rt.sleep.done) {
    p.kind = 'sleep'; p.reaction = 'asleep'; s.flags.sleepShot = true; addPhoto(g, p);
    rt.ev.push({ type: 'photo', photo: p }); rt.ev.push({ type: 'save' }); say(g, 'elena', 'c2.elena.shh', 2.6); later(g, 2.4, () => finishSleep(g)); rt.sleep.done = true;
    return;
  }
  let ok = false;
  if (rt.dare === 0 || rt.dare === 1) { const id = Toys.DARES[rt.dare]; if (Toys.dareShot(cam, id, rt.photoT).ok) { Object.assign(p, { kind: 'dare', dare: id, reaction: id }); ok = true; } }
  else if (rt.dare === 2 && p.reaction === 'candid') { Object.assign(p, { kind: 'dare', dare: 'june' }); ok = true; }
  addPhoto(g, p); rt.ev.push({ type: 'photo', photo: p }); rt.ev.push({ type: 'save' });
  const rx = Toys.REACTIONS[p.reaction] || Toys.REACTIONS.smile; Co.react(rt.june, rx.expr, rx.anim, 2.2);
  if (ok) { dareDone(g); return; }
  say(g, 'june', (rt.dare === 0 || rt.dare === 1) && p.reaction !== 'candid' ? 'c2.dare.not.' + Toys.DARES[rt.dare] : 'c2.react.' + p.reaction, 3);
}
function dareDone(g, gaveUp) {
  const s = g.s, rt = g.rt; const n = rt.dare; s.flags['dare' + n] = true; rt.dare = n + 1; rt.dareT = 0;
  if (n === 2) { if (gaveUp) { dialog(g, 'c2.dareGive', () => juneSnap(g)); } else { juneSnap(g); } return; }
  if (gaveUp) { dialog(g, 'c2.dareGive', () => (n === 0 ? dialog(g, 'c2.nextKite') : startSketch(g))); return; }
  if (n === 0) { dialog(g, 'c2.dare1ok'); return; }
  dialog(g, 'c2.dare2ok', () => startSketch(g));
}
function startSketch(g) { dialog(g, 'c2.sketch', () => { g.rt.sketch = { still: 0, resets: 0 }; g.rt.aim = false; Co.react(g.rt.june, 'tease', 'sketch', 999); }); }
function juneSnap(g) {
  const s = g.s, rt = g.rt;
  s.flags.juneSnap = true; rt.aim = false; addPhoto(g, { id: 'june-elena', by: 'june', reaction: 'secret', back: 'c2.back.june', kind: 'june' });
  rt.ev.push({ type: 'june-photo' }); Co.react(rt.june, 'grin', 'camera', 2.5);
  dialog(g, 'c2.snap', () => branch(g, 'c2.banter', 'train', { 'c2.choice.playful': 'c2.playful', 'c2.choice.sincere': 'c2.sincere' }, () => dialog(g, 'c2.tunnel', () => { g.rt.tunnel = { t: 0 }; g.rt.ev.push({ type: 'tunnel', on: true }); })));
}
function finishSleep(g) {
  const rt = g.rt; if (!rt.sleep || rt.sleep.finished) { return; } rt.sleep.done = true; rt.sleep.finished = true; Co.play(rt.june, 'window'); Co.react(rt.june, 'tease', 'idle', 2);
  dialog(g, g.s.flags.sleepShot ? 'c2.wakeShot' : 'c2.wake', () => dialog(g, 'c2.backs', () => { g.rt.ev.push({ type: 'fade' }); enterBeat(g, '3.ride'); }));
}
DIALOGS['c2.nextKite'] = [L('june', 'c2.dare.kite', 'june')];
DIALOGS['c2.nextJune'] = [L('june', 'c2.dare.june', 'june')];

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
    if (c.id === 'finish') {
      s.window = { placed: true, finish: pick.replace('finish.', '') }; rt.carry = null; rt.ev.push({ type: 'placed', id: 'window', finish: s.window.finish }); rt.ev.push({ type: 'save' }); Co.react(rt.june, 'smile', 'idle', 1.5);
      dialog(g, 'c3.listen', () => { juneOnGallery(g); });
    }
  }
  // things that happen a little later
  for (let i = rt.timers.length - 1; i >= 0; i--) { if (rt.t >= rt.timers[i].at) { const f = rt.timers[i].fn; rt.timers.splice(i, 1); f(); if (g.rt !== rt) { return g.rt.ev; } } }
  if (rt.shotUntil && rt.t > rt.shotUntil && !rt.dialog) { rt.shot = rt.baseShot; rt.shotUntil = null; }
  const active = !busy && !rt.dialog && !rt.choice;
  const anyInput = Math.abs(input.mx) + Math.abs(input.mz) > 0.1 || input.use || input.useHeld || input.jump || input.shoot || input.tab;
  rt.idleT = anyInput ? 0 : rt.idleT + dt;
  if (input.hint) { rt.hintLevel = Math.min(3, rt.hintLevel + 1); rt.idleT = 0; nudge(g); }
  else if (active && rt.idleT > 22 * (rt.hintLevel + 1) && rt.hintLevel < 2) { rt.hintLevel += 1; rt.ev.push({ type: 'hint', level: rt.hintLevel }); nudge(g); }
  const fn = TICK[rt.scene]; if (fn) { fn(g, dt, input, active); }
  if (g.rt !== rt) { return g.rt.ev; }
  // companions
  if (rt.june) { Co.tick(rt.june, dt, { x: rt.body.x, z: rt.body.z }).forEach((e) => { if (e.type === 'june-say' && active && !rt.caption) { say(g, 'june', e.key, 3); } }); }
  if (rt.theo) {
    Co.tick(rt.theo, dt, { x: rt.body.x, z: rt.body.z }).forEach((e) => {
      if (e.type === 'arrived' && rt.theoCrossing) { rt.theoCrossing = false; Co.wait(rt.theo); dialog(g, 'c1.theo2', () => { s.flags.tab = true; enterBeat(g, '1.pier'); }, seen(g, 'c1.theo1') ? DIALOGS['c1.theo2'] : DIALOGS['c1.theo1'].slice(0, 4).concat(DIALOGS['c1.theo2'])); }
    });
  }
  if (g.rt !== rt) { return g.rt.ev; }
  // prompt
  const near = active && !rt.dialog && !rt.choice && !rt.seatedLock ? nearest(g) : null;
  rt.prompt = near ? { id: near.id, verb: near.verb, hold: !!near.hold, x: near.x, z: near.z, optional: !!near.optional } : null;
  if (near && near.hold) { rt.prompt.progress = near.id === 'gap' ? s.bridge : near.id === 'crank' ? s.crank : (rt.hold[near.id] || 0); }
  if (near && input.use && !near.hold) { use(g, near); if (g.rt !== rt) { return g.rt.ev; } }
  if (near && near.hold && input.useHeld) { holdTick(g, near.id, dt); if (g.rt !== rt) { return g.rt.ev; } }
  if (!input.useHeld && rt.holdStarted) { rt.holdStarted = null; }
  if (input.tab && active) { tryTab(g); }
  if (rt.caption && rt.t - rt.caption.t > rt.caption.secs) { rt.caption = null; }
  return rt.ev;
}
function nudge(g) {
  const rt = g.rt; const who = rt.june && rt.scene !== 'train' ? 'june' : (rt.theo ? 'theo' : (rt.scene === 'train' ? 'june' : rt.player));
  say(g, who, 'hint.' + g.s.beat + '.' + Math.max(1, Math.min(3, rt.hintLevel)), 4.5);
}

const TICK = {
  study(g, dt, input, active) { if (active) { moveBody(g, dt, input, false); } },
  porch(g, dt, input, active) { porchTick(g, dt, input, active); },
  town(g, dt, input, active) {
    const rt = g.rt, s = g.s;
    if (active && !rt.seated) { moveBody(g, dt, input, false); }
    // Iris walks to the dock once revived, waits for her rope, and leaves by boat
    const ir = rt.iris;
    if (ir && ir.leaving && !ir.gone) {
      const goal = ir.route[0];
      if (goal) { const dx = goal.x - ir.x, dz = goal.z - ir.z, d = Math.hypot(dx, dz); if (d < 0.08) { ir.route.shift(); } else { const st = Math.min(d, 1.4 * dt); ir.x += (dx / d) * st; ir.z += (dz / d) * st; ir.facing = Math.atan2(dx, dz); ir.walking = true; } }
      else if (!ir.atDock) { ir.atDock = true; ir.walking = false; ir.facing = 0; dialog(g, 'c7.irisRope'); }
      else if (ir.boarded) {
        ir.boatX -= dt * 1.8;
        if (ir.boatX < -30) {
          ir.gone = true; rt.ev.push({ type: 'iris-gone' });
          if (rt.theo) { Co.transition(rt.theo, [[1.6, -6.5], [4.6, -3.8], [5.8, 1.0], [2.4, 6.2], [0.3, 8.0], [0.0, 11.8], [4.0, 12.9], [11.5, 13.2], [14.2, 15.6]], 2.2); say(g, 'theo', 'c7.theo.lamp', 4); }
        }
      }
    }
    // the first winter, newly made
    if (rt.seasonRun) {
      rt.seasonRun.t += dt; const t = rt.seasonRun.t;
      const season = t < 4 ? 'summer' : t < 9 ? 'autumn' : 'winter';
      if (season !== rt.season) { rt.season = season; s.season = season; rt.ev.push({ type: 'season', season }); if (season === 'winter') { s.edition.snow = true; s.edition.winter_theme = true; rt.ev.push({ type: 'save' }); } }
      if (t > 12 && !rt.snowTalk) { rt.snowTalk = true; rt.theo.x = 14.2; rt.theo.z = 15.6; Co.wait(rt.theo); dialog(g, 'c7.snow', () => { g.rt.beam = { a: 2.4, target: 'pier', holdT: 0, ready: true }; g.rt.seated = true; g.rt.shot = g.rt.baseShot = 'town-beam'; }); }
      if (rt.beam && !rt.dialog) {
        const bm = rt.beam; if (active) { bm.a -= (input.mx || 0) * 1.1 * dt; }
        const ta = Toys.beamTo(LIGHTHOUSE, PIER_END); bm.targetA = ta;
        const gap = Math.min(Toys.angleGap(bm.a, ta), Toys.angleGap(bm.a + Math.PI, ta)); bm.onTarget = gap < 0.1; bm.holdT = bm.onTarget ? bm.holdT + dt : 0;
        if (bm.holdT > 0.8 && !bm.done) { bm.done = true; rt.ev.push({ type: 'found', what: 'pier' }); dialog(g, 'c7.beamPier', () => { s.flags.beamPier = true; g.rt.beam = null; g.rt.seated = false; g.rt.shot = g.rt.baseShot = null; g.rt.ev.push({ type: 'save' }); }); }
      }
    }
    if (rt.theoPier && rt.theo && rt.theo.state === 'WAIT' && rt.theo.z > 23 && rt.body.z > 22.6 && !rt.dialog && !rt.finalSaid) { rt.finalSaid = true; dialog(g, 'c7.final', () => { g.rt.ev.push({ type: 'credits-roll' }); enterBeat(g, 'end'); }); }
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
        if (!rt.saidJump && rt.body.x > 5.6 && rt.body.x < 9 && rt.body.grounded) { rt.saidJump = true; say(g, 'june', 'c1.june.jumped', 2.4); }
        if (!rt.saidAlmost && gap < 3.2 && rt.body.x > 8) { rt.saidAlmost = true; say(g, 'june', 'c1.june.almost', 2.4); }
        if (tr.x > lay.train.endX) { tr.tries += 1; rt.ev.push({ type: 'retry', tries: tr.tries }); const tries = tr.tries; enterBeat(g, '1.chase'); g.rt.train.tries = tries; say(g, 'june', 'c1.june.again', 3); }
      }
      if (rt.june) { rt.june.x = tr.x; rt.june.z = lay.train.doorZ; rt.june.anim = Math.abs(tr.x - rt.body.x) < 4 ? 'reach' : 'wave'; rt.june.facing = -Math.PI / 2 + 0.6; }
    } else if (s.beat === '5.depart') {
      if (active) { moveBody(g, dt, input, false); }
      const j = rt.june;
      if (j && j.state === 'LEAD') { if (j.routeI > rt.walkSaid && rt.walkSaid < 2) { rt.walkSaid += 1; say(g, 'june', 'c5.walkTalk.' + rt.walkSaid, 4.2); } }
      if (j && j.state === 'WAIT' && s.flags.suitcase && !s.flags.walked && !rt.boarding && j.x < -26) { s.flags.walked = true; Co.wait(j, null, 'quiet'); rt.ev.push({ type: 'save' }); }
      if (rt.boarding) {
        if (rt.boarding.walking) { if (j && j.state === 'WAIT') { rt.boarding.walking = false; rt.boarding.t = 0; } else { return; } }
        rt.boarding.t += dt;
        // running alongside the train as it leaves: same legs as chapter 1, and this time it gets away
        if (tr.departing && !tr.gone && Math.abs(rt.body.x - (tr.x - 1.2)) < 3.5 && Math.hypot(input.mx, input.mz) > 0.3) {
          if (!rt.runSaid) { rt.runSaid = 1; say(g, 'june', 'c5.june.dontRun', 2.6); } else if (rt.runSaid === 1 && rt.body.x > 20) { rt.runSaid = 2; say(g, 'june', 'c5.june.goHome', 3); }
        }
        if (rt.boarding.t > 1.2 && !tr.departing) { tr.departing = true; rt.june.state = 'WAIT'; rt.june.x = tr.x - 1.2; rt.june.z = lay.train.doorZ; rt.june.anim = 'wave'; rt.ev.push({ type: 'train-go' }); }
        if (tr.departing && !tr.gone) { tr.v = Math.min(5, tr.v + dt * 0.7); tr.x += tr.v * dt; if (rt.june) { rt.june.x = tr.x - 1.2; rt.june.z = lay.train.doorZ; } }
        if (tr.departing && tr.x > 34) { rt.june = null; tr.gone = true; }
        if (tr.gone && !rt.yearCut) { rt.yearCut = { t: 0 }; }
        if (rt.yearCut) { rt.yearCut.t += dt; if (rt.yearCut.t > 2.5) { rt.ev.push({ type: 'years-later' }); enterBeat(g, '5.alone'); } }
      }
    } else if (s.beat === '5.alone') {
      if (active && !rt.seated) { moveBody(g, dt, input, false); }
      // an express that does not stop here any more
      if (tr && !tr.moving && !tr.gone && rt.beatT > 9) { tr.moving = true; tr.v = 16; rt.ev.push({ type: 'sfx', name: 'express' }); }
      if (tr && tr.moving && !tr.gone) { tr.x += tr.v * dt; if (tr.x > 90) { tr.gone = true; } }
    }
  },
  train(g, dt, input, active) {
    const rt = g.rt, s = g.s;
    rt.photoT += dt; if (rt.sleep) { rt.sleep.t += dt; }
    if (rt.tunnel) {
      if (!rt.dialog) { rt.tunnel.t += dt; }
      if (rt.tunnel.t > 9 && !rt.dialog) { rt.tunnel = null; rt.ev.push({ type: 'tunnel', on: false }); dialog(g, 'c2.tunnelOut', () => dialog(g, 'c2.sleep', () => { g.rt.sleep = { t: 0 }; Co.play(g.rt.june, 'sleep'); g.rt.ev.push({ type: 'save' }); })); }
      return;
    }
    if (!active) { return; }
    if (rt.sketch) {
      // June draws Elena: hold still. Moving is never a failure, just a complaint.
      const moved = input.aim || input.shoot || Math.abs(input.aimDX || 0) + Math.abs(input.aimDY || 0) > 3 || Math.abs(input.mx) + Math.abs(input.mz) > 0.3;
      rt.aim = false;
      if (moved) { if (rt.sketch.still > 0.6) { rt.sketch.resets += 1; say(g, 'june', 'c2.sketch.moved.' + Math.min(3, rt.sketch.resets), 2.4); } rt.sketch.still = 0; } else { rt.sketch.still += dt; }
      if (rt.sketch.still > 6 || (rt.sketch.resets >= 3 && rt.sketch.still > 2)) {
        rt.sketch = null; s.flags.sketched = true; addPhoto(g, { id: 'sketch', by: 'june', kind: 'sketch', reaction: 'sketch' }); rt.ev.push({ type: 'sketch-done' }); rt.ev.push({ type: 'save' });
        Co.play(rt.june, 'window'); dialog(g, 'c2.sketchDone');
      }
      return;
    }
    rt.aim = !!input.aim;
    rt.aimYaw -= (input.aimDX || 0) * 0.004; rt.aimPitch = Math.max(-0.5, Math.min(0.6, rt.aimPitch + (input.aimDY || 0) * 0.003));
    if (input.shoot && rt.aim) { shootTrain(g); if (rt.dialog || g.rt !== rt) { return; } }
    const free = s.photos.filter((p) => p.kind === 'free' || p.kind === 'dare').length;
    if (rt.dare === null && s.flags.c2intro && (free >= 1 || rt.photoT > 12)) { s.flags.dares1 = true; rt.dare = 0; rt.dareT = 0; rt.aim = false; dialog(g, 'c2.dare1'); return; }
    if (rt.dare !== null && rt.dare < 3) { rt.dareT += dt; if (rt.dareT > 55) { dareDone(g, true); return; } }
    if (free === 0 && rt.photoT > 9 && !rt.nudged) { rt.nudged = true; say(g, 'june', 'c2.june.go', 3); }
    if (rt.sleep && !rt.sleep.done && rt.sleep.t > 16) { finishSleep(g); }
  },
  ride(g, dt, input, active) {
    const rt = g.rt, r = rt.ride, RL = LAYOUTS.coast.ride;
    if (!active || r.stop) { return; }
    const ev = Toys.tickRide(r, dt, { throttle: input.mz, steer: input.mx, sprint: input.sprint });
    ev.forEach((e) => { if (e.type === 'overtake') { say(g, 'june', 'c3.june.overtake', 2.6); rt.ev.push({ type: 'sfx', name: 'bell' }); } if (e.type === 'june-say') { say(g, 'june', e.key, 2.6); } if (e.type === 'arrive') { rt.ev.push({ type: 'fade' }); enterBeat(g, '3.yard'); } });
    if (g.rt !== rt) { return; }
    // ribbon gates: June's dare, never required
    RL.gates.forEach((gt, i) => {
      if (r.gates[i] || r.s < gt.s) { return; }
      const hit = Math.abs(r.d - gt.d) < 1.1; r.gates[i] = hit ? 'in' : 'out';
      if (hit) { rt.ev.push({ type: 'gate', i }); say(g, 'june', 'c3.gate.' + r.gates.filter((x) => x === 'in').length, 2.8); } else if (!r.missSaid) { r.missSaid = true; say(g, 'june', 'c3.gate.miss', 2.6); }
    });
    if (!r.chainDone && r.s >= RL.chain) { r.stop = 'chain'; r.v = 0; r.june.v = 0; r.june.s = r.s + 2.6; r.june.d = 1.2; rt.ev.push({ type: 'sfx', name: 'chain' }); dialog(g, 'c3.chain'); return; }
    if (!r.noHandsDone && r.s >= RL.noHands) { r.noHandsDone = true; r.june.noHands = 3.2; say(g, 'june', 'c3.june.noHands', 3); }
    if (r.june.noHands) { r.june.noHands = Math.max(0, r.june.noHands - dt); }
    if (input.use) { rt.ev.push({ type: 'sfx', name: 'bell' }); r.bells += 1; if (r.bells <= 3 && Math.abs(r.june.s - r.s) < 12) { say(g, 'june', 'c3.june.bell.' + r.bells, 2.6); later(g, 0.5, () => g.rt.ev.push({ type: 'sfx', name: 'bell' })); } }
  },
  coast(g, dt, input, active) {
    const rt = g.rt, s = g.s, Y = LAYOUTS.coast;
    if (s.beat === '3.beam') { beamTick(g, dt, input, active); return; }
    if (s.beat === '6.beach') { beachTick(g, dt, input, active); return; }
    if (active) { moveBody(g, dt, input, s.beat === '3.cliff'); }
    if (rt.cranking && !input.useHeld) { rt.cranking = false; }
    // June climbs the scaffold to take the lens
    const j = rt.june;
    if (s.beat === '3.yard' && j && s.window.placed && j.state === 'COOPERATE' && j.routeI >= j.route.length && j.y < Y.gallery.y) {
      if (!rt.climbSaid) { rt.climbSaid = true; say(g, 'june', 'c3.june.climb', 3); }
      j.y = Math.min(Y.gallery.y, j.y + dt * 1.8); j.anim = 'climb';
    }
    if (s.beat === '3.cliff' && rt.body.y < -4.5 && !s.flags.landed) { s.flags.landed = true; if (rt.landedByGlide) { say(g, 'elena', 'c3.elena.flew', 3); } }
  },
  cottage(g, dt, input, active) {
    const rt = g.rt, s = g.s;
    if (s.beat === '4.cottage') {
      if (rt.pen) {
        if (!active) { return; }
        Toys.tickPen(rt.pen, dt, input).forEach((e) => {
          rt.ev.push(Object.assign({}, e));
          if (e.type === 'dot' && e.i === 3) { say(g, 'june', 'c4.pen.hull', 2.6); }
          if (e.type === 'dot' && e.i === 5) { say(g, 'june', 'c4.pen.mast', 2.6); }
          if (e.type === 'drawn') { s.flags.boat = true; addPhoto(g, { id: 'boat', by: 'elena', kind: 'drawing', reaction: 'boat' }); rt.ev.push({ type: 'save' }); later(g, 0.8, () => { g.rt.pen = null; g.rt.shot = g.rt.baseShot = null; dialog(g, 'c4.boatDone'); }); }
        });
        return;
      }
      if (rt.tuning) {
        if (!active) { return; }
        const ev = Toys.tickTuning(rt.tuning, dt, input.use || input.jump || input.shoot);
        ev.forEach((e) => {
          rt.ev.push(Object.assign({}, e));
          if (e.type === 'tuned') { say(g, 'june', e.exact ? 'c4.tune.ok.' + (e.string + 1) : 'c4.tune.close', 2.6); }
          if (e.type === 'detuned') { say(g, 'june', e.sharp ? 'c4.tune.sharp' : 'c4.tune.flat', 2.2); }
          if (e.type === 'tuning-done') { s.flags.tuned = true; dialog(g, 'c4.tuned', () => enterBeat(g, '4.duet')); }
        });
        return;
      }
      if (active) { moveBody(g, dt, input, false); }
      return;
    }
    if (s.beat === '4.duet') {
      if (rt.duet && active) {
        const ev = Toys.tickDuet(rt.duet, dt, input.use || input.shoot || input.jump);
        ev.forEach((e) => rt.ev.push(Object.assign({}, e)));
        if (rt.duet.done) {
          const second = rt.duet.second; rt.duet = null; rt.duetN = 1; s.flags.duet1 = true; rt.shot = null;
          Co.react(rt.june, 'smile', 'sit', 1); rt.june.anim = 'sit';
          if (!second) { branch(g, 'c4.again', 'closer', { 'c4.choice.scoot': 'c4.scoot', 'c4.choice.keep': 'c4.keep' }, () => { g.rt.june.x = LAYOUTS.cottage.juneSeat.x - 0.55; g.rt.ev.push({ type: 'closer' }); }); }
          else { dialog(g, 'c4.after', () => { g.rt.ev.push({ type: 'fade' }); enterBeat(g, '4.porch'); }); }
        }
      }
      return;
    }
    if (active) { moveBody(g, dt, input, false); }
    if (rt.juneCarry && rt.june && rt.june.state === 'TRANSITION') { rt.june.anim = 'hold'; }
    if (rt.juneCarry && rt.june && rt.june.state === 'WAIT') { rt.juneCarry = false; rt.june.anim = 'turnaway'; }
  }
};
function beachTick(g, dt, input, active) {
  const rt = g.rt, s = g.s, j = rt.june;
  if (active) { moveBody(g, dt, input, false); }
  if (j) { const gy = Ph.groundAt(rt.world, j.x, j.z, 99); j.y = gy ? gy.y : j.y; }
  if (!j || j.state !== 'WAIT' || rt.dialog || rt.leg === undefined || rt.leg > 2) { return; }
  if (Math.hypot(rt.body.x - j.x, rt.body.z - j.z) > 4.5) { return; }                  // she talks when you are beside her
  const next = () => { rt.leg += 1; if (rt.leg <= 2) { Co.lead(g.rt.june, BEACH_LEGS[rt.leg], { ahead: 3, waitR: 6.5, speed: 1.4 }); } };
  if (rt.leg === 0 && !s.flags.beachTalk1) {
    branch(g, 'c6.talk', 'defend', { 'c6.choice.defend': 'c6.defend', 'c6.choice.admit': 'c6.admit' }, () => { s.flags.beachTalk1 = true; g.rt.ev.push({ type: 'save' }); next(); });
  } else if (rt.leg === 1 && !s.flags.beachTalk2) {
    branch(g, 'c6.loss', 'offer', { 'c6.choice.fix': 'c6.fix', 'c6.choice.forgive': 'c6.forgive' }, () => { s.flags.beachTalk2 = true; g.rt.ev.push({ type: 'save' }); next(); });
  } else if (rt.leg === 2 && !s.flags.beachTalk3) {
    dialog(g, 'c6.socket', () => dialog(g, 'c6.end', () => { s.flags.beachTalk3 = true; s.flags.c6talk = true; g.rt.ev.push({ type: 'save' }); Co.react(g.rt.june, 'quiet', 'turnaway', 999); rt.leg = 3; }));
  } else { next(); }
}
function porchTick(g, dt, input, active) {
  const rt = g.rt, st = rt.stars;
  if (!active || !st) { return; }
  rt.aimYaw -= (input.aimDX || 0) * 0.004; rt.aimPitch = Math.max(-1.1, Math.min(0.3, rt.aimPitch + (input.aimDY || 0) * 0.003));
  if (st.i >= Toys.STARS.length) { return; }
  const d = Toys.starGap({ yaw: rt.aimYaw, pitch: rt.aimPitch }, Toys.STARS[st.i]);
  st.onStar = d < 0.07; st.holdT = st.onStar ? st.holdT + dt : 0;
  if (st.holdT > 0.45) {
    st.linked.push(st.i); st.i += 1; st.holdT = 0; rt.ev.push({ type: 'star', i: st.i - 1 }); say(g, 'june', 'c4.star.' + st.i, 3.4);
    if (st.i >= Toys.STARS.length) { g.s.flags.stars = true; rt.ev.push({ type: 'save' }); later(g, 1.6, () => dialog(g, 'c4.porchEnd', () => { g.rt.ev.push({ type: 'fade' }); enterBeat(g, '5.depart'); })); }
  }
}
function beamTick(g, dt, input, active) {
  const rt = g.rt, s = g.s, Y = LAYOUTS.coast, bm = rt.beam;
  if (!bm.ready) { if (rt.june.state === 'WAIT') { bm.ready = true; Co.wait(rt.june, null, 'grin'); rt.june.anim = 'wave'; if (bm.target === 'june') { dialog(g, 'c3.findMe'); } } return; }
  if (!active) { return; }
  bm.a -= (input.mx || 0) * 1.1 * dt;
  const target = bm.target === 'june' ? Y.rocks : Y.door;
  const ta = Toys.beamTo(Y.lamp, target); bm.targetA = ta;
  const gap = Math.min(Toys.angleGap(bm.a, ta), Toys.angleGap(bm.a + Math.PI, ta));
  bm.onTarget = gap < 0.1; bm.holdT = bm.onTarget ? bm.holdT + dt : 0;
  if (bm.holdT > 0.8) {
    bm.holdT = 0;
    if (bm.target === 'june') { s.flags.foundJune = true; rt.ev.push({ type: 'found', what: 'june' }); Co.react(rt.june, 'grin', 'wave', 3); dialog(g, 'c3.found', () => { g.rt.beam.target = 'cottage'; }); }
    else { s.flags.beamDone = true; rt.ev.push({ type: 'found', what: 'cottage' }); dialog(g, 'c3.beamDone', () => enterBeat(g, '3.cliff')); }
  }
}
function moveBody(g, dt, input, glide) {
  const rt = g.rt;
  const yaw = rt.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const dx = fx * input.mz + rx * input.mx, dz = fz * input.mz + rz * input.mx;
  const ev = Ph.stepBody(rt.body, { dx, dz, sprint: input.sprint, jump: input.jump, jumpHeld: input.jumpHeld, glide, speedScale: rt.carry ? 0.8 : 1 }, dt, rt.world, extraSolids(g));
  ev.forEach((e) => { rt.ev.push({ type: 'body', what: e }); if (e === 'fall') { rt.ev.push({ type: 'retry', reason: 'fall' }); } });
  if (rt.body.gliding) { rt.landedByGlide = true; }
}

// ---- save and snapshot ---------------------------------------------------------------------------------------------
export function serialize(g) {
  const s = JSON.parse(JSON.stringify(g.s));
  const lay = LAYOUTS[g.rt.scene];
  if (lay && g.rt.body && g.rt.scene !== 'ride' && g.rt.scene !== 'train' && !g.rt.seated) { s.pos = {}; s.pos[g.rt.scene] = { x: Math.round(g.rt.body.x * 100) / 100, z: Math.round(g.rt.body.z * 100) / 100, y: Math.round(g.rt.body.y * 100) / 100, yaw: Math.round(g.rt.yaw * 1000) / 1000 }; }
  else { s.pos = {}; }
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
  s.seen = Array.isArray(raw.seen) ? raw.seen.filter((x) => typeof x === 'string' && DIALOGS[x]).slice(0, 120) : [];
  s.photos = Array.isArray(raw.photos) ? raw.photos.filter((p) => p && typeof p.id === 'string').slice(0, MAX_PHOTOS).map((p) => ({ id: p.id.slice(0, 40), reaction: String(p.reaction || '').slice(0, 20), mood: p.mood || null, by: p.by || null, back: p.back || null, kind: typeof p.kind === 'string' ? p.kind : 'free', dare: typeof p.dare === 'string' ? p.dare : undefined, thumb: typeof p.thumb === 'string' && p.thumb.startsWith('data:image/') && p.thumb.length < 60000 ? p.thumb : null })) : [];
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
  if (at('3.beam') && (!s.window.placed || !s.flags.lit)) { s.beat = '3.yard'; }
  if (!at('3.yard')) { s.window = { placed: false, finish: null }; s.flags.lit = false; s.flags.lens = false; s.crank = 0; }
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
    june: rt.june ? { x: rt.june.x, y: rt.june.y || 0, z: rt.june.z, state: rt.june.state, anim: rt.june.anim, expr: rt.june.expr } : null,
    theo: rt.theo ? { x: rt.theo.x, z: rt.theo.z, state: rt.theo.state } : null, iris: rt.iris ? { x: rt.iris.x, z: rt.iris.z, state: rt.iris.state, leaving: rt.iris.leaving, atDock: !!rt.iris.atDock, boarded: !!rt.iris.boarded, gone: rt.iris.gone, loops: !!(rt.iris.script && rt.iris.script.loops) } : null,
    train: rt.train ? { x: rt.train.x, v: rt.train.v, moving: rt.train.moving, caught: !!rt.train.caught, tries: rt.train.tries || 0, gone: !!rt.train.gone } : null,
    ride: rt.ride ? { s: rt.ride.s, d: rt.ride.d, v: rt.ride.v, length: rt.ride.road.length, stop: rt.ride.stop || null, gates: (rt.ride.gates || []).slice(), june: { s: rt.ride.june.s, d: rt.ride.june.d, mode: rt.ride.june.mode, noHands: !!rt.ride.june.noHands }, overtook: rt.ride.overtook } : null,
    duet: rt.duet ? { t: rt.duet.t, layers: rt.duet.layers, hits: rt.duet.hits, misses: rt.duet.misses, cueIn: rt.duet.cueIn, second: rt.duet.second } : null,
    tuning: rt.tuning ? { string: rt.tuning.string, needle: Toys.needleAt(rt.tuning), misses: rt.tuning.misses, done: rt.tuning.done } : null,
    beam: rt.beam ? { a: rt.beam.a, target: rt.beam.target, targetA: rt.beam.targetA, onTarget: !!rt.beam.onTarget, ready: rt.beam.ready } : null,
    pen: rt.pen ? { x: rt.pen.x, y: rt.pen.y, i: rt.pen.i, trail: rt.pen.trail.slice(), done: rt.pen.done } : null, tunnel: rt.tunnel ? { t: rt.tunnel.t } : null,
    stars: rt.stars ? { i: rt.stars.i, linked: rt.stars.linked.slice(), onStar: !!rt.stars.onStar, aimYaw: rt.aimYaw, aimPitch: rt.aimPitch } : null, sketch: rt.sketch ? { still: rt.sketch.still, resets: rt.sketch.resets } : null, leg: rt.leg === undefined ? null : rt.leg,
        dare: rt.dare === undefined ? null : rt.dare, sleep: rt.sleep ? { t: rt.sleep.t, done: !!rt.sleep.done } : null,
    aim: rt.aim, carry: rt.carry, seated: !!rt.seated, bridge: s.bridge, crank: s.crank, hold: Object.assign({}, rt.hold), restored: Object.keys(s.restored), edition: Object.assign({}, s.edition), window: Object.assign({}, s.window), photos: s.photos.map((p) => ({ id: p.id, reaction: p.reaction, kind: p.kind })),
    choices: Object.assign({}, s.choices), flags: Object.assign({}, s.flags), season: rt.season, assets: rt.graph ? [...rt.graph.assets] : [], credits: rt.graph ? rt.graph.credits : null, tab: !!s.flags.tab, hintLevel: rt.hintLevel, idleT: rt.idleT
  };
}
export { points as availablePoints };
