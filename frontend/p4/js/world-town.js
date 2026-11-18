// Scene C: Summer Town, the seaside town Elena built in 1998. Layout matches levels.js:
// arrival lane (z -15..-6), plaza (r 7.6) with the fountain and two copy kiosks, the road south to the promenade,
// the beach and pier, and the rocky point with the lighthouse and Theo.
// The town has three looks: the present, the 1998 copy (warm, complete) and the 2004 mirror (cold, damaged).
import { THREE, PAL, mat, glow, box, cyl, cone, ball, mesh, rng, canvasTex, redraw, FONT, panel, glowSprite, label, skyDome } from './kit.js';
import { makeTheo } from './people.js';
import { THEO_SPOT, THEO_DOOR } from './levels.js';

function roofGeo(w, d, h) {
  // a simple gable: triangular prism along x
  const shape = new THREE.Shape(); shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, h); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2); g.rotateY(Math.PI / 2);
  return g;
}

function house(spec) {
  const { w, d, h, wall, roof, door, shop } = spec;
  const g = new THREE.Group();
  const body = box(w, h, d, wall, 0, 0, 0); g.add(body);
  const r = mesh(roofGeo(w + 0.4, d + 0.5, 1.2 + d * 0.15), mat(roof), 0, h, 0); g.add(r);
  g.add(box(w + 0.1, 0.18, d + 0.1, 0xe8dcc8, 0, 0, 0, { cast: false }));
  g.add(box(0.36, 0.8, 0.36, 0xb8664a, w * 0.28, h + 0.5, -d * 0.15));
  // door and windows on the front (+z local)
  g.add(box(0.8, 1.45, 0.08, door || PAL.woodD, shop ? -w * 0.22 : 0, 0.05, d / 2 + 0.02));
  g.add(ball(0.04, 0, PAL.gold, (shop ? -w * 0.22 : 0) + 0.26, 0.8, d / 2 + 0.07));
  const winMat = mat(0x9fd0e8, { emissive: 0xffc070, ei: 0.25 });
  const wins = [];
  const cols = shop ? [w * 0.18] : [-w * 0.3, w * 0.3];
  cols.forEach((x) => { const wn = box(shop ? w * 0.42 : 0.7, shop ? 0.9 : 0.7, 0.06, winMat, x, shop ? 0.55 : 0.75, d / 2 + 0.03); g.add(wn); wins.push(wn); g.add(box((shop ? w * 0.42 : 0.7) + 0.16, 0.08, 0.14, PAL.white, x, shop ? 0.5 : 0.7, d / 2 + 0.06)); });
  if (h > 3) { [-w * 0.3, w * 0.3].forEach((x) => { const wn = box(0.62, 0.62, 0.06, winMat, x, h - 1.1, d / 2 + 0.03); g.add(wn); wins.push(wn); }); }
  // flower box
  if (!shop) { g.add(box(0.8, 0.16, 0.2, PAL.woodL, -w * 0.3, 0.55, d / 2 + 0.12)); [0, 1, 2].forEach((i) => g.add(ball(0.08, 0, [0xff7aa8, 0xffd27a, 0xffffff][i], -w * 0.3 - 0.25 + i * 0.25, 0.78, d / 2 + 0.14))); }
  if (shop) {
    // striped awning
    for (let i = 0; i < 6; i++) { const a = box(w / 6, 0.05, 0.9, i % 2 ? 0xffffff : spec.awning, -w / 2 + w / 12 + (i * w) / 6, 1.85, d / 2 + 0.45, { rx: 0.35 }); g.add(a); }
  }
  g.userData.body = body; g.userData.wins = wins; g.userData.roof = r;
  return g;
}

function signDraw(text, bg, fg, sub) {
  return (ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#6b4128'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${text.length > 12 ? 40 : 52}px ${FONT}`; ctx.fillText(text, w / 2, h / 2 - (sub ? 12 : 0));
    if (sub) { ctx.font = `22px ${FONT}`; ctx.fillText(sub, w / 2, h / 2 + 34); }
  };
}

