// V5 scenes beyond the town and the study: the station and its train, the carriage interior, the coast road with
// the half-built lighthouse and the cliff, and the cliffside cottage. Coordinates match core/layout.js.
// Low-poly, procedural, in the same palette and material language as the town (render/kit.js).
import { THREE, PAL, mat, glow, box, cyl, cone, ball, mesh, rng, canvasTex, redraw, FONT, panel, glowSprite, skyDome } from './kit.js';
import { LAYOUTS, roadInfo } from '../core/layout.js';
import { trainTarget, STARS, dirOf } from '../core/toys.js';

function lights(scene, o, sunPos, target, size) {
  const hemi = new THREE.HemisphereLight(0xffe0c0, 0x4a5a4a, 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc080, 3.0); sun.position.copy(sunPos); sun.target.position.copy(target);
  sun.castShadow = true; sun.shadow.mapSize.set(o.shadow || 1024, o.shadow || 1024);
  Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 160 }); sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  return { hemi, sun };
}
const TIMES = {
  morning: { sky: ['#5a7ad8', '#8ab0f0', '#ffd8b0', '#ffe8c0', '#fff6e0'], fog: 0xffe4c4, hemi: 0xfff0d8, ground: 0x6a8a5a, sun: 0xffd8a0, sunI: 3.2, sea: 0x4aa8d8 },
  noon: { sky: ['#3a78d8', '#6aa8f0', '#a8d8ff', '#e0f0ff', '#fff8e8'], fog: 0xd8ecff, hemi: 0xfff8f0, ground: 0x6a8a5a, sun: 0xfff0d0, sunI: 3.6, sea: 0x3f9ad8 },
  dusk: { sky: ['#3b3f98', '#7a63c0', '#e07aa0', '#ff9a68', '#ffd28a'], fog: 0xf0a080, hemi: 0xffd0b0, ground: 0x4a5a5a, sun: 0xff9a60, sunI: 2.6, sea: 0x4a78b8 },
  evening: { sky: ['#1c1e48', '#3a3a78', '#7a5a8a', '#c87a6a', '#e8a070'], fog: 0x6a5a78, hemi: 0xc8a8c0, ground: 0x2a2a3a, sun: 0xff8a50, sunI: 1.4, sea: 0x2a4a78 },
  y2004: { sky: ['#2c3a5e', '#4c5f88', '#8a9cb8', '#c0c4d0', '#dcd8d4'], fog: 0xc0c4cc, hemi: 0xd0d8e4, ground: 0x4a5a5a, sun: 0xe0e4f0, sunI: 2.0, sea: 0x3f6a90 }
};

