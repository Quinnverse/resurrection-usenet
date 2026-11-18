// P4 level layout: walkable floor, blocking obstacles, spawn points and interaction points for each scene.
// Units are metres. The ground is the XZ plane, y is up. Pure data and geometry, no Three.js and no DOM.
//
// Walkable floor is a union of shapes. Obstacles are subtracted from it. Shapes:
//   { k: 'rect', x0, x1, z0, z1 }   axis-aligned rectangle
//   { k: 'circ', x, z, r }          circle

export const PLAYER_RADIUS = 0.32;

export const SCENES = {
  study: {
    spawn: { x: 0.2, z: 0.9, yaw: 0.25 },
    camera: { dist: 3.3, pitch: 0.42, minPitch: 0.15, maxPitch: 0.95, room: { x0: -4.3, x1: 4.3, z0: -3.3, z1: 3.3, y1: 2.85 } },
    walk: [{ k: 'rect', x0: -4.15, x1: 4.15, z0: -3.15, z1: 3.15 }],
    block: [
      { k: 'rect', x0: 1.85, x1: 4.5, z0: -3.5, z1: -2.35 },    // desk with the CRT
      { k: 'rect', x0: -4.5, x1: -3.9, z0: -2.5, z1: 0.1 },     // bookshelf
      { k: 'rect', x0: -2.45, x1: -1.15, z0: 0.75, z1: 1.85 },  // moving boxes
      { k: 'rect', x0: -4.35, x1: -3.05, z0: 0.85, z1: 1.95 },  // armchair
      { k: 'rect', x0: -3.85, x1: -2.95, z0: 2.15, z1: 2.95 },  // side table
      { k: 'circ', x: -3.9, z: -2.95, r: 0.3 },                 // floor lamp
      { k: 'circ', x: 4.0, z: 3.0, r: 0.4 },                    // plant
      { k: 'rect', x0: 1.15, x1: 1.85, z0: -2.7, z1: -1.95 }    // desk chair, rolled out to the side
    ]
  },
  archive: {
    spawn: { x: 0, z: 0.8, yaw: 0 },
    camera: { dist: 5.2, pitch: 0.36, minPitch: 0.1, maxPitch: 0.9 },
    walk: [
      { k: 'circ', x: 0, z: 0, r: 3.4 },
      { k: 'rect', x0: -1.7, x1: 1.7, z0: -12, z1: 0 },
      { k: 'circ', x: 0, z: -22, r: 11 },
      { k: 'rect', x0: -1.7, x1: 1.7, z0: -41, z1: -32 },
      { k: 'circ', x: 0, z: -43.5, r: 3.6 }
    ],
    block: [
      { k: 'circ', x: -7, z: -27, r: 1.5 },   // alt.games.homebrew
      { k: 'circ', x: 7, z: -27, r: 1.5 },    // rec.music.makers
      { k: 'circ', x: -7, z: -16.5, r: 1.5 }, // comp.archives
      { k: 'circ', x: 7, z: -16.5, r: 1.5 },  // alt.memories
      { k: 'circ', x: 0, z: -22, r: 1.2 },    // plaza beacon
      { k: 'circ', x: -9.3, z: -24.2, r: 0.35 }, { k: 'circ', x: -4.6, z: -24.8, r: 0.35 }, { k: 'circ', x: -6.6, z: -23.3, r: 0.35 },
      { k: 'circ', x: 6.8, z: -23.6, r: 0.35 }, { k: 'circ', x: -4.8, z: -18.0, r: 0.35 }, { k: 'circ', x: 2.2, z: -2.0, r: 0.35 },
      { k: 'circ', x: -1.54, z: 0.11, r: 0.3 }  // doorway post on the landing platform
    ]
  },
  town: {
    spawn: { x: 0, z: -9.2, yaw: Math.PI },
    camera: { dist: 6.2, pitch: 0.34, minPitch: 0.08, maxPitch: 0.95 },
    walk: [
      { k: 'rect', x0: -2.3, x1: 2.3, z0: -15, z1: -6 },
      { k: 'circ', x: 0, z: 0, r: 7.6 },
      { k: 'rect', x0: -2.6, x1: 2.6, z0: 6, z1: 13 },
      { k: 'rect', x0: -12, x1: 13, z0: 11.4, z1: 14.6 },
      { k: 'rect', x0: 11, x1: 16, z0: 11.4, z1: 16 },
      { k: 'circ', x: 16.2, z: 18.4, r: 4.2 },
      { k: 'rect', x0: -1.3, x1: 1.3, z0: 14, z1: 25 }
    ],
    block: [
      { k: 'circ', x: 0, z: 0, r: 1.7 },        // fountain
      { k: 'circ', x: -4.6, z: 2.2, r: 0.65 },  // 1998 copy booth
      { k: 'circ', x: 4.6, z: 2.2, r: 0.65 },   // 2004 copy booth
      { k: 'circ', x: 17.2, z: 19.6, r: 1.85 }, // lighthouse
      { k: 'rect', x0: -6.2, x1: -3.6, z0: 13.95, z1: 14.55 }, // bench by the sea wall
      { k: 'rect', x0: 4.6, x1: 7.2, z0: 13.95, z1: 14.55 },  // bench by the sea wall
      // lamp posts
      { k: 'circ', x: -3.2, z: -7.0, r: 0.12 }, { k: 'circ', x: 3.2, z: -7.0, r: 0.12 }, { k: 'circ', x: -6.6, z: 3.6, r: 0.12 }, { k: 'circ', x: 6.6, z: 3.6, r: 0.12 },
      { k: 'circ', x: -3.1, z: 11.8, r: 0.12 }, { k: 'circ', x: 3.1, z: 11.8, r: 0.12 }, { k: 'circ', x: 10, z: 11.8, r: 0.12 }, { k: 'circ', x: -10, z: 11.8, r: 0.12 }, { k: 'circ', x: 16.3, z: 12.4, r: 0.12 }
    ]
  }
};

