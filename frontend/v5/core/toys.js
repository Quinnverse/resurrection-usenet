// The chapter toys: the bicycle ride, the guitar duet and the camera. Pure state machines; no DOM, no Three.js.
import { roadInfo } from './layout.js';

// ---- bicycle ---------------------------------------------------------------------------------------------------
// The player rides a fixed coastal road: s is distance along it, d is the offset to the right of the centre line.
// June rides too. She keeps a few metres ahead, waits when the player is slow, and overtakes once on purpose.
// No racing, no losing: the ride always reaches the lighthouse.
export const BIKE = { accel: 3.2, boostAccel: 5.0, max: 8.0, boostMax: 11.0, coast: 0.9, brake: 6.0, steer: 0.42 };
export function newRide() {
  const road = roadInfo();
  return { road, s: 2, d: 0, v: 0, lean: 0, t: 0, june: { s: 0, d: 1.2, v: 0, mode: 'behind', bell: 0 }, overtook: false, arrived: false, slowT: 0 };
}
export function tickRide(r, dt, input) {
  const ev = []; r.t += dt;
  const boost = !!input.sprint, w = r.road && r.road.length ? 5.0 : 5.0;
  if (input.throttle > 0) { r.v += (boost ? BIKE.boostAccel : BIKE.accel) * input.throttle * dt; } else if (input.throttle < 0) { r.v -= BIKE.brake * dt; } else { r.v -= BIKE.coast * dt; }
  r.v = Math.max(0, Math.min(boost ? BIKE.boostMax : BIKE.max, r.v));
  const steer = Math.max(-1, Math.min(1, input.steer || 0));
  r.d += steer * BIKE.steer * Math.max(1.5, r.v) * dt; r.lean += (steer * Math.min(1, r.v / 6) * 0.35 - r.lean) * Math.min(1, dt * 6);
  const half = w / 2 - 0.45; if (Math.abs(r.d) > half) { r.d = Math.sign(r.d) * half; r.v *= 1 - dt * 0.8; }
  r.s += r.v * dt;
  // June: behind at the start, overtakes around 60 m with a bell, then leads and waits for slow riders
  const j = r.june;
  let want;
  if (!r.overtook && r.s < 55) { want = r.s - 3; j.mode = 'behind'; }
  else if (!r.overtook) { want = r.s + 6; j.mode = 'overtake'; if (j.s > r.s + 0.5) { r.overtook = true; ev.push({ type: 'overtake' }); } }
  else { want = r.s + (r.v < 1.5 ? 2 : 4.5); j.mode = r.v < 1.5 ? 'wait' : 'lead'; }
  want = Math.min(want, r.road.length - 1);
  const gap = want - j.s; j.v += Math.max(-4, Math.min(4, gap * 1.2 - (j.v - Math.max(0, r.v)) * 0.6)) * dt; j.v = Math.max(0, Math.min(12, j.v));
  if (j.mode === 'wait' && j.s > r.s + 2) { j.v = Math.max(0, j.v - 6 * dt); }
  j.s = Math.min(r.road.length - 1, j.s + j.v * dt);
  j.d += ((j.mode === 'overtake' ? -1.3 : 1.2) - j.d) * Math.min(1, dt * 1.5);
  if (r.v < 1 && r.s < r.road.length - 4) { r.slowT += dt; if (r.slowT > 6) { r.slowT = 0; ev.push({ type: 'june-say', key: 'june.ride.wait' }); } } else { r.slowT = 0; }
  if (!r.arrived && r.s >= r.road.length - 1.5) { r.arrived = true; r.s = r.road.length - 1.5; ev.push({ type: 'arrive' }); }
  return ev;
}
export function ridePose(r, s, d) { const p = r.road.at(s); return { x: p.x + p.nx * d, z: p.z + p.nz * d, heading: p.heading }; }

