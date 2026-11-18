// V5 town of "Last Light", built from P4/P5 Summer Town pieces and driven by the scene graph (core/archive.js).
// P5 notes kept below for the shared parts. Layout matches levels.js:
// arrival lane (z -15..-6), plaza (r 7.6), the road south to the canal (z 8.4..11.6), June's bridge, the promenade,
// the old pier (x 0, z 14..25) and the rocky point with the lighthouse (17.2, 19.6).
//
// Two builds come from two manifests. Every object below that differs between them is tagged with an asset id from
// those manifests; setBuild() shows exactly the assets the current manifest lists. levels.js tags the walkable floor
// and obstacles with the same ids, so what you see and what you can walk on always change together.
import { THREE, PAL, mat, glow, box, cyl, cone, ball, mesh, rng, canvasTex, redraw, FONT, panel, glowSprite, label, skyDome } from './kit.js';
import { makeTheo, makeCast, animate as animatePerson } from './people.js';
import { THEO_TOWN as THEO, BRIDGE, CANAL, PIER, IRIS_TOWN } from '../core/layout.js';

function roofGeo(w, d, h) {
  const shape = new THREE.Shape(); shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, h); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }); g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2);
  return g;
}
function house(spec) {
  const { w, d, h, wall, roof, door, shop } = spec;
  const g = new THREE.Group();
  const body = box(w, h, d, wall, 0, 0, 0); g.add(body);
  const r = mesh(roofGeo(w + 0.4, d + 0.5, 1.2 + d * 0.15), mat(roof), 0, h, 0); g.add(r);
  g.add(box(w + 0.1, 0.18, d + 0.1, 0xe8dcc8, 0, 0, 0, { cast: false }));
  g.add(box(0.36, 0.8, 0.36, 0xb8664a, w * 0.28, h + 0.5, -d * 0.15));
  g.add(box(0.8, 1.45, 0.08, door || PAL.woodD, shop ? -w * 0.22 : 0, 0.05, d / 2 + 0.02));
  g.add(ball(0.04, 0, PAL.gold, (shop ? -w * 0.22 : 0) + 0.26, 0.8, d / 2 + 0.07));
  const winMat = mat(0x9fd0e8, { emissive: 0xffc070, ei: 0.25 });
  const cols = shop ? [w * 0.18] : [-w * 0.3, w * 0.3];
  cols.forEach((x) => { g.add(box(shop ? w * 0.42 : 0.7, shop ? 0.9 : 0.7, 0.06, winMat, x, shop ? 0.55 : 0.75, d / 2 + 0.03)); g.add(box((shop ? w * 0.42 : 0.7) + 0.16, 0.08, 0.14, PAL.white, x, shop ? 0.5 : 0.7, d / 2 + 0.06)); });
  if (h > 3) { [-w * 0.3, w * 0.3].forEach((x) => g.add(box(0.62, 0.62, 0.06, winMat, x, h - 1.1, d / 2 + 0.03))); }
  const flowers = new THREE.Group(); g.add(flowers);
  if (!shop) { flowers.add(box(0.8, 0.16, 0.2, PAL.woodL, -w * 0.3, 0.55, d / 2 + 0.12)); [0, 1, 2].forEach((i) => flowers.add(ball(0.08, 0, [0xff7aa8, 0xffd27a, 0xffffff][i], -w * 0.3 - 0.25 + i * 0.25, 0.78, d / 2 + 0.14))); }
  if (shop) { for (let i = 0; i < 6; i++) { g.add(box(w / 6, 0.05, 0.9, i % 2 ? 0xffffff : spec.awning, -w / 2 + w / 12 + (i * w) / 6, 1.85, d / 2 + 0.45, { rx: 0.35 })); } }
  g.userData = { body, roof: r, flowers };
  return g;
}
function signDraw(text, bg, fg, sub) {
  return (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#6b4128'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${text.length > 14 ? 34 : text.length > 10 ? 42 : 52}px ${FONT}`; ctx.fillText(text, w / 2, h / 2 - (sub ? 12 : 0));
    if (sub) { ctx.font = `22px ${FONT}`; ctx.fillText(sub, w / 2, h / 2 + 34); }
  };
}
function muralDraw(build) {
  return (ctx, w, h) => {
    if (build === '2004') { ctx.fillStyle = '#efe6d4'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(0,0,0,0.04)'; for (let y = 0; y < h; y += 18) { ctx.fillRect(0, y, w, 9); } return; }
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7ab8e8'); g.addColorStop(0.6, '#ffd8a0'); g.addColorStop(1, '#3f8fd0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9a6340'; ctx.fillRect(0, h * 0.68, w, h * 0.12);
    const girl = (x, hair, coat) => {
      ctx.fillStyle = coat; ctx.fillRect(x - 34, h * 0.36, 68, h * 0.32);
      ctx.fillStyle = '#f6d2aa'; ctx.beginPath(); ctx.arc(x, h * 0.28, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(x, h * 0.25, 32, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#241a3a'; ctx.fillRect(x - 12, h * 0.27, 6, 8); ctx.fillRect(x + 6, h * 0.27, 6, 8); ctx.fillStyle = '#c0504a'; ctx.fillRect(x - 8, h * 0.32, 16, 4);
    };
    girl(w * 0.36, '#4b3568', '#f2ad3d'); girl(w * 0.62, '#c0602a', '#5fb0c8');
    ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(w * 0.36 + 30, h * 0.44); ctx.lineTo(w * 0.86, h * 0.1); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 34px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText('E + J  summer 98', 24, h - 24);
  };
}
function noticeDraw(build) {
  return (ctx, w, h) => {
    if (build === '1998') {
      ctx.fillStyle = '#f6e7c4'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.fillStyle = '#c0443c'; ctx.font = `bold 46px ${FONT}`; ctx.fillText('LAST LIGHT', 30, 70);
      ctx.fillStyle = '#3a2a5a'; ctx.font = `28px ${FONT}`; ctx.fillText('town  junebug', 34, 130); ctx.fillText('code  skylark', 34, 170); ctx.fillText('summer 1998 :)', 34, 220);
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(w - 60, h - 60, 26, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#e8ecf0'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#3a4a68'; ctx.fillRect(0, 0, w, 54);
      ctx.fillStyle = '#ffffff'; ctx.font = `bold 34px ${FONT}`; ctx.fillText('LAST LIGHT 1.0', 24, 40);
      ctx.fillStyle = '#3a4a68'; ctx.font = `28px ${FONT}`; ctx.fillText('by skylark', 34, 130); ctx.fillText('2004', 34, 176);
    }
  };
}

export function buildTown(opts) {
  const o = opts || {};
  const scene = new THREE.Scene();
  const R = rng(5);
  const anchors = {}, blockers = [];
  const tagged = [];                              // [object, assetId]: visible only when the build lists the asset
  const tag = (obj, asset) => { tagged.push([obj, asset]); return obj; };
  const only98 = [], only04 = [];                 // presentation that is not a manifest asset (sky, light)

  // ---- sky and light ---------------------------------------------------------------------------------
  const sky98 = skyDome(['#5a6ad0', '#9a8ae0', '#ffb0a0', '#ffc070', '#fff0b0'], 319);
  const sky04 = skyDome(['#2c3a6e', '#4c5f98', '#8a9cc8', '#c8c4d8', '#e8dcd0'], 318);
  scene.add(sky98, sky04); only98.push(sky98); only04.push(sky04);
  scene.fog = new THREE.Fog(0xffc890, 40, 170);
  const hemi = new THREE.HemisphereLight(0xffd8b8, 0x4a6a5a, 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb070, 3.0);
  sun.position.set(-18, 22, 40); sun.target.position.set(4, 0, 6);
  sun.castShadow = true; sun.shadow.mapSize.set(o.shadow || 1536, o.shadow || 1536);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 5, far: 110 }); sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const sunDisc = glowSprite(0xfff0c0, 40, 0.9); sunDisc.position.set(-30, 18, 160); scene.add(sunDisc);
  const sunCore = new THREE.Mesh(new THREE.CircleGeometry(7, 32), glow(0xfff4d0, { fog: false })); sunCore.position.set(-30, 18, 165); sunCore.lookAt(0, 0, 0); scene.add(sunCore);
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group(); const a = -1.2 + (i / 8) * 2.4; const d = 120 + R() * 40;
    c.position.set(Math.sin(a) * d, 28 + R() * 18, Math.cos(a) * d * 0.8 + 20);
    for (let j = 0; j < 4; j++) { c.add(ball(4 + R() * 4, 1, 0xfff0e8, (j - 1.5) * 6, R() * 2, R() * 3, { cast: false, mat: { emissive: 0xffc0a0, ei: 0.35 } })); }
    c.lookAt(0, 30, 0); scene.add(c);
  }

  // ---- ground, roads, canal, promenade, sea ------------------------------------------------------------
  const grassMat = mat(PAL.grass, { unique: true });
  scene.add(mesh(new THREE.PlaneGeometry(90, 49.4), grassMat, 0, -0.02, CANAL.z0 - 24.7, { rx: -Math.PI / 2, cast: false }));
  scene.add(mesh(new THREE.PlaneGeometry(90, 18), grassMat, 0, -0.02, CANAL.z1 + 9, { rx: -Math.PI / 2, cast: false }));
  const cobble = mat(PAL.stone), cobbleD = mat(PAL.stoneD);
  scene.add(mesh(new THREE.CylinderGeometry(7.9, 7.9, 0.06, 40), cobble, 0, 0, 0, { cast: false }));
  scene.add(mesh(new THREE.TorusGeometry(7.9, 0.12, 4, 48), cobbleD, 0, 0.04, 0, { rx: Math.PI / 2, cast: false }));
  for (let r2 = 2.6; r2 < 7.6; r2 += 1.25) { scene.add(mesh(new THREE.TorusGeometry(r2, 0.03, 3, 48), cobbleD, 0, 0.035, 0, { rx: Math.PI / 2, cast: false })); }
  scene.add(box(4.8, 0.06, 9.4, PAL.stone, 0, 0, -10.6, { cast: false }));
  scene.add(box(5.4, 0.06, CANAL.z0 - 5.6, PAL.stone, 0, 0, (5.6 + CANAL.z0) / 2, { cast: false }));
  scene.add(box(5.4, 0.06, 13.2 - CANAL.z1, PAL.stone, 0, 0, (CANAL.z1 + 13.2) / 2, { cast: false }));
  scene.add(box(26, 0.08, 2.9, 0xd8c8a8, 0.5, 0, 13.25, { cast: false }));
  // canal: a water strip with stone banks right across the town
  const canalW = CANAL.z1 - CANAL.z0;
  scene.add(box(90, 0.1, canalW, 0x3a4a5a, 0, -1.1, (CANAL.z0 + CANAL.z1) / 2, { cast: false }));
  const waterMat = mat(0x4aa0c8, { rough: 0.2, metal: 0.1, unique: true });
  const water = mesh(new THREE.PlaneGeometry(90, canalW, 60, 4), waterMat, 0, -0.42, (CANAL.z0 + CANAL.z1) / 2, { rx: -Math.PI / 2, cast: false }); scene.add(water);
  const waterBase = water.geometry.attributes.position.array.slice();
  [CANAL.z0, CANAL.z1].forEach((z, i) => {
    scene.add(box(90, 0.75, 0.3, PAL.stoneD, 0, -0.68, z + (i ? 0.15 : -0.15), { cast: false }));
    scene.add(box(90, 0.1, 0.4, PAL.stone, 0, 0.0, z + (i ? 0.2 : -0.2), { cast: false }));
  });
  // abutments at both ends of the bridge
  [CANAL.z0 - 0.2, CANAL.z1 + 0.2].forEach((z) => { [-1.25, 1.25].forEach((x) => { scene.add(box(0.4, 0.55, 0.5, PAL.stoneD, x, 0, z)); scene.add(ball(0.12, 0, PAL.stone, x, 0.62, z)); }); });
  // sea wall: continuous in 2004, with an opening for the old pier in 1998
  const wallFull = box(26, 0.3, 0.3, 0xb8a888, 0.5, 0, 14.75, { cast: false }); scene.add(wallFull); tag(wallFull, 'seawall');
  const wallGap = new THREE.Group(); scene.add(wallGap); tag(wallGap, 'seawall_gap');
  wallGap.add(box(11.25, 0.3, 0.3, 0xb8a888, -6.825, 0, 14.75, { cast: false }), box(12.25, 0.3, 0.3, 0xb8a888, 7.325, 0, 14.75, { cast: false }));
  scene.add(mesh(new THREE.PlaneGeometry(80, 10, 1, 1), mat(PAL.sand), 0, -0.35, 19.5, { rx: -Math.PI / 2 + 0.07, cast: false }));
  const seaGeo = new THREE.PlaneGeometry(320, 200, o.low ? 40 : 70, o.low ? 26 : 44); seaGeo.rotateX(-Math.PI / 2);
  const seaBase = seaGeo.attributes.position.array.slice();
  const seaMat = mat(PAL.sea, { rough: 0.25, metal: 0.1, unique: true });
  const sea = mesh(seaGeo, seaMat, 0, -0.62, 112, { cast: false }); scene.add(sea);

  // ---- arrival gate ------------------------------------------------------------------------------------
  const arrival = new THREE.Group(); arrival.position.set(0, 0, -15.8); scene.add(arrival);
  arrival.add(box(0.4, 3.2, 0.4, PAL.woodD, -1.6, 0, 0), box(0.4, 3.2, 0.4, PAL.woodD, 1.6, 0, 0), box(3.8, 0.4, 0.5, PAL.woodD, 0, 3.1, 0));
  const creditTex = canvasTex(512, 110, signDraw('LAST LIGHT', '#fdf8ef', '#c0443c', 'by skylark'));
  const arrivalSign = panel(2.6, 0.55, creditTex, 0xfdf8ef, { lit: true }); arrivalSign.position.set(0, 3.55, 0.28); arrival.add(arrivalSign);
  [-2.65, 2.65].forEach((x) => { for (let z = -14.5; z < -7; z += 1.4) { scene.add(ball(0.62, 1, PAL.grassD, x, 0.45, z, { s: 1, cast: true })); } });

  // ---- houses ------------------------------------------------------------------------------------------
  const houses = [];
  function place(h, x, z, fx, fz) { h.position.set(x, 0, z); h.lookAt(fx, 0, fz); scene.add(h); blockers.push(h.userData.body); houses.push(h); return h; }
  const bakery = place(house({ w: 4.2, d: 3.6, h: 3.4, wall: PAL.houseB, roof: PAL.roofA, shop: true, awning: 0xe85a6a }), -7.2, -8.4, 0, -2);
  const muralHouse = place(house({ w: 4.4, d: 3.6, h: 3.0, wall: PAL.houseD, roof: PAL.roofB }), 7.2, -8.4, 0, -2);
  place(house({ w: 3.6, d: 3.4, h: 3.6, wall: PAL.houseC, roof: PAL.roofC }), -10.2, -1.2, 0, 0);
  place(house({ w: 3.8, d: 3.2, h: 3.0, wall: PAL.houseA, roof: PAL.roofD }), 10.4, -1.0, 0, 0);
  place(house({ w: 3.6, d: 3.4, h: 3.2, wall: PAL.houseD, roof: PAL.roofB }), -9.2, 5.6, 0, 0);
  place(house({ w: 3.6, d: 3.2, h: 3.8, wall: PAL.houseB, roof: PAL.roofA, shop: true, awning: 0x3f7cc4 }), 9.0, 5.8, 0, 0);
  place(house({ w: 3.0, d: 2.8, h: 2.6, wall: PAL.houseC, roof: PAL.roofA }), -5.2, -12.2, 0, -12.2);
  place(house({ w: 3.0, d: 2.8, h: 2.8, wall: PAL.houseA, roof: PAL.roofB }), 5.2, -12.2, 0, -12.2);
  houses.forEach((h2) => { tag(h2.userData.flowers, 'bunting'); });          // 2004 is tidier: no window boxes
  const signTex = canvasTex(512, 128, signDraw('BAKERY', '#fdf8ef', '#c0443c'));
  const bakerySign = panel(2.8, 0.7, signTex, 0xfdf8ef, { lit: true }); bakerySign.position.set(0, 2.55, 1.86); bakery.add(bakerySign);
  bakery.add(box(0.9, 0.5, 0.5, PAL.woodL, 1.3, 0, 2.1), ball(0.16, 0, 0xd9a050, 1.15, 0.62, 2.05), ball(0.14, 0, 0xc08040, 1.45, 0.6, 2.15));
  anchors.bakery = bakery;
  const muralTex = canvasTex(512, 320, muralDraw('1998'));
  const mural = panel(3.6, 2.25, muralTex, 0x9ac0e8, { lit: true }); mural.position.set(0, 1.55, 1.83); muralHouse.add(mural);
  anchors.mural = muralHouse;

  // ---- plaza: fountain, notice board ---------------------------------------------------------------------
  const fountain = new THREE.Group(); scene.add(fountain);
  fountain.add(cyl(1.7, 1.8, 0.55, 16, PAL.stone, 0, 0, 0), cyl(1.45, 1.45, 0.05, 16, PAL.sea, 0, 0.45, 0, { mat: { rough: 0.2 } }));
  fountain.add(cyl(0.25, 0.35, 1.3, 8, PAL.stoneD, 0, 0.5, 0), cyl(0.8, 0.6, 0.18, 12, PAL.stone, 0, 1.6, 0), cyl(0.65, 0.65, 0.04, 12, PAL.sea, 0, 1.73, 0));
  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 8, 1, true), glow(0xd8f0ff, { opacity: 0.55, side: THREE.DoubleSide })); spout.position.set(-0.12, 2.1, 0); spout.rotation.z = 0.25; fountain.add(spout);
  const fish = ball(0.18, 0, 0xffb347, 0, 1.95, 0); fountain.add(fish);
  blockers.push(fountain.children[0]); anchors.fountain = fountain;
  const notice = new THREE.Group(); notice.position.set(-4.6, 0, 2.6); notice.lookAt(0, 0, 0); scene.add(notice);
  notice.add(cyl(0.06, 0.07, 1.4, 6, PAL.woodD, -0.55, 0, 0), cyl(0.06, 0.07, 1.4, 6, PAL.woodD, 0.55, 0, 0));
  const noticeTex = canvasTex(512, 300, noticeDraw('1998'));
  const noticePanel = panel(1.3, 0.78, noticeTex, 0xf6e7c4, { lit: true }); noticePanel.position.set(0, 1.62, 0.05); notice.add(noticePanel);
  notice.add(box(1.42, 0.9, 0.06, PAL.woodD, 0, 1.17, -0.01));
  anchors.notice = notice;

  // ---- lamp posts, benches, bunting, palms, boats --------------------------------------------------------
  const lampGlows = [];
  [[-3.2, -7.0], [3.2, -7.0], [-6.6, 3.6], [6.6, 3.6], [-3.1, 12.0], [3.4, 12.0], [10, 12.0], [-10, 12.0]].forEach(([x, z]) => {
    const p = new THREE.Group(); p.position.set(x, 0, z); scene.add(p);
    p.add(cyl(0.06, 0.09, 3.0, 6, 0x2a3040, 0, 0, 0), box(0.36, 0.05, 0.36, 0x2a3040, 0, 2.98, 0), cone(0.3, 0.22, 4, 0x2a3040, 0, 3.36, 0, { ry: Math.PI / 4 }));
    p.add(box(0.26, 0.34, 0.26, 0xfff0c0, 0, 3.02, 0, { mat: { emissive: 0xffc070, ei: 1.4 } }));
    const gl = glowSprite(0xffc070, 1.8, 0.55); gl.position.y = 3.2; p.add(gl); lampGlows.push(gl);
  });
  [[-4.9, 14.25], [5.9, 14.25]].forEach(([x, z]) => { const b = new THREE.Group(); b.position.set(x, 0, z); scene.add(b); b.add(box(2.4, 0.08, 0.5, PAL.woodL, 0, 0.45, 0), box(2.4, 0.5, 0.08, PAL.woodL, 0, 0.55, -0.25), box(0.1, 0.45, 0.45, 0x2a3040, -1.0, 0, 0), box(0.1, 0.45, 0.45, 0x2a3040, 1.0, 0, 0)); });
  const bunting = new THREE.Group(); scene.add(bunting); tag(bunting, 'bunting');
  const flagCols = [0xd6443c, 0xffd27a, 0x3f7cc4, 0x6fe0a0, 0xff9ac0];
  [[[-7.2, 3.6, -6.0], [7.2, 3.6, -6.0]], [[-8.0, 3.6, 4.8], [8.0, 3.6, 4.8]], [[-9.0, 3.4, 12.2], [9.0, 3.4, 12.2]]].forEach(([a, b]) => {
    for (let i = 0; i <= 14; i++) {
      const t2 = i / 14; const x = a[0] + (b[0] - a[0]) * t2, z = a[2] + (b[2] - a[2]) * t2, y = a[1] - Math.sin(t2 * Math.PI) * 0.7;
      bunting.add(mesh(new THREE.ConeGeometry(0.16, 0.36, 3), mat(flagCols[i % 5], { side: THREE.DoubleSide }), x, y - 0.18, z, { rx: Math.PI, cast: false }));
    }
  });
  function palm(x, z, s) {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(s || 1); scene.add(p);
    for (let i = 0; i < 6; i++) { const seg = cyl(0.14 - i * 0.012, 0.16 - i * 0.012, 0.7, 6, i % 2 ? PAL.woodL : PAL.wood, i * 0.06, i * 0.66, 0, { rz: -0.06 }); p.add(seg); blockers.push(seg); }
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const leaf = box(0.35, 0.05, 1.8, i % 2 ? PAL.grass : PAL.grassD, 0.4 + Math.cos(a) * 0.8, 4.0, Math.sin(a) * 0.8); leaf.lookAt(0.4 + Math.cos(a) * 3, 3.2, Math.sin(a) * 3); p.add(leaf); }
  }
  palm(-8, 15.6, 1); palm(-14, 16.5, 1.1); palm(7.5, 15.8, 0.95); palm(-6.0, 7.4, 1.0); palm(-12, 9.6, 1.05);
  function boat(x, z, ry, c) {
    const b = new THREE.Group(); b.position.set(x, -0.55, z); b.rotation.y = ry; scene.add(b);
    b.add(box(1.4, 0.5, 3.2, c, 0, 0, 0), box(1.5, 0.08, 3.3, PAL.white, 0, 0.5, 0), cone(0.7, 1.0, 4, c, 0, 0, 1.9, { rx: Math.PI / 2 }), cyl(0.04, 0.04, 2.4, 5, PAL.woodD, 0, 0.5, -0.2));
    const sail = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.0, 3), mat(0xfff8ee, { side: THREE.DoubleSide })); sail.position.set(0, 1.7, -0.1); sail.scale.set(1, 1, 0.05); b.add(sail);
    return b;
  }
  const boats = [boat(-4.4, 20.5, 0.3, 0x3f7cc4), boat(-5, 27, -0.5, 0xd6443c)];
  const canalBoat = boat(-6.5, (CANAL.z0 + CANAL.z1) / 2, Math.PI / 2, 0xffd27a); canalBoat.scale.setScalar(0.6); canalBoat.position.y = -0.55;

  // ---- the old pier (1998) and the closed pier (2004) ----------------------------------------------------
  const pierOld = new THREE.Group(); scene.add(pierOld); tag(pierOld, 'pier_old');
  [[PIER.near1998[0], PIER.near1998[1]], [PIER.far1998[0], PIER.far1998[1]]].forEach(([a, b]) => {
    pierOld.add(box(2.6, 0.12, b - a, PAL.woodL, 0, -0.06, (a + b) / 2));
    for (let z = a + 0.3; z < b; z += 0.7) { pierOld.add(box(2.6, 0.02, 0.06, PAL.woodD, 0, 0.0, z, { cast: false })); }
    [-1.2, 1.2].forEach((x) => pierOld.add(box(0.06, 0.06, b - a, PAL.woodD, x, 0.85, (a + b) / 2)));
  });
  for (let i = 0; i < 4; i++) { pierOld.add(box(2.4, 0.06, 0.18, PAL.woodL, (i % 2 ? 0.3 : -0.3), -0.5 - i * 0.1, PIER.near1998[1] + 0.6 + i * 0.9, { rz: 0.2 })); }   // planks June had not nailed down yet, floating
  for (let z = 15; z < 25.5; z += 2.2) { [-1.2, 1.2].forEach((x) => pierOld.add(cyl(0.05, 0.05, 0.9, 5, PAL.woodD, x, 0, z))); }
  const carved = cyl(0.16, 0.16, 1.1, 7, PAL.woodD, 0.0, 0, 25.0); pierOld.add(carved);
  const lantern98 = glowSprite(0xffd27a, 1.2, 0.6); lantern98.position.set(0, 1.3, 25.0); pierOld.add(lantern98);
  const pierPiles = new THREE.Group(); scene.add(pierPiles);               // the piles stand in both builds
  for (let z = 15; z < 25.5; z += 2.2) { [-1.2, 1.2].forEach((x) => pierPiles.add(cyl(0.11, 0.11, 2.0, 6, PAL.woodD, x, -1.6, z))); }
  const pierClosed = new THREE.Group(); scene.add(pierClosed); tag(pierClosed, 'pier_closed');
  pierClosed.add(box(2.6, 0.12, PIER.stub2004[1] - PIER.stub2004[0], 0x8a7a6a, 0, -0.06, (PIER.stub2004[0] + PIER.stub2004[1]) / 2));   // a repaired stub over the old gap
  for (let i = 0; i < 9; i++) { pierClosed.add(box(0.12, 1.2, 0.08, 0xd8dce4, -1.2 + i * 0.3, 0, 14.45)); }
  pierClosed.add(box(2.7, 0.1, 0.1, 0xd8dce4, 0, 1.0, 14.45), box(2.7, 0.1, 0.1, 0xd8dce4, 0, 0.4, 14.45));
  const closedSign = panel(1.2, 0.5, canvasTex(256, 110, signDraw('PIER CLOSED', '#e8ecf0', '#3a4a68', '2004')), 0xe8ecf0, { lit: true }); closedSign.position.set(0, 0.85, 14.38); closedSign.rotation.y = Math.PI; pierClosed.add(closedSign);
  anchors.pierGate = pierPiles; anchors.pierEnd = carved;
  const fenceParts = pierClosed.children.slice(1);
  // the present edition (2026): pale new planks laid by Mara, so they are never mistaken for June's
  const newPier = new THREE.Group(); scene.add(newPier); const newPlanks = [];
  [[14.3, 17.2], [22.8, 25.2]].forEach(([a, b]) => { for (let z = a; z < b - 0.05; z += 0.36) { const pl = box(2.2, 0.1, 0.32, 0xf0e4c8, 0, -0.05, z + 0.17); pl.visible = false; newPier.add(pl); newPlanks.push(pl); } });
  const newLabel = panel(0.9, 0.35, canvasTex(256, 100, signDraw('NEW · 2026', '#fdf8ef', '#3f7cc4', 'Mara')), 0xfdf8ef, { lit: true }); newLabel.position.set(1.25, 0.6, 14.6); newLabel.rotation.y = Math.PI; newLabel.visible = false; newPier.add(newLabel);

  // ---- the rocky point: path (2004) or rocks and crates (1998) --------------------------------------------
  const point = new THREE.Group(); scene.add(point);
  point.add(cyl(4.6, 5.4, 1.2, 10, PAL.stoneD, 16.2, -1.15, 18.4, { cast: false }), cyl(4.4, 4.6, 0.12, 12, PAL.grass, 16.2, -0.07, 18.4, { cast: false }));
  for (let i = 0; i < 14; i++) { const a = R() * Math.PI * 2, d = 4.2 + R() * 1.6; point.add(ball(0.5 + R() * 0.9, 0, i % 2 ? PAL.stoneD : 0x8a8070, 16.2 + Math.cos(a) * d, -0.4, 18.4 + Math.sin(a) * d)); }
  const pathG = new THREE.Group(); scene.add(pathG); tag(pathG, 'point_path');
  pathG.add(box(5.4, 0.08, 4.8, 0xd8d0c4, 13.6, 0, 13.7, { cast: false }));
  const pathLamp = new THREE.Group(); pathLamp.position.set(16.3, 0, 12.4); pathG.add(pathLamp);
  pathLamp.add(cyl(0.06, 0.09, 3.0, 6, 0x2a3040, 0, 0, 0), box(0.26, 0.34, 0.26, 0xe8f0ff, 0, 3.02, 0, { mat: { emissive: 0xc0d8ff, ei: 1.0 } }));
  const rocks = new THREE.Group(); scene.add(rocks); tag(rocks, 'point_rocks');
  for (let i = 0; i < 9; i++) { rocks.add(ball(0.6 + R() * 0.5, 0, i % 2 ? PAL.stoneD : 0x8a8070, 13.6 + (R() - 0.5) * 2.6, 0.1, 15.2 + R() * 1.2)); }
  rocks.add(box(1.2, 0.8, 0.8, PAL.woodL, 14.8, 0, 14.9, { ry: 0.3 }), box(0.9, 0.6, 0.9, PAL.wood, 13.2, 0, 15.6, { ry: -0.2 }));
  const sign98 = panel(1.4, 0.5, canvasTex(256, 110, signDraw('LAMP: JUNE', '#fdf8ef', '#c0443c', 'writing it!')), 0xfdf8ef, { lit: true }); sign98.position.set(12.4, 1.4, 14.7); sign98.rotation.y = Math.PI; rocks.add(sign98);
  rocks.add(cyl(0.05, 0.05, 1.3, 5, PAL.woodD, 12.4, 0, 14.75));
  anchors.scaffold = rocks;

  // ---- lighthouse: finished tower (2004) or half-built in scaffolding (1998) ------------------------------
  const LH = new THREE.Vector3(17.2, 0, 19.6);
  const towerG = new THREE.Group(); towerG.position.copy(LH); scene.add(towerG); tag(towerG, 'lighthouse_tower');
  const towerH = 8.2;
  const towerBody = mesh(new THREE.CylinderGeometry(1.15, 1.75, towerH, 10), mat(0xf4f0ea), 0, towerH / 2, 0); towerG.add(towerBody); blockers.push(towerBody);
  [1.6, 4.4, 7.0].forEach((y) => { const rr = 1.75 - (0.6 * y) / towerH; towerG.add(mesh(new THREE.CylinderGeometry(rr - 0.03, rr + 0.03, 0.9, 10), mat(0x3a5a8a), 0, y, 0)); });
  const door = box(0.8, 1.6, 0.1, PAL.woodD, -1.25, 0, -1.2); door.lookAt(LH.x - 10, 0, LH.z - 10); towerG.add(door);
  towerG.add(cyl(1.7, 1.7, 0.18, 12, 0x2a3040, 0, towerH, 0));
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; towerG.add(cyl(0.03, 0.03, 0.7, 4, 0x2a3040, Math.cos(a) * 1.6, towerH + 0.1, Math.sin(a) * 1.6)); }
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xc8d8e8, transparent: true, opacity: 0.35, roughness: 0.1, flatShading: true });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const pane = mesh(new THREE.BoxGeometry(0.75, 1.3, 0.04), glassMat, Math.cos(a) * 0.95, towerH + 0.83, Math.sin(a) * 0.95, { cast: false }); pane.rotation.y = -a + Math.PI / 2; towerG.add(pane); }
  towerG.add(cone(1.3, 1.1, 10, 0x3a5a8a, 0, towerH + 1.48, 0));
  anchors.lighthouse = towerG;
  // June's crooked window, the same bytes in every build; drawn from window.ll
  const windowSlots = [];
  function windowMesh(data, finish) {
    const g = new THREE.Group(); if (!data || !data.points || !data.points.length) { return g; }
    const sh = new THREE.Shape(); data.points.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath();
    const col = { sea: 0x3f7cc4, honey: 0xe0a83a, chalk: 0xf4f0e6 }[finish] || 0xe0a83a;
    const frame = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat(col)); frame.scale.setScalar(1.12); frame.position.z = -0.01; g.add(frame);
    const glass = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffc070, emissiveIntensity: 0.45, flatShading: true })); g.add(glass);
    data.mullions.forEach(([x0, y0, x1, y1]) => { const len = Math.hypot(x1 - x0, y1 - y0); const m = box(0.05, len, 0.04, col, (x0 + x1) / 2, (y0 + y1) / 2 - len / 2, 0.02); m.rotation.z = Math.atan2(-(x1 - x0), y1 - y0); g.add(m); });
    return g;
  }
  function placeWindow(parent, r, y, data, finish) {
    const slot = new THREE.Group(); const a = Math.atan2(-6, -6); slot.position.set(Math.cos(a) * 0 + Math.sin(a) * r, y, Math.cos(a) * r); slot.rotation.y = a; parent.add(slot);
    windowSlots.push({ slot, data, finish }); return slot;
  }
  placeWindow(towerG, 1.62, 3.6);
  // the lamp: in the present edition it is restored from Elena's 1998 lamp.ll
  const lampGlowT = glowSprite(0xffd27a, 8, 0); lampGlowT.position.set(0, towerH + 0.8, 0); towerG.add(lampGlowT);
  const lampLightT = new THREE.PointLight(0xffd890, 0, 44, 1.2); lampLightT.position.set(0, towerH + 0.8, 0); towerG.add(lampLightT);
  const beamT = new THREE.Group(); beamT.position.set(0, towerH + 0.8, 0); beamT.visible = false; towerG.add(beamT);
  [0, Math.PI].forEach((a) => { const b2 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 36, 16, 1, true), glow(0xfff0b0, { additive: true, opacity: 0.16, side: THREE.DoubleSide })); b2.rotation.z = Math.PI / 2; b2.position.x = 18; const arm = new THREE.Group(); arm.rotation.y = a; arm.add(b2); beamT.add(arm); });
  const scaffG = new THREE.Group(); scaffG.position.copy(LH); scene.add(scaffG); tag(scaffG, 'lighthouse_scaffold');
  const halfH = 4.6;
  scaffG.add(mesh(new THREE.CylinderGeometry(1.45, 1.75, halfH, 10), mat(PAL.white), 0, halfH / 2, 0));
  scaffG.add(mesh(new THREE.CylinderGeometry(1.6, 1.68, 0.9, 10), mat(PAL.red), 0, 1.6, 0));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; scaffG.add(cyl(0.05, 0.05, 7.4, 4, PAL.woodL, Math.cos(a) * 2.1, 0, Math.sin(a) * 2.1)); }
  [2.2, 4.4, 6.6].forEach((y) => { for (let i = 0; i < 8; i++) { const a = ((i + 0.5) / 8) * Math.PI * 2; const pl = box(1.6, 0.06, 0.32, PAL.wood, Math.cos(a) * 2.05, y, Math.sin(a) * 2.05); pl.rotation.y = -a + Math.PI / 2; scaffG.add(pl); } });
  // the anomaly: a light where the summer build has no lamp
  const anomalyGlow = glowSprite(0xfff0b0, 7, 0); anomalyGlow.position.set(0, 7.2, 0); scaffG.add(anomalyGlow);
  const anomalyLight = new THREE.PointLight(0xffe0a0, 0, 46, 1.2); anomalyLight.position.set(0, 7.2, 0); scaffG.add(anomalyLight);
  const beam = new THREE.Group(); beam.position.set(0, 7.2, 0); beam.visible = false; scaffG.add(beam);
  const beamCone = new THREE.Mesh(new THREE.ConeGeometry(2.0, 30, 16, 1, true), glow(0xfff0b0, { additive: true, opacity: 0.18, side: THREE.DoubleSide })); beamCone.rotation.z = Math.PI / 2; beamCone.position.x = 15; beam.add(beamCone);
  placeWindow(scaffG, 1.66, 3.0);
  const scaffBlock = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.75, halfH, 10), new THREE.MeshBasicMaterial({ visible: false })); scaffBlock.position.y = halfH / 2; scaffG.add(scaffBlock); blockers.push(scaffBlock);

  // ---- the canal crossing: June's bridge and the outline where it should be ---------------------------------
  const bridgeG = new THREE.Group(); bridgeG.position.set(BRIDGE.x, 0, BRIDGE.z0); scene.add(bridgeG);
  const ghostG = new THREE.Group(); ghostG.position.set(BRIDGE.x, 0, BRIDGE.z0); scene.add(ghostG);
  let planks = [], rails = [], posts = [], bridgeData = null, shown = 0, progress = 0;
  const plankMat = mat(PAL.woodL), plankMatD = mat(PAL.wood);
  function clear(g) { while (g.children.length) { const c = g.children.pop(); if (c.geometry) { c.geometry.dispose(); } } }
  function setBridgeData(data) {
    clear(bridgeG); planks = []; rails = []; posts = []; bridgeData = data; shown = 0;
    if (!data || !data.planks.length) { return; }
    data.planks.forEach((p, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(p.len, 0.09, p.d), i % 2 ? plankMat : plankMatD);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.home = new THREE.Vector3(p.side, -0.02, p.z + p.d / 2); m.userData.rz = p.tilt; m.userData.placedAt = -1;
      m.position.copy(m.userData.home); m.rotation.z = p.tilt; m.visible = false; bridgeG.add(m); planks.push(m);
    });
    [-1, 1].forEach((s) => {
      const r = box(0.08, 0.07, data.span, PAL.woodD, s * data.width / 2, data.rail, data.span / 2); r.position.z = data.span / 2; r.visible = false; bridgeG.add(r); rails.push(r);
      data.posts.forEach((z) => { const p = cyl(0.06, 0.07, data.rail + 0.05, 6, PAL.woodD, s * data.width / 2, -0.05, z); p.visible = false; bridgeG.add(p); posts.push(p); });
    });
  }
  // progress 0..1 shows that share of the planks; rails and posts arrive with the last plank.
  function setBridgeProgress(p, t, animate) {
    progress = Math.max(0, Math.min(1, p));
    const n = Math.round(progress * planks.length);
    planks.forEach((m, i) => {
      const on = i < n;
      if (on && !m.visible) { m.visible = true; m.userData.placedAt = animate ? t : -1; if (!animate) { m.position.copy(m.userData.home); m.rotation.z = m.userData.rz; } }
      if (!on) { m.visible = false; }
    });
    const done = n >= planks.length && planks.length > 0;
    rails.concat(posts).forEach((m) => { m.visible = done; });
    shown = n;
    return n;
  }
  // The length of floor the visible planks give, for the walkable shape in levels.js.
  function builtLength() { if (!bridgeData || !shown) { return 0; } const last = bridgeData.planks[shown - 1]; return shown >= planks.length ? bridgeData.span : last.z + last.d; }
  // Outline: the planks a copy describes. A cut-off copy shows where its data stops.
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.32, wireframe: true, depthWrite: false });
  const ghostWarm = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.45, wireframe: true, depthWrite: false });
  const glitchMat = new THREE.MeshBasicMaterial({ color: 0xff6fa8, transparent: true, opacity: 0.5, depthWrite: false });
  let ghostBits = [], glitch = [];
  function setGhost(data, complete) {
    clear(ghostG); ghostBits = []; glitch = [];
    const d = data && data.planks.length ? data : null;
    const span = BRIDGE.span;
    if (d) { d.planks.forEach((p) => { const m = new THREE.Mesh(new THREE.BoxGeometry(p.len, 0.09, p.d), complete ? ghostWarm : ghostMat); m.position.set(p.side, 0.02, p.z + p.d / 2); m.rotation.z = p.tilt; ghostG.add(m); ghostBits.push(m); }); }
    const from = d ? d.planks[d.planks.length - 1].z + 0.25 : 0;
    if (!complete) {
      for (let z = from; z < span; z += 0.22) { for (let k = 0; k < 3; k++) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.1 + R() * 0.25, 0.06, 0.08), glitchMat); g.position.set((R() - 0.5) * 2.0, 0.02 + R() * 0.25, z); g.userData.ph = R() * 6; ghostG.add(g); glitch.push(g); } }
    }
  }
  anchors.gap = ghostG;

  // ---- Theo ----------------------------------------------------------------------------------------------
  const theo = makeTheo(); theo.position.set(THEO.wait.x, 0, THEO.wait.z); theo.rotation.y = Math.PI; scene.add(theo);
  anchors.theo = theo;
  let theoRoute = [], theoMode = 'wait', theoPhase = 0, theoSpeed = 0;

  // Iris, June's baker, and the boat she leaves on
  const iris = makeCast('iris'); iris.position.set(IRIS_TOWN.bakery.x, 0, IRIS_TOWN.bakery.z); iris.rotation.y = 0; scene.add(iris);
  canalBoat.position.set(-5.8, -0.55, 9.6); canalBoat.rotation.y = Math.PI / 2;
  // the path down to the little dock, the mooring post and Iris's rope
  scene.add(box(2.6, 0.08, 2.2, 0xd8cdb8, -5.1, -0.02, 5.9, { cast: false }));
  const mooring = new THREE.Group(); mooring.position.set(-5.7, 0, 7.9); scene.add(mooring);
  mooring.add(cyl(0.09, 0.11, 0.7, 6, PAL.woodD, 0, 0, 0), cyl(0.12, 0.12, 0.08, 6, 0x2a2a30, 0, 0.66, 0));
  const rope = box(0.05, 0.05, 1.4, 0xd8c8a0, 0, 0.45, 0.75, { rx: 0.35, cast: false }); mooring.add(rope);
  // winter, newly made for the restored edition: snow on roofs and falling snow
  const snowCaps = new THREE.Group(); scene.add(snowCaps); snowCaps.visible = false;
  houses.forEach((h2) => { const cap = box(1, 0.12, 1, 0xf8fbff, 0, 0, 0, { cast: false }); const r0 = h2.userData.roof; const bb = new THREE.Box3().setFromObject(r0); const sz = bb.getSize(new THREE.Vector3()), c0 = bb.getCenter(new THREE.Vector3()); cap.scale.set(sz.x * 0.95, 1, sz.z * 0.95); cap.position.set(c0.x, bb.max.y - 0.02, c0.z); snowCaps.add(cap); });
  const snowGeo = new THREE.BufferGeometry(); const SN = o.low ? 500 : 1100; const sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { sp[i * 3] = -20 + R() * 44; sp[i * 3 + 1] = R() * 16; sp[i * 3 + 2] = -18 + R() * 46; }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false })); snow.visible = false; snow.frustumCulled = false; scene.add(snow);
  const leaves = new THREE.Group(); scene.add(leaves); leaves.visible = false;
  for (let i = 0; i < 70; i++) { const lf = box(0.12, 0.02, 0.08, [0xd9772a, 0xc0443c, 0xe0a83a][i % 3], -14 + R() * 30, R() * 0.05 + 0.03, -12 + R() * 26, { cast: false }); lf.rotation.y = R() * 6; leaves.add(lf); }
  // gulls (1998 only)
  const gulls = [];
  for (let i = 0; i < 6; i++) {
    const g2 = new THREE.Group(); const w1 = box(0.6, 0.03, 0.16, 0xffffff, -0.3, 0, 0, { cast: false }), w2 = box(0.6, 0.03, 0.16, 0xffffff, 0.3, 0, 0, { cast: false }); g2.add(w1, w2, box(0.12, 0.1, 0.36, 0xf4f4f4, 0, -0.05, 0, { cast: false }));
    g2.userData = { w1, w2, r: 10 + i * 3, h: 9 + (i % 3) * 2, sp: 0.15 + i * 0.03, ph: i * 1.3, cx: 4 + i * 2, cz: 24 + i };
    scene.add(g2); gulls.push(g2); tag(g2, 'gulls');
  }

  // ---- builds ----------------------------------------------------------------------------------------------
  const LOOK = {
    '1998': { fog: 0xffc890, near: 40, far: 170, hemiS: 0xfff0c8, hemiG: 0x6a8a5a, hemiI: 1.25, sun: 0xffc880, sunI: 3.6, sea: 0x4aa8d8, grass: 0x7fd06a, water: 0x4ab0d0 },
    '2004': { fog: 0xc8c8d8, near: 30, far: 150, hemiS: 0xd8e0f0, hemiG: 0x4a5a5a, hemiI: 1.05, sun: 0xe8e4f0, sunI: 2.4, sea: 0x3f78a8, grass: 0x6aa070, water: 0x3a7898 }
  };
  let build = '2004', assets = new Set();
  function setBuild(b, assetSet) {
    build = b; assets = assetSet || new Set();
    const L = LOOK[b];
    scene.fog.color.set(L.fog); scene.fog.near = L.near; scene.fog.far = L.far;
    hemi.color.set(L.hemiS); hemi.groundColor.set(L.hemiG); hemi.intensity = L.hemiI; sun.color.set(L.sun); sun.intensity = L.sunI;
    seaMat.color.set(L.sea); grassMat.color.set(L.grass); waterMat.color.set(L.water);
    only98.forEach((x) => { x.visible = b === '1998'; }); only04.forEach((x) => { x.visible = b === '2004'; });
    tagged.forEach(([obj, id]) => { obj.visible = assets.has(id); });
    lampGlows.forEach((gl) => { gl.material.opacity = b === '1998' ? 0.55 : 0.3; });
    redraw(signTex, assets.has('bakery_1998') ? signDraw('JUNE & SKY\u2019S BAKERY', '#fdf8ef', '#c0443c', 'open when the light is on') : signDraw('BAKERY', '#eef0f2', '#3a4a68'));
    redraw(muralTex, muralDraw(assets.has('notice_1998') ? '1998' : '2004'));
    redraw(noticeTex, noticeDraw(assets.has('notice_1998') ? '1998' : '2004'));
    lantern98.visible = b === '1998';
  }
  let season = 'summer';
  function setSeason(sn) {
    season = sn;
    const pal = { summer: null, autumn: { grass: 0xb8a050, fog: 0xe8c8a0, hemi: 0xffe0c0 }, winter: { grass: 0xe8eef4, fog: 0xd8e4f0, hemi: 0xe8f0ff } }[sn];
    if (pal) { grassMat.color.set(pal.grass); scene.fog.color.set(pal.fog); hemi.color.set(pal.hemi); }
    snow.visible = snowCaps.visible = sn === 'winter'; leaves.visible = sn === 'autumn' || sn === 'winter';
    if (sn === 'winter') { sun.intensity = 2.0; sun.color.set(0xfff0e0); waterMat.color.set(0x5a88a8); }
  }

  // ---- anomaly timeline -------------------------------------------------------------------------------------
  let anomalyT = -1; let beamAngle = null;
  const api = {
    scene, anchors, blockers, theo,
    get build() { return build; },
    get assetTags() { return [...new Set(tagged.map((x) => x[1]))]; },
    setBuild, setBridgeData, setBridgeProgress, builtLength, setGhost, setSeason, iris, canalBoat,
    setCredits(credits) { redraw(creditTex, signDraw('LAST LIGHT', '#fdf8ef', '#c0443c', (credits || []).filter((c) => c.who !== 'mara').map((c) => c.who === 'skylark' ? 'Elena' : c.who === 'junebug' ? 'June' : c.who).join(' & '))); },
    setWindow(data, finish) { windowSlots.forEach((w) => { while (w.slot.children.length) { w.slot.remove(w.slot.children[0]); } w.slot.add(windowMesh(data, finish)); }); },
    setLamp(on, color) { lampGlowT.material.opacity = on ? 0.85 : 0; lampLightT.intensity = on ? 70 : 0; beamT.visible = !!on; if (color) { lampLightT.color.set(color); } },
    // null lets the beam turn by itself; a number holds it where the player points it
    setBeamAngle(a) { beamAngle = a; },
    setRope(tied) { rope.visible = !!tied; },
    setNewPier(k) { const n = Math.round(Math.max(0, Math.min(1, k)) * newPlanks.length); newPlanks.forEach((pl, i) => { pl.visible = i < n; }); newLabel.visible = k >= 1; fenceParts.forEach((f) => { f.visible = k < 1; }); },
    get bridgePlanks() { return planks.length; },
    plankWorld(i) { const m = planks[i]; if (!m) { return null; } return new THREE.Vector3(BRIDGE.x + m.userData.home.x, m.userData.home.y, BRIDGE.z0 + m.userData.home.z); },
    activeBlockers() { return blockers.filter((b) => { let n = b; while (n) { if (!n.visible) { return false; } n = n.parent; } return true; }); },
    // Theo: 'wait' (far side), 'meet' (walks across), 'post' (his evening spot)
    placeTheo(where) {
      const p = where === 'meet' ? THEO.meet : where === 'post' ? THEO.post : THEO.wait;
      theo.position.set(p.x, 0, p.z); theoRoute = []; theoMode = where; theoSpeed = 0;
    },
    theoGo(where) {
      theoRoute = where === 'meet' ? THEO.path.map(([x, z]) => ({ x, z })) : [{ x: 0.3, z: 8.0 }, { x: 0.3, z: 11.9 }, { x: THEO.post.x, z: THEO.post.z }];
      if (where === 'post' && theo.position.z > CANAL.z1) { theoRoute = [{ x: THEO.post.x, z: THEO.post.z }]; }
      theoMode = 'walking:' + where;
    },
    get theoWalking() { return theoRoute.length > 0; },
    get theoMode() { return theoMode; },
    theoFace(x, z, k) { if (!theoRoute.length) { const target = Math.atan2(x - theo.position.x, z - theo.position.z); theo.rotation.y += Math.atan2(Math.sin(target - theo.rotation.y), Math.cos(target - theo.rotation.y)) * (k || 0.12); } },
    theoAnim(t, reduce, talking, calling) { const m = theoRoute.length ? 'walk' : (talking ? 'talk' : (calling ? 'wave' : 'idle')); return { phase: theoPhase, speed: theoSpeed, mode: m }; },
    startAnomaly(t) { anomalyT = 0; },
    get anomalyPlaying() { return anomalyT >= 0 && anomalyT < 5.2; },
    update(dt, t, reduce) {
      if (!reduce) {
        const p = sea.geometry.attributes.position; const arr = p.array;
        for (let i = 0; i < arr.length; i += 3) { const x = seaBase[i], z = seaBase[i + 2]; arr[i + 1] = Math.sin(x * 0.18 + t * 1.1) * 0.18 + Math.cos(z * 0.22 + t * 0.8) * 0.16; }
        p.needsUpdate = true;
        const wp = water.geometry.attributes.position; const wa = wp.array;
        for (let i = 0; i < wa.length; i += 3) { wa[i + 2] = waterBase[i + 2] + Math.sin(waterBase[i] * 0.5 + t * 1.4) * 0.03; }
        wp.needsUpdate = true;
      }
      spout.scale.y = reduce ? 1 : 1 + Math.sin(t * 6) * 0.08; fish.rotation.y = t * 0.5;
      if (beamT.visible) { beamT.rotation.y = beamAngle === null ? t * (reduce ? 0.25 : 0.6) : beamAngle; }
      if (snow.visible && !reduce) { const a2 = snow.geometry.attributes.position.array; for (let i = 0; i < a2.length; i += 3) { a2[i + 1] -= dt * 1.1; a2[i] += Math.sin(t + i) * dt * 0.2; if (a2[i + 1] < 0) { a2[i + 1] = 16; } } snow.geometry.attributes.position.needsUpdate = true; }
      boats.forEach((b, i) => { b.position.y = -0.55 + (reduce ? 0 : Math.sin(t * 1.2 + i) * 0.08); b.rotation.z = reduce ? 0 : Math.sin(t * 0.9 + i) * 0.04; });
      gulls.forEach((g2) => { const u = g2.userData; const a = t * u.sp + u.ph; g2.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(t * 0.7 + u.ph) * 0.6, u.cz + Math.sin(a) * u.r); g2.rotation.y = -a; const f = reduce ? 0.2 : Math.sin(t * 6 + u.ph) * 0.45; u.w1.rotation.z = f; u.w2.rotation.z = -f; });
      // planks drop into place
      planks.forEach((m) => {
        if (m.userData.placedAt < 0 || !m.visible) { return; }
        const k = Math.min(1, (t - m.userData.placedAt) / (reduce ? 0.05 : 0.32)); const e = 1 - Math.pow(1 - k, 3);
        m.position.set(m.userData.home.x, m.userData.home.y + (1 - e) * 0.9, m.userData.home.z); m.rotation.z = m.userData.rz + (1 - e) * 0.6;
        if (k >= 1) { m.userData.placedAt = -1; m.position.copy(m.userData.home); m.rotation.z = m.userData.rz; }
      });
      // the outline breathes; the glitch where data is missing flickers
      ghostBits.forEach((g, i) => { g.material.opacity = (reduce ? 0.35 : 0.25 + 0.15 * Math.sin(t * 2 + i * 0.4)); g.visible = progress < 1 && i >= shown; });
      glitch.forEach((g, i) => { g.visible = progress < 1 && (reduce ? i % 2 === 0 : Math.sin(t * 13 + g.userData.ph) > 0); });
      // Theo walks his route
      if (theoRoute.length) {
        const goal = theoRoute[0]; const dx = goal.x - theo.position.x, dz = goal.z - theo.position.z, dist = Math.hypot(dx, dz);
        if (dist < 0.06) { theoRoute.shift(); if (!theoRoute.length) { theoMode = theoMode.replace('walking:', ''); theoSpeed = 0; } }
        else { const sp = reduce ? 3.0 : 1.5; theoSpeed = sp; const st = Math.min(dist, sp * dt); theo.position.x += (dx / dist) * st; theo.position.z += (dz / dist) * st; theo.rotation.y = Math.atan2(dx, dz); theoPhase += st * 4.2; }
      }
      // anomaly: three short flashes, one long sweep, then a faint pulse that stays
      if (anomalyT >= 0) {
        anomalyT += dt; const a = anomalyT;
        const flash = (s, d) => (a > s && a < s + d ? 1 : 0);
        let k = Math.max(flash(0.4, 0.18), flash(0.9, 0.18), flash(1.4, 0.18), a > 2.2 && a < 4.6 ? 1 : 0);
        if (a >= 4.6) { k = reduce ? 0.25 : 0.2 + 0.12 * Math.sin(t * 2.2); }
        anomalyGlow.material.opacity = 0.9 * k; anomalyLight.intensity = 140 * k; beam.visible = a > 2.2 && a < 4.6;
        if (beam.visible) { beam.rotation.y = -0.9 + (a - 2.2) * (reduce ? 0.2 : 0.75); }
      }
    }
  };
  setBuild('2004', new Set());
  return api;
}
