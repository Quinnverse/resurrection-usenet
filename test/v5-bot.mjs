// A scripted player for the V5 simulation. It plays the real game core (frontend/v5/core/game.js) from the first
// frame to the credits using only input: movement axes, jump, use, Tab, aim and shoot, dialogue advance and choices.
// It plans walks with the game's own path finder on the floor the game reports. This is automated play, not a
// human playtest, and not a browser.
//
// Every step is awaited, so the same plan runs synchronously in Node (o.step returns at once) or frame by frame in a
// browser page (o.step resolves after the page has drawn the frame).
import * as Gm from '../frontend/v5/core/game.js';
import * as Ph from '../frontend/v5/core/physics.js';
import * as Toys from '../frontend/v5/core/toys.js';
import { LAYOUTS } from '../frontend/v5/core/layout.js';

export const DT = 1 / 30;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function makeBot(g, opts) {
  const o = Object.assign({ choices: { train: 1, parting: 0, finish: 1, closer: 0, defend: 0, offer: 0, letter: 0 }, glide: true, log: false, optional: true, sleepShot: true }, opts || {});
  const bot = { g, t: 0, events: [], beats: [], o, stuck: [], beatTimes: {}, dialogT: 0 };
  let lastBeat = g.s.beat, beatT0 = 0;
  bot.tick = async (input) => {
    const s0 = Gm.snapshot(g); const inDialog = !!(s0.dialog || s0.choice);
    const ev = o.step ? await o.step(input || {}) : Gm.tick(g, DT, input || {});
    bot.t += DT; if (inDialog) { bot.dialogT += DT; }
    (ev || []).forEach((e) => { bot.events.push(Object.assign({ at: Math.round(bot.t * 10) / 10 }, e)); if (e.type === 'beat') { bot.beats.push(e.beat); if (o.log) { console.log(bot.t.toFixed(1), 'beat', e.beat); } } });
    if (g.s.beat !== lastBeat) { bot.beatTimes[lastBeat] = (bot.beatTimes[lastBeat] || 0) + bot.t - beatT0; lastBeat = g.s.beat; beatT0 = bot.t; }
    return ev;
  };
  bot.finish = () => { bot.beatTimes[lastBeat] = (bot.beatTimes[lastBeat] || 0) + bot.t - beatT0; };
  bot.snap = () => Gm.snapshot(g);
  bot.wait = async (secs, input) => { for (let i = 0; i < secs / DT; i++) { await bot.tick(typeof input === 'function' ? input(bot.snap()) : input); } };
  const pick = (id) => { const v = o.choices[id]; return v === undefined ? 0 : v; };
  // read dialogue to the end, choosing as planned; also handles a pending choice
  bot.talk = async (maxSecs) => {
    for (let i = 0; i < (maxSecs || 180) / DT; i++) {
      const s = bot.snap();
      if (s.choice) { await bot.tick({ choose: pick(s.choice.id) }); continue; }
      if (!s.dialog) { return; }
      const ln = s.dialog.line;
      if (!Array.isArray(ln)) { await bot.tick({ choose: pick(ln.choice) }); continue; }
      await bot.tick({ advance: i % 12 === 0 });
    }
    throw new Error('dialogue never ended: ' + JSON.stringify(bot.snap().dialog));
  };
  bot.axes = (dx, dz) => { const s = bot.snap(); const yaw = s.yaw; const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw); const d = Math.hypot(dx, dz) || 1; return { mz: (dx * fx + dz * fz) / d, mx: (dx * rx + dz * rz) / d }; };
  // walk to (x, z) on the current floor; stop early when `until(snapshot)` holds
  bot.walkTo = async (x, z, until, sprint) => {
    const s0 = bot.snap(); const w = g.rt.world;
    const path = Ph.findPath(w, g.rt.scene + g.s.era + g.s.beat + Math.round(g.s.bridge * 20) + (g.rt.carry || ''), { x: s0.x, z: s0.z, y: s0.y }, { x, z }, { reach: 1.0 }) || [[s0.x, s0.z], [x, z]];
    for (const [px, pz] of path.slice(1)) {
      let best = Infinity, lastGood = bot.t;
      for (let i = 0; i < 40 / DT; i++) {
        const s = bot.snap(); if (until && until(s)) { return true; }
        if (s.dialog || s.choice) { await bot.talk(); continue; }
        const d = Math.hypot(px - s.x, pz - s.z); if (d < 0.3) { break; }
        if (d < best - 0.05) { best = d; lastGood = bot.t; }
        if (bot.t - lastGood > 4) { bot.stuck.push({ beat: s.beat, at: [s.x, s.z], to: [px, pz] }); break; }
        const a = bot.axes(px - s.x, pz - s.z); await bot.tick(Object.assign(a, { sprint: !!sprint }));
      }
    }
    const s = bot.snap(); return until ? until(s) : Math.hypot(x - s.x, z - s.z) < 1.2;
  };
  bot.promptIs = (id) => (s) => s.prompt && s.prompt.id === id;
  bot.use = async (id) => { const s = bot.snap(); if (!s.prompt || s.prompt.id !== id) { throw new Error(`no prompt ${id} at beat ${s.beat} (${s.x.toFixed(2)},${s.z.toFixed(2)}): ${JSON.stringify(s.prompt)}`); } await bot.tick({ use: true }); };
  bot.hold = async (id, secs) => { for (let i = 0; i < 15 && Math.hypot(g.rt.body.vx, g.rt.body.vz) > 0.05 && bot.snap().prompt && bot.snap().prompt.id === id; i++) { await bot.tick({}); }   // stop walking first
    for (let i = 0; i < secs / DT; i++) { const s = bot.snap(); if (!s.prompt || s.prompt.id !== id) { return; } await bot.tick({ useHeld: true, use: i === 0 }); } };
  bot.go = async (id, x, z) => { if (!(await bot.walkTo(x, z, bot.promptIs(id)))) { const s = bot.snap(); throw new Error(`could not reach ${id} at beat ${s.beat} from (${s.x.toFixed(2)},${s.z.toFixed(2)}) prompt=${JSON.stringify(s.prompt)}`); } };
  bot.goUse = async (id, x, z) => { await bot.go(id, x, z); await bot.use(id); await bot.talk(); };
  // like until, but also stops when `alt` holds
  bot.untilOr = async (fn, secs, input, alt) => bot.until((s) => fn(s) || (alt && alt(s)), secs, input);
  bot.until = async (fn, secs, input) => { for (let i = 0; i < (secs || 60) / DT; i++) { const s = bot.snap(); if (fn(s)) { return s; } if (s.dialog || s.choice) { await bot.talk(); continue; } await bot.tick(typeof input === 'function' ? input(s) : input); } throw new Error('timed out at beat ' + bot.snap().beat + ' ' + JSON.stringify({ prompt: bot.snap().prompt, x: bot.snap().x, z: bot.snap().z })); };
  // point the train camera at a world position (carriage coordinates) and take the picture
  // turn the camera until it is on target (a stick turns at a limited speed), then shoot
  bot.shootAt = async (posFn) => {
    const seat = LAYOUTS.train.seat;
    for (let k = 0; k < 60; k++) {
      const p = posFn((g.rt.outsideT || 0) + DT); const dx = p.x - seat.x, dy = p.y - seat.y, dz = p.z - seat.z;
      const yaw = Math.atan2(-dx, -dz), pitch = Math.max(-0.5, Math.min(0.6, Math.atan2(-dy, Math.hypot(dx, dz))));
      const ey = wrap(yaw - g.rt.aimYaw), ep = pitch - g.rt.aimPitch;
      if (k >= 2 && Math.abs(ey) < 0.012 && Math.abs(ep) < 0.012) { break; }
      await bot.tick({ aim: true, aimDX: -ey / 0.004, aimDY: ep / 0.003 });
    }
    await bot.tick({ aim: true, shoot: true });
  };
  return bot;
}

