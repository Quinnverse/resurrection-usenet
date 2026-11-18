// P5 level layout: walkable floor, obstacles, spawn points, interaction points and path finding.
// Units are metres; the ground is the XZ plane. Pure data and geometry: no Three.js, no DOM.
//
// Walkable floor is a union of shapes minus obstacles. Shapes:
//   { k: 'rect', x0, x1, z0, z1 }   axis-aligned rectangle
//   { k: 'circ', x, z, r }          circle
// A shape with `asset` exists only when that asset is part of the current build (from the build manifest), so the
// floor, the obstacles and the visible world all come from the same data and change together.
// ctx = { assets: Set<string>, bridgeLen: metres of bridge built (0..BRIDGE.span) }

export const PLAYER_RADIUS = 0.32;

// The canal between the plaza and the promenade, and June's bridge over it.
export const CANAL = { z0: 8.4, z1: 11.6 };
export const BRIDGE = { x: 0, z0: 8.4, span: 3.2, halfWalk: 0.98 };

export const THEO = {
  wait: { x: 0.5, z: 12.5 },               // stuck on the far side
  meet: { x: 1.5, z: 7.2 },                // after he crosses
  post: { x: 2.9, z: 12.9 },               // his evening spot by the pier
  path: [[0.5, 12.2], [0.0, 11.4], [0.0, 8.9], [0.9, 8.5], [1.5, 7.2]]
};

export const SCENES = {
  study: {
    spawn: { x: 0.2, z: 0.9, yaw: 0.25 },
    camera: { dist: 3.3, pitch: 0.42, minPitch: 0.15, maxPitch: 0.95, room: { x0: -4.3, x1: 4.3, z0: -3.3, z1: 3.3, y1: 2.85 } },
    bounds: { x0: -4.2, x1: 4.2, z0: -3.2, z1: 3.2 },
    walk: [{ k: 'rect', x0: -4.15, x1: 4.15, z0: -3.15, z1: 3.15 }],
    block: [
      { k: 'rect', x0: 1.85, x1: 4.5, z0: -3.5, z1: -2.35 },    // desk with the CRT
      { k: 'rect', x0: -4.5, x1: -3.9, z0: -2.5, z1: 0.1 },     // bookshelf
      { k: 'rect', x0: -2.45, x1: -1.15, z0: 0.75, z1: 1.85 },  // moving boxes
      { k: 'rect', x0: -4.35, x1: -3.05, z0: 0.85, z1: 1.95 },  // armchair
      { k: 'rect', x0: -3.85, x1: -2.95, z0: 2.15, z1: 2.95 },  // side table
      { k: 'circ', x: -3.9, z: -2.95, r: 0.3 },                 // floor lamp
      { k: 'circ', x: 4.0, z: 3.0, r: 0.4 },                    // plant
      { k: 'rect', x0: 1.15, x1: 1.85, z0: -2.7, z1: -1.95 }    // desk chair
    ]
  },
  town: {
    spawn: { x: 0, z: -9.2, yaw: Math.PI },
    camera: { dist: 6.2, pitch: 0.34, minPitch: 0.08, maxPitch: 0.95 },
    bounds: { x0: -13, x1: 21, z0: -15.5, z1: 25.5 },
    walk: [
      { k: 'rect', x0: -2.3, x1: 2.3, z0: -15, z1: -6 },         // arrival lane
      { k: 'circ', x: 0, z: 0, r: 7.6 },                        // plaza
      { k: 'rect', x0: -2.6, x1: 2.6, z0: 6, z1: CANAL.z0 },    // road down to the canal
      { k: 'rect', x0: -2.6, x1: 2.6, z0: CANAL.z1 - 0.1, z1: 13 }, // road on the far side
      { k: 'rect', x0: -12, x1: 13, z0: 11.8, z1: 14.6 },       // promenade
      { k: 'rect', x0: 11, x1: 16, z0: 11.8, z1: 16, asset: 'point_path' },   // 2004: path to the finished lighthouse
      { k: 'circ', x: 16.2, z: 18.4, r: 4.2, asset: 'point_path' },
      { k: 'rect', x0: -1.0, x1: 1.0, z0: 14.0, z1: 25.0, asset: 'pier_old' }  // 1998: the old pier
    ],
    block: [
      { k: 'circ', x: 0, z: 0, r: 1.7 },                                      // fountain
      { k: 'circ', x: -4.6, z: 2.6, r: 0.45 },                                // notice board
      { k: 'circ', x: 17.2, z: 19.6, r: 1.85, asset: 'lighthouse_tower' },
      { k: 'rect', x0: -6.2, x1: -3.6, z0: 13.95, z1: 14.55 },                // benches by the sea wall
      { k: 'rect', x0: 4.6, x1: 7.2, z0: 13.95, z1: 14.55 },
      { k: 'circ', x: -3.2, z: -7.0, r: 0.12 }, { k: 'circ', x: 3.2, z: -7.0, r: 0.12 }, { k: 'circ', x: -6.6, z: 3.6, r: 0.12 }, { k: 'circ', x: 6.6, z: 3.6, r: 0.12 },
      { k: 'circ', x: -3.1, z: 12.0, r: 0.12 }, { k: 'circ', x: 3.4, z: 12.0, r: 0.12 }, { k: 'circ', x: 10, z: 12.0, r: 0.12 }, { k: 'circ', x: -10, z: 12.0, r: 0.12 },
      { k: 'circ', x: 16.3, z: 12.4, r: 0.12, asset: 'point_path' }
    ]
  }
};

