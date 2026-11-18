// June, the companion. Not a follower: an authored state machine that invites, leads, waits, plays, cooperates,
// reacts and hands over to the next scene. Pure: positions, facing, speed, animation and expression only.
//
//   INVITE      stands somewhere, calls the player over, looks at them
//   LEAD        walks a route ahead; slows and stops when the player falls behind, looks back
//   WAIT        holds a spot, turns toward the player, idles; after a while says something (a nudge, never a fail)
//   PLAY        free behaviour in the moment (posing for the camera, teasing)
//   COOPERATE   does her half of a shared action at a spot
//   REACT       a short expression + gesture, then returns to the previous state
//   TRANSITION  scripted move at a scene boundary; ignores the player

export const STATES = ['INVITE', 'LEAD', 'WAIT', 'PLAY', 'COOPERATE', 'REACT', 'TRANSITION'];
export const EXPRESSIONS = ['neutral', 'smile', 'grin', 'shy', 'tease', 'surprise', 'hurt', 'quiet', 'angry'];
export const ANIMS = ['idle', 'walk', 'run', 'wave', 'reach', 'camera', 'hideface', 'pose', 'sit', 'hum', 'hold', 'turnaway', 'look'];

export function newCompanion(x, z, facing) {
  return { x, z, y: 0, facing: facing || 0, speed: 0, state: 'WAIT', prev: null, anim: 'idle', expr: 'neutral', look: null,
    route: [], routeI: 0, leadAhead: 3.0, waitR: 6.0, reactT: 0, idleT: 0, nudges: 0, t: 0, phase: 0, said: null, coop: null };
}
const turn = (c, want, k) => { c.facing += Math.atan2(Math.sin(want - c.facing), Math.cos(want - c.facing)) * Math.min(1, k); };

// Commands from the story.
export function invite(c, at, expr) { Object.assign(c, { state: 'INVITE', route: [], anim: 'wave', expr: expr || 'smile', idleT: 0 }); if (at) { c.x = at.x; c.z = at.z; } }
export function lead(c, route, opts) { Object.assign(c, { state: 'LEAD', route: route.map(([x, z]) => ({ x, z })), routeI: 0, idleT: 0, leadAhead: (opts && opts.ahead) || 3.0, waitR: (opts && opts.waitR) || 6.0, runSpeed: (opts && opts.speed) || 2.4 }); }
export function wait(c, at, expr) { Object.assign(c, { state: 'WAIT', route: [], idleT: 0, anim: 'idle', expr: expr || c.expr }); if (at) { c.x = at.x; c.z = at.z; } }
export function play(c, mode) { Object.assign(c, { state: 'PLAY', play: mode || 'window', playT: 0, idleT: 0 }); }
export function cooperate(c, at, what) { Object.assign(c, { state: 'COOPERATE', coop: what, route: at ? [{ x: at.x, z: at.z }] : [], routeI: 0, idleT: 0 }); }
export function react(c, expr, anim, secs) { if (c.state !== 'REACT') { c.prev = c.state; } Object.assign(c, { state: 'REACT', expr, anim: anim || 'idle', reactT: secs || 1.6 }); }
export function transition(c, route, speed) { Object.assign(c, { state: 'TRANSITION', route: route.map(([x, z]) => ({ x, z })), routeI: 0, runSpeed: speed || 1.6 }); }

// One tick. player: { x, z, speed }. Returns events: { type: 'june-say', key } nudges, 'arrived' at route end.
export function tick(c, dt, player) {
  const ev = []; c.t += dt; c.idleT += dt;
  const dx = player.x - c.x, dz = player.z - c.z, d = Math.hypot(dx, dz);
  const facePlayer = (k) => turn(c, Math.atan2(dx, dz), dt * (k || 5));
  const walkTo = (p, sp) => { const ex = p.x - c.x, ez = p.z - c.z, e = Math.hypot(ex, ez); if (e < 0.08) { c.speed = 0; return true; } const st = Math.min(e, sp * dt); c.x += (ex / e) * st; c.z += (ez / e) * st; turn(c, Math.atan2(ex, ez), dt * 10); c.speed = sp; c.phase += st * 4.2; return false; };
  c.speed = 0;
  switch (c.state) {
    case 'INVITE':
      facePlayer(4); c.anim = d > 4 ? 'wave' : 'idle';
      if (c.idleT > 9 && c.nudges < 3) { c.idleT = 0; c.nudges += 1; ev.push({ type: 'june-say', key: 'june.nudge' + c.nudges }); }
      break;
    case 'LEAD': {
      const goal = c.route[c.routeI];
      if (!goal) { c.state = 'WAIT'; ev.push({ type: 'arrived' }); break; }
      // walk while the player keeps up; stop and look back when they fall behind
      const behind = d > c.waitR;
      if (behind) { c.anim = 'look'; facePlayer(3); if (c.idleT > 8 && c.nudges < 3) { c.idleT = 0; c.nudges += 1; ev.push({ type: 'june-say', key: 'june.waitUp' }); } break; }
      c.idleT = 0;
      const ahead = Math.hypot(goal.x - c.x, goal.z - c.z) < 0.08;
      if (ahead) { c.routeI += 1; break; }
      const sp = d < c.leadAhead * 0.6 ? c.runSpeed * 1.25 : c.runSpeed;
      walkTo(goal, sp); c.anim = sp > 3 ? 'run' : 'walk';
      break;
    }
    case 'WAIT':
      c.anim = 'idle'; if (d < 7) { facePlayer(4); }
      if (c.idleT > 14 && c.nudges < 3) { c.idleT = 0; c.nudges += 1; ev.push({ type: 'june-say', key: 'june.idle' + c.nudges }); }
      break;
    case 'PLAY':
      c.playT = (c.playT || 0) + dt;
      if (c.play === 'window') { c.anim = 'look'; c.look = 'window'; }
      break;
    case 'COOPERATE': {
      const goal = c.route[c.routeI];
      if (goal) { if (walkTo(goal, 1.8)) { c.routeI += 1; ev.push({ type: 'arrived' }); } c.anim = 'walk'; } else { c.anim = 'hold'; facePlayer(2); }
      break;
    }
    case 'REACT':
      c.reactT -= dt; facePlayer(6);
      if (c.reactT <= 0) { c.state = c.prev || 'WAIT'; c.prev = null; c.anim = 'idle'; }
      break;
    case 'TRANSITION': {
      const goal = c.route[c.routeI];
      if (!goal) { c.state = 'WAIT'; ev.push({ type: 'arrived' }); break; }
      if (walkTo(goal, c.runSpeed)) { c.routeI += 1; }
      c.anim = c.runSpeed > 3 ? 'run' : 'walk';
      break;
    }
    default: break;
  }
  return ev;
}