// ---- guitar duet --------------------------------------------------------------------------------------------------
// Elena's melody comes from tune.ll in the archive. One cue per phrase; a cue is open for ±0.45 s around its note.
// Every hit adds a layer (June hums, then harmony). A missed cue still plays the note, softly. Nothing blocks.
export function newDuet(tune, opts) {
  const spb = 60 / (tune.tempo || 88); const notes = []; let t = 1.6;
  const phrases = (opts && opts.phrases) || tune.phrases.map((_, i) => i);
  phrases.forEach((pi, k) => {
    const ph = tune.phrases[pi]; if (!ph) { return; }
    const longest = ph.reduce((b, n, i) => (n.beats > ph[b].beats ? i : b), 0);
    ph.forEach((n, i) => { notes.push({ t, midi: n.midi, dur: n.beats * spb, phrase: k, cue: i === longest }); t += n.beats * spb; });
    t += spb;                                                                                   // a breath between phrases
  });
  return { notes, i: 0, t: 0, end: t + 0.6, layers: 0, hits: 0, misses: 0, done: false, window: 0.45, pressed: [] };
}
export function tickDuet(m, dt, pressed) {
  const ev = []; m.t += dt;
  if (pressed) { m.pressed.push(m.t); }
  while (m.i < m.notes.length && m.notes[m.i].t <= m.t) {
    const n = m.notes[m.i];
    if (n.cue) {
      // judge the cue with presses made close to it (pressing slightly early or late both count)
      n.judgeAt = n.t + m.window;
    }
    ev.push({ type: 'note', midi: n.midi, dur: n.dur, layer: m.layers, phrase: n.phrase, cue: !!n.cue });
    m.i += 1;
  }
  for (const n of m.notes) {
    if (!n.cue || n.judged || n.judgeAt === undefined || m.t < n.judgeAt) { continue; }
    n.judged = true;
    const hit = m.pressed.some((p) => Math.abs(p - n.t) <= m.window);
    if (hit) { m.hits += 1; m.layers = Math.min(3, m.layers + 1); ev.push({ type: 'cue-hit', phrase: n.phrase, layer: m.layers }); } else { m.misses += 1; ev.push({ type: 'cue-miss', phrase: n.phrase }); }
  }
  m.pressed = m.pressed.filter((p) => p > m.t - 2);
  const next = m.notes.find((n) => n.cue && !n.judged && n.t - m.t < 1.4 && n.t - m.t > -m.window);
  m.cueIn = next ? next.t - m.t : null;
  if (!m.done && m.t >= m.end) { m.done = true; ev.push({ type: 'duet-done', hits: m.hits, misses: m.misses }); }
  return ev;
}

// ---- the camera -------------------------------------------------------------------------------------------------
// June's mood on the train cycles by itself: she looks out of the window, notices, teases with her own camera.
// A photo is judged only for what June does about it. There is no score and no "right angle".
export function juneMoodAt(t) { const c = t % 11; return c < 4.5 ? 'window' : c < 6 ? 'notice' : c < 9 ? 'tease' : 'notice'; }
// cam: { x, y, z, yaw, pitch, fov (vertical, degrees), aspect }; target: June's face { x, y, z }
export function frame(cam, target) {
  const dx = target.x - cam.x, dy = target.y - cam.y, dz = target.z - cam.z;
  const fx = -Math.sin(cam.yaw) * Math.cos(cam.pitch), fy = -Math.sin(cam.pitch), fz = -Math.cos(cam.yaw) * Math.cos(cam.pitch);
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;                                    // up = right x forward
  const depth = dx * fx + dy * fy + dz * fz; if (depth <= 0.05) { return { inFrame: false, depth, nx: 0, ny: 0, size: 0 }; }
  const th = Math.tan((cam.fov * Math.PI) / 360);
  const nx = (dx * rx + dz * rz) / depth / (th * cam.aspect), ny = (dx * ux + dy * uy + dz * uz) / depth / th;
  const size = 0.18 / (depth * th);                                                             // her face height on screen, 0..1
  return { inFrame: Math.abs(nx) < 0.95 && Math.abs(ny) < 0.95, depth, nx, ny, size, centred: Math.abs(nx) < 0.35 && Math.abs(ny) < 0.4 };
}
// Returns the photo record (no image here; the browser adds a thumbnail).
export function takePhoto(cam, target, t, count) {
  const f = frame(cam, target), mood = juneMoodAt(t);
  let reaction;
  if (!f.inFrame) { reaction = 'missed'; } else if (mood === 'window') { reaction = 'candid'; } else if (mood === 'tease') { reaction = 'duel'; } else if (f.size > 0.5) { reaction = 'hide'; } else { reaction = ['shy', 'pose', 'smile'][Math.min(2, count)]; }
  return { id: 'photo-' + (count + 1), t: Math.round(t * 10) / 10, reaction, mood, framed: f.inFrame, centred: !!f.centred, size: Math.round(f.size * 100) / 100 };
}
export const REACTIONS = { missed: { expr: 'tease', anim: 'look' }, candid: { expr: 'surprise', anim: 'look' }, duel: { expr: 'grin', anim: 'camera' }, hide: { expr: 'shy', anim: 'hideface' }, shy: { expr: 'shy', anim: 'hideface' }, pose: { expr: 'grin', anim: 'pose' }, smile: { expr: 'smile', anim: 'idle' },
  lighthouse: { expr: 'grin', anim: 'pose' }, kite: { expr: 'grin', anim: 'pose' }, asleep: { expr: 'quiet', anim: 'sleep' }, last: { expr: 'grin', anim: 'pose' }, empty: { expr: 'neutral', anim: 'idle' } };

