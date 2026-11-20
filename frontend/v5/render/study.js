// P5 prologue: Mom's study at sunset (adapted from P4). Room interior x -4.3..4.3, z -3.3..3.3, height 2.9 (see levels.js).
import { THREE, PAL, mat, glow, box, cyl, cone, ball, mesh, rng, canvasTex, redraw, FONT, panel, glowSprite, softPoints } from './kit.js';

const H = 2.9;

function sunsetDraw(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#5a4aa8'); g.addColorStop(0.35, '#c46aa0'); g.addColorStop(0.62, '#ff9a5e'); g.addColorStop(0.8, '#ffd27a'); g.addColorStop(1, '#ffe6a8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,248,220,0.95)'; ctx.beginPath(); ctx.arc(w * 0.63, h * 0.7, h * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,170,0.35)'; ctx.beginPath(); ctx.arc(w * 0.63, h * 0.7, h * 0.18, 0, Math.PI * 2); ctx.fill();
  const r = (() => { let s = 7; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
  ctx.fillStyle = '#5b3f78';
  let x = 0;
  while (x < w) { const bw = 18 + r() * 40, bh = h * (0.12 + r() * 0.25); ctx.fillRect(x, h - bh, bw, bh); if (r() < 0.6) { ctx.fillStyle = 'rgba(255,214,120,0.8)'; for (let i = 0; i < 4; i++) { ctx.fillRect(x + 4 + r() * (bw - 8), h - bh + 6 + r() * (bh - 12), 3, 4); } ctx.fillStyle = '#5b3f78'; } x += bw + 2; }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  [[0.18, 0.2, 60], [0.42, 0.12, 80], [0.8, 0.28, 50]].forEach((c) => { ctx.beginPath(); ctx.ellipse(c[0] * w, c[1] * h, c[2], c[2] * 0.28, 0, 0, Math.PI * 2); ctx.fill(); });
}

function screenDraw(on, lines) {
  return (ctx, w, h) => {
    ctx.fillStyle = on ? '#0d2a26' : '#141c1c'; ctx.fillRect(0, 0, w, h);
    if (!on) { const g = ctx.createRadialGradient(w * 0.35, h * 0.3, 4, w * 0.4, h * 0.35, w * 0.7); g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); return; }
    ctx.fillStyle = '#7dffd8'; ctx.font = `bold 22px ${FONT}`;
    (lines || []).forEach((ln, i) => ctx.fillText(ln, 18, 40 + i * 32));
    ctx.fillRect(18, 40 + (lines || []).length * 32 - 18, 14, 22);
    for (let y = 0; y < h; y += 4) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, y, w, 2); }
  };
}

