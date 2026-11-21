// RC3: the problems the owner met in the RC2 playtest, reproduced in the real game core and checked as fixed.
//   - the slipped chain on the bike ride: the prompt was drawn at the start of the road (behind the camera), so nothing
//     on screen said what to do, and the player cannot move while the bike is stopped
//   - the photo dares on the train: the lighthouse was in the windows 16 s of every 55 s, the view started away from it,
//     and the frame that counted was smaller than the frame drawn on screen
//   - the duet: seated face to face, the two characters' legs went through each other
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Gm from '../frontend/v5/core/game.js';
import * as Toys from '../frontend/v5/core/toys.js';
import { objective } from '../frontend/v5/core/objectives.js';
import { LAYOUTS } from '../frontend/v5/core/layout.js';
import { dictionaries } from '../frontend/v5/core/i18n.js';
import { playThrough } from './v5-bot.mjs';
import { loadArchive } from '../tools/v5-playthrough.mjs';

const ar = loadArchive();
let SAVES = null;
async function saves() {
  if (SAVES) { return SAVES; }
  const g = Gm.createGame(ar); SAVES = {};
  await playThrough(g, { step: (input) => { const ev = Gm.tick(g, 1 / 30, input); if (!SAVES[g.s.beat]) { SAVES[g.s.beat] = Gm.serialize(g); } return ev; } });
  return SAVES;
}
const from = async (beat) => Gm.createGame(ar, Gm.parseSave((await saves())[beat], ar));
const advanceDialog = (g) => { for (let i = 0; i < 900 && (g.rt.dialog || g.rt.choice); i++) { Gm.tick(g, 1 / 30, { advance: true }); } };
async function atChainStop() {
  const g = await from('3.ride');
  for (let i = 0; i < 30 * 120 && !(g.rt.ride && g.rt.ride.stop === 'chain'); i++) { const s = Gm.snapshot(g); Gm.tick(g, 1 / 30, { mz: 1, advance: !!s.dialog }); }
  assert.equal(g.rt.ride.stop, 'chain', 'the ride reaches the slipped chain');
  advanceDialog(g); Gm.tick(g, 1 / 30, {});
  return g;
}

test('chain: the prompt and the marker are at the bikes, not at the start of the road', async () => {
  const g = await atChainStop(); const r = g.rt.ride;
  const bike = Toys.ridePose(r, r.s, r.d), june = Toys.ridePose(r, r.june.s, r.june.d);
  const sn = Gm.snapshot(g);
  assert.ok(sn.prompt && sn.prompt.id === 'chain' && sn.prompt.hold, 'a hold prompt for the chain');
  assert.ok(Math.hypot(sn.prompt.x - june.x, sn.prompt.z - june.z) < 0.5, `the prompt is at June's bike (${sn.prompt.x.toFixed(1)}, ${sn.prompt.z.toFixed(1)})`);
  assert.ok(Math.hypot(g.rt.body.x - bike.x, g.rt.body.z - bike.z) < 0.01, 'the player body is on the bike');
  const o = objective(g); assert.ok(o.target && Math.hypot(o.target.x - june.x, o.target.z - june.z) < 0.5, 'the goal marker points at June\'s bike');
  assert.equal(o.nextKey, 'do.3.ride.chainNow');
});

test('chain: holding E or tapping E fixes it', async () => {
  for (const [name, inp] of [['hold E', () => ({ useHeld: true })], ['tap E', (i) => ({ useHeld: i % 6 < 2, use: i % 6 === 0 })]]) {
    const g = await atChainStop(); let fixed = null;
    for (let i = 0; i < 30 * 12; i++) { Gm.tick(g, 1 / 30, inp(i)); if (g.rt.ride.chainDone) { fixed = i / 30; break; } }
    assert.ok(fixed !== null && fixed < 8, `${name}: fixed after ${fixed} s`);
  }
});

test('chain: a player who does nothing gets the chain hint at 30, 60 and 90 s, and June fixes it herself after 100 s', async () => {
  const g = await atChainStop(); const lines = [];
  for (let i = 0; i < 30 * 130 && !g.rt.ride.chainDone; i++) { const s = Gm.snapshot(g); const ev = Gm.tick(g, 1 / 30, { advance: !!s.dialog, autoHelp: true }); ev.filter((e) => e.type === 'caption').forEach((e) => lines.push([Math.round(i / 30), e.key])); }
  assert.ok(g.rt.ride.chainDone && g.rt.ride.selfFixed, 'June fixed it');
  const hints = lines.filter(([, k]) => k.startsWith('hint.'));
  assert.deepEqual(hints.map(([, k]) => k), ['hint.3.ride.chain', 'hint.3.ride.chain', 'hint.3.ride.chain'], 'every hint is about the chain, not about pedalling');
  assert.deepEqual(hints.map(([t]) => t), [30, 60, 90]);
  for (let i = 0; i < 30 * 90 && g.s.beat === '3.ride'; i++) { const s = Gm.snapshot(g); Gm.tick(g, 1 / 30, { mz: 1, advance: !!s.dialog }); }
  assert.equal(g.s.beat, '3.yard', 'the ride goes on to the lighthouse');
});

test('chain: the texts say no walking is needed, in English and Chinese', () => {
  for (const lang of ['en', 'zh']) {
    const d = dictionaries[lang];
    for (const k of ['do.3.ride.chainNow', 'hint.3.ride.chain', 'c3.june.chainSelf', 'c3.elena.chainSelf']) { assert.ok(d[k] && d[k].length > 3, `${lang} ${k}`); }
    assert.ok(!/by her bike|在她车旁/.test(d['do.3.ride.chainNow']), `${lang}: no "by her bike" (the player cannot walk there)`);
  }
});