// ---- photo dares on the train ------------------------------------------------------------------------------------
// Things outside the window, in carriage coordinates (the seat faces -z; +x is the sea side). They loop so a dare can
// always be taken again. The renderer places its lighthouse and kite with the same function.
export const DARES = ['lighthouse', 'kite', 'june'];
// the stretch of the outside (carriage z) that the side windows show from the seat
export const WINDOW_Z = [-18, 10];
export function trainTarget(id, t) {
  // RC3: slower and on a shorter loop, so it is in the windows for 20 s of every 43 s (it was 16 s of every 55 s)
  if (id === 'lighthouse') { return { x: 34, y: 5.5, z: -30 + ((t * 1.4) % 60) }; }
  if (id === 'kite') { return { x: -12, y: 4.2 + Math.sin(t * 1.3) * 0.6, z: -46 + ((t * 4.0) % 70) }; }
  return null;
}
// Is target `id` in this photo? June is judged by takePhoto; outside things by framing and distance.
export function dareShot(cam, id, t) {
  const p = trainTarget(id, t); if (!p) { return { ok: false }; }
  // inside the drawn viewfinder (the middle 80% of the view), with the camera's real aspect
  const f = frame(cam, p); return { ok: f.inFrame && Math.abs(f.nx) < 0.8 && Math.abs(f.ny) < 0.8, f };
}

// ---- tuning the guitar (chapter 4) ----------------------------------------------------------------------------
// A needle swings across the dial; press when it is in the middle. Misses never block: after three, June calls it
// close enough. Each string swings a little faster.
export function newTuning() { return { string: 0, t: 0, misses: 0, done: false, tuned: [] }; }
export const needleAt = (tu) => Math.sin(tu.t * (1.6 + tu.string * 0.45) + Math.PI / 2);   // starts at the edge
export function tickTuning(tu, dt, pressed) {
  const ev = []; tu.t += dt;
  if (pressed && !tu.done && tu.t > 0.35) {
    const n = needleAt(tu);
    if (Math.abs(n) < 0.2 || tu.misses >= 3) { ev.push({ type: 'tuned', string: tu.string, exact: Math.abs(n) < 0.2 }); tu.tuned.push(tu.string); tu.string += 1; tu.misses = 0; tu.t = 0; if (tu.string >= 3) { tu.done = true; ev.push({ type: 'tuning-done' }); } }
    else { tu.misses += 1; ev.push({ type: 'detuned', string: tu.string, sharp: n > 0, misses: tu.misses }); }
  }
  return ev;
}

// ---- the lighthouse beam (chapter 3) -------------------------------------------------------------------------
// Angle in radians around the tower, measured like Three.js rotation.y on the +x axis.
export const beamTo = (from, to) => Math.atan2(-(to.z - from.z), to.x - from.x);
export const angleGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

// ---- June's constellation (chapter 4) ------------------------------------------------------------------------
// Five stars over the sea, as camera directions from the porch (yaw 0 looks south, negative pitch looks up). Joined in
// order they make a crooked window. A star counts when the middle of the view rests on it.
export const STARS = [{ yaw: 0.38, pitch: -0.24 }, { yaw: 0.02, pitch: -0.3 }, { yaw: -0.04, pitch: -0.64 }, { yaw: 0.33, pitch: -0.6 }, { yaw: 0.17, pitch: -0.43 }];
export const dirOf = (a) => ({ x: -Math.sin(a.yaw) * Math.cos(a.pitch), y: -Math.sin(a.pitch), z: -Math.cos(a.yaw) * Math.cos(a.pitch) });
export function starGap(view, star) { const a = dirOf(view), b = dirOf(star); return Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z))); }

// ---- June teaches Elena to draw a boat (chapter 4) ----------------------------------------------------------
// The pen moves with the mouse (or the movement keys) over a sheet of paper, 0..1 in both directions. Reach each dot
// in turn; the line is drawn as you go. There is no wrong boat.
export const BOAT = [[0.2, 0.6], [0.3, 0.76], [0.7, 0.76], [0.8, 0.6], [0.5, 0.6], [0.5, 0.24], [0.73, 0.55]];
export function newPen() { return { x: 0.12, y: 0.4, i: 0, done: false, trail: [] }; }
export function tickPen(pen, dt, input) {
  const ev = [];
  pen.x = Math.max(0, Math.min(1, pen.x + (input.aimDX || 0) * 0.0011 + (input.mx || 0) * 0.45 * dt));
  pen.y = Math.max(0, Math.min(1, pen.y + (input.aimDY || 0) * 0.0011 - (input.mz || 0) * 0.45 * dt));
  if (pen.done) { return ev; }
  const [tx, ty] = BOAT[pen.i];
  if (Math.hypot(pen.x - tx, pen.y - ty) < 0.045) { pen.trail.push([tx, ty]); pen.i += 1; ev.push({ type: 'dot', i: pen.i - 1 }); if (pen.i >= BOAT.length) { pen.done = true; ev.push({ type: 'drawn' }); } }
  return ev;
}