// ---- station and train ------------------------------------------------------------------------------------------
export function buildStation(opts) {
  const o = opts || {}; const scene = new THREE.Scene(); const R = rng(21); const blockers = [];
  const skies = {}; Object.entries(TIMES).forEach(([k, v]) => { skies[k] = skyDome(v.sky, 300); skies[k].visible = false; scene.add(skies[k]); });
  scene.fog = new THREE.Fog(0xffe4c4, 40, 200);
  const L = lights(scene, o, new THREE.Vector3(-20, 30, -40), new THREE.Vector3(0, 0, 0), 40);
  const groundMat = mat(PAL.grass, { unique: true }); scene.add(mesh(new THREE.PlaneGeometry(200, 60), groundMat, 0, -1.02, 20, { rx: -Math.PI / 2, cast: false }));
  const seaMat = mat(PAL.sea, { unique: true }); scene.add(mesh(new THREE.PlaneGeometry(400, 200), seaMat, 0, -1.4, 140, { rx: -Math.PI / 2, cast: false }));
  // platform
  scene.add(box(70, 1.0, 4.4, 0xd8cdb8, 1, -1.0, -0.2, { cast: false }), box(70, 0.04, 0.3, 0xf0d040, 1, 0.0, 1.85, { cast: false }));
  for (let x = -34; x < 36; x += 1.4) { scene.add(box(0.02, 0.012, 4.2, 0xc4b8a0, x, 0.0, -0.2, { cast: false })); }
  const backWall = box(72, 3.6, 0.3, 0xe8dcc4, 1, 0, -2.6); scene.add(backWall); blockers.push(backWall);
  // canopy
  for (let x = -30; x <= 32; x += 6) { scene.add(cyl(0.08, 0.1, 3.4, 6, 0x3a4a5a, x, 0, -2.0)); }
  scene.add(box(66, 0.14, 3.2, 0x3a5a7a, 1, 3.3, -1.2, { rx: -0.08 }));
  // benches, lamps, signs, flowers
  [[-13, -2.1], [-1, -2.1], [19, -2.1]].forEach(([x, z]) => { scene.add(box(2.0, 0.08, 0.5, PAL.woodL, x, 0.45, z), box(2.0, 0.5, 0.08, PAL.woodL, x, 0.55, z - 0.22), box(0.08, 0.45, 0.45, 0x2a3040, x - 0.9, 0, z), box(0.08, 0.45, 0.45, 0x2a3040, x + 0.9, 0, z)); });
  const flowers = new THREE.Group(); scene.add(flowers);
  for (let x = -28; x < 34; x += 7) { flowers.add(box(1.2, 0.4, 0.4, PAL.woodL, x, 0, -2.25)); [0, 1, 2, 3].forEach((i) => flowers.add(ball(0.1, 0, [0xff7aa8, 0xffd27a, 0xffffff, 0xe85a6a][i], x - 0.45 + i * 0.3, 0.5, -2.25))); }
  const signTex = canvasTex(512, 128, (ctx, w, h) => { ctx.fillStyle = '#2a4a6a'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fdf8ef'; ctx.font = `bold 54px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('LAST LIGHT', w / 2, 62); ctx.font = `28px ${FONT}`; ctx.fillText('coast line', w / 2, 104); });
  [-20, 10].forEach((x) => { const sg = panel(3.2, 0.8, signTex, 0x2a4a6a, { lit: true }); sg.position.set(x, 2.5, -2.42); scene.add(sg); });
  // the soda machine (orange soda, two buttons) and June's suitcase
  const kiosk = new THREE.Group(); kiosk.position.set(-8.0, 0, -2.05); scene.add(kiosk);
  kiosk.add(box(1.3, 1.9, 0.6, 0xe0703a, 0, 0, 0), box(0.9, 0.9, 0.04, 0xfff0d8, -0.1, 0.8, 0.31, { mat: { emissive: 0xffd8a0, ei: 0.35 } }), box(0.14, 0.1, 0.04, 0xffffff, 0.45, 1.1, 0.31), box(0.14, 0.1, 0.04, 0xffffff, 0.45, 0.92, 0.31), box(0.6, 0.16, 0.06, 0x2a2a30, 0, 0.25, 0.31));
  for (let i = 0; i < 4; i++) { kiosk.add(cyl(0.07, 0.07, 0.2, 8, 0xf29a3a, -0.4 + i * 0.2, 1.0, 0.3)); }
  const suitcase = new THREE.Group(); suitcase.position.set(-5.0, 0, -1.55); scene.add(suitcase);
  suitcase.add(box(0.7, 0.5, 0.24, 0x8a4a3a, 0, 0, 0), box(0.2, 0.06, 0.05, 0x2a2a30, 0, 0.52, 0), box(0.72, 0.05, 0.26, 0xd8a050, 0, 0.25, 0));
  const dropped = suitcase.clone(); dropped.position.set(-2.2, 0, 1.25); dropped.visible = false; scene.add(dropped);
  // the luggage cart you vault over
  const cart = new THREE.Group(); cart.position.set(4.7, 0, -0.2); scene.add(cart);
  cart.add(box(1.4, 0.12, 4.4, 0x6a5a4a, 0, 0.46, 0), box(1.3, 0.12, 0.12, 0x3a3a40, 0, 0.1, 2.0), box(1.3, 0.12, 0.12, 0x3a3a40, 0, 0.1, -2.0));
  [[-0.3, 1.2, 0x8a4a3a], [0.2, -0.6, 0x3f7cc4], [-0.1, 0.4, 0xd9a050]].forEach(([dx, dz, c]) => cart.add(box(0.7, 0.36, 0.9, c, dx, 0.58, dz)));
  // tracks
  for (let x = -60; x < 80; x += 0.9) { scene.add(box(0.2, 0.08, 2.6, 0x5a4a3a, x, -0.98, 3.6, { cast: false })); }
  [2.9, 4.3].forEach((z) => scene.add(box(140, 0.08, 0.08, 0x8a8a92, 10, -0.9, z, { cast: false })));
  // the train: locomotive and three carriages; carriage 2's door is the one June holds
  const train = new THREE.Group(); scene.add(train);
  const carMat = mat(0xd6443c, { unique: true }), carTrim = mat(0xfdf8ef);
  for (let c = 0; c < 3; c++) {
    const cx = -c * 9.4; const car = new THREE.Group(); car.position.x = cx; train.add(car);
    car.add(mesh(new THREE.BoxGeometry(9, 2.6, 2.6), carMat, 0, 0.35, 3.6)); car.add(mesh(new THREE.BoxGeometry(9.1, 0.18, 2.7), carTrim, 0, 1.6, 3.6));
    for (let i = -3; i <= 3; i++) { if (i === 0) { continue; } car.add(box(0.9, 0.7, 0.04, 0xbfe0f0, i * 1.2, 1.5, 2.29, { mat: { emissive: 0xffd8a0, ei: 0.25 } })); }
    car.add(box(1.0, 2.0, 0.05, c === 1 ? 0x3a2a2a : 0x8a2a2a, 0, 0.35, 2.29));
    [-3, 3].forEach((wx) => { car.add(cyl(0.45, 0.45, 0.2, 10, 0x2a2a30, wx, -0.5, 2.4, { rx: Math.PI / 2 })); });
  }
  const loco = new THREE.Group(); loco.position.x = 9.6; train.add(loco);
  loco.add(mesh(new THREE.BoxGeometry(9, 2.8, 2.6), mat(0x2f5d8a), 0, 0.45, 3.6), cyl(0.5, 0.6, 1.2, 8, 0x2a2a30, 2.8, 2.2, 3.6), box(2.6, 1.4, 2.8, 0x23476a, -2.8, 2.2, 3.6));
  const smoke = []; for (let i = 0; i < 10; i++) { const sm = ball(0.4 + i * 0.05, 1, 0xf4f0ea, 12.4, 3.4, 3.6, { cast: false }); sm.userData.ph = i / 10; scene.add(sm); smoke.push(sm); }
  const doorX = -9.4;                                                          // carriage 2 door, in train coordinates
  // things only the summer has
  const bunting = new THREE.Group(); scene.add(bunting);
  for (let i = 0; i <= 30; i++) { const x = -30 + i * 2.1; bunting.add(mesh(new THREE.ConeGeometry(0.16, 0.34, 3), mat([0xd6443c, 0xffd27a, 0x3f7cc4, 0x6fe0a0, 0xff9ac0][i % 5], { side: THREE.DoubleSide }), x, 2.9 - Math.sin((i % 6) / 6 * Math.PI) * 0.35, -0.4, { rx: Math.PI, cast: false })); }
  const lampG = []; for (let x = -24; x <= 30; x += 12) { const p = new THREE.Group(); p.position.set(x, 0, 1.4); scene.add(p); p.add(cyl(0.05, 0.07, 2.6, 6, 0x2a3040, 0, 0, 0), box(0.24, 0.3, 0.24, 0xfff0c0, 0, 2.6, 0, { mat: { emissive: 0xffc070, ei: 1.2 } })); const gl = glowSprite(0xffc070, 1.4, 0.0); gl.position.y = 2.7; p.add(gl); lampG.push(gl); }
  let time = 'morning';
  const api = {
    scene, blockers, train, doorX,
    setTime(tm) {
      time = tm; const T = TIMES[tm] || TIMES.morning;
      Object.entries(skies).forEach(([k, v]) => { v.visible = k === tm; });
      scene.fog.color.set(T.fog); L.hemi.color.set(T.hemi); L.hemi.groundColor.set(T.ground); L.sun.color.set(T.sun); L.sun.intensity = T.sunI; seaMat.color.set(T.sea);
      const y04 = tm === 'y2004'; bunting.visible = !y04; flowers.visible = !y04; carMat.color.set(y04 ? 0x8a8e98 : 0xd6443c);
      lampG.forEach((g) => { g.material.opacity = tm === 'dusk' || tm === 'evening' ? 0.6 : 0; });
      if (tm === 'dusk') { L.sun.position.set(-40, 8, 60); }
    },
    setSuitcase(where) { suitcase.visible = where === 'bench'; dropped.visible = where === 'door'; },
    setTrain(x, visible) { train.position.x = x - doorX; train.visible = visible !== false; smoke.forEach((s2) => { s2.visible = train.visible; }); },
    update(dt, t, reduce) {
      smoke.forEach((s2) => { const k = (t * 0.4 + s2.userData.ph) % 1; s2.position.set(train.position.x + 12.4 - k * 4, 3.4 + k * 3, 3.6 + Math.sin(k * 6) * 0.3); s2.scale.setScalar(0.6 + k * 1.4); s2.visible = train.visible && !reduce; });
    }
  };
  api.setTime('morning');
  return api;
}

// ---- inside the carriage -----------------------------------------------------------------------------------------
export function buildCarriage(opts) {
  const o = opts || {}; const scene = new THREE.Scene(); const R = rng(31);
  scene.background = new THREE.Color(0x9ad0f0); scene.fog = new THREE.Fog(0xcfe8ff, 20, 120);
  const L = lights(scene, o, new THREE.Vector3(30, 20, 5), new THREE.Vector3(0, 0, 0), 8); L.hemi.intensity = 1.35;
  const wallMat = mat(0xf2e6d0), seatMat = mat(0x3f6f8a), wood = mat(PAL.woodL);
  scene.add(mesh(new THREE.BoxGeometry(2.8, 0.06, 12), mat(0x6b4128), 0, 0, 0, { cast: false }), mesh(new THREE.BoxGeometry(2.8, 0.06, 12), mat(0xf8f0e0), 0, 2.3, 0, { cast: false }));
  [-1.4, 1.4].forEach((x) => {
    // walls with window gaps every 1.6 m
    for (let z = -6; z < 6; z += 1.6) { scene.add(mesh(new THREE.BoxGeometry(0.06, 0.9, 1.6), wallMat, x, 0.45, z + 0.8), mesh(new THREE.BoxGeometry(0.06, 0.5, 1.6), wallMat, x, 2.05, z + 0.8), mesh(new THREE.BoxGeometry(0.06, 0.9, 0.3), wallMat, x, 1.35, z + 0.15)); }
  });
  scene.add(mesh(new THREE.BoxGeometry(2.8, 2.3, 0.06), wallMat, 0, 1.15, -6), mesh(new THREE.BoxGeometry(2.8, 2.3, 0.06), wallMat, 0, 1.15, 6));
  // facing seats with a little table
  [[-0.55, 0.6, Math.PI], [0.55, -0.6, 0], [-0.55, -0.6, 0], [0.55, 0.6, Math.PI]].forEach(([x, z, r]) => { const s2 = new THREE.Group(); s2.position.set(x, 0, z); s2.rotation.y = r; scene.add(s2); s2.add(mesh(new THREE.BoxGeometry(0.9, 0.12, 0.55), seatMat, 0, 0.45, 0), mesh(new THREE.BoxGeometry(0.9, 0.75, 0.12), seatMat, 0, 0.5, -0.3)); });
  scene.add(mesh(new THREE.BoxGeometry(2.2, 0.05, 0.5), wood, 0, 0.72, 0), cyl(0.04, 0.04, 0.7, 6, 0x6b4128, 0, 0, 0));
  scene.add(cyl(0.03, 0.03, 0.12, 8, 0xd8e6ee, 0.4, 0.75, 0.1), box(0.18, 0.02, 0.12, 0xfff6e0, -0.3, 0.75, 0.05, { ry: 0.3 }));   // a cup, a ticket
  // outside: sea on one side, meadows and poles on the other, scrolling past
  const outside = new THREE.Group(); scene.add(outside);
  outside.add(mesh(new THREE.PlaneGeometry(200, 400), mat(0x3f9ad8), 60, -1.2, 0, { rx: -Math.PI / 2, cast: false }), mesh(new THREE.PlaneGeometry(200, 400), mat(PAL.grass), -60, -0.6, 0, { rx: -Math.PI / 2, cast: false }));
  const passing = [];
  for (let i = 0; i < 22; i++) { const side = i % 2 ? 1 : -1; const p = side > 0 ? cyl(0.06, 0.06, 3, 5, 0x6b4128, 6 + R() * 2, -0.5, -60 + i * 6) : ball(1 + R(), 0, PAL.grassD, -7 - R() * 6, 0, -60 + i * 6); outside.add(p); passing.push(p); }
  const sun = glowSprite(0xfff0c0, 30, 0.8); sun.position.set(80, 25, -40); scene.add(sun);
  // the dares: the real lighthouse on the cape (sea side) and a kite (land side), placed by core/toys.js
  const cape = new THREE.Group(); scene.add(cape);
  cape.add(mesh(new THREE.CylinderGeometry(6, 9, 3, 10), mat(PAL.stoneD), 0, -1.5, 0), cyl(0.9, 1.2, 8, 10, PAL.white, 0, 0, 0), cyl(1.0, 1.0, 1.0, 10, PAL.red, 0, 2.5, 0), cyl(1.0, 1.0, 1.0, 10, PAL.red, 0, 5.0, 0), cone(1.1, 1.2, 10, 0x2a3040, 0, 8.4, 0));
  const capeGlow = glowSprite(0xfff0b0, 5, 0.7); capeGlow.position.y = 8; cape.add(capeGlow);
  const kite = new THREE.Group(); scene.add(kite);
  const kiteBody = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), mat(0xe4506f, { side: THREE.DoubleSide })); kiteBody.scale.set(1, 1.4, 0.15); kite.add(kiteBody);
  for (let i = 0; i < 5; i++) { kite.add(box(0.35, 0.12, 0.04, [0xffd27a, 0x3f7cc4, 0xffffff][i % 3], 0, -1.8 - i * 0.6, 0, { cast: false })); }
  // the tunnel: the light goes, the carriage lamps come on
  const lampsIn = new THREE.PointLight(0xffd8a0, 0, 8, 1.4); lampsIn.position.set(0, 2.1, 0); scene.add(lampsIn);
  const tunnel = mesh(new THREE.CylinderGeometry(4, 4, 200, 12, 1, true), mat(0x1a1612, { side: THREE.BackSide }), 0, 0.5, 0, { rx: Math.PI / 2, cast: false }); tunnel.visible = false; scene.add(tunnel);
  const sky0 = scene.background.clone(); let inTunnel = false;
  return {
    scene, blockers: [], seat: LAYOUTS.train.seat, juneSeat: LAYOUTS.train.june,
    setOutside(t) { const a = trainTarget('lighthouse', t), b = trainTarget('kite', t); cape.position.set(a.x, -2.5, a.z); kite.position.set(b.x, b.y, b.z); kite.rotation.z = Math.sin(t * 2) * 0.25; },
    setTunnel(on) { inTunnel = !!on; tunnel.visible = inTunnel; outside.visible = cape.visible = kite.visible = sun.visible = !inTunnel; scene.background.copy(inTunnel ? new THREE.Color(0x0c0a08) : sky0); L.hemi.intensity = inTunnel ? 0.25 : 1.35; L.sun.intensity = inTunnel ? 0 : 3.0; lampsIn.intensity = inTunnel ? 6 : 0; scene.fog.color.set(inTunnel ? 0x0c0a08 : 0xcfe8ff); },
    update(dt, t, reduce) { if (reduce) { return; } passing.forEach((p) => { p.position.z += dt * 14; if (p.position.z > 60) { p.position.z -= 132; } }); }
  };
}