export function buildStudy(opts) {
  const o = opts || {};
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1a22);
  scene.fog = new THREE.Fog(0x3a2430, 9, 22);
  const anchors = {};
  const blockers = [];
  const R = rng(11);

  // ---- light ----------------------------------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xffd8b0, 0x4a2c26, 0.75); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffa868, 3.2);
  sun.position.set(-2.2, 3.4, -9); sun.target.position.set(0.6, 0, 0.6);
  sun.castShadow = true; sun.shadow.mapSize.set(o.shadow || 1024, o.shadow || 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 20 }); sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);
  const lampLight = new THREE.PointLight(0xffc27a, 5.5, 7, 1.6); lampLight.position.set(-3.9, 1.55, -2.95); lampLight.castShadow = false; scene.add(lampLight);
  const crtLight = new THREE.PointLight(0x5fe0c0, 0, 4.5, 1.8); crtLight.position.set(3.0, 1.2, -2.5); scene.add(crtLight);
  const fill = new THREE.PointLight(0xff9a7a, 1.2, 9, 2); fill.position.set(0, 2.4, 1.5); scene.add(fill);

  // ---- floor, walls, ceiling ------------------------------------------------------------------------
  const woods = [PAL.wood, 0x8d5a3a, 0xa36a44, 0x93603e];
  for (let i = 0; i < 15; i++) {
    const x = -4.3 + i * 0.58 + 0.29;
    scene.add(box(0.57, 0.04, 6.6, woods[i % 4], x, -0.04, 0, { cast: false }));
  }
  const wallTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#ead1a8'; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { ctx.fillStyle = 'rgba(200,150,110,0.25)'; ctx.fillRect(x, 0, 12, h); }
    ctx.fillStyle = 'rgba(190,120,110,0.35)';
    for (let y = 16; y < h; y += 64) { for (let x = 22; x < w; x += 64) { ctx.beginPath(); ctx.arc(x + ((y / 64) % 2) * 16, y, 4, 0, Math.PI * 2); ctx.fill(); } }
  }, { repeat: [4, 1.2] });
  const wallMat = new THREE.MeshStandardMaterial({ color: wallTex ? 0xffffff : PAL.wallWarm, map: wallTex, roughness: 0.95 });
  function wall(w, h, x, y, z, ry) { const m = mesh(new THREE.PlaneGeometry(w, h), wallMat, x, y, z, { ry, cast: false }); scene.add(m); blockers.push(m); return m; }
  // back wall with a window opening (x -1.6..0.4, y 0.9..2.4)
  wall(2.7, H, -2.95, H / 2, -3.3, 0); wall(3.9, H, 2.35, H / 2, -3.3, 0);
  wall(2.0, 0.9, -0.6, 0.45, -3.3, 0); wall(2.0, 0.5, -0.6, 2.65, -3.3, 0);
  wall(6.6, H, -4.3, H / 2, 0, Math.PI / 2); wall(6.6, H, 4.3, H / 2, 0, -Math.PI / 2); wall(8.6, H, 0, H / 2, 3.3, Math.PI);
  // the thickness of the walls, so they cast shadows and only the window lets the sun in
  [[-2.95, 2.7, -3.42], [2.35, 3.9, -3.42]].forEach(([x, w, z]) => { const b = box(w, H, 0.2, PAL.wallWarm, x, 0, z); b.material = mat(PAL.wallWarm); b.receiveShadow = false; scene.add(b); });
  scene.add(box(2.0, 0.9, 0.2, PAL.wallWarm, -0.6, 0, -3.42), box(2.0, 0.5, 0.2, PAL.wallWarm, -0.6, 2.4, -3.42));
  // wainscoting
  [[0, -3.28, 8.6, 0], [-4.28, 0, 6.6, Math.PI / 2], [4.28, 0, 6.6, Math.PI / 2], [0, 3.28, 8.6, 0]].forEach(([x, z, w, ry]) => {
    const p = box(w, 0.86, 0.03, PAL.wallLow, x, 0, z, { ry, cast: false }); scene.add(p);
    const rail = box(w, 0.06, 0.06, PAL.woodD, x, 0.86, z, { ry, cast: false }); scene.add(rail);
    const skirt = box(w, 0.1, 0.05, PAL.woodDD, x, 0, z, { ry, cast: false }); scene.add(skirt);
  });
  const ceil = mesh(new THREE.PlaneGeometry(8.6, 6.6), mat(PAL.ceiling), 0, H, 0, { rx: Math.PI / 2, cast: false }); scene.add(ceil);
  [-1.6, 1.6].forEach((z) => scene.add(box(8.6, 0.16, 0.22, PAL.woodD, 0, H - 0.16, z, { cast: false })));

  // ---- window, sunset, curtains, light shaft --------------------------------------------------------
  const sunsetTex = canvasTex(512, 384, sunsetDraw);
  const outside = panel(3.6, 2.6, sunsetTex, 0xff9a5e, { fog: false }); outside.position.set(-0.6, 1.55, -4.6); scene.add(outside);
  scene.add(box(2.12, 0.08, 0.3, PAL.white, -0.6, 0.86, -3.3), box(2.12, 0.08, 0.16, PAL.white, -0.6, 2.4, -3.3));
  scene.add(box(0.08, 1.54, 0.16, PAL.white, -1.62, 0.88, -3.3), box(0.08, 1.54, 0.16, PAL.white, 0.42, 0.88, -3.3));
  scene.add(box(0.05, 1.5, 0.06, PAL.white, -0.6, 0.9, -3.3), box(2.0, 0.05, 0.06, PAL.white, -0.6, 1.62, -3.3));
  scene.add(box(2.3, 0.06, 0.32, PAL.white, -0.6, 0.86, -3.12)); // sill
  scene.add(box(0.16, 0.18, 0.16, 0xc05a3a, -1.25, 0.92, -3.15), cone(0.13, 0.32, 5, 0x5aa05a, -1.25, 1.1, -3.15)); // little cactus pot
  const curtains = [];
  [-1.85, 0.65].forEach((x0, side) => {
    const g = new THREE.Group(); g.position.set(x0, 0, -3.12);
    for (let i = 0; i < 5; i++) { const f = box(0.11, 1.95, 0.09, i % 2 ? 0xb83a48 : 0xd04d58, (i - 2) * 0.1, 0.62, (i % 2) * 0.05); g.add(f); }
    g.userData.side = side; curtains.push(g); scene.add(g);
  });
  scene.add(cyl(0.02, 0.02, 2.9, 6, PAL.woodD, -0.6, 2.58, -3.12, { rz: Math.PI / 2 }));
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 5.2), glow(0xffc888, { additive: true, opacity: 0.07, side: THREE.DoubleSide }));
  shaft.position.set(-0.2, 1.0, -1.6); shaft.rotation.set(-1.0, 0.18, 0); scene.add(shaft);

  // ---- desk and the CRT ----------------------------------------------------------------------------
  const desk = new THREE.Group(); desk.position.set(3.15, 0, -2.9); scene.add(desk);
  desk.add(box(2.5, 0.06, 1.05, PAL.woodL, 0, 0.72, 0));
  desk.add(box(2.5, 0.04, 1.05, PAL.woodD, 0, 0.7, 0));
  desk.add(box(0.07, 0.7, 0.07, PAL.woodD, -1.18, 0, 0.45), box(0.07, 0.7, 0.07, PAL.woodD, -1.18, 0, -0.45));
  desk.add(box(0.7, 0.7, 0.98, PAL.wood, 0.88, 0, 0));
  [0.12, 0.38].forEach((y) => { desk.add(box(0.62, 0.2, 0.02, PAL.woodL, 0.88, y, 0.5)); desk.add(box(0.12, 0.03, 0.03, PAL.gold, 0.88, y + 0.1, 0.52)); });
  const crt = new THREE.Group(); crt.position.set(-0.15, 0.78, -0.05); desk.add(crt);
  crt.add(box(0.56, 0.46, 0.5, PAL.crt, 0, 0, 0));
  crt.add(box(0.42, 0.36, 0.3, PAL.crtD, 0, 0.04, -0.36));
  crt.add(box(0.5, 0.06, 0.4, PAL.crtD, 0, -0.05, 0.02));
  crt.add(box(0.46, 0.37, 0.03, PAL.crtD, 0, 0.05, 0.25));
  const screenTex = canvasTex(320, 256, screenDraw(false));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.31), new THREE.MeshStandardMaterial({ color: screenTex ? 0xffffff : PAL.screenOff, map: screenTex, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.12, roughness: 0.3 }));
  screen.position.set(0, 0.235, 0.268); crt.add(screen);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: 0x334433 })); led.position.set(0.2, 0.04, 0.27); crt.add(led);
  crt.add(box(0.64, 0.035, 0.22, PAL.crt, 0, -0.02, 0.48)); // keyboard
  for (let r = 0; r < 3; r++) { for (let k = 0; k < 9; k++) { crt.add(box(0.05, 0.015, 0.04, PAL.crtD, -0.26 + k * 0.065, 0.015, 0.41 + r * 0.055, { cast: false })); } }
  crt.add(box(0.07, 0.03, 0.11, PAL.crt, 0.45, -0.02, 0.45));
  // floppies, mug, sticky notes, desk lamp
  for (let i = 0; i < 5; i++) { desk.add(box(0.09, 0.012, 0.09, [0x3a5aa8, 0xd04d58, 0x2f8a52, 0xe0b040, 0x5a3a8a][i], 0.7 + (i % 2) * 0.01, 0.77 + i * 0.013, -0.25, { ry: i * 0.2 })); }
  desk.add(cyl(0.045, 0.04, 0.1, 8, 0xd8e6ee, 0.48, 0.75, 0.25), cyl(0.012, 0.012, 0.05, 4, 0xd8e6ee, 0.53, 0.78, 0.25, { rz: Math.PI / 2 }));
  [[0.15, 0.35, 0xffe066], [0.13, 0.15, 0xff9ac0]].forEach(([x, y, c]) => { const n = box(0.08, 0.08, 0.005, c, 0.16 + x * 0.2, 0.86 + y * 0.3, 0.21, { cast: false }); crt.add(n); });
  anchors.computer = crt;
  // chair rolled out to the side
  const chair = new THREE.Group(); chair.position.set(1.5, 0, -2.33); chair.rotation.y = 0.6; scene.add(chair);
  chair.add(box(0.5, 0.08, 0.5, 0xc23e52, 0, 0.45, 0), box(0.5, 0.6, 0.08, 0xc23e52, 0, 0.5, -0.24), cyl(0.04, 0.04, 0.4, 6, 0x555566, 0, 0.05, 0));
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; chair.add(box(0.3, 0.04, 0.05, 0x444455, Math.cos(a) * 0.14, 0.03, Math.sin(a) * 0.14, { ry: -a })); }

  // ---- bookshelf ------------------------------------------------------------------------------------
  const shelf = new THREE.Group(); shelf.position.set(-4.08, 0, -1.2); scene.add(shelf);
  shelf.add(box(0.42, 2.25, 2.5, PAL.woodD, 0, 0, 0));
  const bookCols = [0xd6443c, 0x3f7cc4, 0xe0a83a, 0x4fa36b, 0x8a5ad0, 0xf3e6c9, 0x2f3a5a, 0xe46a8a, 0x5fb0c8];
  for (let s = 0; s < 5; s++) {
    const y = 0.08 + s * 0.44;
    shelf.add(box(0.36, 0.03, 2.36, PAL.woodL, 0.04, y, 0, { cast: false }));
    let z = -1.12;
    while (z < 1.1) {
      const t = 0.04 + R() * 0.05, hgt = 0.24 + R() * 0.12;
      if (R() < 0.08) { z += 0.12; continue; }
      const b = box(0.27, hgt, t, bookCols[Math.floor(R() * bookCols.length)], 0.07, y + 0.03, z + t / 2, { cast: false, rz: R() < 0.06 ? 0.25 : 0 });
      shelf.add(b); z += t + 0.006;
    }
  }
  shelf.add(cyl(0.07, 0.09, 0.16, 6, 0x5aa0a0, 0.08, 2.25, -0.8), ball(0.11, 0, 0x5aa05a, 0.08, 2.48, -0.8)); // plant on top
  shelf.add(box(0.2, 0.26, 0.3, PAL.cream, 0.08, 2.25, 0.6, { ry: 0.2 })); // old game box
  anchors.shelf = shelf;

  // ---- floor lamp -----------------------------------------------------------------------------------
  const lamp = new THREE.Group(); lamp.position.set(-3.9, 0, -2.95); scene.add(lamp);
  lamp.add(cyl(0.22, 0.25, 0.05, 10, 0x4a3a2a, 0, 0, 0), cyl(0.025, 0.025, 1.45, 6, 0x4a3a2a, 0, 0.05, 0));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 0.32, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xffe0a8, emissive: 0xffb860, emissiveIntensity: 0.9, side: THREE.DoubleSide, flatShading: true }));
  shade.position.y = 1.58; lamp.add(shade);
  const lampGlow = glowSprite(0xffc070, 1.6, 0.55); lampGlow.position.y = 1.5; lamp.add(lampGlow);
  anchors.lamp = lamp;

  // ---- moving boxes (KEEP) --------------------------------------------------------------------------
  const boxes = new THREE.Group(); boxes.position.set(-1.8, 0, 1.3); scene.add(boxes);
  const card = mat(PAL.card), cardD = mat(PAL.cardD);
  boxes.add(box(0.7, 0.5, 0.55, card, -0.25, 0, -0.1, { ry: 0.15 }));
  boxes.add(box(0.6, 0.42, 0.5, cardD, -0.3, 0.5, -0.12, { ry: -0.1 }));
  const keep = new THREE.Group(); keep.position.set(0.35, 0, 0.15); keep.rotation.y = -0.35; boxes.add(keep);
  keep.add(box(0.62, 0.44, 0.52, card, 0, 0, 0));
  const flap1 = box(0.62, 0.02, 0.26, cardD, 0, 0.44, 0.38, { rx: 0.9 }); flap1.position.y = 0.5; keep.add(flap1);
  const flap2 = box(0.62, 0.02, 0.26, cardD, 0, 0.44, -0.38, { rx: -0.9 }); flap2.position.y = 0.5; keep.add(flap2);
  keep.add(box(0.6, 0.03, 0.5, 0x3a2a2a, 0, 0.42, 0, { cast: false }));
  keep.add(box(0.15, 0.15, 0.012, 0x2f4fa0, -0.1, 0.43, 0.05, { rx: -0.5 })); // the floppy disk
  keep.add(box(0.11, 0.06, 0.014, 0xf3e6c9, -0.1, 0.5, 0.02, { rx: -0.5 })); keep.add(box(0.06, 0.04, 0.014, 0xc0c4cc, -0.1, 0.43, 0.065, { rx: -0.5 }));
  const keepLabel = panel(0.42, 0.16, canvasTex(256, 96, (ctx, w, h) => { ctx.fillStyle = '#f3e6c9'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#2a1a1a'; ctx.font = `bold 34px ${FONT}`; ctx.fillText('KEEP', 12, 40); ctx.font = `20px ${FONT}`; ctx.fillText("sky's things", 12, 76); }), PAL.paper, { lit: true });
  keepLabel.position.set(0, 0.25, 0.265); keep.add(keepLabel);
  keep.add(box(0.64, 0.05, 0.08, 0xc8b070, 0, 0.42, 0.0, { cast: false }));
  anchors.keepbox = keep;
  // a roll of tape and a marker on the floor
  scene.add(cyl(0.07, 0.07, 0.05, 10, 0xd8c070, -0.9, 0, 2.0), box(0.14, 0.02, 0.02, 0x222222, -1.1, 0, 2.15, { ry: 0.7 }));

  // ---- armchair, side table with postcard and radio --------------------------------------------------
  const arm = new THREE.Group(); arm.position.set(-3.7, 0, 1.4); arm.rotation.y = Math.PI / 2 + 0.35; scene.add(arm);
  const fabric = mat(0x3f7c84);
  arm.add(box(1.0, 0.42, 0.85, fabric, 0, 0.08, 0), box(1.0, 0.75, 0.2, fabric, 0, 0.3, -0.38), box(0.18, 0.55, 0.85, fabric, -0.5, 0.15, 0), box(0.18, 0.55, 0.85, fabric, 0.5, 0.15, 0));
  arm.add(box(0.75, 0.12, 0.62, 0x4f9aa2, 0, 0.5, 0.05));
  arm.add(box(0.55, 0.04, 0.5, 0xe8a85a, 0.15, 0.62, 0.1, { ry: 0.3 })); // knitted blanket
  [-0.42, 0.42].forEach((x) => [-0.34, 0.34].forEach((z) => arm.add(box(0.06, 0.08, 0.06, PAL.woodDD, x, 0, z))));
  const side = new THREE.Group(); side.position.set(-3.4, 0, 2.55); scene.add(side);
  side.add(cyl(0.38, 0.38, 0.04, 12, PAL.woodL, 0, 0.62, 0), cyl(0.04, 0.05, 0.62, 6, PAL.woodD, 0, 0, 0), cyl(0.22, 0.25, 0.04, 10, PAL.woodD, 0, 0, 0));
  side.add(box(0.3, 0.16, 0.12, 0x8a2a2a, -0.12, 0.66, -0.1, { ry: 0.3 }), cyl(0.05, 0.05, 0.02, 10, 0xc0c0c0, -0.15, 0.77, -0.04, { rx: Math.PI / 2 })); // radio
  const pcTex = canvasTex(256, 168, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7ab8e8'); g.addColorStop(0.6, '#ffd8a0'); g.addColorStop(1, '#3f8fd0'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3f8fd0'; ctx.fillRect(0, h * 0.68, w, h * 0.32);
    ctx.fillStyle = '#fdf8ef'; ctx.fillRect(w * 0.62, h * 0.18, 18, h * 0.5); ctx.fillStyle = '#d6443c'; ctx.fillRect(w * 0.62, h * 0.32, 18, 12); ctx.fillRect(w * 0.62, h * 0.5, 18, 12);
    ctx.fillStyle = '#ffd27a'; ctx.fillRect(w * 0.62 - 2, h * 0.12, 22, 12);
    ctx.fillStyle = '#ffffff'; ctx.font = `bold 20px ${FONT}`; ctx.fillText('LAST LIGHT', 12, 30); ctx.font = `14px ${FONT}`; ctx.fillText('love, J.', 12, 150);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.strokeRect(0, 0, w, h);
  });
  const postcard = panel(0.28, 0.19, pcTex, 0x7ab8e8, { lit: true }); postcard.rotation.x = -Math.PI / 2; postcard.rotation.z = 0.4; postcard.position.set(0.1, 0.665, 0.08); side.add(postcard);
  side.add(cyl(0.04, 0.035, 0.09, 8, 0xe46a8a, 0.18, 0.64, -0.18));
  anchors.postcard = side;

  // ---- cork board with the photo on the right wall --------------------------------------------------
  const board = new THREE.Group(); board.position.set(4.27, 1.62, 0.6); board.rotation.y = -Math.PI / 2; scene.add(board);
  board.add(box(1.6, 1.0, 0.04, 0xb88a5a, 0, -0.5, 0, { cast: false }));
  board.add(box(1.68, 1.08, 0.03, PAL.woodD, 0, -0.54, -0.01, { cast: false }));
  const photoTex = canvasTex(256, 192, (ctx, w, h) => {
    ctx.fillStyle = '#fdf8ef'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 10, 0, h - 30); g.addColorStop(0, '#8ac0f0'); g.addColorStop(0.6, '#ffd8a0'); g.addColorStop(1, '#3f8fd0');
    ctx.fillStyle = g; ctx.fillRect(10, 10, w - 20, h - 46);
    ctx.fillStyle = '#9a6340'; ctx.fillRect(10, h - 70, w - 20, 34);
    const girl = (x, hair, coat) => { ctx.fillStyle = coat; ctx.fillRect(x - 16, 70, 32, 46); ctx.fillStyle = '#f6d2aa'; ctx.beginPath(); ctx.arc(x, 58, 15, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(x, 52, 16, Math.PI, 0); ctx.fill(); };
    girl(96, '#4b3568', '#f2ad3d'); girl(160, '#c0602a', '#5fb0c8');
    ctx.fillStyle = '#4a3a2a'; ctx.font = `20px ${FONT}`; ctx.fillText('summer 98', 14, h - 12);
  });
  const photo = panel(0.42, 0.32, photoTex, 0xffe0b0, { lit: true }); photo.position.set(-0.2, -0.38, 0.03); photo.rotation.z = -0.05; board.add(photo);
  [[0.45, -0.3, 0xffe066], [0.5, -0.72, 0xff9ac0], [-0.6, -0.75, 0x9ae0ff], [0.15, -0.8, 0xffffff]].forEach(([x, y, c]) => board.add(box(0.2, 0.2, 0.01, c, x, y - 0.1, 0.03, { cast: false, rz: (x * 3) % 0.3 })));
  [[-0.2, -0.2], [0.45, -0.22], [0.5, -0.64], [-0.6, -0.67]].forEach(([x, y]) => board.add(ball(0.02, 0, 0xd6443c, x, y, 0.05)));
  anchors.photo = board;
  // poster on the right wall: the 1998 game
  const posterTex = canvasTex(256, 360, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2f3592'); g.addColorStop(0.6, '#d9a2ee'); g.addColorStop(1, '#ffc3d4'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3f8fd0'; ctx.fillRect(0, h * 0.72, w, h * 0.28); ctx.fillStyle = '#f0d39a'; ctx.fillRect(0, h * 0.82, w, h * 0.18);
    ctx.fillStyle = '#fdf8ef'; ctx.fillRect(w * 0.7, h * 0.4, 20, h * 0.34); ctx.fillStyle = '#d6443c'; ctx.fillRect(w * 0.7, h * 0.5, 20, 14);
    ctx.fillStyle = '#ffd27a'; ctx.font = `bold 40px ${FONT}`; ctx.fillText('LAST', 20, 70); ctx.fillText('LIGHT', 20, 116);
    ctx.fillStyle = '#ffffff'; ctx.font = `18px ${FONT}`; ctx.fillText('summer 1998', 20, 150);
  });
  const poster = panel(0.7, 1.0, posterTex, 0x7a72dc, { lit: true }); poster.position.set(4.27, 1.75, -1.4); poster.rotation.y = -Math.PI / 2; scene.add(poster);

  // ---- front wall: door, framed pictures --------------------------------------------------------------
  scene.add(box(1.0, 2.1, 0.06, 0x8a5a3a, 2.6, 0, 3.27), box(1.15, 0.1, 0.1, PAL.white, 2.6, 2.1, 3.27));
  scene.add(ball(0.04, 0, PAL.gold, 2.2, 1.0, 3.22));
  [[-0.6, 1.9, 0x5fb0c8], [0.3, 1.6, 0xe46a8a]].forEach(([x, y, c]) => { scene.add(box(0.5, 0.4, 0.04, PAL.woodD, x, y, 3.27, { cast: false })); scene.add(box(0.42, 0.32, 0.01, c, x, y + 0.04, 3.245, { cast: false })); });
  const drawTex = canvasTex(256, 320, (ctx, w, h) => {
    ctx.fillStyle = '#fbf6ea'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7ab8e8'; ctx.fillRect(0, h * 0.72, w, h * 0.28);
    ctx.save(); ctx.translate(w * 0.5, h * 0.72); ctx.rotate(0.16);                    // a very crooked lighthouse
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-20, -170); ctx.lineTo(22, -176); ctx.lineTo(38, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e0403a'; [-40, -100].forEach((y) => ctx.fillRect(-30, y, 64, 18));
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(2, -192, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(150, 60); ctx.lineTo(240, 30); ctx.moveTo(150, 72); ctx.lineTo(240, 96); ctx.stroke();
    ctx.fillStyle = '#3a3a8a'; ctx.font = `bold 26px ${FONT}`; ctx.fillText('MARA 6', 14, 34);
  });
  const drawing = panel(0.46, 0.58, drawTex, 0xfbf6ea, { lit: true }); drawing.position.set(-1.5, 1.72, 3.245); drawing.rotation.y = Math.PI; drawing.rotation.z = 0.04; scene.add(drawing);
  scene.add(box(0.06, 0.06, 0.01, 0xd8d0b8, -1.68, 1.98, 3.24, { cast: false }), box(0.06, 0.06, 0.01, 0xd8d0b8, -1.32, 1.98, 3.24, { cast: false })); // tape
  anchors.drawing = drawing;

  // ---- rug, plant -------------------------------------------------------------------------------------
  const rug = mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.02, 24), mat(PAL.rug), 0.4, 0.0, 0.2, { cast: false }); rug.scale.set(1.25, 1, 0.9); scene.add(rug);
  const rug2 = mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.022, 24), mat(PAL.rugL), 0.4, 0.002, 0.2, { cast: false }); rug2.scale.set(1.25, 1, 0.9); scene.add(rug2);
  const plant = new THREE.Group(); plant.position.set(4.0, 0, 3.0); scene.add(plant);
  plant.add(cyl(0.22, 0.17, 0.42, 8, 0xc05a3a, 0, 0, 0));
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const leaf = cone(0.09, 0.8, 4, i % 2 ? 0x4e9a52 : 0x6fbf63, Math.cos(a) * 0.08, 0.4, Math.sin(a) * 0.08); leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); plant.add(leaf); }
  anchors.window = outside;

  // ---- dust in the sunbeam ----------------------------------------------------------------------------
  const dustGeo = new THREE.BufferGeometry(); const dn = 46; const dpos = new Float32Array(dn * 3);
  for (let i = 0; i < dn; i++) { const k = R(); dpos[i * 3] = -1.2 + R() * 1.4 + k * 0.6; dpos[i * 3 + 1] = 0.6 + k * 1.8; dpos[i * 3 + 2] = -2.9 + R() * 1.6 + k * 1.2; }   // a slanting column under the window
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dustGeo, softPoints('mote', { size: 0.035, opacity: 0.2 }));
  scene.add(dust);

  // ---- behaviour --------------------------------------------------------------------------------------
  let crtOn = false, wakeT = -1;
  function setScreen(lines) { if (screenTex) { redraw(screenTex, screenDraw(true, lines)); } }
  const api = {
    scene, anchors, blockers, hemi, sun,
    setLamp(on) { lampLight.intensity = on ? 5.5 : 0; shade.material.emissiveIntensity = on ? 0.9 : 0.05; lampGlow.visible = on; },
    setCrt(on, lines) {
      crtOn = on; screen.material.emissiveIntensity = on ? 1.1 : 0.12; crtLight.intensity = on ? 0.9 : 0;
      led.material.color.set(on ? 0x6fe06f : 0x334433);
      if (screenTex) { redraw(screenTex, screenDraw(on, lines || ['tin 1.2 newsreader', 'user: skylark', '1 saved thread:', ' Last Light'])); }
    },
    wake(t) { wakeT = t; api.setCrt(true); },
    setScreenLines: setScreen,
    update(dt, t, reduce) {
      curtains.forEach((c) => { c.rotation.z = reduce ? 0 : Math.sin(t * 0.7 + c.userData.side * 1.3) * 0.025; });
      if (!reduce) {
        const p = dust.geometry.attributes.position;
        for (let i = 0; i < dn; i++) { let y = p.getY(i) + dt * 0.04; if (y > 2.6) { y = 0.3; } p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i) * dt * 0.02); }
        p.needsUpdate = true;
      }
      if (crtOn) {
        const since = wakeT >= 0 ? t - wakeT : 99;
        const flick = since < 1.2 ? (Math.sin(since * 60) > 0 ? 1.4 : 0.3) : 1.0 + (reduce ? 0 : Math.sin(t * 9) * 0.04);
        screen.material.emissiveIntensity = flick; crtLight.intensity = 0.9 * flick;
      }
    }
  };
  api.setLamp(true);
  return api;
}