// Interaction points. r is the reach in metres from the point to the player. y is the marker height.
// The story module decides which of these are available at any moment.
export const INTERACT = {
  study: [
    { id: 'keepbox', x: -1.8, z: 1.3, r: 1.45, y: 0.9, verb: 'verb.inspect' },
    { id: 'photo', x: 4.2, z: 0.6, r: 1.6, y: 1.65, verb: 'verb.inspect' },
    { id: 'postcard', x: -3.4, z: 2.55, r: 1.35, y: 0.95, verb: 'verb.inspect' },
    { id: 'shelf', x: -4.0, z: -1.2, r: 1.5, y: 1.4, verb: 'verb.inspect' },
    { id: 'window', x: -0.6, z: -3.2, r: 1.5, y: 1.5, verb: 'verb.inspect' },
    { id: 'lamp', x: -3.9, z: -2.95, r: 1.3, y: 1.4, verb: 'verb.toggle' },
    { id: 'computer', x: 3.0, z: -2.75, r: 1.55, y: 1.3, verb: 'verb.use' }
  ],
  archive: [
    { id: 'notice', x: 2.2, z: -2.0, r: 1.5, y: 1.4, verb: 'verb.read' },
    { id: 'pete', x: -9.3, z: -24.2, r: 1.5, y: 1.3, verb: 'verb.read' },
    { id: 'owl', x: -4.6, z: -24.8, r: 1.5, y: 1.3, verb: 'verb.read' },
    { id: 'sky', x: -6.6, z: -23.3, r: 1.5, y: 1.3, verb: 'verb.read' },
    { id: 'june', x: 6.8, z: -23.6, r: 1.5, y: 1.3, verb: 'verb.read' },
    { id: 'mirrorbot', x: -4.8, z: -18.0, r: 1.5, y: 1.3, verb: 'verb.read' },
    { id: 'gate', x: 0, z: -44.5, r: 2.3, y: 2.2, verb: 'verb.enter' }
  ],
  town: [
    { id: 'theo', x: 14.0, z: 16.2, r: 1.8, y: 2.2, verb: 'verb.talk' },
    { id: 'booth98', x: -4.6, z: 2.2, r: 1.75, y: 2.3, verb: 'verb.view' },
    { id: 'booth04', x: 4.6, z: 2.2, r: 1.75, y: 2.3, verb: 'verb.view' },
    { id: 'lighthouse', x: 15.6, z: 18.1, r: 1.9, y: 2.0, verb: 'verb.inspect' },
    { id: 'bakery', x: -5.0, z: -5.6, r: 1.7, y: 2.0, verb: 'verb.inspect' },
    { id: 'mural', x: 5.0, z: -5.6, r: 1.7, y: 2.0, verb: 'verb.inspect' },
    { id: 'pier', x: 0, z: 24.2, r: 1.6, y: 1.2, verb: 'verb.inspect' }
  ]
};