// Interaction points. r is the reach from the point; y is the marker height. `asset` limits a point to builds
// that contain that asset. The story decides which are available at any moment. Theo moves; main.js passes his
// position in.
export const INTERACT = {
  study: [
    { id: 'computer', x: 3.0, z: -2.75, r: 1.55, y: 1.3, verb: 'verb.use' },
    { id: 'photo', x: 4.2, z: 0.6, r: 1.6, y: 1.65, verb: 'verb.inspect' },
    { id: 'keepbox', x: -1.8, z: 1.3, r: 1.45, y: 0.9, verb: 'verb.inspect' },
    { id: 'postcard', x: -3.4, z: 2.55, r: 1.35, y: 0.95, verb: 'verb.inspect' },
    { id: 'drawing', x: -1.5, z: 3.2, r: 1.45, y: 1.7, verb: 'verb.inspect' },
    { id: 'shelf', x: -4.0, z: -1.2, r: 1.5, y: 1.4, verb: 'verb.inspect' },
    { id: 'window', x: -0.6, z: -3.2, r: 1.5, y: 1.5, verb: 'verb.inspect' },
    { id: 'lamp', x: -3.9, z: -2.95, r: 1.3, y: 1.4, verb: 'verb.toggle' }
  ],
  town: [
    { id: 'theo', x: THEO.wait.x, z: THEO.wait.z, r: 1.8, y: 2.2, verb: 'verb.talk', moving: true },
    { id: 'gap', x: 0, z: 8.0, r: 1.6, y: 1.0, verb: 'verb.inspect' },
    { id: 'notice', x: -4.6, z: 2.6, r: 1.6, y: 1.9, verb: 'verb.read' },
    { id: 'bakery', x: -5.0, z: -5.6, r: 1.7, y: 2.0, verb: 'verb.inspect' },
    { id: 'mural', x: 5.0, z: -5.6, r: 1.7, y: 2.0, verb: 'verb.inspect' },
    { id: 'fountain', x: 0, z: 0, r: 2.4, y: 1.6, verb: 'verb.inspect' },
    { id: 'pierGate', x: 0, z: 14.2, r: 1.5, y: 1.3, verb: 'verb.inspect' },
    { id: 'pierEnd', x: 0, z: 24.3, r: 1.4, y: 1.2, verb: 'verb.look', asset: 'pier_old' },
    { id: 'lighthouse', x: 15.6, z: 18.1, r: 1.9, y: 2.0, verb: 'verb.inspect', asset: 'point_path' },
    { id: 'scaffold', x: 12.2, z: 13.6, r: 1.6, y: 2.0, verb: 'verb.inspect', asset: 'point_rocks' }
  ]
};
// Where Theo can be talked to from across the canal (he cannot cross until the bridge exists).
export const THEO_SHOUT_REACH = 4.9;

