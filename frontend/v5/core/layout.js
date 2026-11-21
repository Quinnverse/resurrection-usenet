// Scene layouts for V5: floors, solids, interaction points, spawns and authored paths. Units are metres.
// Render code builds the visible world on the same numbers, so what you see and what you collide with agree.
// Shapes tagged with `asset` exist only when the current build's manifest lists that asset (see core/archive.js).

const rect = (x0, x1, z0, z1, y, more) => Object.assign({ k: 'rect', x0, x1, z0, z1, y: y || 0 }, more || {});
const circ = (x, z, r, y, more) => Object.assign({ k: 'circ', x, z, r, y: y || 0 }, more || {});
const wall = (x0, x1, z0, z1, top, more) => Object.assign({ k: 'rect', x0, x1, z0, z1, top: top || 3 }, more || {});
const post = (x, z, r, top, more) => Object.assign({ k: 'circ', x, z, r, top: top || 3 }, more || {});

// ---- the town of Last Light (reused from P4/P5) ------------------------------------------------------------------
export const CANAL = { z0: 8.4, z1: 11.6 };
export const BRIDGE = { x: 0, z0: 8.4, span: 3.2, halfWalk: 0.98 };
export const PIER = { near1998: [14.0, 18.0], far1998: [22.0, 25.0], stub2004: [17.0, 23.0], halfWidth: 1.0 };
export const LIGHTHOUSE = { x: 17.2, z: 19.6 };
export const THEO_TOWN = { wait: { x: 0.5, z: 12.5 }, meet: { x: 1.5, z: 7.2 }, post: { x: 2.9, z: 12.9 }, path: [[0.5, 12.2], [0.0, 11.4], [0.0, 8.9], [0.9, 8.5], [1.5, 7.2]] };
export const IRIS_TOWN = { bakery: { x: -5.0, z: -4.6 }, path: [[-3.6, -2.6], [-4.2, 3.6], [-5.6, 7.3]], dock: { x: -5.6, z: 7.6 } };