// The whole game. Returns the bot (events, beats, timings).
export async function playThrough(g, opts) {
  const bot = makeBot(g, opts); const mark = {}; const m = (k) => { mark[k] = bot.t; };
  const P = (scene, id) => LAYOUTS[scene].points.find((p) => p.id === id);
  const opt = bot.o.optional;
  // ---- chapter 1
  const comp = P('study', 'computer');
  await bot.goUse('computer', comp.x, comp.z + 1.0);                         // no disk yet
  await bot.goUse('keepbox', -1.1, 2.2);                                     // Elena's backup disk
  if (opt) { await bot.goUse('photo', 3.2, 0.7); }
  await bot.goUse('computer', comp.x, comp.z + 1.0);
  await bot.until((s) => s.scene === 'town'); m('town');
  if (opt) { await bot.walkTo(-3.4, -3.2); await bot.until((s) => s.prompt && s.prompt.id === 'irisTalk', 4, () => bot.axes(-1, -0.4)); await bot.use('irisTalk'); }
  await bot.walkTo(0, 7.4); await bot.until((s) => s.prompt && s.prompt.id === 'theo', 10, () => bot.axes(0, 1)); await bot.use('theo'); await bot.talk();
  await bot.until((s) => s.prompt && s.prompt.id === 'gap', 10, () => bot.axes(0, 1)); await bot.hold('gap', 6); m('bridge');
  await bot.until((s) => s.beat === '1.pier', 60);
  // the pier: 1998 near deck, 2004 stub over the gap, 1998 far end
  await bot.walkTo(0, 13.5);
  await bot.tick({ tab: true }); await bot.wait(0.3);
  await bot.walkTo(0, 17.6);
  await bot.tick({ tab: true }); await bot.wait(0.3);
  await bot.walkTo(0, 22.6);
  await bot.tick({ tab: true }); await bot.wait(0.3);
  await bot.go('pierEnd', 0, 24.2); await bot.use('pierEnd'); await bot.talk(); m('memory');
  // 1998: carving the post with June
  await bot.until((s) => s.beat === '1.carve'); await bot.talk();
  await bot.until((s) => s.prompt && s.prompt.id === 'post', 10, (s) => bot.axes(0 - s.x, 24.0 - s.z)); await bot.hold('post', 3.5); await bot.talk();
  // the train
  await bot.until((s) => s.beat === '1.chase');
  await bot.until((s) => (s.prompt && s.prompt.id === 'hand') || s.beat !== '1.chase', 60, (s) => {
    const cartAhead = s.x > 1.4 && s.x < 4.0 && s.grounded;
    const ax = bot.axes((s.train ? s.train.x : s.x + 5) - s.x, 1.5 - s.z);
    return Object.assign(ax, { sprint: true, jump: cartAhead, jumpHeld: true });
  });
  await bot.use('hand'); await bot.talk(); m('train');
  // ---- chapter 2: photographs and June's dares
  await bot.until((s) => s.beat === '2.train'); await bot.talk();
  const lay = LAYOUTS.train; const juneFace = () => ({ x: lay.june.x, y: 1.15, z: lay.june.z });
  await bot.wait(1.5, { aim: true }); await bot.shootAt(juneFace); await bot.wait(0.4, { aim: true });   // a free shot first
  await bot.until((s) => s.dare === 0 && !s.dialog, 30);
  for (const id of ['lighthouse', 'kite']) {
    const n = Toys.DARES.indexOf(id);
    for (let k = 0; k < 8 && bot.snap().dare === n; k++) {
      // wait until the target is roughly abeam (inside the window) and take it
      await bot.until((s) => { const p = Toys.trainTarget(id, g.rt.outsideT || 0); return s.dare !== n || (p.z > Toys.WINDOW_Z[0] && p.z < Toys.WINDOW_Z[1]); }, 70, { aim: true });
      if (bot.snap().dare !== n) { break; }
      await bot.shootAt((t) => Toys.trainTarget(id, t)); await bot.wait(0.3, { aim: true });
      await bot.talk();
    }
  }
  // June draws Elena: keep still
  await bot.until((s) => !!s.sketch || s.dare !== 2, 30);
  await bot.until((s) => !s.sketch, 30, {}); await bot.talk();
  // the third dare: June when she is looking out of the window
  for (let k = 0; k < 6 && bot.snap().dare === 2; k++) {
    await bot.until((s) => s.dare !== 2 || Toys.juneMoodAt(g.rt.photoT + 0.3) === 'window', 15, { aim: true });
    if (bot.snap().dare !== 2) { break; }
    await bot.shootAt(juneFace); await bot.wait(0.3, { aim: true }); await bot.talk();
  }
  await bot.talk();
  await bot.until((s) => (s.prompt && s.prompt.id === 'juneHand') || !!s.sleep, 60); if (bot.snap().prompt) { await bot.use('juneHand'); await bot.talk(); }
  await bot.until((s) => !!s.sleep || s.beat !== '2.train', 120);
  if (bot.o.sleepShot && bot.snap().sleep) { await bot.wait(2, { aim: true }); await bot.shootAt(juneFace); }
  await bot.until((s) => s.beat === '3.ride', 90); m('ride');
  // ---- chapter 3: ride, window, lens, lamp, beam, cliff
  const RL = LAYOUTS.coast.ride;
  let rang = false;
  await bot.until((s) => s.beat !== '3.ride', 240, (s) => {
    if (!s.ride) { return {}; }
    if (s.prompt && s.prompt.id === 'chain') { return { useHeld: true, use: true }; }
    const next = RL.gates.find((gt, i) => !s.ride.gates[i] && gt.s > s.ride.s);
    const wantD = next && next.s - s.ride.s < 30 ? next.d : 0;
    const ring = !rang && s.ride.s > 20; if (ring) { rang = true; }
    return { mz: s.ride.v > 7.5 ? 0 : 1, mx: Math.max(-1, Math.min(1, (wantD - s.ride.d) * 1.5)), use: ring };
  });
  m('yard');
  await bot.go('cart', P('coast', 'cart').x, P('coast', 'cart').z + 0.3); await bot.use('cart'); await bot.talk();
  await bot.until((s) => s.carry === 'window', 5);
  await bot.go('socket', 262.6, 25.5); await bot.use('socket'); await bot.until((s) => !!s.choice, 3); await bot.tick({ choose: bot.o.choices.finish }); await bot.talk();
  await bot.walkTo(266.4, 23.0); await bot.until((s) => s.prompt && s.prompt.id === 'pulley', 30); await bot.hold('pulley', 4); await bot.talk();
  await bot.go('crank', 266.4, 25.4); await bot.hold('crank', 5); await bot.talk(); m('lit');
  await bot.until((s) => s.beat === '3.beam', 10);
  await bot.until((s) => s.beat !== '3.beam', 120, (s) => {
    if (!s.beam || !s.beam.ready || s.beam.targetA === undefined) { return {}; }
    const d1 = wrap(s.beam.targetA - s.beam.a), d2 = wrap(s.beam.targetA - (s.beam.a + Math.PI)); const d = Math.abs(d1) < Math.abs(d2) ? d1 : d2;
    return { mx: Math.abs(d) < 0.04 ? 0 : -Math.sign(d) * Math.min(1, Math.abs(d) * 4 + 0.15) };
  });
  m('beam');
  if (bot.o.glide) {
    await bot.walkTo(272.4, 27.0);
    await bot.until((s) => s.y < -4.9 && s.grounded, 12, (s) => Object.assign(bot.axes(1, 0), { jump: s.grounded && s.y > -0.1, jumpHeld: true }));
  } else { await bot.walkTo(272.5, 16); await bot.walkTo(285, 20); }
  await bot.go('door', 300, 31); await bot.use('door'); m('cottage');
  // ---- chapter 4: the cottage, tuning, the duet twice
  await bot.until((s) => s.beat === '4.cottage'); await bot.talk();
  await bot.go('sketches', 1.3, 1.3); await bot.use('sketches'); await bot.talk();
  for (const [tx, ty] of Toys.BOAT) {
    await bot.until((s) => !s.pen || s.pen.done || Math.hypot(s.pen.x - tx, s.pen.y - ty) < 0.03, 10, (s) => (s.pen ? { aimDX: Math.max(-40, Math.min(40, (tx - s.pen.x) / 0.0011 * 0.4)), aimDY: Math.max(-40, Math.min(40, (ty - s.pen.y) / 0.0011 * 0.4)) } : {}));
  }
  await bot.until((s) => !s.pen, 5); await bot.talk();
  if (opt) { await bot.goUse('window', 0.0, -1.9); }
  await bot.go('guitar', -1.4, -0.3); await bot.use('guitar');
  await bot.until((s) => s.beat === '4.duet' || s.dialog, 60, (s) => ({ use: !!(s.tuning && Math.abs(s.tuning.needle) < 0.08) }));
  await bot.talk();
  await bot.until((s) => s.beat === '4.duet'); await bot.talk();
  for (let k = 0; k < 2; k++) {
    await bot.until((s) => s.prompt && s.prompt.id === 'guitar', 10); await bot.use('guitar');
    await bot.until((s) => !s.duet || s.dialog, 60, (s) => ({ use: !!(s.duet && s.duet.cueIn !== null && Math.abs(s.duet.cueIn) < 0.05) }));
    await bot.talk();
  }
  // the porch: June's constellation
  await bot.until((s) => s.beat === '4.porch', 20); await bot.talk();
  for (let k = 0; k < Toys.STARS.length; k++) {
    await bot.until((s) => !s.stars || s.stars.i > k, 20, (s) => {
      if (!s.stars) { return {}; } const st = Toys.STARS[k];
      return { aimDX: -wrap(st.yaw - s.stars.aimYaw) / 0.004 * 0.5, aimDY: (st.pitch - s.stars.aimPitch) / 0.003 * 0.5 };
    });
  }
  await bot.until((s) => s.beat === '5.depart', 30); m('depart');
  // ---- chapter 5: the last afternoon, then six years later
  await bot.talk();
  if (opt) { await bot.goUse('kiosk', -8.0, -0.6); await bot.go('snap', -6.2, 0.6); await bot.use('snap'); await bot.wait(2); }
  await bot.goUse('suitcase', -5.0, -0.6); await bot.go('door', -2.0, 0.6); await bot.use('door'); await bot.talk();
  // walk with June to the end of the platform
  await bot.until((s) => s.flags.walked, 60, (s) => (s.june && Math.hypot(s.june.x - s.x, s.june.z - s.z) > 2.2 ? bot.axes(s.june.x + 1.2 - s.x, s.june.z - 0.6 - s.z) : {}));
  await bot.go('june', g.rt.june.x + 1.2, g.rt.june.z - 0.8); await bot.use('june'); await bot.talk();
  // she walks back to the train; run alongside as it leaves
  await bot.until((s) => s.beat === '5.alone', 90, (s) => (s.train && s.train.x > -1.5 && s.x < 30 ? Object.assign(bot.axes(1, 1.2 - s.z), { sprint: true }) : (s.june ? bot.axes(s.june.x - 1.5 - s.x, 0.4 - s.z) : {})));
  if (opt) { await bot.goUse('kiosk', -8.0, -0.6); await bot.go('snap', -6.2, 0.6); await bot.use('snap'); await bot.wait(2); await bot.go('door', -2.0, 0.6); await bot.use('door'); await bot.wait(4.5); }
  await bot.go('bench', P('station', 'bench').x, P('station', 'bench').z + 0.4); await bot.use('bench'); await bot.talk(); m('cottage2004');
  // ---- chapter 6: 2004, packing, the conversation
  await bot.until((s) => s.beat === '6.cottage'); await bot.talk();
  await bot.goUse('boxA', -2.9, -0.4); await bot.goUse('drop', 1.2, 1.8);
  await bot.goUse('boxB', 2.6, -1.2); await bot.goUse('drop', 1.2, 1.8);
  if (opt) { await bot.goUse('letter', 1.3, 1.1); await bot.goUse('gamebox', 2.05, 1.75); }
  await bot.until((s) => s.june && s.june.state !== 'TRANSITION', 20);
  await bot.go('june', g.rt.june.x - 0.6, g.rt.june.z + 1.1); await bot.use('june'); await bot.talk();
  // the beach in 2004: keep beside her; she stops to talk
  await bot.until((s) => s.beat === '6.beach', 10);
  await bot.until((s) => s.flags.beachTalk3, 240, (s) => (s.june && Math.hypot(s.june.x - s.x, s.june.z - s.z) > 1.8 ? bot.axes(s.june.x - s.x, s.june.z + 0.8 - s.z) : {}));
  await bot.talk();
  await bot.go('road', 254.6, 21.0); await bot.use('road'); await bot.talk(); m('present');
  // ---- chapter 7: the drafts, the names, Iris, the seasons
  await bot.until((s) => s.beat === '7.study'); await bot.go('computer', comp.x, comp.z + 1.0); await bot.use('computer'); await bot.talk();
  await bot.until((s) => s.beat === '7.town'); await bot.wait(2); await bot.talk();
  await bot.goUse('credits', 0, -13.4);                                       // one name: what did 1998 say?
  await bot.tick({ tab: true }); await bot.wait(0.5); await bot.talk();
  await bot.goUse('credits', 0, -13.4);                                       // read the summer build's sign
  await bot.tick({ tab: true }); await bot.wait(0.5); await bot.talk();
  await bot.go('credits', 0, -13.4); await bot.hold('credits', 3.5); await bot.talk();
  await bot.goUse('iris', -4.4, -4.6);                                        // she loops
  await bot.go('iris', -4.4, -4.6); await bot.use('iris'); await bot.wait(0.5);
  await bot.walkTo(-4.6, 5.6);
  await bot.until((s) => s.prompt && s.prompt.id === 'rope', 30, (s) => (Math.hypot(s.x + 5.6, s.z - 6.8) > 0.8 ? bot.axes(-5.6 - s.x, 6.8 - s.z) : {}));
  await bot.hold('rope', 3); await bot.talk();
  await bot.until((s) => s.iris && s.iris.gone, 40);
  await bot.go('lampRestore', 15.2, 17.2); await bot.hold('lampRestore', 4); await bot.talk();
  await bot.go('seasons', 15.2, 17.2); await bot.hold('seasons', 4); await bot.talk();
  // the last light: turn the beam to the old pier
  await bot.untilOr((s) => s.beat === 'end', 90, (s) => {
    if (!s.beam || s.beam.targetA === undefined) { return {}; }
    const d1 = wrap(s.beam.targetA - s.beam.a), d2 = wrap(s.beam.targetA - (s.beam.a + Math.PI)); const d = Math.abs(d1) < Math.abs(d2) ? d1 : d2;
    return { mx: Math.abs(d) < 0.04 ? 0 : -Math.sign(d) * Math.min(1, Math.abs(d) * 4 + 0.15) };
  }, (s) => s.flags.beamPier);
  // new planks in the present edition, then walk Theo out to the end
  await bot.go('newPier', 0.2, 13.0); await bot.hold('newPier', 5); await bot.talk();
  await bot.until((s) => s.beat === 'end', 90, (s) => (s.theo && s.z < 24.0 ? bot.axes(s.theo.x - 0.3 - s.x, Math.min(24.0, s.theo.z - 0.9) - s.z) : {}));
  m('end');
  bot.finish(); bot.marks = mark;
  return bot;
}