function muralDraw(state) {
  return (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (state === '04') { g.addColorStop(0, '#6a7890'); g.addColorStop(1, '#3a4a68'); } else { g.addColorStop(0, '#7ab8e8'); g.addColorStop(0.6, '#ffd8a0'); g.addColorStop(1, '#3f8fd0'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = state === '04' ? '#5a4a40' : '#9a6340'; ctx.fillRect(0, h * 0.68, w, h * 0.12);
    const girl = (x, hair, coat, scraped) => {
      ctx.fillStyle = coat; ctx.fillRect(x - 34, h * 0.36, 68, h * 0.32);
      ctx.fillStyle = '#f6d2aa'; ctx.beginPath(); ctx.arc(x, h * 0.28, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(x, h * 0.25, 32, Math.PI, 0); ctx.fill();
      if (scraped) { ctx.fillStyle = '#d8d0c4'; for (let i = 0; i < 14; i++) { ctx.fillRect(x - 40 + ((i * 37) % 80), h * 0.14 + ((i * 23) % 70), 26, 6); } ctx.fillStyle = '#b8b0a4'; ctx.fillRect(x - 36, h * 0.16, 72, 56); }
      else { ctx.fillStyle = '#241a3a'; ctx.fillRect(x - 12, h * 0.27, 6, 8); ctx.fillRect(x + 6, h * 0.27, 6, 8); ctx.fillStyle = '#c0504a'; ctx.fillRect(x - 8, h * 0.32, 16, 4); }
    };
    girl(w * 0.36, '#4b3568', '#f2ad3d', false);
    girl(w * 0.62, '#c0602a', '#5fb0c8', state !== '98');
    ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(w * 0.36 + 30, h * 0.44); ctx.lineTo(w * 0.86, h * 0.1); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 34px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(state === '98' ? 'E + J  summer 98' : (state === '04' ? 'E +    summer 98' : 'E +    summer 98'), 24, h - 24);
  };
}

export function buildTown(opts) {
  const o = opts || {};
  const scene = new THREE.Scene();
  const R = rng(5);
  const anchors = {};
  const blockers = [];
  const looks = { present: [], '98': [], '04': [] };

  // ---- sky, sun, light --------------------------------------------------------------------------------
  const skyPresent = skyDome(['#3b3f98', '#7a63c0', '#e07aa0', '#ff9a68', '#ffd28a'], 320);
  const sky98 = skyDome(['#5a6ad0', '#9a8ae0', '#ffb0a0', '#ffc070', '#fff0b0'], 319);
  const sky04 = skyDome(['#4a5468', '#66728a', '#8a94a8', '#a8b0bc', '#c8ccd2'], 318);
  scene.add(skyPresent, sky98, sky04); looks.present.push(skyPresent); looks['98'].push(sky98); looks['04'].push(sky04);
  scene.fog = new THREE.Fog(0xf0a080, 40, 170);
  const hemi = new THREE.HemisphereLight(0xffd8b8, 0x4a6a5a, 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb070, 3.0);
  sun.position.set(-18, 22, 40); sun.target.position.set(4, 0, 6);
  sun.castShadow = true; sun.shadow.mapSize.set(o.shadow || 1536, o.shadow || 1536);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 5, far: 110 }); sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const sunDisc = glowSprite(0xfff0c0, 40, 0.9); sunDisc.position.set(-30, 18, 160); scene.add(sunDisc);
  const sunCore = new THREE.Mesh(new THREE.CircleGeometry(7, 32), glow(0xfff4d0, { fog: false })); sunCore.position.set(-30, 18, 165); sunCore.lookAt(0, 0, 0); scene.add(sunCore);
  looks.present.push(sunDisc, sunCore); looks['98'].push(sunDisc, sunCore);
  // low-poly clouds
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group(); const a = -1.2 + (i / 8) * 2.4; const d = 120 + R() * 40;
    c.position.set(Math.sin(a) * d, 28 + R() * 18, Math.cos(a) * d * 0.8 + 20);
    for (let j = 0; j < 4; j++) { c.add(ball(4 + R() * 4, 1, 0xfff0e8, (j - 1.5) * 6, R() * 2, R() * 3, { cast: false, mat: { emissive: 0xffc0a0, ei: 0.35 } })); }
    c.lookAt(0, 30, 0); scene.add(c);
  }

  // ---- ground: grass, cobbles, promenade, beach, sea --------------------------------------------------
  const grass = mesh(new THREE.PlaneGeometry(90, 70), mat(PAL.grass), 0, -0.02, -6, { rx: -Math.PI / 2, cast: false }); scene.add(grass);
  const cobble = mat(PAL.stone), cobbleD = mat(PAL.stoneD);
  const plaza = mesh(new THREE.CylinderGeometry(7.9, 7.9, 0.06, 40), cobble, 0, 0, 0, { cast: false }); scene.add(plaza);
  const plazaRing = mesh(new THREE.TorusGeometry(7.9, 0.12, 4, 48), cobbleD, 0, 0.04, 0, { rx: Math.PI / 2, cast: false }); scene.add(plazaRing);
  for (let r2 = 2.6; r2 < 7.6; r2 += 1.25) { const ring2 = mesh(new THREE.TorusGeometry(r2, 0.03, 3, 48), cobbleD, 0, 0.035, 0, { rx: Math.PI / 2, cast: false }); scene.add(ring2); }
  scene.add(box(4.8, 0.06, 9.4, PAL.stone, 0, 0, -10.6, { cast: false }));
  scene.add(box(5.4, 0.06, 7.2, PAL.stone, 0, 0, 9.6, { cast: false }));
  scene.add(box(26, 0.08, 3.4, 0xd8c8a8, 0.5, 0, 13.0, { cast: false }));
  scene.add(box(26, 0.3, 0.3, 0xb8a888, 0.5, 0, 14.75, { cast: false })); // sea wall
  // beach slopes down to the water
  const beach = mesh(new THREE.PlaneGeometry(80, 10, 1, 1), mat(PAL.sand), 0, -0.35, 19.5, { rx: -Math.PI / 2 + 0.07, cast: false }); scene.add(beach);
  // sea with gentle waves (flat shading needs no normal updates)
  const seaGeo = new THREE.PlaneGeometry(320, 200, o.low ? 40 : 70, o.low ? 26 : 44); seaGeo.rotateX(-Math.PI / 2);
  const seaBase = seaGeo.attributes.position.array.slice();
  const seaMat = mat(PAL.sea, { rough: 0.25, metal: 0.1, unique: true });
  const sea = mesh(seaGeo, seaMat, 0, -0.62, 112, { cast: false }); scene.add(sea);
  const glitter = [];
  for (let i = 0; i < 40; i++) { const g2 = glowSprite(0xfff0c0, 0.6 + R() * 1.2, 0.0); g2.position.set(-40 + R() * 80, -0.3, 24 + R() * 70); scene.add(g2); glitter.push(g2); }

  // ---- arrival portal behind the spawn -----------------------------------------------------------------
  const arrival = new THREE.Group(); arrival.position.set(0, 0, -15.8); scene.add(arrival);
  arrival.add(box(0.4, 3.2, 0.4, PAL.woodD, -1.6, 0, 0), box(0.4, 3.2, 0.4, PAL.woodD, 1.6, 0, 0), box(3.8, 0.4, 0.5, PAL.woodD, 0, 3.1, 0));
  const arrivalGlow = panel(2.8, 3.0, null, 0xffb0a0, { additive: true, opacity: 0.25, side: THREE.FrontSide }); arrivalGlow.position.set(0, 1.55, 0.1); arrival.add(arrivalGlow);
  const sign0 = panel(2.6, 0.55, canvasTex(512, 110, signDraw('SUMMER TOWN', '#fdf8ef', '#c0443c')), 0xfdf8ef, { lit: true }); sign0.position.set(0, 3.55, 0.28); arrival.add(sign0);
  // lane hedges
  [-2.65, 2.65].forEach((x) => { for (let z = -14.5; z < -7; z += 1.4) { scene.add(ball(0.62, 1, PAL.grassD, x, 0.45, z, { s: 1, cast: true })); } });

  // ---- houses around the plaza -----------------------------------------------------------------------
  const houses = [];
  function place(h, x, z, faceX, faceZ) { h.position.set(x, 0, z); h.lookAt(faceX, 0, faceZ); scene.add(h); blockers.push(h.userData.body); houses.push(h); return h; }
  const bakery = place(house({ w: 4.2, d: 3.6, h: 3.4, wall: PAL.houseB, roof: PAL.roofA, shop: true, awning: 0xe85a6a }), -7.2, -8.4, 0, -2);
  const muralHouse = place(house({ w: 4.4, d: 3.6, h: 3.0, wall: PAL.houseD, roof: PAL.roofB }), 7.2, -8.4, 0, -2);
  place(house({ w: 3.6, d: 3.4, h: 3.6, wall: PAL.houseC, roof: PAL.roofC }), -10.2, -1.2, 0, 0);
  place(house({ w: 3.8, d: 3.2, h: 3.0, wall: PAL.houseA, roof: PAL.roofD }), 10.4, -1.0, 0, 0);
  place(house({ w: 3.6, d: 3.4, h: 3.2, wall: PAL.houseD, roof: PAL.roofB }), -9.2, 6.0, 0, 0);
  place(house({ w: 3.6, d: 3.2, h: 3.8, wall: PAL.houseB, roof: PAL.roofA, shop: true, awning: 0x3f7cc4 }), 9.0, 6.2, 0, 0);
  place(house({ w: 3.4, d: 3.0, h: 2.8, wall: PAL.houseA, roof: PAL.roofC }), -5.8, 10.0, -5.8, 20);
  place(house({ w: 3.4, d: 3.0, h: 3.0, wall: PAL.houseC, roof: PAL.roofD }), 6.4, 9.8, 6.4, 20);
  place(house({ w: 3.0, d: 2.8, h: 2.6, wall: PAL.houseC, roof: PAL.roofA }), -5.2, -12.2, 0, -12.2);
  place(house({ w: 3.0, d: 2.8, h: 2.8, wall: PAL.houseA, roof: PAL.roofB }), 5.2, -12.2, 0, -12.2);
  // bakery sign: blank in the present, JUNE'S BAKERY in 1998, [deleted] in 2004
  const signTex = canvasTex(512, 128, signDraw('', '#fdf8ef', '#c0443c'));
  const bakerySign = panel(2.8, 0.7, signTex, 0xfdf8ef, { lit: true }); bakerySign.position.set(0, 2.55, 1.86); bakery.add(bakerySign);
  const note = box(0.28, 0.34, 0.01, 0xfff4b0, -0.92, 0.85, 1.85, { cast: false }); bakery.add(note);
  bakery.add(box(0.9, 0.5, 0.5, PAL.woodL, 1.3, 0, 2.1), ball(0.16, 0, 0xd9a050, 1.15, 0.62, 2.05), ball(0.14, 0, 0xc08040, 1.45, 0.6, 2.15)); // bread crate
  anchors.bakery = bakery;
  // mural on the house facing the plaza
  const muralTex = canvasTex(512, 320, muralDraw('present'));
  const mural = panel(3.6, 2.25, muralTex, 0x9ac0e8, { lit: true }); mural.position.set(0, 1.55, 1.83); muralHouse.add(mural);
  anchors.mural = muralHouse;

  // ---- fountain ---------------------------------------------------------------------------------------
  const fountain = new THREE.Group(); scene.add(fountain);
  fountain.add(cyl(1.7, 1.8, 0.55, 16, PAL.stone, 0, 0, 0), cyl(1.45, 1.45, 0.05, 16, PAL.sea, 0, 0.45, 0, { mat: { rough: 0.2 } }));
  fountain.add(cyl(0.25, 0.35, 1.3, 8, PAL.stoneD, 0, 0.5, 0), cyl(0.8, 0.6, 0.18, 12, PAL.stone, 0, 1.6, 0), cyl(0.65, 0.65, 0.04, 12, PAL.sea, 0, 1.73, 0));
  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 8, 1, true), glow(0xd8f0ff, { opacity: 0.55, side: THREE.DoubleSide })); spout.position.y = 2.1; fountain.add(spout);
  const fish = ball(0.18, 0, 0xffb347, 0, 1.95, 0); fountain.add(fish);
  blockers.push(fountain.children[0]);

  // ---- copy kiosks ------------------------------------------------------------------------------------
  function kiosk(x, z, era) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.lookAt(0, 0, z - 1.6); scene.add(g);
    const shell = era === '98' ? 0xd6443c : 0x6a7a90, trim = era === '98' ? PAL.cream : 0xb8c4d0;
    g.add(box(1.0, 2.35, 0.9, shell, 0, 0, 0), box(1.1, 0.14, 1.0, trim, 0, 2.35, 0), box(0.6, 0.35, 0.6, trim, 0, 2.49, 0));
    const scrTex = canvasTex(256, 192, (ctx, w, h) => {
      ctx.fillStyle = era === '98' ? '#2a1606' : '#06141e'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = era === '98' ? '#ffc46a' : '#8fe8ff'; ctx.font = `bold 24px ${FONT}`;
      ctx.fillText(era === '98' ? 'summer98.net' : 'mirror.oldnet', 14, 40); ctx.font = `20px ${FONT}`;
      ctx.fillText(era === '98' ? '15 Aug 1998' : '3 Mar 2004', 14, 76); ctx.fillText('~skylark/town', 14, 108);
      ctx.fillText(era === '98' ? 'original' : 'mirror copy', 14, 140);
    });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.48), new THREE.MeshStandardMaterial({ color: scrTex ? 0xffffff : (era === '98' ? 0xffc46a : 0x8fe8ff), map: scrTex, emissive: 0xffffff, emissiveMap: scrTex, emissiveIntensity: 0.6 }));
    scr.position.set(0, 1.5, 0.46); g.add(scr);
    g.add(box(0.7, 0.08, 0.3, 0x2a2a30, 0, 1.0, 0.55));
    const lab = label(era === '98' ? '1998' : '2004', { color: era === '98' ? '#ffd27a' : '#bfe8ff', glowColor: era === '98' ? '#ff9a5e' : '#5fb0e0', w: 2.2, fallback: 0xffffff }); lab.position.y = 3.25; g.add(lab);
    const light = new THREE.PointLight(era === '98' ? 0xffb060 : 0x80c8ff, 3, 6, 1.6); light.position.set(0, 1.6, 0.9); g.add(light);
    blockers.push(g.children[0]);
    return { g, scr, light };
  }
  const k98 = kiosk(-4.6, 2.2, '98'); const k04 = kiosk(4.6, 2.2, '04');
  anchors.booth98 = k98.g; anchors.booth04 = k04.g;

  // ---- lamp posts, benches, bunting, palms, boats, pier -------------------------------------------------
  const lampGlows = [];
  [[-3.2, -7.0], [3.2, -7.0], [-6.6, 3.6], [6.6, 3.6], [-3.1, 11.8], [3.1, 11.8], [10, 11.8], [-10, 11.8], [16.3, 12.4]].forEach(([x, z]) => {
    const p = new THREE.Group(); p.position.set(x, 0, z); scene.add(p);
    p.add(cyl(0.06, 0.09, 3.0, 6, 0x2a3040, 0, 0, 0), box(0.36, 0.05, 0.36, 0x2a3040, 0, 2.98, 0), cone(0.3, 0.22, 4, 0x2a3040, 0, 3.36, 0, { ry: Math.PI / 4 }));
    const bulb = box(0.26, 0.34, 0.26, 0xfff0c0, 0, 3.02, 0, { mat: { emissive: 0xffc070, ei: 1.4 } }); p.add(bulb);
    const gl = glowSprite(0xffc070, 1.8, 0.55); gl.position.y = 3.2; p.add(gl); lampGlows.push(gl);
  });
  [[-4.9, 14.25], [5.9, 14.25]].forEach(([x, z]) => { const b = new THREE.Group(); b.position.set(x, 0, z); scene.add(b); b.add(box(2.4, 0.08, 0.5, PAL.woodL, 0, 0.45, 0), box(2.4, 0.5, 0.08, PAL.woodL, 0, 0.55, -0.25), box(0.1, 0.45, 0.45, 0x2a3040, -1.0, 0, 0), box(0.1, 0.45, 0.45, 0x2a3040, 1.0, 0, 0)); });
  const bunting = new THREE.Group(); scene.add(bunting); looks['98'].push(bunting);
  const flagCols = [0xd6443c, 0xffd27a, 0x3f7cc4, 0x6fe0a0, 0xff9ac0];
  [[[-7.2, 3.6, -6.0], [7.2, 3.6, -6.0]], [[-8.0, 3.6, 4.8], [8.0, 3.6, 4.8]]].forEach(([a, b]) => {
    for (let i = 0; i <= 14; i++) {
      const t2 = i / 14; const x = a[0] + (b[0] - a[0]) * t2, z = a[2] + (b[2] - a[2]) * t2, y = a[1] - Math.sin(t2 * Math.PI) * 0.7;
      const f = mesh(new THREE.ConeGeometry(0.16, 0.36, 3), mat(flagCols[i % 5], { side: THREE.DoubleSide }), x, y - 0.18, z, { rx: Math.PI, cast: false }); bunting.add(f);
    }
  });
  function palm(x, z, s) {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(s || 1); scene.add(p);
    for (let i = 0; i < 6; i++) { const seg = cyl(0.14 - i * 0.012, 0.16 - i * 0.012, 0.7, 6, i % 2 ? PAL.woodL : PAL.wood, i * 0.06, i * 0.66, 0, { rz: -0.06 }); p.add(seg); blockers.push(seg); }
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const leaf = box(0.35, 0.05, 1.8, i % 2 ? PAL.grass : PAL.grassD, 0.4 + Math.cos(a) * 0.8, 4.0, Math.sin(a) * 0.8); leaf.lookAt(0.4 + Math.cos(a) * 3, 3.2, Math.sin(a) * 3); p.add(leaf); }
    p.add(ball(0.14, 0, 0x6a4a2a, 0.4, 3.9, 0.1), ball(0.13, 0, 0x6a4a2a, 0.3, 3.85, -0.12));
  }
  palm(-8, 15.6, 1); palm(-14, 16.5, 1.1); palm(7.5, 15.8, 0.95); palm(-3.8, 10.4, 1.0); palm(-12, 9.8, 1.05);
  // pier
  const pier = new THREE.Group(); scene.add(pier);
  pier.add(box(2.6, 0.12, 11.2, PAL.woodL, 0, -0.06, 19.6));
  for (let z = 14.5; z < 25.5; z += 0.7) { pier.add(box(2.6, 0.02, 0.06, PAL.woodD, 0, 0.0, z, { cast: false })); }
  for (let z = 15; z < 25.5; z += 2.2) { [-1.2, 1.2].forEach((x) => { pier.add(cyl(0.11, 0.11, 2.0, 6, PAL.woodD, x, -1.6, z)); pier.add(cyl(0.05, 0.05, 0.9, 5, PAL.woodD, x, 0, z)); }); }
  [-1.2, 1.2].forEach((x) => pier.add(box(0.06, 0.06, 10.6, PAL.woodD, x, 0.85, 19.9)));
  const pierPost = cyl(0.16, 0.16, 1.1, 7, PAL.woodD, 0.0, 0, 24.9); pier.add(pierPost);
  anchors.pier = pierPost;
  function boat(x, z, ry, c) {
    const b = new THREE.Group(); b.position.set(x, -0.55, z); b.rotation.y = ry; scene.add(b);
    b.add(box(1.4, 0.5, 3.2, c, 0, 0, 0), box(1.5, 0.08, 3.3, PAL.white, 0, 0.5, 0), cone(0.7, 1.0, 4, c, 0, 0, 1.9, { rx: Math.PI / 2 }));
    b.add(cyl(0.04, 0.04, 2.4, 5, PAL.woodD, 0, 0.5, -0.2));
    const sail = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.0, 3), mat(0xfff8ee, { side: THREE.DoubleSide })); sail.position.set(0, 1.7, -0.1); sail.scale.set(1, 1, 0.05); b.add(sail);
    return b;
  }
  const boats = [boat(4.2, 21, 0.3, 0x3f7cc4), boat(-5, 27, -0.5, 0xd6443c)];

  // ---- the rocky point and the lighthouse ---------------------------------------------------------------
  const point = new THREE.Group(); scene.add(point);
  point.add(cyl(4.6, 5.4, 1.2, 10, PAL.stoneD, 16.2, -1.15, 18.4, { cast: false }), cyl(4.4, 4.6, 0.12, 12, PAL.grass, 16.2, -0.07, 18.4, { cast: false }));
  point.add(box(5.4, 0.08, 4.8, 0xd8c8a8, 13.6, 0, 13.7, { cast: false }));
  for (let i = 0; i < 14; i++) { const a = R() * Math.PI * 2, d = 4.2 + R() * 1.6; point.add(ball(0.5 + R() * 0.9, 0, i % 2 ? PAL.stoneD : 0x8a8070, 16.2 + Math.cos(a) * d, -0.4, 18.4 + Math.sin(a) * d)); }
  const lh = new THREE.Group(); lh.position.set(17.2, 0, 19.6); scene.add(lh);
  const towerH = 8.2;
  const towerBody = mesh(new THREE.CylinderGeometry(1.15, 1.75, towerH, 10), mat(PAL.white), 0, towerH / 2, 0); lh.add(towerBody); blockers.push(towerBody);
  [1.6, 4.4, 7.0].forEach((y) => { const rr = 1.75 - (0.6 * y) / towerH; lh.add(mesh(new THREE.CylinderGeometry(rr - 0.03, rr + 0.03, 0.9, 10), mat(PAL.red), 0, y, 0)); });
  // door facing Theo
  const doorDir = new THREE.Vector2(THEO_SPOT.x - 17.2, THEO_SPOT.z - 19.6).normalize();
  const lhDoor = box(0.8, 1.6, 0.1, PAL.woodD, doorDir.x * 1.7, 0, doorDir.y * 1.7); lhDoor.lookAt(doorDir.x * 10, 0, doorDir.y * 10); lh.add(lhDoor);
  lh.add(cyl(1.7, 1.7, 0.18, 12, 0x2a3040, 0, towerH, 0));                                     // gallery floor
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; lh.add(cyl(0.03, 0.03, 0.7, 4, 0x2a3040, Math.cos(a) * 1.6, towerH + 0.1, Math.sin(a) * 1.6)); }
  lh.add(mesh(new THREE.TorusGeometry(1.6, 0.04, 3, 24), mat(0x2a3040), 0, towerH + 0.8, 0, { rx: Math.PI / 2 }));
  // the lamp room: present in the 1998 copy; missing (static) in the present and the 2004 copy
  const lampRoom = new THREE.Group(); lampRoom.position.y = towerH + 0.18; lh.add(lampRoom);
  const lampParts = [];
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.35, roughness: 0.1, flatShading: true });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pane = mesh(new THREE.BoxGeometry(0.75, 1.3, 0.04), glassMat, Math.cos(a) * 0.95, 0.65, Math.sin(a) * 0.95, { cast: false }); pane.lookAt(lh.position.x, 0, lh.position.z); pane.rotation.set(0, -a + Math.PI / 2, 0);
    const mull = cyl(0.04, 0.04, 1.3, 4, 0x2a3040, Math.cos(a + 0.39) * 1.0, 0, Math.sin(a + 0.39) * 1.0);
    lampRoom.add(pane, mull); lampParts.push(pane, mull);
  }
  const roof = cone(1.3, 1.1, 10, PAL.red, 0, 1.3, 0); const knob = ball(0.18, 0, 0x2a3040, 0, 2.5, 0);
  lampRoom.add(roof, knob); lampParts.push(roof, knob);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffd27a, emissiveIntensity: 0.0, flatShading: true });
  const lamp = mesh(new THREE.OctahedronGeometry(0.42, 0), lampMat, 0, 0.6, 0); lampRoom.add(lamp); lampParts.push(lamp);
  lampParts.forEach((p) => { p.userData.home = p.position.clone(); p.userData.homeRot = p.rotation.clone(); });
  // static noise where the lamp should be
  const staticG = new THREE.Group(); staticG.position.y = towerH + 0.2; lh.add(staticG);
  const staticBits = [];
  for (let i = 0; i < 26; i++) { const sb = box(0.16 + R() * 0.3, 0.12 + R() * 0.25, 0.16 + R() * 0.3, [0xffffff, 0x8fe8ff, 0xff4fd0, 0x222222][i % 4], (R() - 0.5) * 1.8, R() * 1.8, (R() - 0.5) * 1.8, { cast: false, mat: { emissive: 0xffffff, ei: 0.25, unique: false } }); staticG.add(sb); staticBits.push(sb); }
  // the beam
  const beamG = new THREE.Group(); beamG.position.y = towerH + 0.8; lh.add(beamG); beamG.visible = false;
  [0, Math.PI].forEach((a) => { const b = new THREE.Mesh(new THREE.ConeGeometry(2.2, 34, 16, 1, true), glow(0xfff0b0, { additive: true, opacity: 0.16, side: THREE.DoubleSide })); b.rotation.z = Math.PI / 2; b.position.x = 17; const arm = new THREE.Group(); arm.rotation.y = a; arm.add(b); beamG.add(arm); });
  const lampGlow = glowSprite(0xfff0b0, 6, 0); lampGlow.position.y = towerH + 0.8; lh.add(lampGlow);
  const lampLight = new THREE.PointLight(0xffd890, 0, 40, 1.2); lampLight.position.y = towerH + 0.8; lh.add(lampLight);
  anchors.lighthouse = lh;

  // ---- Theo --------------------------------------------------------------------------------------------
  const theo = makeTheo(); theo.position.set(THEO_SPOT.x, 0, THEO_SPOT.z); theo.rotation.y = Math.atan2(17.2 - THEO_SPOT.x, 19.6 - THEO_SPOT.z) + Math.PI * 0.85; scene.add(theo);
  anchors.theo = theo;
  const theoLanternLight = new THREE.PointLight(0xffc070, 0.0, 4, 1.6); theo.add(theoLanternLight); theoLanternLight.position.set(-0.4, 0.4, 0.2);

  // seagulls
  const gulls = [];
  for (let i = 0; i < 6; i++) {
    const g2 = new THREE.Group(); const w1 = box(0.6, 0.03, 0.16, 0xffffff, -0.3, 0, 0, { cast: false }), w2 = box(0.6, 0.03, 0.16, 0xffffff, 0.3, 0, 0, { cast: false }); g2.add(w1, w2, box(0.12, 0.1, 0.36, 0xf4f4f4, 0, -0.05, 0, { cast: false }));
    g2.userData = { w1, w2, r: 10 + i * 3, h: 9 + (i % 3) * 2, sp: 0.15 + i * 0.03, ph: i * 1.3, cx: 4 + i * 2, cz: 24 + i };
    scene.add(g2); gulls.push(g2);
  }
  looks.present.push(...gulls); looks['98'].push(...gulls);

  // ---- state switching ---------------------------------------------------------------------------------
  let view = null, restored = false, lit = false;
  let restoreT = -1, lightT = -1;
  const PRESENT = { fog: 0xf0a080, hemiS: 0xffd8b8, hemiG: 0x4a6a5a, hemiI: 1.0, sun: 0xffb070, sunI: 3.0, sea: PAL.sea, grass: PAL.grass };
  const V98 = { fog: 0xffc890, hemiS: 0xfff0c8, hemiG: 0x6a8a5a, hemiI: 1.25, sun: 0xffc880, sunI: 3.6, sea: 0x4aa8d8, grass: 0x7fd06a };
  const V04 = { fog: 0x8a94a8, hemiS: 0xb8c4d8, hemiG: 0x3a4250, hemiI: 0.85, sun: 0xc8d4e8, sunI: 1.4, sea: 0x4a6a88, grass: 0x6a8a6a };
  function applyLook(L, which) {
    scene.fog.color.set(L.fog); scene.fog.near = which === '04' ? 18 : 40; scene.fog.far = which === '04' ? 110 : 170;
    hemi.color.set(L.hemiS); hemi.groundColor.set(L.hemiG); hemi.intensity = L.hemiI; sun.color.set(L.sun); sun.intensity = L.sunI;
    seaMat.color.set(L.sea); grass.material = mat(L.grass);
    skyPresent.visible = which === 'present'; sky98.visible = which === '98'; sky04.visible = which === '04';
    sunDisc.visible = sunCore.visible = which !== '04';
    bunting.visible = which !== '04';
    gulls.forEach((g2) => { g2.visible = which !== '04'; });
    houses.forEach((h2, i) => { h2.userData.roof.visible = !(which === '04' && (i === 3 || i === 7)); });
    lampGlows.forEach((gl) => { gl.visible = which !== '04'; });
    // the lighthouse: lamp exists in 1998, or after restoring
    const hasLamp = which === '98' || (which === 'present' && restored);
    lampRoom.visible = hasLamp || restoreT >= 0;
    staticG.visible = !hasLamp && restoreT < 0;
    const lampOn = which === '98' || (which === 'present' && lit);
    lampMat.emissiveIntensity = lampOn ? 2.2 : 0.05; lampGlow.material.opacity = lampOn ? 0.85 : 0; lampLight.intensity = lampOn ? 60 : 0; beamG.visible = lampOn;
    redraw(signTex, which === '98' ? signDraw('JUNE\u2019S BAKERY', '#fdf8ef', '#c0443c', 'est. 1998') : which === '04' ? signDraw('[deleted]', '#c8ccd2', '#5a6070') : signDraw('', '#fdf8ef', '#c0443c'));
    note.visible = which !== '98';
    redraw(muralTex, muralDraw(which));
    k98.scr.material.emissiveIntensity = which === '98' ? 1.6 : 0.6; k04.scr.material.emissiveIntensity = which === '04' ? 1.6 : 0.6;
    k98.light.intensity = which === '98' ? 8 : 3; k04.light.intensity = which === '04' ? 8 : 3;
  }
  applyLook(PRESENT, 'present');

  // Theo's walk to the lighthouse door and back
  let theoMode = 'idle', theoPhase = 0, theoSpeed = 0;
  const api = {
    scene, anchors, blockers, theo,
    get view() { return view; },
    setView(v) { view = v; applyLook(v === '98' ? V98 : v === '04' ? V04 : PRESENT, v || 'present'); },
    setRestored(on, animate) {
      restored = on;
      if (on && animate) {
        restoreT = 0;
        lampParts.forEach((p, i) => { const a = (i / lampParts.length) * Math.PI * 2; p.position.set(p.userData.home.x + Math.cos(a) * 6, p.userData.home.y + 8 + (i % 3) * 2, p.userData.home.z + Math.sin(a) * 6); p.rotation.set(i, i * 0.7, 0); });
      }
      applyLook(view === '98' ? V98 : view === '04' ? V04 : PRESENT, view || 'present');
    },
    setLit(on, animate) { lit = on; if (on && animate) { lightT = 0; } applyLook(view === '98' ? V98 : view === '04' ? V04 : PRESENT, view || 'present'); },
    get restoring() { return restoreT >= 0; },
    startLighting() { theoMode = 'toDoor'; },
    get lighting() { return theoMode !== 'idle' && theoMode !== 'done'; },
    theoFace(x, z) { if (theoMode === 'idle' || theoMode === 'done') { const target = Math.atan2(x - theo.position.x, z - theo.position.z); theo.rotation.y += Math.atan2(Math.sin(target - theo.rotation.y), Math.cos(target - theo.rotation.y)) * 0.12; } },
    update(dt, t, reduce, onEvent) {
      // sea waves
      if (!reduce) {
        const p = sea.geometry.attributes.position; const arr = p.array;
        for (let i = 0; i < arr.length; i += 3) { const x = seaBase[i], z = seaBase[i + 2]; arr[i + 1] = Math.sin(x * 0.18 + t * 1.1) * 0.18 + Math.cos(z * 0.22 + t * 0.8) * 0.16; }
        p.needsUpdate = true;
      }
      glitter.forEach((g2, i) => { g2.material.opacity = view === '04' ? 0 : Math.max(0, Math.sin(t * 2 + i * 1.7)) * (lit ? 0.7 : 0.35); });
      spout.scale.y = reduce ? 1 : 1 + Math.sin(t * 6) * 0.08; fish.rotation.y = t * 0.5;
      boats.forEach((b, i) => { b.position.y = -0.55 + (reduce ? 0 : Math.sin(t * 1.2 + i) * 0.08); b.rotation.z = reduce ? 0 : Math.sin(t * 0.9 + i) * 0.04; });
      gulls.forEach((g2) => { const u = g2.userData; const a = t * u.sp + u.ph; g2.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(t * 0.7 + u.ph) * 0.6, u.cz + Math.sin(a) * u.r); g2.rotation.y = -a; const f = reduce ? 0.2 : Math.sin(t * 6 + u.ph) * 0.45; u.w1.rotation.z = f; u.w2.rotation.z = -f; });
      // static flicker
      if (staticG.visible) { staticBits.forEach((sb, i) => { sb.visible = reduce ? i % 2 === 0 : Math.sin(t * 17 + i * 3.1) > -0.2; }); if (!reduce) { staticG.rotation.y = t * 2; } }
      // restore: lamp pieces fly home
      if (restoreT >= 0) {
        restoreT += dt; const k = Math.min(1, restoreT / (reduce ? 0.6 : 2.6)); const e2 = 1 - Math.pow(1 - k, 3);
        lampParts.forEach((p, i) => { const d = Math.min(1, Math.max(0, e2 * 1.3 - (i / lampParts.length) * 0.3)); p.position.lerp(p.userData.home, d * 0.25 + (k >= 1 ? 1 : 0)); p.rotation.x *= 1 - d * 0.3; p.rotation.y *= 1 - d * 0.3; if (k >= 1) { p.position.copy(p.userData.home); p.rotation.copy(p.userData.homeRot); } });
        lampGlow.material.opacity = Math.sin(k * Math.PI) * 0.8;
        if (k >= 1) { restoreT = -1; applyLook(PRESENT, 'present'); if (onEvent) { onEvent('restoreDone'); } }
      }
      // Theo
      const door = { x: THEO_DOOR.x, z: THEO_DOOR.z };
      if (theoMode === 'toDoor' || theoMode === 'back') {
        const goal = theoMode === 'toDoor' ? door : THEO_SPOT;
        const dx = goal.x - theo.position.x, dz = goal.z - theo.position.z, dist = Math.hypot(dx, dz);
        if (dist < 0.08) {
          if (theoMode === 'toDoor') { theoMode = 'inside'; lightT = 0; theo.visible = false; } else { theoMode = 'done'; theoSpeed = 0; if (onEvent) { onEvent('lightDone'); } }
        } else {
          const sp = reduce ? 3.5 : 1.6; theoSpeed = sp; const step = Math.min(dist, sp * dt);
          theo.position.x += (dx / dist) * step; theo.position.z += (dz / dist) * step; theo.rotation.y = Math.atan2(dx, dz); theoPhase += step * 4.2;
        }
      } else if (theoMode === 'inside') {
        lightT += dt;
        const ignite = reduce ? 0.6 : 2.2;
        if (lightT > ignite && !lit) { lit = true; applyLook(PRESENT, 'present'); if (onEvent) { onEvent('ignite'); } }
        if (lightT > ignite + (reduce ? 0.6 : 2.0)) { theoMode = 'back'; theo.visible = true; theo.position.set(door.x, 0, door.z); }
      } else { theoSpeed = 0; }
      theoLanternLight.intensity = lit ? 1.2 : 0.6; theo.userData.lanternGlass.material.color.set(lit ? 0xffd27a : 0xc08a4a);
      if (beamG.visible) { beamG.rotation.y = t * (reduce ? 0.25 : 0.6); }
      if (lit && lightT >= 0 && lightT < 3) { lampLight.intensity = 60 + 140 * Math.max(0, 1 - lightT / 1.2); }
    },
    theoAnim(t, reduce, talking) { const m = theoMode === 'toDoor' || theoMode === 'back' ? 'walk' : (talking ? 'talk' : 'idle'); return { phase: theoPhase, speed: theoSpeed, mode: m }; }
  };
  return api;
}
