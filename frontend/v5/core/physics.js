// Character physics for V5: floors with heights (and ramps), solids with tops, jump, sprint, glide, edge guard,
// safe landing checks and grid path finding. Pure: no Three.js, no DOM.
//
// Floor shape: { k: 'rect', x0, x1, z0, z1, y, [y2, axis] } or { k: 'circ', x, z, r, y }  (y2/axis = ramp)
// Solid shape: same footprint plus { top, [bottom] }. Low solids (top < 0.9) can be jumped onto if a floor covers them.
// Optional tags: asset (only when the current build lists it), ledge (walking off is allowed: a drop or a glide).

export const R = 0.32;                 // body radius
export const STEP = 0.32;              // highest step you walk up
export const DROP = 0.7;               // deepest step you walk down without jumping (edge guard)
export const G = 12, JUMP_V = 4.6, GLIDE_FALL = 1.15;
export const WALK = 2.6, SPRINT = 4.4, ACCEL = 14, DECEL = 18;

const inShape = (s, x, z, pad) => s.k === 'rect' ? (x >= s.x0 - pad && x <= s.x1 + pad && z >= s.z0 - pad && z <= s.z1 + pad) : ((x - s.x) * (x - s.x) + (z - s.z) * (z - s.z) <= (s.r + pad) * (s.r + pad));
function floorY(s, x, z) {
  if (s.y2 === undefined) { return s.y; }
  const t = s.axis === 'z' ? (z - s.z0) / (s.z1 - s.z0) : (x - s.x0) / (s.x1 - s.x0);
  return s.y + (s.y2 - s.y) * Math.max(0, Math.min(1, t));
}
// A world is the active floors and solids of a scene for one context (era assets, bridge planks, moving things).
export function makeWorld(layout, ctx) {
  const on = (s) => !s.asset || (ctx && ctx.assets && ctx.assets.has(s.asset));
  const floors = layout.floors.filter(on).concat((ctx && ctx.floors) || []);
  const solids = layout.solids.filter(on).concat((ctx && ctx.solids) || []);
  return { layout, floors, solids, voidY: layout.voidY === undefined ? -3 : layout.voidY, bounds: layout.bounds };
}
// Highest floor at (x, z) that is not above `maxY`. null when there is none (water, a gap, the void).
export function groundAt(w, x, z, maxY) {
  let best = null, ledge = false;
  for (const s of w.floors) { if (!inShape(s, x, z, 0)) { continue; } const y = floorY(s, x, z); if (y <= maxY + 1e-6 && (best === null || y > best)) { best = y; ledge = !!s.ledge; } }
  return best === null ? null : { y: best, ledge };
}
// A body at (x, z) with feet at y overlaps a solid it cannot stand on.
export function blocked(w, x, z, y, r, extra) {
  const list = extra ? w.solids.concat(extra) : w.solids;
  for (const s of list) { if ((s.bottom || 0) <= y + 1.6 && s.top > y + 0.05 && inShape(s, x, z, r === undefined ? R : r)) { return true; } }
  return false;
}
// Can a body stand here at about this height? (support under the centre, nothing in the way)
export function standable(w, x, z, y, extra, r) {
  const g = groundAt(w, x, z, y + STEP); if (!g || g.y < y - DROP) { return false; }
  return !blocked(w, x, z, g.y, r, extra);
}
export function findSafe(w, x, z, y, maxR, extra) {
  if (standable(w, x, z, y, extra)) { return { x, z, y: groundAt(w, x, z, y + STEP).y, moved: false }; }
  for (let r = 0.12; r <= maxR; r += 0.12) {
    const n = Math.max(10, Math.round(r * 12));
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (standable(w, px, pz, y, extra, R + 0.04)) { return { x: px, z: pz, y: groundAt(w, px, pz, y + STEP).y, moved: true }; } }
  }
  return null;
}