export const LAYOUTS = {
  study: {
    spawn: { x: 0.2, z: 0.9, yaw: 0.25 }, bounds: { x0: -4.2, x1: 4.2, z0: -3.2, z1: 3.2, step: 0.2 },
    camera: { dist: 3.3, pitch: 0.42, room: { x0: -4.3, x1: 4.3, z0: -3.3, z1: 3.3, y1: 2.85 } },
    floors: [rect(-4.15, 4.15, -3.15, 3.15)],
    solids: [wall(1.85, 4.5, -3.5, -2.35), wall(-4.5, -3.9, -2.5, 0.1), wall(-2.45, -1.15, 0.75, 1.85), wall(-4.35, -3.05, 0.85, 1.95), wall(-3.85, -2.95, 2.15, 2.95), post(-3.9, -2.95, 0.3), post(4.0, 3.0, 0.4), wall(1.15, 1.85, -2.7, -1.95),
      wall(-4.6, -4.15, -3.6, 3.6), wall(4.15, 4.6, -3.6, 3.6), wall(-4.6, 4.6, -3.6, -3.15), wall(-4.6, 4.6, 3.15, 3.6)],
    points: [
      { id: 'computer', x: 3.0, z: -2.75, r: 1.55, y: 1.3 }, { id: 'photo', x: 4.2, z: 0.6, r: 1.6, y: 1.65 }, { id: 'keepbox', x: -1.8, z: 1.3, r: 1.7, y: 0.9 },
      { id: 'drawing', x: -1.5, z: 3.2, r: 1.45, y: 1.7 }, { id: 'shelf', x: -4.0, z: -1.2, r: 1.5, y: 1.4 }, { id: 'window', x: -0.6, z: -3.2, r: 1.5, y: 1.5 }, { id: 'lamp', x: -3.9, z: -2.95, r: 1.3, y: 1.4 }
    ]
  },
  town: {
    spawn: { x: 0, z: -9.2, yaw: Math.PI }, bounds: { x0: -13, x1: 21, z0: -15.5, z1: 25.5, step: 0.25 },
    camera: { dist: 6.0, pitch: 0.34 },
    voidY: -1.5,
    floors: [
      rect(-2.3, 2.3, -15, -6), circ(0, 0, 7.6), rect(-2.6, 2.6, 6, CANAL.z0), rect(-2.6, 2.6, CANAL.z1 - 0.1, 13), rect(-12, 13, 11.8, 14.6),
      rect(-7.0, -4.4, 6.8, CANAL.z0),                                                         // the little dock by the canal
      rect(-6.4, -3.8, 4.8, 7.0),                                                              // the path down to it
      rect(11, 16, 11.8, 16, 0, { asset: 'point_path' }), circ(16.2, 18.4, 4.2, 0, { asset: 'point_path' }), rect(12.0, 12.9, 15.9, 17.3, 0, { asset: 'point_path' }),   // no sliver between the path and the point
      rect(-PIER.halfWidth, PIER.halfWidth, PIER.near1998[0], PIER.near1998[1], 0, { asset: 'pier_old' }),
      rect(-PIER.halfWidth, PIER.halfWidth, PIER.far1998[0], PIER.far1998[1], 0, { asset: 'pier_old' }),
      rect(-PIER.halfWidth, PIER.halfWidth, PIER.stub2004[0], PIER.stub2004[1], 0, { asset: 'pier_closed' })
    ],
    solids: [
      post(0, 0, 1.7, 0.9), post(-4.6, 2.6, 0.45, 2.4), post(LIGHTHOUSE.x, LIGHTHOUSE.z, 1.85, 9, { asset: 'lighthouse_tower' }), post(LIGHTHOUSE.x, LIGHTHOUSE.z, 1.85, 6, { asset: 'lighthouse_scaffold' }),
      wall(-6.2, -3.6, 13.95, 14.55, 0.8), wall(4.6, 7.2, 13.95, 14.55, 0.8),
      post(-3.2, -7.0, 0.12), post(3.2, -7.0, 0.12), post(-6.6, 3.6, 0.12), post(6.6, 3.6, 0.12), post(-3.1, 12.0, 0.12), post(3.4, 12.0, 0.12), post(10, 12.0, 0.12), post(-10, 12.0, 0.12),
      wall(-1.4, 1.4, 14.35, 14.55, 1.3, { asset: 'pier_closed' }),                             // 2004 fence at the pier foot
      wall(11.2, 16.0, 14.6, 16.2, 2, { asset: 'point_rocks' })                                  // 1998: rocks and crates
    ],
    points: [
      { id: 'theo', x: THEO_TOWN.wait.x, z: THEO_TOWN.wait.z, r: 1.8, y: 2.2, moving: true },
      { id: 'gap', x: 0, z: 8.0, r: 1.6, y: 1.0 },
      { id: 'notice', x: -4.6, z: 2.6, r: 1.7, y: 1.9 }, { id: 'bakery', x: -5.0, z: -5.4, r: 1.8, y: 2.0 }, { id: 'credits', x: 0, z: -14.6, r: 2.0, y: 3.2 },
      { id: 'pierEnd', x: 0, z: 24.4, r: 1.3, y: 1.2, asset: 'pier_old' }, { id: 'lighthouse', x: 15.6, z: 18.1, r: 2.0, y: 2.0, asset: 'point_path' },
      { id: 'rope', x: -5.7, z: 7.3, r: 1.3, y: 0.6 }
    ]
  },
  station: {
    spawn: { x: -24, z: 0, yaw: -Math.PI / 2 }, bounds: { x0: -35, x1: 37, z0: -2.5, z1: 2.1, step: 0.25 },
    camera: { dist: 5.2, pitch: 0.28 },
    floors: [rect(-34, 36, -2.4, 2.0), rect(4.0, 5.4, -2.4, 2.0, 0.6)],
    solids: [wall(-36, 38, -3.2, -2.4, 4), wall(4.0, 5.4, -2.4, 2.0, 0.6), wall(-8.7, -7.3, -2.4, -1.75, 2), wall(-14, -12, -2.4, -1.8, 0.5), wall(-2, 0, -2.4, -1.8, 0.5), wall(18, 20, -2.4, -1.8, 0.5), wall(-36, -34, -3, 3, 4), wall(36, 38, -3, 3, 4)],
    points: [{ id: 'bench', x: -1.0, z: -1.5, r: 1.6, y: 1.0 }, { id: 'exit', x: 33, z: -1.6, r: 1.8, y: 1.4 }, { id: 'kiosk', x: -8.0, z: -1.2, r: 1.4, y: 1.4 },
      { id: 'suitcase', x: -5.0, z: -1.5, r: 1.3, y: 0.6 }, { id: 'door', x: -2.0, z: 1.3, r: 1.3, y: 1.4 }, { id: 'snap', x: -6.2, z: 0.4, r: 1.2, y: 1.5 }],
    train: { z: 3.6, doorZ: 2.15, startX: -12, endX: 30, base: 3.4, slow: 2.0, crawl: 0.7, catchR: 1.45 }
  },
  train: { spawn: { x: 0, z: 0, yaw: 0 }, bounds: { x0: -1, x1: 1, z0: -1, z1: 1 }, floors: [rect(-1, 1, -1, 1)], solids: [], points: [], seat: { x: -0.55, y: 1.2, z: 0.6 }, june: { x: 0.55, y: 0, z: -0.6 } },
  porch: { spawn: { x: 0, z: 0, yaw: 0 }, bounds: { x0: -1, x1: 1, z0: -1, z1: 1 }, floors: [rect(-1, 1, -1, 1)], solids: [], points: [], seat: { x: 297.3, y: -3.55, z: 31.2 }, june: { x: 298.1, z: 31.5 } },
  coast: {
    spawn: { x: 262, z: 20, yaw: 0 }, bounds: { x0: 248, x1: 312, z0: 4, z1: 50, step: 0.25 },
    camera: { dist: 5.6, pitch: 0.32 },
    voidY: -9,
    floors: [
      circ(262, 24, 10), rect(266, 270.2, 14, 18, 0), rect(268.5, 270.6, 17.9, 20.5, 0),   // the landing at the top of the stairs
       rect(270, 274, 14, 18, 0, { y2: -5, axis: 'x' }),   // the yard and the cliff stairs
      rect(271.5, 273.5, 24, 34, 0, { ledge: true }),                                           // the windy ledge
      rect(272, 312, 6, 50, -5),                                                                 // the beach below
    ],
    solids: [post(264, 28, 1.8, 7), wall(257.6, 259.4, 18.6, 20.0, 0.9), wall(250, 252, 4, 50, 6), wall(250, 312, 48, 50, 6)],
    points: [{ id: 'cart', x: 258.5, z: 20.6, r: 1.6, y: 1.0 }, { id: 'socket', x: 263.0, z: 26.2, r: 1.5, y: 1.8 }, { id: 'crank', x: 265.6, z: 26.0, r: 1.4, y: 1.0 }, { id: 'pulley', x: 266.6, z: 23.4, r: 1.4, y: 1.2 }, { id: 'door', x: 300, z: 30, r: 1.8, y: 1.4 }],
    road: { width: 5.0, points: [[0, 0], [30, -6], [62, -2], [92, 10], [112, 30], [104, 56], [118, 80], [146, 92], [178, 98], [204, 84], [208, 58], [190, 40], [184, 18], [206, 8], [230, 14], [248, 18], [258, 19.5]] },
    // along the road (distance s, offset d to the right): the ribbon gates June dares you through, where her chain slips, where she shows off
    ride: { gates: [{ s: 92, d: -1.3 }, { s: 205, d: 1.3 }, { s: 262, d: -1.1 }, { s: 318, d: 1.2 }, { s: 372, d: -1.2 }], chain: 150, noHands: 290 },
    pulley: { x: 266.6, z: 23.4 }, gallery: { x: 264.0, y: 6.6, z: 25.9 }, rocks: { x: 272.6, z: 33.2 }, lamp: { x: 264, z: 28 },
    socket: { x: 263.0, y: 1.8, z: 26.6, face: Math.PI * 0.85 }, crank: { x: 265.6, z: 26.0 }, cart: { x: 258.5, z: 19.3 }, door: { x: 300, z: 30 }
  },
  cottage: {
    spawn: { x: 0, z: 2.4, yaw: 0 }, bounds: { x0: -3.9, x1: 3.9, z0: -2.9, z1: 2.9, step: 0.2 },
    camera: { dist: 3.0, pitch: 0.36, room: { x0: -4, x1: 4, z0: -3, z1: 3, y1: 2.7 } },
    floors: [rect(-3.9, 3.9, -2.9, 2.9)],
    solids: [wall(-3.9, -2.2, -2.9, -1.6, 1), wall(0.6, 2.0, -0.6, 0.4, 0.8), wall(2.6, 3.9, 1.0, 2.9, 1), wall(-4.4, -3.9, -3.4, 3.4), wall(3.9, 4.4, -3.4, 3.4), wall(-4.4, 4.4, -3.4, -2.9), wall(-4.4, -0.7, 2.9, 3.4), wall(0.7, 4.4, 2.9, 3.4)],
    points: [{ id: 'guitar', x: -1.4, z: -1.0, r: 1.4, y: 1.0 }, { id: 'june', x: 1.4, z: -2.1, r: 1.6, y: 1.6, moving: true }, { id: 'door', x: 0, z: 2.8, r: 1.3, y: 1.4 },
      { id: 'sketches', x: 1.3, z: 0.75, r: 1.2, y: 1.0 }, { id: 'shelf', x: 2.3, z: 1.9, r: 1.2, y: 1.3 }, { id: 'window', x: 0, z: -2.5, r: 1.3, y: 1.5 },
      { id: 'boxA', x: -2.9, z: -0.9, r: 1.2, y: 0.6 }, { id: 'boxB', x: 2.3, z: -1.5, r: 1.2, y: 0.6 }, { id: 'drop', x: 1.2, z: 2.1, r: 1.2, y: 0.4 }, { id: 'gamebox', x: 2.3, z: 1.9, r: 0.95, y: 1.3 }, { id: 'letter', x: 1.3, z: 0.75, r: 0.95, y: 1.0 }],
    guitarSeat: { x: -1.4, z: -1.0 }, juneSeat: { x: -0.32, z: -1.0 }, juneWindow: { x: 1.4, z: -2.3 },
    // RC3: the duet side by side, both turned a little toward a point in front of them. Face to face at 1.5 m (1.0 m after
    // "scoot closer") their seated legs (0.85 m each) went through each other.
    duet: { apart: 1.2, closer: 0.95, focus: 2.5 }   // June's stool (juneSeat) sits between the two, so she is on it in both
  }
};