// ---- the coast: road, half-built lighthouse, the windy ledge, the beach, the cottage ----------------------------
export function buildCoast(opts) {
  const o = opts || {}; const scene = new THREE.Scene(); const R = rng(41); const blockers = [];
  const sky = skyDome(TIMES.noon.sky, 420); scene.add(sky); const skyNight = skyDome(['#05060f', '#0b1030', '#1a2050', '#2a2a5a', '#3a3460'], 420); skyNight.visible = false; scene.add(skyNight);
  const sky04 = skyDome(TIMES.y2004.sky, 420); sky04.visible = false; scene.add(sky04); scene.fog = new THREE.Fog(0xd8ecff, 60, 300);
  const L = lights(scene, o, new THREE.Vector3(200, 60, -60), new THREE.Vector3(262, 0, 24), 40);
  const road = roadInfo();
  // grass everywhere at the top of the cliff, but not over the beach below it (x 271..313, z 5..51)
  const grassMat = mat(PAL.grass, { unique: true });
  [[-220, 271, -90, 210], [271, 480, -90, 5], [271, 480, 51, 210], [313, 480, 5, 51]].forEach(([x0, x1, z0, z1]) => scene.add(mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), grassMat, (x0 + x1) / 2, -0.03, (z0 + z1) / 2, { rx: -Math.PI / 2, cast: false })));
  scene.add(mesh(new THREE.PlaneGeometry(260, 300), mat(0x3f9ad8), 450, -6.0, 60, { rx: -Math.PI / 2, cast: false }));   // open sea east of the beach
  const sea = mesh(new THREE.PlaneGeometry(900, 500), mat(0x3f9ad8, { unique: true }), 130, -6.2, -240, { rx: -Math.PI / 2, cast: false }); scene.add(sea);
  // the cliff edge on the sea side of the road
  scene.add(mesh(new THREE.BoxGeometry(700, 6, 4), mat(PAL.stoneD), 130, -3.0, -18, { cast: false }));
  // road strip
  const segs = 220, pos = [], idx = [];
  for (let i = 0; i <= segs; i++) { const p = road.at((i / segs) * road.length); [-2.5, 2.5].forEach((d) => pos.push(p.x + p.nx * d, 0.01, p.z + p.nz * d)); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setIndex(idx); rg.computeVertexNormals();
  const roadMesh = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: 0xd8c8a8, roughness: 0.95, side: THREE.DoubleSide, flatShading: true })); roadMesh.receiveShadow = true; scene.add(roadMesh);
  // posts, fences, wildflowers, a few trees along the way
  for (let s = 6; s < road.length; s += 8) { const p = road.at(s); const side = 3.2; const q = { x: p.x - p.nx * side, z: p.z - p.nz * side }; scene.add(cyl(0.05, 0.05, 0.9, 4, PAL.woodD, q.x, 0, q.z)); if (s % 24 < 8) { const t2 = ball(1.0 + R() * 0.8, 0, PAL.grassD, p.x + p.nx * (6 + R() * 6), 0.6, p.z + p.nz * (6 + R() * 6)); scene.add(t2); } if (R() < 0.5) { scene.add(ball(0.08, 0, [0xff7aa8, 0xffd27a, 0xffffff][Math.floor(R() * 3)], p.x + p.nx * (3 + R() * 2), 0.1, p.z + p.nz * (3 + R() * 2), { cast: false })); } }
  // the lighthouse yard
  const Y = LAYOUTS.coast;
  scene.add(mesh(new THREE.CylinderGeometry(10, 10.2, 0.1, 32), mat(0xc9bfae), 262, -0.04, 24, { cast: false }));
  scene.add(box(4.2, 0.1, 4, 0xc9bfae, 268.1, -0.04, 16, { cast: false }));
  // stairs down the cliff (a ramp with steps drawn on it) and the beach below
  for (let i = 0; i < 12; i++) { scene.add(box(0.36, 0.2, 4, 0xb8a888, 270 + i * 0.34, -i * 0.42 - 0.1, 16, { cast: false })); }
  scene.add(mesh(new THREE.BoxGeometry(44, 5, 46), mat(PAL.stoneD), 250, -2.6, 27, { cast: false }));
  scene.add(mesh(new THREE.PlaneGeometry(42, 46), mat(PAL.sand), 292, -5.0, 28, { rx: -Math.PI / 2, cast: false }));
  scene.add(box(2.1, 0.1, 2.6, 0xc9bfae, 269.55, -0.04, 19.2, { cast: false }));   // the landing at the top of the stairs
  // the ribbon gates June dares Elena through
  const gates = new THREE.Group(); scene.add(gates);
  LAYOUTS.coast.ride.gates.forEach((gt, i) => {
    const p = road.at(gt.s); const cx = p.x + p.nx * gt.d, cz = p.z + p.nz * gt.d; const g2 = new THREE.Group(); g2.position.set(cx, 0, cz); g2.rotation.y = p.heading + Math.PI / 2; gates.add(g2);
    [-1.0, 1.0].forEach((o2) => g2.add(cyl(0.05, 0.05, 2.2, 5, PAL.woodL, o2, 0, 0)));
    for (let k = 0; k < 6; k++) { g2.add(box(0.06, 0.7, 0.02, [0xff9ac0, 0xffd27a, 0x6fe0a0, 0x9fd6ff][(k + i) % 4], -0.85 + k * 0.34, 1.75, 0, { cast: false })); }
    g2.add(box(2.1, 0.04, 0.04, 0xfff6e0, 0, 2.15, 0, { cast: false }));
  });
  // the windy ledge: a wooden lip with ribbons
  scene.add(box(2, 0.12, 10, PAL.woodL, 272.5, -0.06, 29));
  const ribbons = []; for (let i = 0; i < 4; i++) { const pole = cyl(0.04, 0.04, 1.6, 4, PAL.woodD, 273.4, 0, 25 + i * 2.8); scene.add(pole); const rb = box(0.8, 0.06, 0.02, [0xff9ac0, 0xffd27a, 0x6fe0a0, 0x9fd6ff][i], 273.8, 1.5, 25 + i * 2.8, { cast: false }); scene.add(rb); ribbons.push(rb); }
  // the unfinished lighthouse with a frame for the window
  const lh = new THREE.Group(); lh.position.set(264, 0, 28); scene.add(lh);
  const tower = mesh(new THREE.CylinderGeometry(1.5, 1.8, 7, 12), mat(PAL.white), 0, 3.5, 0); lh.add(tower); blockers.push(tower);
  lh.add(mesh(new THREE.CylinderGeometry(1.62, 1.7, 0.8, 12), mat(PAL.red), 0, 1.0, 0));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; lh.add(cyl(0.05, 0.05, 8, 4, PAL.woodL, Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2)); }
  lh.add(cyl(1.7, 1.7, 0.16, 12, 0x2a3040, 0, 7, 0));
  const lampGlow = glowSprite(0xffd27a, 9, 0); lampGlow.position.set(0, 7.6, 0); lh.add(lampGlow);
  const lampLight = new THREE.PointLight(0xffd890, 0, 50, 1.2); lampLight.position.set(0, 7.6, 0); lh.add(lampLight);
  const beam = new THREE.Group(); beam.position.set(0, 7.6, 0); beam.visible = false; lh.add(beam);
  [0, Math.PI].forEach((a) => { const b2 = new THREE.Mesh(new THREE.ConeGeometry(2.0, 40, 16, 1, true), glow(0xfff0b0, { additive: true, opacity: 0.16, side: THREE.DoubleSide })); b2.rotation.z = Math.PI / 2; b2.position.x = 20; const arm = new THREE.Group(); arm.rotation.y = a; arm.add(b2); beam.add(arm); });
  const lens = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffd27a, emissiveIntensity: 0.05, flatShading: true })); lens.position.set(0, 7.6, 0); lh.add(lens);
  const socket = new THREE.Group(); socket.position.set(Y.socket.x, Y.socket.y, Y.socket.z); socket.rotation.y = Math.atan2(Y.socket.x - 264, Y.socket.z - 28); scene.add(socket);
  const socketFrame = box(1.3, 1.6, 0.1, 0x6b4128, 0, -0.8, -0.02); socket.add(socketFrame);
  const ghost = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.25, depthWrite: false })); ghost.position.z = 0.04; socket.add(ghost);
  const windowSlot = new THREE.Group(); windowSlot.position.z = 0.06; socket.add(windowSlot);
  // the pulley that lifts the lens to the gallery, and the gallery June stands on
  const Yp = Y.pulley, Yg = Y.gallery;
  const pulley = new THREE.Group(); pulley.position.set(Yp.x, 0, Yp.z); scene.add(pulley);
  pulley.add(box(0.12, 2.0, 0.12, PAL.woodD, 0, 0, 0), cyl(0.18, 0.18, 0.1, 10, 0x8a8a92, 0, 1.9, 0, { rx: Math.PI / 2 }));
  const ropeUp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 4), mat(0xd8c8a0)); scene.add(ropeUp);
  scene.add(box(1.6, 0.08, 0.9, PAL.woodL, Yg.x, Yg.y - 0.05, Yg.z, { cast: false }));
  const lensBox = new THREE.Group(); scene.add(lensBox); lensBox.add(box(0.5, 0.4, 0.5, 0xb08a5a, 0, 0, 0), mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffd27a, emissiveIntensity: 0.3, flatShading: true }), 0, 0.32, 0));
  const lensAt = (k) => { const x = Yp.x + (Yg.x - Yp.x) * k, z = Yp.z + (Yg.z - Yp.z) * k, y = 0.3 + (Yg.y + 0.3 - 0.3) * k; lensBox.position.set(x, y, z); const top = new THREE.Vector3(Yp.x, 2.0, Yp.z), end = lensBox.position.clone().add(new THREE.Vector3(0, 0.25, 0)); ropeUp.position.copy(top.clone().lerp(end, 0.5)); ropeUp.scale.y = Math.max(0.1, top.distanceTo(end)); ropeUp.lookAt(end); ropeUp.rotateX(Math.PI / 2); };
  lensAt(0);
  // June's porch seat outside the cottage, for the stars
  const porch = new THREE.Group(); porch.position.set(297.7, -5, 31.3); scene.add(porch);
  porch.add(box(2.2, 0.08, 0.5, PAL.woodL, 0, 0.45, 0), box(0.08, 0.45, 0.45, PAL.woodD, -1.0, 0, 0), box(0.08, 0.45, 0.45, PAL.woodD, 1.0, 0, 0));
  // June's constellation: five stars and the lines between those found
  const seat = LAYOUTS.porch.seat; const starG = new THREE.Group(); starG.visible = false; scene.add(starG);
  const starPos = STARS.map((st) => { const d = dirOf(st); return new THREE.Vector3(seat.x + d.x * 180, seat.y + d.y * 180, seat.z + d.z * 180); });
  const starSprites = starPos.map((p, i) => { const sp2 = glowSprite(0xfff8e0, i === 0 ? 9 : 6, 0.95); sp2.position.copy(p); starG.add(sp2); return sp2; });
  const field = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 900 }, (_, i) => { const k = Math.floor(i / 3), a = R() * Math.PI * 2, e = 0.12 + R() * 1.2; const d = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)]; return [seat.x, seat.y, seat.z][i % 3] + d[i % 3] * 220; }), 3)), new THREE.PointsMaterial({ color: 0xdde4ff, size: 1.2, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false })); starG.add(field);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.9 }); let lines = null;
  // the crank, June's cart
  const crank = new THREE.Group(); crank.position.set(Y.crank.x, 0, Y.crank.z); scene.add(crank); crank.add(box(0.4, 1.0, 0.4, 0x3a4a5a, 0, 0, 0)); const handle = new THREE.Group(); handle.position.y = 0.9; crank.add(handle); handle.add(box(0.5, 0.06, 0.06, 0x8a8a92, 0.25, 0, 0), box(0.06, 0.25, 0.06, 0x8a8a92, 0.5, 0, 0));
  const cart = new THREE.Group(); cart.position.set(Y.cart.x, 0, Y.cart.z); scene.add(cart);
  cart.add(box(1.8, 0.5, 1.2, PAL.woodL, 0, 0.3, 0), cyl(0.25, 0.25, 0.1, 10, 0x2a2a30, -0.7, 0.25, 0.65, { rx: Math.PI / 2 }), cyl(0.25, 0.25, 0.1, 10, 0x2a2a30, 0.7, 0.25, 0.65, { rx: Math.PI / 2 }));
  const cartWindow = box(0.9, 1.1, 0.06, 0xfff4d6, 0, 1.15, 0, { rx: -0.3 }); cart.add(cartWindow);
  cart.add(box(0.3, 0.2, 0.2, 0x8a4a3a, 0.6, 0.65, -0.3), box(0.25, 0.04, 0.35, 0xd8c8a0, -0.5, 0.57, -0.2));
  // two bicycles
  const bike = (color) => { const g = new THREE.Group(); [-0.5, 0.5].forEach((z) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.04, 5, 16), mat(0x2a2a30)); w.rotation.y = Math.PI / 2; w.position.set(0, 0.36, z); g.add(w); }); g.add(box(0.06, 0.06, 1.0, color, 0, 0.6, 0, { rx: 0.2 }), box(0.06, 0.5, 0.06, color, 0, 0.6, -0.15), box(0.24, 0.05, 0.1, 0x2a2a30, 0, 0.88, -0.2), box(0.5, 0.04, 0.04, 0x8a8a92, 0, 0.92, 0.45)); return g; };
  const bikeE = bike(0xf2ad3d), bikeJ = bike(0x6fb8a8); scene.add(bikeE, bikeJ);
  // the cottage on the beach
  const cot = new THREE.Group(); cot.position.set(303, -5, 30); scene.add(cot);
  cot.add(box(6, 3, 5, 0xe8dcc4, 0, 0, 0), mesh(new THREE.ConeGeometry(4.4, 2, 4), mat(PAL.roofA), 0, 4, 0, { ry: Math.PI / 4 }), box(0.9, 1.8, 0.1, PAL.woodD, -3.02, 0, 0, { ry: Math.PI / 2 }), box(1.0, 0.8, 0.06, 0xffe0a0, -3.02, 1.6, 1.4, { ry: Math.PI / 2, mat: { emissive: 0xffc070, ei: 0.6 } }));
  blockers.push(cot.children[0]);
  const ribbonT = { t: 0 }; let beamAngle = null, era = 1998, time = 'noon';
  const only98 = [cart, bikeE, bikeJ, gates, pulley, ropeUp, lensBox, ...ribbons];
  const api0 = {
    setBeamAngle(a) { beamAngle = a; },
    setLens(k, done) { lensAt(done ? 1 : Math.max(0, Math.min(1, k))); lensBox.visible = era === 1998 && !done; ropeUp.visible = era === 1998 && !done; },
    setStars(n) { if (lines) { starG.remove(lines); lines = null; } if (n > 1) { lines = new THREE.Line(new THREE.BufferGeometry().setFromPoints(starPos.slice(0, n)), lineMat); starG.add(lines); } starSprites.forEach((sp2, i) => { sp2.material.opacity = i < n ? 1 : 0.75; sp2.scale.setScalar(i < n ? 9 : (i === n ? 7.5 : 5.5)); }); },
    // noon (1998 day), night (1998, the porch) or 2004 (the same coast six years later, grey and unlit)
    setTime(tm, year) {
      time = tm; era = year || 1998;
      sky.visible = tm === 'noon'; skyNight.visible = tm === 'night'; sky04.visible = tm === 'y2004'; starG.visible = tm === 'night';
      const T = tm === 'night' ? { fog: 0x1a2040, hemi: 0x8090c0, ground: 0x202030, sun: 0x8090c0, sunI: 0.25, hemiI: 0.45, grass: 0x3a5a4a } : tm === 'y2004' ? { fog: 0xc0c4cc, hemi: 0xd0d8e4, ground: 0x4a5a5a, sun: 0xe0e4f0, sunI: 1.8, hemiI: 1.0, grass: 0x6a9070 } : { fog: 0xd8ecff, hemi: 0xffe0c0, ground: 0x4a5a4a, sun: 0xffc080, sunI: 3.0, hemiI: 1.0, grass: PAL.grass };
      scene.fog.color.set(T.fog); L.hemi.color.set(T.hemi); L.hemi.groundColor.set(T.ground); L.hemi.intensity = T.hemiI; L.sun.color.set(T.sun); L.sun.intensity = T.sunI; grassMat.color.set(T.grass);
      only98.forEach((x) => { x.visible = era === 1998; });
      if (era !== 1998) { ghost.visible = false; }
    }
  };
  return {
    scene, blockers, bikeE, bikeJ, cart, cartWindow, lh, socket, ghost, ...api0,
    setWindow(meshGroup) { while (windowSlot.children.length) { windowSlot.remove(windowSlot.children[0]); } if (meshGroup) { windowSlot.add(meshGroup); } ghost.visible = !meshGroup && era === 1998; cartWindow.visible = false; },
    showCartWindow(on) { cartWindow.visible = !!on; },
    setLit(on, lamp) { const c = lamp && lamp.color ? parseInt(lamp.color, 16) : 0xffd890; lampGlow.material.opacity = on ? 0.85 : 0; lampLight.intensity = on ? 90 : 0; lampLight.color.set(c); beam.visible = !!on; lens.material.emissiveIntensity = on ? 2.2 : 0.05; this.lampSpeed = lamp ? lamp.speed : 0.6; },
    crankAngle(a) { handle.rotation.z = a; },
    setBikes(e, j) { if (e) { bikeE.position.set(e.x, 0, e.z); bikeE.rotation.set(0, e.heading, e.lean || 0); } if (j) { bikeJ.position.set(j.x, 0, j.z); bikeJ.rotation.set(0, j.heading, 0); } bikeE.visible = !!e; bikeJ.visible = !!j; },
    update(dt, t, reduce) { ribbonT.t += dt; ribbons.forEach((r2, i) => { r2.rotation.y = reduce ? 0.2 : Math.sin(t * 6 + i) * 0.4; }); if (beam.visible) { beam.rotation.y = beamAngle === null ? t * (reduce ? 0.25 : (this.lampSpeed || 0.6)) : beamAngle; } }
  };
}

