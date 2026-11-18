// A scripted player for the V5 simulation. It plays the real game core (frontend/v5/core/game.js) from the first
// frame to the credits using only input: movement axes, jump, use, Tab, aim and shoot, dialogue advance and choices.
// It plans walks with the game's own path finder on the floor the game reports. This is automated play, not a
// human playtest, and not a browser.
import * as Gm from '../frontend/v5/core/game.js';
import * as Ph from '../frontend/v5/core/physics.js';
import { LAYOUTS } from '../frontend/v5/core/layout.js';

export const DT = 1 / 30;
export function makeBot(g, opts) {
  const o = Object.assign({ choices: { train: 1, parting: 0, finish: 1 }, glide: true, log: false }, opts || {});
  const bot = { g, t: 0, events: [], beats: [], o, stuck: [] };
  // o.step lets a harness run the same plan through the browser shell instead of calling the core directly
  bot.tick = (input) => { const ev = o.step ? o.step(input || {}) : Gm.tick(g, DT, input || {}); bot.t += DT; ev.forEach((e) => { bot.events.push(Object.assign({ at: Math.round(bot.t * 10) / 10 }, e)); if (e.type === 'beat') { bot.beats.push(e.beat); if (o.log) { console.log(bot.t.toFixed(1), 'beat', e.beat); } } }); return ev; };
  bot.snap = () => Gm.snapshot(g);
  bot.wait = (secs, input) => { for (let i = 0; i < secs / DT; i++) { bot.tick(input); } };
  // read dialogue to the end, choosing as planned; also handles a pending choice
  bot.talk = (maxSecs) => {
    for (let i = 0; i < (maxSecs || 120) / DT; i++) {
      const s = bot.snap();
      if (s.choice) { bot.tick({ choose: o.choices[s.choice.id] || 0 }); continue; }
      if (!s.dialog) { return; }
      const ln = s.dialog.line;
      if (!Array.isArray(ln)) { bot.tick({ choose: o.choices[ln.choice] || 0 }); continue; }
      bot.tick({ advance: i % 12 === 0 });
    }
    throw new Error('dialogue never ended: ' + JSON.stringify(bot.snap().dialog));
  };
  bot.axes = (dx, dz) => { const s = bot.snap(); const yaw = s.yaw; const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw); const d = Math.hypot(dx, dz) || 1; return { mz: (dx * fx + dz * fz) / d, mx: (dx * rx + dz * rz) / d }; };
  // walk to (x, z) on the current floor; stop early when `until(snapshot)` holds
  bot.walkTo = (x, z, until, sprint) => {
    const s0 = bot.snap(); const w = g.rt.world;
    const path = Ph.findPath(w, g.rt.scene + g.s.era + g.s.beat + Math.round(g.s.bridge * 20), { x: s0.x, z: s0.z, y: s0.y }, { x, z }, { reach: 1.0 }) || [[s0.x, s0.z], [x, z]];
    for (const [px, pz] of path.slice(1)) {
      let best = Infinity, lastGood = bot.t;
      for (let i = 0; i < 40 / DT; i++) {
        const s = bot.snap(); if (until && until(s)) { return true; }
        if (s.dialog || s.choice) { bot.talk(); continue; }
        const d = Math.hypot(px - s.x, pz - s.z); if (d < 0.3) { break; }
        if (d < best - 0.05) { best = d; lastGood = bot.t; }
        if (bot.t - lastGood > 4) { bot.stuck.push({ beat: s.beat, at: [s.x, s.z], to: [px, pz] }); break; }
        const a = bot.axes(px - s.x, pz - s.z); bot.tick(Object.assign(a, { sprint: !!sprint }));
      }
    }
    const s = bot.snap(); return until ? until(s) : Math.hypot(x - s.x, z - s.z) < 1.2;
  };
  bot.promptIs = (id) => (s) => s.prompt && s.prompt.id === id;
  bot.use = (id) => { const s = bot.snap(); if (!s.prompt || s.prompt.id !== id) { throw new Error(`no prompt ${id} at beat ${s.beat} (${s.x.toFixed(2)},${s.z.toFixed(2)}): ${JSON.stringify(s.prompt)}`); } bot.tick({ use: true }); };
  bot.hold = (id, secs) => { for (let i = 0; i < secs / DT; i++) { const s = bot.snap(); if (!s.prompt || s.prompt.id !== id) { return; } bot.tick({ useHeld: true, use: i === 0 }); } };
  bot.go = (id, x, z) => { if (!bot.walkTo(x, z, bot.promptIs(id))) { const s = bot.snap(); throw new Error(`could not reach ${id} at beat ${s.beat} from (${s.x.toFixed(2)},${s.z.toFixed(2)}) prompt=${JSON.stringify(s.prompt)}`); } };
  bot.until = (fn, secs, input) => { for (let i = 0; i < (secs || 60) / DT; i++) { const s = bot.snap(); if (fn(s)) { return s; } if (s.dialog || s.choice) { bot.talk(); continue; } bot.tick(typeof input === 'function' ? input(s) : input); } throw new Error('timed out at beat ' + bot.snap().beat); };
  return bot;
}

