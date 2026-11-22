// R4: Mom's kitchen, the room of the prologue. One room, two moods, on the same numbers as LAYOUTS.kitchen:
//   'rain'  February 2026, night. Rain on the window, a warm pendant over the table against the cold blue glass,
//           the kettle on the stove, two coats on the hooks.
//   'grey'  October 2026, the same room emptied: flat grey daylight, the pendant off, boxes on the dresser, sympathy
//           cards and her keys on the table, the answering machine blinking, only her coat left on the hook.
// Interior x -3.6..3.6, z -2.8..2.8, height 2.7. Back wall (z -2.8) has the counter and the window over the sink; the
// front door is on the left wall (x -3.6), the study door on the right wall (x 3.6).
import { THREE, PAL, mat, glow, box, cyl, cone, ball, mesh, rng, canvasTex, redraw, panel, glowSprite, softPoints } from './kit.js';

const H = 2.7;

function outsideDraw(mode) {
  return (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (mode === 'rain') { g.addColorStop(0, '#0c1428'); g.addColorStop(0.6, '#1c2a48'); g.addColorStop(1, '#2a3458'); }
    else { g.addColorStop(0, '#9aa2ac'); g.addColorStop(0.7, '#b8bec6'); g.addColorStop(1, '#c8ccd2'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const r = (() => { let s = 5; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
    // the houses across the road; in the rain two windows are lit
    ctx.fillStyle = mode === 'rain' ? '#0a0f1e' : '#7c848e';
    let x = 0; while (x < w) { const bw = 40 + r() * 60, bh = h * (0.25 + r() * 0.2); ctx.fillRect(x, h - bh, bw, bh); if (mode === 'rain' && r() < 0.35) { ctx.fillStyle = 'rgba(255,200,120,0.85)'; ctx.fillRect(x + 10, h - bh + 14, 10, 12); ctx.fillStyle = '#0a0f1e'; } x += bw + 6; }
    if (mode === 'rain') { ctx.strokeStyle = 'rgba(180,200,240,0.25)'; ctx.lineWidth = 1; for (let i = 0; i < 160; i++) { const a = r() * w, b = r() * h; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a - 3, b + 14); ctx.stroke(); } }
  };
}
// water running down the glass (rain only); the texture scrolls in update()
function streakDraw(ctx, w, h) {
  ctx.clearRect(0, 0, w, h); const r = (() => { let s = 3; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
  for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, l = 20 + r() * 60; const g = ctx.createLinearGradient(0, y, 0, y + l); g.addColorStop(0, 'rgba(200,220,255,0)'); g.addColorStop(1, 'rgba(200,220,255,0.55)'); ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 4, y + l); ctx.stroke(); ctx.fillStyle = 'rgba(220,235,255,0.6)'; ctx.beginPath(); ctx.arc(x, y + l, 1.6, 0, Math.PI * 2); ctx.fill(); }
}

export function buildKitchen(opts) {
  const o = opts || {};
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x141826); scene.fog = new THREE.Fog(0x1a1e2c, 9, 22);
  const blockers = [], anchors = {}; const R = rng(23);

  // ---- light ---------------------------------------------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0x8090c0, 0x302820, 0.35); scene.add(hemi);
  const win = new THREE.DirectionalLight(0x7f9cd8, 0.9); win.position.set(0.4, 2.4, -7); win.target.position.set(0, 0, 0.5);
  win.castShadow = true; win.shadow.mapSize.set(o.shadow || 1024, o.shadow || 1024); Object.assign(win.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 16 }); win.shadow.bias = -0.0008; scene.add(win, win.target);
  const pendant = new THREE.PointLight(0xffb36a, 7, 7, 1.6); pendant.position.set(0, 2.05, 0.5); pendant.castShadow = false; scene.add(pendant);
  const stoveGlow = new THREE.PointLight(0xff8a50, 0.6, 2.2, 2); stoveGlow.position.set(2.3, 1.05, -2.4); scene.add(stoveGlow);
  const fill = new THREE.PointLight(0xffd0b0, 0.6, 9, 2); fill.position.set(-1.5, 2.3, 1.6); scene.add(fill);

  // ---- floor, walls, ceiling --------------------------------------------------------------------------------------
  const tiles = canvasTex(256, 256, (ctx, w, h) => { for (let j = 0; j < 8; j++) { for (let i = 0; i < 8; i++) { ctx.fillStyle = (i + j) % 2 ? '#d9d0bf' : '#9e8f7a'; ctx.fillRect(i * 32, j * 32, 32, 32); } } }, { repeat: [3.6, 2.8] });
  scene.add(mesh(new THREE.PlaneGeometry(7.2, 5.6), new THREE.MeshStandardMaterial({ color: tiles ? 0xffffff : 0xb8ad98, map: tiles, roughness: 0.9 }), 0, 0, 0, { rx: -Math.PI / 2, cast: false }));
  const wallTex = canvasTex(256, 256, (ctx, w, h) => { ctx.fillStyle = '#e6dcc4'; ctx.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { ctx.fillStyle = 'rgba(150,130,100,0.08)'; ctx.fillRect(0, y, w, 1); } }, { repeat: [3, 1] });
  const wallMat = new THREE.MeshStandardMaterial({ color: wallTex ? 0xffffff : 0xe6dcc4, map: wallTex, roughness: 0.95 });
  const wall = (w, h, x, y, z, ry) => { const m = mesh(new THREE.PlaneGeometry(w, h), wallMat, x, y, z, { ry, cast: false }); scene.add(m); blockers.push(m); return m; };
  // back wall with the window (x -0.4..1.2, y 1.15..2.1)
  wall(3.2, H, -2.0, H / 2, -2.8, 0); wall(2.4, H, 2.4, H / 2, -2.8, 0); wall(1.6, 1.15, 0.4, 0.575, -2.8, 0); wall(1.6, 0.6, 0.4, 2.4, -2.8, 0);
  wall(5.6, H, -3.6, H / 2, 0, Math.PI / 2); wall(5.6, H, 3.6, H / 2, 0, -Math.PI / 2); wall(7.2, H, 0, H / 2, 2.8, Math.PI);
  scene.add(mesh(new THREE.PlaneGeometry(7.2, 5.6), mat(0xf0ead8), 0, H, 0, { rx: Math.PI / 2, cast: false }));
  [[0, -2.78, 7.2, 0], [-3.58, 0, 5.6, Math.PI / 2], [3.58, 0, 5.6, Math.PI / 2], [0, 2.78, 7.2, 0]].forEach(([x, z, w, ry]) => scene.add(box(w, 0.1, 0.04, PAL.woodDD, x, 0, z, { ry, cast: false })));

  // ---- the window: outside, the rain on the glass, the frame ---------------------------------------------------------
  const outTex = canvasTex(512, 320, outsideDraw('rain'));
  const outside = panel(2.6, 1.8, outTex, 0x1c2a48, { fog: false }); outside.position.set(0.4, 1.6, -3.6); scene.add(outside);
  const streakTex = canvasTex(256, 256, streakDraw, { repeat: [1, 1] });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.95), new THREE.MeshBasicMaterial({ map: streakTex, transparent: true, opacity: 0.8, depthWrite: false })); glass.position.set(0.4, 1.625, -2.79); scene.add(glass);
  scene.add(box(1.7, 0.06, 0.12, PAL.white, 0.4, 1.12, -2.78), box(1.7, 0.06, 0.12, PAL.white, 0.4, 2.1, -2.78), box(0.06, 1.0, 0.12, PAL.white, -0.42, 1.12, -2.78), box(0.06, 1.0, 0.12, PAL.white, 1.22, 1.12, -2.78), box(0.04, 1.0, 0.08, PAL.white, 0.4, 1.12, -2.78));
  // rain falling past the window outside
  const rn = 220; const rpos = new Float32Array(rn * 3); for (let i = 0; i < rn; i++) { rpos[i * 3] = -1.2 + R() * 3.2; rpos[i * 3 + 1] = R() * 3; rpos[i * 3 + 2] = -3.0 - R() * 0.5; }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
  const rain = new THREE.Points(rainGeo, softPoints('mote', { size: 0.03, opacity: 0.55 })); scene.add(rain);

  // ---- counter, sink, stove, kettle, cupboards --------------------------------------------------------------------------
  const wood = 0x8a5e3e, top = 0xd8cfc0;
  scene.add(box(7.2, 0.88, 0.6, wood, 0, 0, -2.5), box(7.2, 0.07, 0.64, top, 0, 0.88, -2.5));
  for (let i = 0; i < 9; i++) { scene.add(box(0.02, 0.7, 0.01, PAL.woodDD, -3.2 + i * 0.8, 0.1, -2.19, { cast: false })); scene.add(box(0.12, 0.03, 0.02, 0xb0a890, -2.95 + i * 0.8, 0.72, -2.18, { cast: false })); }
  scene.add(box(0.7, 0.05, 0.45, 0x9aa0a8, 0.4, 0.9, -2.5), box(0.6, 0.02, 0.36, 0x4a525a, 0.4, 0.93, -2.5), cyl(0.02, 0.02, 0.3, 6, 0xc0c4c8, 0.4, 0.95, -2.72));
  scene.add(box(0.8, 0.04, 0.6, 0x2a2a2e, 2.3, 0.95, -2.5));
  [[2.12, -2.38], [2.48, -2.38], [2.12, -2.62], [2.48, -2.62]].forEach(([x, z]) => scene.add(cyl(0.11, 0.11, 0.01, 12, 0x5a5a60, x, 0.99, z)));
  const kettle = new THREE.Group(); kettle.position.set(2.12, 1.0, -2.38); scene.add(kettle);
  kettle.add(cyl(0.12, 0.14, 0.2, 12, 0xc0442e, 0, 0, 0), cone(0.1, 0.08, 12, 0xc0442e, 0, 0.2, 0), ball(0.025, 1, 0x2a2a2e, 0, 0.29, 0), box(0.04, 0.04, 0.16, 0x2a2a2e, 0, 0.26, 0, { cast: false }));
  const spout = cyl(0.015, 0.03, 0.14, 6, 0xc0442e, 0.13, 0.1, 0, { rz: -0.9 }); kettle.add(spout);
  const steam = glowSprite(0xffffff, 0.5, 0); steam.position.set(2.32, 1.3, -2.38); scene.add(steam);
  anchors.kettle = kettle;
  // upper cupboards (not over the window)
  [[-2.0, 3.0], [2.55, 2.1]].forEach(([x, w]) => { scene.add(box(w, 0.7, 0.35, 0xa07a58, x, 1.75, -2.62)); for (let k = 0; k < Math.round(w / 0.6); k++) { scene.add(box(0.02, 0.6, 0.01, PAL.woodDD, x - w / 2 + 0.6 * (k + 1), 1.8, -2.44, { cast: false })); } });
  // mugs: one by the sink, one on the draining board
  const mugA = cyl(0.045, 0.04, 0.1, 10, 0xf0e8d8, 0.9, 0.92, -2.4), mugB = cyl(0.045, 0.04, 0.1, 10, 0x7aa0c0, 1.1, 0.92, -2.55); scene.add(mugA, mugB);
  // the answering machine
  const machine = new THREE.Group(); machine.position.set(-1.7, 0.92, -2.5); scene.add(machine);
  machine.add(box(0.34, 0.08, 0.24, 0x2a2a30, 0, 0, 0), box(0.12, 0.02, 0.08, 0x40404a, 0.08, 0.08, 0.02));
  const led = glowSprite(0xff4040, 0.18, 0.9); led.position.set(-1.6, 1.02, -2.4); scene.add(led);
  const ledDot = ball(0.012, 1, 0xff3030, -0.1, 0.085, 0.08); machine.add(ledDot);

  // ---- fridge, table, chairs, pendant -------------------------------------------------------------------------------------
  const fridge = box(0.62, 1.85, 1.05, 0xf2f2ee, 3.27, 0, 0.7); scene.add(fridge); blockers.push(fridge);
  scene.add(box(0.02, 0.6, 0.04, 0xa0a0a0, 2.95, 1.0, 0.32), box(0.01, 0.16, 0.11, 0x4a7fb0, 2.955, 1.35, 0.85, { cast: false }), box(0.01, 0.1, 0.14, 0xffffff, 2.955, 1.6, 0.6, { cast: false }), box(0.01, 0.14, 0.1, 0xf0d070, 2.955, 1.1, 0.9, { cast: false }));
  scene.add(cyl(0.78, 0.78, 0.05, 20, 0x9a6a44, 0, 0.74, 0.5), cyl(0.07, 0.12, 0.74, 8, PAL.woodD, 0, 0, 0.5));
  const chair = (x, z, ry) => { const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; c.add(box(0.42, 0.04, 0.42, 0x7a5236, 0, 0.45, 0), box(0.42, 0.5, 0.04, 0x7a5236, 0, 0.47, -0.2)); [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([a, b]) => c.add(box(0.03, 0.45, 0.03, PAL.woodD, a, 0, b))); scene.add(c); return c; };
  chair(-0.95, 0.5, Math.PI / 2); chair(0.95, 0.5, -Math.PI / 2);
  const shade = cone(0.28, 0.22, 16, 0x2e4a3e, 0, 2.05, 0.5); shade.material.side = THREE.DoubleSide; scene.add(shade, cyl(0.005, 0.005, 0.45, 4, 0x202020, 0, 2.25, 0.5));
  const bulb = glowSprite(0xffc078, 0.8, 0.9); bulb.position.set(0, 2.02, 0.5); scene.add(bulb);
  // on the table (October): the keys in a bowl, sympathy cards
  const bowl = cyl(0.14, 0.09, 0.06, 12, 0x5a7a8a, 0.45, 0.765, 0.75); scene.add(bowl);
  const keysG = new THREE.Group(); keysG.position.set(0.45, 0.82, 0.75); keysG.add(box(0.06, 0.01, 0.02, 0xd8b050, 0, 0, 0, { cast: false }), box(0.05, 0.01, 0.015, 0xb0b0b8, 0.03, 0.004, 0.03, { cast: false }), cyl(0.02, 0.02, 0.005, 10, 0xd8b050, -0.03, 0, 0, { cast: false })); scene.add(keysG);
  const cards = new THREE.Group(); scene.add(cards);
  [[-0.5, 0.25, 0.3], [-0.3, 0.1, -0.2], [-0.62, 0.5, 0.6], [-0.2, 0.45, 0.1]].forEach(([x, z, ry], i) => { const cd = box(0.14, 0.18, 0.01, i === 1 ? 0xdde8f0 : 0xf6f0e4, x, 0.77, z, { ry, cast: false }); cd.rotation.x = -0.25; cards.add(cd); });
  const cupTable = cyl(0.045, 0.04, 0.1, 10, 0xf0e8d8, 0.35, 0.765, 0.2); scene.add(cupTable);

  // ---- left wall: front door, coat hooks, calendar, dresser and boxes ----------------------------------------------------------
  scene.add(box(0.08, 2.05, 0.95, 0x5a3a28, -3.56, 0, 1.6), ball(0.04, 1, 0xd8b050, -3.5, 1.0, 1.25));
  scene.add(box(0.04, 0.06, 0.8, PAL.woodD, -3.56, 1.6, 0.45));
  const coatElena = new THREE.Group(); coatElena.position.set(-3.46, 0.75, 0.25); coatElena.add(box(0.12, 0.85, 0.36, 0xb8a080, 0, 0, 0)); scene.add(coatElena);
  const coatMara = new THREE.Group(); coatMara.position.set(-3.46, 0.8, 0.65); coatMara.add(box(0.12, 0.8, 0.34, 0x3f6f8a, 0, 0, 0)); scene.add(coatMara);
  const drip = glowSprite(0xa0c0ff, 0.12, 0.6); drip.position.set(-3.4, 0.05, 0.65); scene.add(drip);
  scene.add(box(0.02, 0.5, 0.36, 0xf8f4ec, -3.58, 1.3, -0.4, { cast: false }), box(0.025, 0.12, 0.36, 0xc04040, -3.575, 1.68, -0.4, { cast: false }));
  scene.add(box(0.75, 1.0, 1.1, 0x7a5a40, -3.22, 0, -1.45), box(0.78, 0.04, 1.14, 0x8a6a4a, -3.22, 1.0, -1.45));
  const boxes = new THREE.Group(); scene.add(boxes);
  [[-3.25, 1.04, -1.75, 0.5, 0.36, 0.45, 0.1], [-3.2, 1.04, -1.2, 0.48, 0.32, 0.5, -0.08], [-3.22, 1.4, -1.5, 0.42, 0.3, 0.4, 0.2]].forEach(([x, y, z, w, h, d, ry]) => { boxes.add(box(w, h, d, 0xc49a62, x, y, z, { ry }), box(w + 0.005, 0.03, 0.06, 0xd8c8a0, x, y + h - 0.02, z, { ry, cast: false })); });
  // right wall: the study door (locked, a brass keyhole)
  scene.add(box(0.08, 2.05, 0.95, 0x6b4128, 3.56, 0, 2.1), box(0.02, 0.06, 0.03, 0xd8b050, 3.51, 1.0, 1.75));
  anchors.machine = machine; anchors.keys = keysG;

  // ---- behaviour ------------------------------------------------------------------------------------------------------------------
  let mode = 'rain', steamOn = false, blink = false;
  const api = {
    scene, blockers, anchors, hemi,
    setMode(m, st) {
      const s = st || {}; mode = m;
      redraw(outTex, outsideDraw(m));
      const rainy = m === 'rain';
      rain.visible = rainy; glass.visible = rainy; drip.visible = rainy && !!s.coatMara;
      hemi.color.set(rainy ? 0x8090c0 : 0xc8ccd4); hemi.groundColor.set(rainy ? 0x302820 : 0x5a5650); hemi.intensity = rainy ? 0.35 : 0.95;
      win.color.set(rainy ? 0x7f9cd8 : 0xd8dce4); win.intensity = rainy ? 0.9 : 1.6;
      pendant.intensity = rainy ? 7 : 0; bulb.visible = rainy; stoveGlow.intensity = rainy ? 0.6 : 0; fill.intensity = rainy ? 0.6 : 0.9;
      scene.background.set(rainy ? 0x141826 : 0x8a9098); scene.fog.color.set(rainy ? 0x1a1e2c : 0x9aa0a8);
      coatMara.visible = !!s.coatMara; boxes.visible = !rainy; cards.visible = !rainy; bowl.visible = !rainy; keysG.visible = !rainy && !s.keysTaken;
      cupTable.visible = rainy; mugB.visible = !rainy; blink = !rainy && !!s.blink; led.visible = blink;
    },
    setSteam(on) { steamOn = !!on; },
    update(dt, t, reduce) {
      if (rain.visible && !reduce) { const p = rain.geometry.attributes.position; for (let i = 0; i < rn; i++) { let y = p.getY(i) - dt * 7; if (y < 0) { y = 3; } p.setY(i, y); } p.needsUpdate = true; }
      if (glass.visible && streakTex && !reduce) { streakTex.offset.y = (streakTex.offset.y + dt * 0.04) % 1; }
      steam.material.opacity += ((steamOn ? 0.55 + Math.sin(t * 9) * 0.15 : 0) - steam.material.opacity) * Math.min(1, dt * 4); steam.position.y = 1.3 + (reduce ? 0 : (t * 0.4) % 0.25);
      if (blink) { led.material.opacity = Math.sin(t * 5) > 0 ? 0.95 : 0.1; ledDot.material.color.set(Math.sin(t * 5) > 0 ? 0xff3030 : 0x401010); }
      if (mode === 'rain' && !reduce) { pendant.intensity = 7 + Math.sin(t * 13) * 0.05; }
    }
  };
  api.setMode('rain', { coatMara: true });
  void glow;
  return api;
}