test('photo dares: a player who never searches (aim, shoot when the frame turns gold) finishes all three quickly', async () => {
  const g = await from('2.train'); let t = 0; const took = {}; let last = null, start = 0;
  while (t < 300 && !g.s.flags.juneSnap) {
    const s = Gm.snapshot(g); const inp = { aspect: 16 / 9 };
    if (s.dialog || s.choice) { inp.advance = true; } else if (s.sketch) { /* hold still */ } else if (s.dare === null) { inp.aim = true; if (Math.round(t * 30) % 60 === 0) { inp.shoot = true; } } else { inp.aim = true; if (s.aimHelp && s.aimHelp.ready && Math.round(t * 30) % 10 === 0) { inp.shoot = true; } }
    if (!s.dialog && s.dare !== last) { if (last !== null) { took[last] = t - start; } last = s.dare; start = t; }
    Gm.tick(g, 1 / 30, inp); t += 1 / 30;
  }
  assert.ok(g.s.flags.juneSnap, 'all three dares done');
  for (const k of ['dare0', 'dare1', 'dare2']) { assert.ok(g.s.flags[k], k); }
  assert.ok(took[0] < 10 && took[1] < 10, `lighthouse ${took[0] && took[0].toFixed(1)} s, kite ${took[1] && took[1].toFixed(1)} s`);
  assert.ok(!g.s.photos.some((p) => p.kind === 'dare' && p.gaveUp), 'none given up');
});

test('photo dares: what counts is exactly the drawn frame, at the real screen shape', () => {
  const lay = LAYOUTS.train; const p = Toys.trainTarget('lighthouse', 10 / 1.4); const dx = p.x - lay.seat.x, dy = p.y - lay.seat.y, dz = p.z - lay.seat.z;
  const yaw0 = Math.atan2(-dx, -dz), pitch = -Math.atan2(dy, Math.hypot(dx, dz));
  const at = (dyaw, aspect) => Toys.dareShot({ x: lay.seat.x, y: lay.seat.y, z: lay.seat.z, yaw: yaw0 + dyaw, pitch, fov: 40, aspect }, 'lighthouse', 10 / 1.4).f;
  const th = Math.tan(20 * Math.PI / 180);
  for (const aspect of [16 / 9, 4 / 3]) {
    const edge = Math.atan(0.78 * th * aspect), out = Math.atan(0.84 * th * aspect);   // just inside / just outside the frame
    assert.ok(Math.abs(at(edge, aspect).nx) < Gm.FRAME_BOX, `aspect ${aspect.toFixed(2)}: just inside counts`);
    assert.ok(Math.abs(at(out, aspect).nx) > Gm.FRAME_BOX, `aspect ${aspect.toFixed(2)}: just outside does not`);
  }
});

test('photo dares: at the start of each dare the subject is in the windows and the view turns toward it', async () => {
  const g = await from('2.train');
  for (let i = 0; i < 30 * 60 && g.rt.dare !== 0; i++) { const s = Gm.snapshot(g); Gm.tick(g, 1 / 30, { advance: !!s.dialog, aim: !s.dialog, shoot: !s.dialog && i % 60 === 0 }); }
  advanceDialog(g); for (let i = 0; i < 50; i++) { Gm.tick(g, 1 / 30, { aim: true }); }
  const a = Gm.snapshot(g).aimHelp; assert.ok(a && a.id === 'lighthouse' && a.inFrame && a.seen, JSON.stringify(a));
  const p = Toys.trainTarget('lighthouse', g.rt.outsideT); assert.ok(p.z > Toys.WINDOW_Z[0] && p.z < Toys.WINDOW_Z[1]);
});

test('duet: seated side by side, the two pairs of legs never cross (apart and after "closer")', () => {
  const foot = (p) => ({ x: p.x + Math.sin(p.yaw) * 0.95, z: p.z + Math.cos(p.yaw) * 0.95 });
  for (const closer of [false, true]) {
    const d = Gm.duetPlaces(closer); const fe = foot(d.elena), fj = foot(d.june);
    assert.ok(Math.hypot(d.june.x - d.elena.x, d.june.z - d.elena.z) >= 0.8, 'hips apart');
    assert.ok(Math.hypot(fe.x - fj.x, fe.z - fj.z) >= 0.45, `feet apart (${closer ? 'closer' : 'apart'})`);
    const room = LAYOUTS.cottage.bounds; [d.elena, d.june, fe, fj].forEach((q) => assert.ok(q.x > room.x0 && q.x < room.x1 && q.z > room.z0 && q.z < room.z1, 'inside the room'));
  }
});

test('mouse and Shift: the new tips and settings exist in both languages with real control tokens', () => {
  for (const lang of ['en', 'zh']) {
    const d = dictionaries[lang];
    for (const k of ['tut.look.kbm', 'tut.look.free', 'tut.sprint', 'ui.mouse', 'ui.mouse.capture', 'ui.mouse.free', 'ui.aim.now', 'ui.aim.waitJune', 'ui.aim.waitWindow', 'ui.aim.left', 'ui.aim.right']) { assert.ok(d[k], `${lang} ${k}`); }
    assert.match(d['tut.sprint'], /\{k:sprint\}/);
  }
});