// ---- the character controller -------------------------------------------------------------------------------
export function newBody(x, z, y) { return { x, z, y: y || 0, vx: 0, vz: 0, vy: 0, grounded: true, facing: 0, safe: { x, z, y: y || 0 }, gliding: false, airT: 0 }; }
// input: { dx, dz } desired direction in world space (length 0..1), sprint, jump (pressed), jumpHeld, glide (allowed here)
// Returns events: 'jump', 'land', 'fall' (respawned at the last safe spot), 'blocked'.
export function stepBody(b, input, dt, w, extra) {
  const ev = [];
  const mag = Math.min(1, Math.hypot(input.dx || 0, input.dz || 0));
  const top = (input.sprint ? SPRINT : WALK) * (input.speedScale || 1);
  const tx = mag ? (input.dx / Math.hypot(input.dx, input.dz)) * top * mag : 0, tz = mag ? (input.dz / Math.hypot(input.dx, input.dz)) * top * mag : 0;
  const k = (mag ? ACCEL : DECEL) * dt * (b.grounded ? 1 : 0.45);
  b.vx += Math.max(-k, Math.min(k, tx - b.vx)); b.vz += Math.max(-k, Math.min(k, tz - b.vz));
  if (b.gliding) { const gs = 1.35; b.vx *= 1 + (gs - 1) * Math.min(1, dt * 2); b.vz *= 1 + (gs - 1) * Math.min(1, dt * 2); }
  if (mag > 0.05) { const want = Math.atan2(b.vx, b.vz); b.facing += Math.atan2(Math.sin(want - b.facing), Math.cos(want - b.facing)) * Math.min(1, dt * 12); }
  if (b.grounded) { unstick(b, w, extra); }
  // jump
  if (input.jump && b.grounded) { b.vy = JUMP_V; b.grounded = false; b.airT = 0; ev.push('jump'); }
  // horizontal move in small steps with sliding
  const n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vz) * dt / 0.05));
  for (let i = 0; i < n; i++) {
    const sx = (b.vx * dt) / n, sz = (b.vz * dt) / n;
    const ok = (x, z) => {
      if (blocked(w, x, z, b.y, R, extra)) { return false; }
      if (!b.grounded) { return true; }
      const g = groundAt(w, x, z, b.y + STEP);
      if (!g) { return !!groundAt(w, b.x, b.z, b.y + STEP) && groundAt(w, b.x, b.z, b.y + STEP).ledge; }   // walking off is only allowed at a ledge
      return g.y >= b.y - DROP || g.ledge || (groundAt(w, b.x, b.z, b.y + STEP) || {}).ledge;
    };
    if (ok(b.x + sx, b.z + sz)) { b.x += sx; b.z += sz; continue; }
    if (ok(b.x + sx, b.z)) { b.x += sx; b.vz *= 0.5; continue; }
    if (ok(b.x, b.z + sz)) { b.z += sz; b.vx *= 0.5; continue; }
    // blocked straight on: glide along the edge or the wall at an angle, slower, instead of stopping dead
    let slid = false;
    for (const a of [0.6, -0.6, 1.1, -1.1]) { const c = Math.cos(a), sn = Math.sin(a), k = c * 0.8; const rx = (sx * c - sz * sn) * k, rz = (sx * sn + sz * c) * k; if (ok(b.x + rx, b.z + rz)) { b.x += rx; b.z += rz; slid = true; break; } }
    if (slid) { continue; }
    b.vx *= 0.3; b.vz *= 0.3; if (mag > 0.3) { ev.push('blocked'); } break;
  }
  // vertical
  const g = groundAt(w, b.x, b.z, b.y + STEP);
  if (b.grounded) {
    if (!g || g.y < b.y - DROP) { b.grounded = false; b.vy = 0; b.airT = 0; } else { b.y = g.y; }
  }
  if (!b.grounded) {
    b.airT += dt;
    b.gliding = !!(input.glide && input.jumpHeld && b.vy < 0);
    b.vy -= G * dt; if (b.gliding) { b.vy = Math.max(b.vy, -GLIDE_FALL); }
    const ny = b.y + b.vy * dt;
    const gg = groundAt(w, b.x, b.z, Math.max(b.y, ny) + 0.05);
    if (gg && b.vy <= 0 && ny <= gg.y) { b.y = gg.y; b.vy = 0; b.grounded = true; b.gliding = false; ev.push('land'); unstick(b, w, extra); } else { b.y = ny; }
    if (b.y < w.voidY) { Object.assign(b, { x: b.safe.x, z: b.safe.z, y: b.safe.y, vx: 0, vz: 0, vy: 0, grounded: true, gliding: false }); ev.push('fall'); }
  }
  if (b.grounded && !(g && g.ledge)) { const s = groundAt(w, b.x, b.z, b.y + STEP); if (s && !blocked(w, b.x, b.z, b.y, R + 0.02, extra)) { b.safe = { x: b.x, z: b.z, y: b.y }; } }
  return ev;
}

// After landing beside a low obstacle the body can overlap it; move it out, preferring the way it was going.
function unstick(b, w, extra) {
  if (!blocked(w, b.x, b.z, b.y, R, extra)) { return; }
  const sp = Math.hypot(b.vx, b.vz), ux = sp > 0.1 ? b.vx / sp : 0, uz = sp > 0.1 ? b.vz / sp : 0;
  for (let r = 0.05; r <= 0.8; r += 0.05) {
    const tries = [[ux, uz]].concat(Array.from({ length: 12 }, (_, i) => [Math.cos((i / 12) * Math.PI * 2), Math.sin((i / 12) * Math.PI * 2)]));
    for (const [dx, dz] of tries) { if (!dx && !dz) { continue; } const x = b.x + dx * r, z = b.z + dz * r; const g = groundAt(w, x, z, b.y + STEP); if (g && Math.abs(g.y - b.y) < STEP && !blocked(w, x, z, g.y, R, extra)) { b.x = x; b.z = z; b.y = g.y; return; } }
  }
}