// ---- the cliffside cottage ----------------------------------------------------------------------------------------
export function buildCottage(opts) {
  const o = opts || {}; const scene = new THREE.Scene(); const R = rng(51); const blockers = [];
  scene.background = new THREE.Color(0x1c1e30); scene.fog = new THREE.Fog(0x2a2438, 10, 30);
  const hemi = new THREE.HemisphereLight(0xffd8b0, 0x2a1a22, 0.6); scene.add(hemi);
  const lamp = new THREE.PointLight(0xffb870, 9, 9, 1.6); lamp.position.set(-2.4, 1.9, -0.4); lamp.castShadow = true; lamp.shadow.mapSize.set(512, 512); scene.add(lamp);
  const winLight = new THREE.DirectionalLight(0xa8c0ff, 0.6); winLight.position.set(0, 3, -8); scene.add(winLight);
  const wall = mat(0xe8d4b4, { unique: true }), woodM = mat(PAL.wood);
  for (let i = 0; i < 14; i++) { scene.add(box(0.57, 0.04, 6, i % 2 ? PAL.wood : 0x8d5a3a, -3.9 + i * 0.57 + 0.28, -0.04, 0, { cast: false })); }
  const W = (w, h, x, y, z, ry) => { const m = mesh(new THREE.PlaneGeometry(w, h), wall, x, y, z, { ry, cast: false }); scene.add(m); blockers.push(m); return m; };
  W(8, 2.7, 0, 1.35, 3, Math.PI); W(6, 2.7, -4, 1.35, 0, Math.PI / 2); W(6, 2.7, 4, 1.35, 0, -Math.PI / 2);
  W(3, 2.7, -2.5, 1.35, -3, 0); W(3, 2.7, 2.5, 1.35, -3, 0); W(2, 0.8, 0, 0.4, -3, 0); W(2, 0.6, 0, 2.4, -3, 0);
  scene.add(mesh(new THREE.PlaneGeometry(8, 6), mat(0xd9bf98), 0, 2.7, 0, { rx: Math.PI / 2, cast: false }));
  // the window over the sea
  const view = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6), new THREE.MeshBasicMaterial({ color: 0x3a4a78 })); view.position.set(0, 1.4, -3.6); scene.add(view);
  const moon = glowSprite(0xf4f0ff, 1.4, 0.8); moon.position.set(0.6, 2.0, -3.5); scene.add(moon);
  scene.add(box(2.1, 0.08, 0.2, PAL.white, 0, 0.8, -2.95), box(0.06, 1.4, 0.1, PAL.white, 0, 0.8, -2.97));
  // the door
  const door = box(1.2, 2.1, 0.08, PAL.woodD, 0, 0, 2.95); scene.add(door);
  // furniture
  const bed = new THREE.Group(); bed.position.set(-3.05, 0, -2.25); scene.add(bed); bed.add(box(1.7, 0.45, 1.3, 0x7a5a8a, 0, 0, 0), box(1.7, 0.12, 1.3, 0xf4ece0, 0, 0.45, 0));
  const table = new THREE.Group(); table.position.set(1.3, 0, -0.1); scene.add(table); table.add(box(1.4, 0.06, 1.0, PAL.woodL, 0, 0.72, 0), box(0.06, 0.72, 0.06, PAL.woodD, -0.62, 0, -0.42), box(0.06, 0.72, 0.06, PAL.woodD, 0.62, 0, 0.42), box(0.06, 0.72, 0.06, PAL.woodD, -0.62, 0, 0.42), box(0.06, 0.72, 0.06, PAL.woodD, 0.62, 0, -0.42));
  const sketches = new THREE.Group(); table.add(sketches); for (let i = 0; i < 5; i++) { sketches.add(box(0.3, 0.005, 0.22, 0xfff6e0, -0.4 + i * 0.2, 0.76, (R() - 0.5) * 0.3, { ry: R() - 0.5, cast: false })); }
  const shelf = new THREE.Group(); shelf.position.set(3.25, 0, 1.95); scene.add(shelf); shelf.add(box(1.2, 1.8, 1.8, PAL.woodD, 0, 0, 0)); for (let i = 0; i < 8; i++) { shelf.add(box(0.2, 0.3, 0.06, [0xd6443c, 0x3f7cc4, 0xe0a83a, 0x4fa36b][i % 4], -0.4 + (i % 4) * 0.25, 0.3 + Math.floor(i / 4) * 0.6, 0.92)); }
  const chair = box(0.5, 0.45, 0.5, PAL.woodL, -1.4, 0, -1.0); scene.add(chair); const stool = cyl(0.22, 0.2, 0.45, 8, PAL.woodL, 0, 0, -1.6); scene.add(stool);
  const lampStand = new THREE.Group(); lampStand.position.set(-2.4, 0, -0.4); scene.add(lampStand); lampStand.add(cyl(0.03, 0.03, 1.6, 5, 0x2a2a30, 0, 0, 0), cone(0.25, 0.3, 8, 0xffe0a8, 0, 1.6, 0, { mat: { emissive: 0xffb860, ei: 0.8 } }));
  // 2004: dust sheets and a suitcase by the door
  const sheets = new THREE.Group(); scene.add(sheets);
  sheets.add(box(1.8, 0.6, 1.4, 0xe8e4dc, -3.05, 0, -2.25), box(1.5, 0.85, 1.1, 0xe8e4dc, 1.3, 0, -0.1)); const suitcase = box(0.6, 0.45, 0.2, 0x2f3a5a, 0.9, 0, 2.5); sheets.add(suitcase);
  // 2004: two boxes to carry, the studio's letter, the game box, the crooked window she kept
  const mkBox = (c) => { const g2 = new THREE.Group(); g2.add(box(0.55, 0.4, 0.4, c, 0, 0, 0), box(0.56, 0.04, 0.12, 0xd8c8a0, 0, 0.4, 0)); return g2; };
  const boxes = { boxA: mkBox(0xb08a5a), boxB: mkBox(0xa07a4a) }; const home = { boxA: [-2.9, -0.9], boxB: [2.3, -1.5] }, placedAt = { boxA: [1.0, 2.25, 0], boxB: [1.0, 2.25, 0.42] };
  Object.entries(boxes).forEach(([k, b]) => { b.position.set(home[k][0], 0, home[k][1]); sheets.add(b); });
  const letter = box(0.22, 0.01, 0.3, 0xfdf8ef, 1.3, 0.92, 0.2, { ry: 0.3, cast: false }); sheets.add(letter);
  const gamebox = box(0.3, 0.4, 0.06, 0x2f5d8a, 2.65, 1.25, 1.6, { ry: -Math.PI / 2 }); sheets.add(gamebox);
  const kept = new THREE.Group(); kept.position.set(-0.9, 0, -2.75); kept.rotation.set(-0.15, 0.2, 0.08); sheets.add(kept);
  kept.add(box(0.9, 1.15, 0.06, 0x3f7cc4, 0, 0.58, 0), box(0.72, 0.95, 0.03, 0xdde8f0, 0, 0.6, 0.03));
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 240 }, (_, i) => (i % 3 === 1 ? 0.3 + R() * 2.2 : (R() - 0.5) * 7)), 3)), new THREE.PointsMaterial({ color: 0xfff0d0, size: 0.02, transparent: true, opacity: 0.5, depthWrite: false })); scene.add(dust);
  const api = {
    scene, blockers,
    // where each box is: 'floor', 'carried' (in someone's arms, drawn on the person) or 'placed' (stacked by the door)
    setBoxes(st) { Object.entries(boxes).forEach(([k, b]) => { const w = st[k] || 'floor'; b.visible = w !== 'carried'; const q = w === 'placed' ? placedAt[k] : [home[k][0], 0, home[k][1]]; b.position.set(q[0], w === 'placed' ? q[2] : 0, w === 'placed' ? q[1] : q[2]); }); },
    setEra(year) {
      const y04 = year === 2004;
      sheets.visible = y04; sketches.visible = !y04; bed.visible = !y04; table.visible = true;
      lamp.intensity = y04 ? 0 : 9; hemi.intensity = y04 ? 1.1 : 0.6; hemi.color.set(y04 ? 0xd0d8e8 : 0xffd8b0); winLight.intensity = y04 ? 2.0 : 0.6; winLight.color.set(y04 ? 0xe8eef8 : 0xa8c0ff);
      view.material.color.set(y04 ? 0x9ab0c8 : 0x3a4a78); moon.visible = !y04; scene.background.set(y04 ? 0x8a98a8 : 0x1c1e30); scene.fog.color.set(y04 ? 0xa8b4c4 : 0x2a2438); wall.color.set(y04 ? 0xd8d4cc : 0xe8d4b4);
    },
    update(dt, t, reduce) { if (!reduce) { dust.rotation.y = t * 0.02; } }
  };
  api.setEra(1998);
  return api;
}