// ---- geometry ----------------------------------------------------------------------------------------------
function inside(s, x, z, pad) {
  if (s.k === 'rect') { return x >= s.x0 - pad && x <= s.x1 + pad && z >= s.z0 - pad && z <= s.z1 + pad; }
  const dx = x - s.x, dz = z - s.z; return dx * dx + dz * dz <= (s.r + pad) * (s.r + pad);
}
const active = (s, ctx) => !s.asset || (ctx && ctx.assets && ctx.assets.has(s.asset));
export function bridgeShape(ctx) {
  const len = ctx && ctx.bridgeLen ? Math.min(BRIDGE.span, ctx.bridgeLen) : 0;
  if (len <= 0) { return null; }
  // the bridge overlaps the near bank, and the far bank once it is complete
  return { k: 'rect', x0: BRIDGE.x - BRIDGE.halfWalk, x1: BRIDGE.x + BRIDGE.halfWalk, z0: BRIDGE.z0 - 0.15, z1: BRIDGE.z0 + len + (len >= BRIDGE.span - 1e-6 ? 0.2 : 0) };
}
function walkShapes(sceneId, ctx) {
  const w = SCENES[sceneId].walk.filter((s) => active(s, ctx));
  if (sceneId === 'town') { const b = bridgeShape(ctx); if (b) { w.push(b); } }
  return w;
}
const blockShapes = (sceneId, ctx) => SCENES[sceneId].block.filter((s) => active(s, ctx));

// True when a body of `radius` (default PLAYER_RADIUS) can stand at (x, z).
export function canStand(sceneId, x, z, ctx, extra, radius) {
  const r = radius === undefined ? PLAYER_RADIUS : radius;
  const walk = walkShapes(sceneId, ctx);
  const pts = [[0, 0]]; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  for (const [ox, oz] of pts) { if (!walk.some((s) => inside(s, x + ox, z + oz, 0))) { return false; } }
  const blocks = extra ? blockShapes(sceneId, ctx).concat(extra) : blockShapes(sceneId, ctx);
  return !blocks.some((s) => inside(s, x, z, r));
}

// Moves from (x, z) by (dx, dz), sliding along walls.
export function move(sceneId, x, z, dx, dz, ctx, extra) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05));
  let px = x, pz = z; const sx = dx / steps, sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    if (canStand(sceneId, px + sx, pz + sz, ctx, extra)) { px += sx; pz += sz; continue; }
    if (canStand(sceneId, px + sx, pz, ctx, extra)) { px += sx; continue; }
    if (canStand(sceneId, px, pz + sz, ctx, extra)) { pz += sz; continue; }
    break;
  }
  return { x: px, z: pz };
}

// After a build switch the floor can change under the player. Returns the nearest place to stand, so nobody is ever
// left inside a wall or over water. Searches rings outward; returns the same point when it is already fine.
export function safeSpot(sceneId, x, z, ctx, extra) {
  if (canStand(sceneId, x, z, ctx, extra)) { return { x, z, moved: false }; }
  for (let r = 0.15; r < 30; r += 0.15) {
    const n = Math.max(12, Math.round(r * 10));
    let best = null;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (canStand(sceneId, px, pz, ctx, extra, PLAYER_RADIUS + 0.05)) { best = { x: px, z: pz }; break; }
    }
    if (best) { return Object.assign(best, { moved: true }); }
  }
  const sp = SCENES[sceneId].spawn; return { x: sp.x, z: sp.z, moved: true };
}

// Nearest available interaction point within reach. `available(id)` filters; `where(id)` overrides a position.
export function nearest(sceneId, x, z, available, where, ctx) {
  let best = null, bestD = Infinity;
  for (const o of INTERACT[sceneId]) {
    if (o.asset && !(ctx && ctx.assets && ctx.assets.has(o.asset))) { continue; }
    if (available && !available(o.id)) { continue; }
    const p = (where && where(o.id)) || o;
    const reach = p.r || o.r;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d <= reach && d < bestD) { best = o; bestD = d; }
  }
  return best;
}
export const point = (sceneId, id) => INTERACT[sceneId].find((o) => o.id === id) || null;