// Where Theo stands. He moves into the lighthouse when he lights it, then comes back.
export const THEO_SPOT = { x: 14.0, z: 16.2 };
export const THEO_DOOR = { x: 15.85, z: 18.35 };

// Waypoint routes used by tests and the scripted playthrough. They are ordinary walking paths.
export const ROUTES = {
  study: { keepbox: [[-0.6, 0.9]], photo: [[2.2, 0.4], [3.4, 0.6]], computer: [[2.4, -0.9], [3.0, -1.75]], postcard: [[-0.4, 2.45], [-2.3, 2.55]], window: [[-0.6, -2.2]], shelf: [[-2.6, -1.2], [-3.2, -1.2]], lamp: [[-2.6, -1.8], [-3.15, -2.3]] },
  archive: { plaza: [[0, -6], [0, -12.5]], sky: [[-3.5, -19.5], [-6.2, -22.6]], gate: [[-3, -20], [0, -31], [0, -40.5], [0, -42.6]] },
  town: {
    plaza: [[0, -6.5], [0, -4.5]],
    theo: [[3.2, 4.2], [1.6, 9.0], [1.6, 12.6], [11.5, 13.0], [13.0, 15.0]],
    booth98: [[-3.3, 3.0]],
    booth04: [[3.3, 3.0]],
    lighthouse: [[3.2, 4.2], [1.6, 9.0], [1.6, 12.6], [11.5, 13.0], [16.0, 16.6]]
  }
};

// Walking graph for the town: nodes joined by straight walkable lines. plan() finds the shortest node path.
export const PATHS = {
  town: {
    nodes: { lane: [0, -6.5], gate: [0, -12.5], plazaW: [-2.9, -1.5], plazaE: [2.9, -1.5], kioskW: [-3.3, 3.0], kioskE: [3.3, 3.0], plazaS: [2.2, 4.6], plazaSW: [-2.2, 4.6],
      road: [1.2, 9.0], roadEnd: [1.6, 13.0], prom: [11.5, 13.0], theo: [13.0, 15.0], promE: [14.6, 13.4], light: [16.0, 16.6], pierFoot: [0, 13.2], pier: [0, 24.4], bakery: [-4.4, -4.6], mural: [4.4, -4.6] },
    edges: [['gate', 'lane'], ['lane', 'plazaW'], ['lane', 'plazaE'], ['lane', 'bakery'], ['lane', 'mural'], ['plazaW', 'kioskW'], ['plazaE', 'kioskE'], ['plazaW', 'bakery'], ['plazaE', 'mural'],
      ['kioskW', 'plazaSW'], ['kioskE', 'plazaS'], ['plazaS', 'plazaSW'], ['plazaS', 'road'], ['plazaSW', 'road'], ['road', 'roadEnd'], ['roadEnd', 'prom'], ['roadEnd', 'pierFoot'], ['pierFoot', 'pier'], ['prom', 'theo'], ['prom', 'promE'], ['promE', 'light'], ['theo', 'promE']]
  }
};
export const GOALS = { town: { theo: 'theo', booth98: 'kioskW', booth04: 'kioskE', lighthouse: 'light', bakery: 'bakery', mural: 'mural', pier: 'pier', plaza: 'lane' } };