export const point = (scene, id) => (LAYOUTS[scene].points || []).find((p) => p.id === id) || null;

// The bridge over the canal, one floor strip per plank, from June's bridge.ll. A plank missing from the record
// leaves a real hole you cannot walk across.
export function bridgeFloors(data, progress) {
  if (!data || !data.planks.length) { return []; }
  const n = Math.round(Math.max(0, Math.min(1, progress)) * data.planks.length), out = [];
  for (let i = 0; i < n; i++) { const p = data.planks[i]; out.push(rect(BRIDGE.x - BRIDGE.halfWalk, BRIDGE.x + BRIDGE.halfWalk, BRIDGE.z0 + p.z - 0.03, BRIDGE.z0 + p.z + p.d + 0.03, 0, { plank: i })); }
  if (n) { out.unshift(rect(BRIDGE.x - BRIDGE.halfWalk, BRIDGE.x + BRIDGE.halfWalk, BRIDGE.z0 - 0.2, BRIDGE.z0 + Math.max(0.05, data.planks[0].z), 0)); }
  if (n >= data.planks.length) { const last = data.planks[n - 1]; out.push(rect(BRIDGE.x - BRIDGE.halfWalk, BRIDGE.x + BRIDGE.halfWalk, BRIDGE.z0 + last.z + last.d - 0.03, BRIDGE.z0 + BRIDGE.span + 0.25, 0)); }
  return out;
}

// The coast road as a polyline: position and heading at distance s, and total length.
export function roadInfo() {
  const pts = LAYOUTS.coast.road.points; const seg = []; let L = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push({ a: pts[i - 1], b: pts[i], s0: L, d }); L += d; }
  return {
    length: L,
    at(s) {
      const c = Math.max(0, Math.min(L, s)); const g = seg.find((q) => c <= q.s0 + q.d) || seg[seg.length - 1]; const t = g.d ? (c - g.s0) / g.d : 0;
      const x = g.a[0] + (g.b[0] - g.a[0]) * t, z = g.a[1] + (g.b[1] - g.a[1]) * t, heading = Math.atan2(g.b[0] - g.a[0], g.b[1] - g.a[1]);
      return { x, z, heading, nx: -Math.cos(heading), nz: Math.sin(heading) };   // (nx, nz) points to the road's right
    }
  };
}