// ---- path finding ------------------------------------------------------------------------------------------
// A* on a grid of standable cells, then shortened with straight walkable lines. Used for the light trail and by the
// scripted test player. Paths keep a margin from walls so the trail never hugs or crosses them.
const STEP = { study: 0.2, town: 0.25 };
const gridCache = new Map();
function ctxKey(sceneId, ctx) { return sceneId + '|' + (ctx && ctx.assets ? [...ctx.assets].sort().join(',') : '') + '|' + (ctx && ctx.bridgeLen ? ctx.bridgeLen.toFixed(2) : '0'); }
function grid(sceneId, ctx, margin) {
  const key = ctxKey(sceneId, ctx) + '|' + margin;
  if (gridCache.has(key)) { return gridCache.get(key); }
  const b = SCENES[sceneId].bounds, s = STEP[sceneId];
  const nx = Math.floor((b.x1 - b.x0) / s) + 1, nz = Math.floor((b.z1 - b.z0) / s) + 1;
  const free = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) { for (let i = 0; i < nx; i++) { free[j * nx + i] = canStand(sceneId, b.x0 + i * s, b.z0 + j * s, ctx, null, PLAYER_RADIUS + margin) ? 1 : 0; } }
  const g = { b, s, nx, nz, free };
  if (gridCache.size > 24) { gridCache.delete(gridCache.keys().next().value); }
  gridCache.set(key, g);
  return g;
}
function nearestFree(g, x, z, maxR) {
  const ci = Math.round((x - g.b.x0) / g.s), cj = Math.round((z - g.b.z0) / g.s);
  const R = Math.ceil(maxR / g.s); let best = -1, bd = Infinity;
  for (let dj = -R; dj <= R; dj++) {
    for (let di = -R; di <= R; di++) {
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= g.nx || j >= g.nz || !g.free[j * g.nx + i]) { continue; }
      const d = di * di + dj * dj; if (d < bd) { bd = d; best = j * g.nx + i; }
    }
  }
  return best;
}
// Straight line from a to b stays on standable floor (sampled every 10 cm).
export function clearLine(sceneId, ax, az, bx, bz, ctx, extra, radius) {
  const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1));
  for (let i = 0; i <= n; i++) { const k = i / n; if (!canStand(sceneId, ax + (bx - ax) * k, az + (bz - az) * k, ctx, extra, radius)) { return false; } }
  return true;
}
export function findPath(sceneId, from, to, ctx, opts) {
  const o = opts || {};
  for (const margin of [0.14, 0.04]) {
    const g = grid(sceneId, ctx, margin);
    const start = nearestFree(g, from.x, from.z, 1.2), goal = nearestFree(g, to.x, to.z, o.reach || 2.2);
    if (start < 0 || goal < 0) { continue; }
    const cells = astar(g, start, goal);
    if (!cells) { continue; }
    const pts = cells.map((c) => [g.b.x0 + (c % g.nx) * g.s, g.b.z0 + Math.floor(c / g.nx) * g.s]);
    // the first point is where the player stands; then shorten with straight lines that keep the margin
    const raw = [[from.x, from.z]].concat(pts);
    const out = [raw[0]]; let i = 0;
    while (i < raw.length - 1) {
      let j = raw.length - 1;
      while (j > i + 1 && !clearLine(sceneId, raw[i][0], raw[i][1], raw[j][0], raw[j][1], ctx, null, PLAYER_RADIUS + margin * 0.5)) { j -= 1; }
      out.push(raw[j]); i = j;
    }
    return out;
  }
  return null;
}
function astar(g, start, goal) {
  const { nx, free } = g, N = free.length;
  const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = []; const push = (n, f) => { heap.push([f, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) { break; } [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) { m = l; } if (r < heap.length && heap[r][0] < heap[m][0]) { m = r; } if (m === k) { break; } [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const gx = goal % nx, gz = Math.floor(goal / nx);
  const h = (n) => { const dx = Math.abs((n % nx) - gx), dz = Math.abs(Math.floor(n / nx) - gz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  gs[start] = 0; push(start, h(start));
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (heap.length) {
    const [, u] = pop(); if (closed[u]) { continue; } if (u === goal) { break; } closed[u] = 1;
    const ux = u % nx, uz = Math.floor(u / nx);
    for (const [dx, dz, c] of D) {
      const vx = ux + dx, vz = uz + dz; if (vx < 0 || vz < 0 || vx >= nx || vz >= g.nz) { continue; }
      const v = vz * nx + vx; if (!free[v]) { continue; }
      if (dx && dz && (!free[uz * nx + vx] || !free[vz * nx + ux])) { continue; }   // no cutting corners
      const ng = gs[u] + c; if (ng < gs[v]) { gs[v] = ng; came[v] = u; push(v, ng + h(v)); }
    }
  }
  if (came[goal] < 0 && start !== goal) { return null; }
  const path = [goal]; let n = goal; while (n !== start) { n = came[n]; path.push(n); }
  return path.reverse();
}