// Shortest list of [x, z] waypoints from (x, z) to a node: start at the nearest node with a clear line.
export function plan(sceneId, x, z, goalNode, extraBlock) {
  const G = PATHS[sceneId]; if (!G) { return null; }
  const names = Object.keys(G.nodes);
  const clear = (ax, az, bx, bz) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2); for (let i = 0; i <= n; i++) { const k = i / Math.max(1, n); if (!canStand(sceneId, ax + (bx - ax) * k, az + (bz - az) * k, extraBlock)) { return false; } } return true; };
  const startable = names.filter((n) => clear(x, z, G.nodes[n][0], G.nodes[n][1])).sort((a, b) => Math.hypot(G.nodes[a][0] - x, G.nodes[a][1] - z) - Math.hypot(G.nodes[b][0] - x, G.nodes[b][1] - z));
  if (!startable.length) { return null; }
  const adj = {}; names.forEach((n) => { adj[n] = []; });
  G.edges.forEach(([a, b]) => { const d = Math.hypot(G.nodes[a][0] - G.nodes[b][0], G.nodes[a][1] - G.nodes[b][1]); adj[a].push([b, d]); adj[b].push([a, d]); });
  let best = null;
  for (const start of startable.slice(0, 3)) {
    const dist = { [start]: Math.hypot(G.nodes[start][0] - x, G.nodes[start][1] - z) }, prev = {}, done = new Set();
    for (;;) {
      let u = null; for (const n of Object.keys(dist)) { if (!done.has(n) && (u === null || dist[n] < dist[u])) { u = n; } }
      if (u === null || u === goalNode) { break; }
      done.add(u);
      for (const [v, d] of adj[u]) { if (dist[v] === undefined || dist[u] + d < dist[v]) { dist[v] = dist[u] + d; prev[v] = u; } }
    }
    if (dist[goalNode] !== undefined && (!best || dist[goalNode] < best.d)) { const path = []; let n = goalNode; while (n) { path.unshift(G.nodes[n]); n = prev[n]; } best = { d: dist[goalNode], path }; }
  }
  return best ? best.path : null;
}

function inside(shape, x, z, pad) {
  if (shape.k === 'rect') { return x >= shape.x0 - pad && x <= shape.x1 + pad && z >= shape.z0 - pad && z <= shape.z1 + pad; }
  const dx = x - shape.x, dz = z - shape.z;
  return dx * dx + dz * dz <= (shape.r + pad) * (shape.r + pad);
}

// True when a player of radius PLAYER_RADIUS can stand at (x, z).
export function canStand(sceneId, x, z, extraBlock) {
  const sc = SCENES[sceneId];
  // The whole body circle must be on the floor: test the centre and 8 points on the rim against the walkable union.
  const pts = [[0, 0]];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; pts.push([Math.cos(a) * PLAYER_RADIUS, Math.sin(a) * PLAYER_RADIUS]); }
  for (const [ox, oz] of pts) {
    if (!sc.walk.some((s) => inside(s, x + ox, z + oz, 0))) { return false; }
  }
  const blocks = extraBlock ? sc.block.concat(extraBlock) : sc.block;
  return !blocks.some((s) => inside(s, x, z, PLAYER_RADIUS));
}

// Moves from (x, z) by (dx, dz) with sliding along walls. Returns the new position.
export function move(sceneId, x, z, dx, dz, extraBlock) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05));
  let px = x, pz = z;
  const sx = dx / steps, sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    if (canStand(sceneId, px + sx, pz + sz, extraBlock)) { px += sx; pz += sz; continue; }
    if (canStand(sceneId, px + sx, pz, extraBlock)) { px += sx; continue; }
    if (canStand(sceneId, px, pz + sz, extraBlock)) { pz += sz; continue; }
    break;
  }
  return { x: px, z: pz };
}

// Nearest available interaction point within reach, or null. available(id) decides which are active.
export function nearest(sceneId, x, z, available) {
  let best = null, bestD = Infinity;
  for (const o of INTERACT[sceneId]) {
    if (available && !available(o.id)) { continue; }
    const d = Math.hypot(o.x - x, o.z - z);
    if (d <= o.r && d < bestD) { best = o; bestD = d; }
  }
  return best;
}

export function point(sceneId, id) { return INTERACT[sceneId].find((o) => o.id === id) || null; }