// The whole game. Returns the bot (events, beats, timings).
export function playThrough(g, opts) {
  const bot = makeBot(g, opts); const mark = {}; const m = (k) => { mark[k] = bot.t; };
  const P = (scene, id) => LAYOUTS[scene].points.find((p) => p.id === id);
  // ---- chapter 1
  bot.go('computer', P('study', 'computer').x, P('study', 'computer').z - 0.1 + 1.0); bot.use('computer'); bot.talk();
  bot.until((s) => s.scene === 'town'); m('town');
  bot.walkTo(0, 7.4); bot.until((s) => s.prompt && s.prompt.id === 'theo', 10, () => bot.axes(0, 1)); bot.use('theo'); bot.talk();
  bot.until((s) => s.prompt && s.prompt.id === 'gap', 10, () => bot.axes(0, 1)); bot.hold('gap', 6); m('bridge');
  bot.until((s) => s.beat === '1.pier', 60);
  // the pier: 1998 near deck, 2004 stub over the gap, 1998 far end
  bot.walkTo(0, 13.5);
  bot.tick({ tab: true }); bot.wait(0.3);
  bot.walkTo(0, 17.6);
  bot.tick({ tab: true }); bot.wait(0.3);
  bot.walkTo(0, 22.6);
  bot.tick({ tab: true }); bot.wait(0.3);
  bot.go('pierEnd', 0, 24.2); bot.use('pierEnd'); bot.talk(); m('memory');
  // the train
  bot.until((s) => s.beat === '1.chase');
  bot.until((s) => (s.prompt && s.prompt.id === 'hand') || s.beat !== '1.chase', 60, (s) => {
    const cartAhead = s.x > 1.4 && s.x < 4.0 && s.grounded;
    const ax = bot.axes((s.train ? s.train.x : s.x + 5) - s.x, 1.5 - s.z);
    return Object.assign(ax, { sprint: true, jump: cartAhead, jumpHeld: true });
  });
  bot.use('hand'); bot.talk(); m('train');
  // ---- chapter 2: photographs
  bot.until((s) => s.beat === '2.train'); bot.talk();
  const aimAt = () => { const lay = LAYOUTS.train; const dx = lay.june.x - lay.seat.x, dz = lay.june.z - lay.seat.z; return Math.atan2(-dx, -dz); };
  // turn the camera toward June with the mouse, then take photos
  for (let k = 0; k < 3 && !bot.g.s.flags.juneSnap; k++) {
    for (let i = 0; i < 20; i++) { const d = Math.atan2(Math.sin(aimAt() - g.rt.aimYaw), Math.cos(aimAt() - g.rt.aimYaw)); bot.tick({ aim: true, aimDX: -d / 0.004 / 6 }); }
    bot.wait(1.2 + k * 1.7, { aim: true }); bot.tick({ aim: true, shoot: true }); bot.wait(0.5, { aim: true });
  }
  bot.until((s) => s.beat === '3.ride', 90); m('ride');
  // ---- chapter 3: ride, window, lamp, cliff
  bot.until((s) => s.beat !== '3.ride', 120, (s) => ({ mz: s.ride && s.ride.v > 7 ? 0 : 1, mx: s.ride ? Math.max(-1, Math.min(1, -s.ride.d)) : 0 }));
  m('yard');
  bot.go('cart', P('coast', 'cart').x, P('coast', 'cart').z + 0.3); bot.use('cart'); bot.talk();
  bot.until((s) => s.carry === 'window', 5);
  bot.go('socket', 262.6, 25.5); bot.use('socket'); bot.until((s) => !!s.choice, 3); bot.tick({ choose: bot.o.choices.finish }); bot.talk();
  bot.go('crank', 266.4, 25.4); bot.hold('crank', 5); bot.talk(); m('lit');
  bot.until((s) => s.beat === '3.cliff', 10);
  if (bot.o.glide) {
    bot.walkTo(272.4, 27.0);
    bot.until((s) => s.y < -4.9 && s.grounded, 12, (s) => Object.assign(bot.axes(1, 0), { jump: s.grounded && s.y > -0.1, jumpHeld: true }));
  } else { bot.walkTo(272.5, 16); bot.walkTo(285, 20); }
  bot.go('door', 300, 31); bot.use('door'); m('cottage');
  // ---- chapter 4: the duet, twice
  bot.until((s) => s.beat === '4.duet'); bot.talk();
  for (let k = 0; k < 2; k++) {
    bot.until((s) => s.prompt && s.prompt.id === 'guitar', 10); bot.use('guitar');
    bot.until((s) => !s.duet || s.dialog, 60, (s) => ({ use: !!(s.duet && s.duet.cueIn !== null && Math.abs(s.duet.cueIn) < 0.05) }));
    bot.talk();
  }
  bot.until((s) => s.beat === '5.depart', 10); m('depart');
  // ---- chapter 5
  bot.go('june', g.rt.june.x, g.rt.june.z - 1.2); bot.use('june'); bot.talk();
  bot.until((s) => s.beat === '5.alone', 60, () => bot.axes(1, 0));
  bot.go('bench', P('station', 'bench').x, P('station', 'bench').z + 0.4); bot.use('bench'); bot.talk(); m('cottage2004');
  // ---- chapter 6
  bot.until((s) => s.beat === '6.cottage'); bot.go('june', g.rt.june.x - 0.5, g.rt.june.z + 1.1); bot.use('june'); bot.talk();
  bot.go('door', 0, 2.4); bot.use('door'); m('present');
  // ---- chapter 7
  bot.until((s) => s.beat === '7.study'); bot.go('computer', 3.0, -1.7); bot.use('computer'); bot.talk();
  bot.until((s) => s.beat === '7.town'); bot.wait(2); bot.talk();
  bot.go('credits', 0, -13.4); bot.use('credits'); bot.talk();
  bot.go('iris', -4.4, -4.6); bot.use('iris'); bot.wait(1);
  bot.tick({ tab: true }); bot.wait(0.5); bot.talk(); bot.tick({ tab: true }); bot.wait(0.5); bot.talk();
  bot.go('seasons', 15.2, 17.2); bot.use('seasons'); bot.talk();
  bot.until((s) => s.beat === 'end', 60); m('end');
  bot.marks = mark;
  return bot;
}