// ---- path finding on the floor of a world ---------------------------------------------------------------------
const gridCache = new Map();
function grid(w, key, y, margin) {
  const k = key + '|' + margin + '|' + Math.round(y * 4);
  if (gridCache.has(k)) { return gridCache.get(k); }
  const b = w.bounds, s = b.step || 0.25;
  const nx = Math.floor((b.x1 - b.x0) / s) + 1, nz = Math.floor((b.z1 - b.z0) / s) + 1, free = new Uint8Array(nx * nz), hy = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) { for (let i = 0; i < nx; i++) { const x = b.x0 + i * s, z = b.z0 + j * s; const g = groundAt(w, x, z, 99); const e = margin > 0.2 ? margin : 0; const edgeOk = !g || !e || [[e, 0], [-e, 0], [0, e], [0, -e]].every(([ox, oz]) => { const q = groundAt(w, x + ox, z + oz, 99); return q && Math.abs(q.y - g.y) < 0.4; }); if (g && edgeOk && !blocked(w, x, z, g.y, R + margin)) { free[j * nx + i] = 1; hy[j * nx + i] = g.y; } } }
  const out = { b, s, nx, nz, free, hy };
  if (gridCache.size > 30) { gridCache.delete(gridCache.keys().next().value); }
  gridCache.set(k, out); return out;
}
// Walkable straight line: every 10 cm has floor within a step of the previous point and no solid.
export function clearLine(w, ax, az, bx, bz, y, r) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1)); let py = y;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    const g = groundAt(w, x, z, py + STEP); if (!g || g.y < py - DROP || blocked(w, x, z, g.y, r === undefined ? R : r)) { return false; } py = g.y;
  }
  return true;
}
export function findPath(w, key, from, to, opts) {
  const o = opts || {};
  // first try a path that keeps 0.35 m from floor edges and solids (easier to follow with digital keys), then tighter
  for (const margin of [0.35, 0.12, 0.03]) {
    const g = grid(w, key, from.y || 0, margin);
    const cell = (x, z, maxR) => { const ci = Math.round((x - g.b.x0) / g.s), cj = Math.round((z - g.b.z0) / g.s), Rr = Math.ceil(maxR / g.s); let best = -1, bd = Infinity; for (let dj = -Rr; dj <= Rr; dj++) { for (let di = -Rr; di <= Rr; di++) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= g.nx || j >= g.nz || !g.free[j * g.nx + i]) { continue; } const d = di * di + dj * dj; if (d < bd) { bd = d; best = j * g.nx + i; } } } return best; };
    const start = cell(from.x, from.z, 1.0), goal = cell(to.x, to.z, o.reach || 2.0); if (start < 0 || goal < 0) { continue; }
    const cells = astar(g, start, goal); if (!cells) { continue; }
    const raw = [[from.x, from.z]].concat(cells.map((c) => [g.b.x0 + (c % g.nx) * g.s, g.b.z0 + Math.floor(c / g.nx) * g.s]));
    const out = [raw[0]]; let i = 0;
    while (i < raw.length - 1) { let j = raw.length - 1; while (j > i + 1 && !clearLine(w, raw[i][0], raw[i][1], raw[j][0], raw[j][1], from.y || 0, R + margin * 0.5)) { j -= 1; } out.push(raw[j]); i = j; }
    // a wide path ends where the wide grid ends; finish at the target itself when a straight line gets there
    if (margin > 0.2) { const l = out[out.length - 1]; if (Math.hypot(l[0] - to.x, l[1] - to.z) > 0.3) { if (!clearLine(w, l[0], l[1], to.x, to.z, from.y || 0)) { continue; } out.push([to.x, to.z]); } }
    return out;
  }
  return null;
}
function astar(g, start, goal) {
  const { nx, free, hy } = g, N = free.length;
  const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N), heap = [];
  const push = (n, f) => { heap.push([f, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) { break; } [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) { m = l; } if (r < heap.length && heap[r][0] < heap[m][0]) { m = r; } if (m === k) { break; } [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const gx = goal % nx, gz = Math.floor(goal / nx); const h = (n) => { const dx = Math.abs((n % nx) - gx), dz = Math.abs(Math.floor(n / nx) - gz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  gs[start] = 0; push(start, h(start));
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [, u] = pop(); if (closed[u]) { continue; } if (u === goal) { break; } closed[u] = 1;
    const ux = u % nx, uz = Math.floor(u / nx);
    for (const [dx, dz, c] of D) {
      const vx = ux + dx, vz = uz + dz; if (vx < 0 || vz < 0 || vx >= nx || vz >= g.nz) { continue; }
      const v = vz * nx + vx; if (!free[v] || Math.abs(hy[v] - hy[u]) > STEP) { continue; }
      if (dx && dz && (!free[uz * nx + vx] || !free[vz * nx + ux])) { continue; }
      const ng = gs[u] + c; if (ng < gs[v]) { gs[v] = ng; came[v] = u; push(v, ng + h(v)); }
    }
  }
  if (came[goal] < 0 && start !== goal) { return null; }
  const p = [goal]; let n = goal; while (n !== start) { n = came[n]; p.push(n); } return p.reverse();
}
