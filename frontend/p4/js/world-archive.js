// Scene B: the old-internet archive. A sleeping network floating in the dark: a landing platform, a bridge,
// the newsgroup plaza with four towers, message stones, and skylark's gate (see levels.js for the walkable layout).
import { THREE, PAL, mat, glow, box, cyl, cone, ball, mesh, rng, canvasTex, FONT, panel, glowSprite, label } from './kit.js';

function postDraw(user, group, lines, accent) {
  return (ctx, w, h) => {
    ctx.fillStyle = 'rgba(10,14,40,0.82)'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = accent; ctx.font = `bold 30px ${FONT}`; ctx.fillText('From: ' + user, 22, 46);
    ctx.fillStyle = '#9fb0e0'; ctx.font = `22px ${FONT}`; ctx.fillText('Newsgroups: ' + group, 22, 80);
    ctx.fillStyle = '#e8ecff'; ctx.font = `24px ${FONT}`;
    lines.forEach((ln, i) => ctx.fillText(ln, 22, 124 + i * 32));
  };
}

const TOWERS = [
  { id: 'homebrew', name: 'alt.games.homebrew', x: -7, z: -27, color: 0xffb347, css: '#ffc46a', h: 9.5 },
  { id: 'music', name: 'rec.music.makers', x: 7, z: -27, color: 0xa98aff, css: '#c4b0ff', h: 8 },
  { id: 'archives', name: 'comp.archives', x: -7, z: -16.5, color: 0x5fe0f0, css: '#8ff0ff', h: 7 },
  { id: 'memories', name: 'alt.memories', x: 7, z: -16.5, color: 0xff8ac0, css: '#ffb0d6', h: 7.5 }
];

const POSTS = {
  pete: { user: 'pixelpete', group: 'alt.games.homebrew', lines: ['Anyone finish a game', 'this summer?'], tower: 'homebrew' },
  owl: { user: 'nightowl', group: 'alt.games.homebrew', lines: ['Lost 3 weeks to a bad', 'floppy. BACK UP.'], tower: 'homebrew' },
  sky: { user: 'skylark', group: 'alt.games.homebrew', lines: ['It\u2019s done. Summer Town.', 'Link below. \u2014 E.'], tower: 'homebrew', special: true },
  june: { user: 'junebug', group: 'rec.music.makers', lines: ['Writing songs for a', 'friend\u2019s game. \u2014 J.'], tower: 'music' },
  mirrorbot: { user: 'mirrorbot', group: 'comp.archives', lines: ['alt.games.* copied to', 'mirror.oldnet.org'], tower: 'archives' },
  notice: { user: 'SERVER', group: 'summer98.net', lines: ['This server closes', 'in 2004.'], tower: null }
};

export function buildArchive(opts) {
  const o = opts || {};
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x090b22);
  scene.fog = new THREE.FogExp2(0x0b0e2a, 0.028);
  const anchors = {};
  const blockers = [];
  const R = rng(23);
  const pulsers = [];

  scene.add(new THREE.HemisphereLight(0x6a7ad8, 0x120c2a, 0.9));
  const key = new THREE.DirectionalLight(0x8a9cff, 1.1); key.position.set(6, 14, 8); scene.add(key);

  const deck = mat(0x1a2050, { rough: 0.35, metal: 0.25 });
  const deckEdge = glow(0x5fe0f0, { additive: true, opacity: 0.85 });
  function disc(x, z, r, edgeColor) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const slab = mesh(new THREE.CylinderGeometry(r, r * 0.92, 0.5, 48), deck, 0, -0.25, 0, { cast: false }); g.add(slab);
    const under = mesh(new THREE.ConeGeometry(r * 0.9, r * 0.9, 12), mat(0x111633), 0, -0.5 - r * 0.45, 0, { rx: Math.PI, cast: false }); g.add(under);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 4, 64), edgeColor ? glow(edgeColor, { additive: true, opacity: 0.9 }) : deckEdge);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.01; g.add(rim);
    const rim2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.82, 0.02, 4, 64), glow(edgeColor || 0x5fe0f0, { additive: true, opacity: 0.35 }));
    rim2.rotation.x = Math.PI / 2; rim2.position.y = 0.012; g.add(rim2);
    scene.add(g);
    return g;
  }
  function bridge(z0, z1, w) {
    const len = z1 - z0, zc = (z0 + z1) / 2;
    scene.add(mesh(new THREE.BoxGeometry(w, 0.4, len), deck, 0, -0.2, zc, { cast: false }));
    [-w / 2, w / 2].forEach((x) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, len), deckEdge); e.position.set(x, 0.02, zc); scene.add(e); });
    const posts = [];
    for (let z = z0 + 1; z < z1 - 0.5; z += 2) {
      [-w / 2 + 0.15, w / 2 - 0.15].forEach((x) => {
        const p = new THREE.Group(); p.position.set(x, 0, z);
        p.add(cyl(0.05, 0.07, 0.9, 6, 0x2a3270, 0, 0, 0));
        const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), glow(0x5fe0f0)); bulb.position.y = 0.95; p.add(bulb);
        const sp = glowSprite(0x5fe0f0, 0.7, 0.5); sp.position.y = 0.95; p.add(sp);
        p.userData = { bulb, sp, z };
        scene.add(p); posts.push(p);
      });
    }
    return posts;
  }

  // ---- landing platform, the doorway Mara came through, the server notice -----------------------------
  disc(0, 0, 3.4);
  const frame = new THREE.Group(); frame.position.set(-2.35, 0, 1.25); frame.rotation.y = 0.95; scene.add(frame);
  frame.add(box(3.0, 0.25, 0.3, PAL.crt, 0, 3.0, 0), box(0.25, 3.0, 0.3, PAL.crt, -1.4, 0, 0), box(0.25, 3.0, 0.3, PAL.crt, 1.4, 0, 0));
  // one-sided, facing the plaza: from behind (where the camera usually is) only the frame shows
  const back = panel(2.6, 2.9, null, 0x5fe0c0, { additive: true, opacity: 0.22, side: THREE.FrontSide }); back.position.set(0, 1.5, -0.05); back.rotation.y = Math.PI; frame.add(back);
  // ---- bridge to the plaza ----------------------------------------------------------------------------
  const posts1 = bridge(-12, 0, 3.4);
  // ---- the plaza ------------------------------------------------------------------------------------
  const plaza = disc(0, -22, 11, 0x8a9cff);
  for (let i = -10; i <= 10; i += 2) {
    const len = 2 * Math.sqrt(Math.max(0, 121 - i * i)) * 0.96;
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, len), glow(0x3a4aa0, { opacity: 0.6 })); l1.position.set(i, 0.006, -22); scene.add(l1);
    const l2 = new THREE.Mesh(new THREE.BoxGeometry(len, 0.01, 0.02), glow(0x3a4aa0, { opacity: 0.6 })); l2.position.set(0, 0.006, -22 + i); scene.add(l2);
  }
  // centre beacon with a slow ring of text
  const beacon = new THREE.Group(); beacon.position.set(0, 0, -22); scene.add(beacon);
  beacon.add(cyl(1.0, 1.2, 0.6, 8, 0x22285a, 0, 0, 0));
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 16, 12, 1, true), glow(0x8a9cff, { additive: true, opacity: 0.25, side: THREE.DoubleSide })); column.position.y = 8; beacon.add(column);
  const ringTex = canvasTex(1024, 64, (ctx, w, h) => { ctx.fillStyle = '#c4ccff'; ctx.font = `bold 34px ${FONT}`; ctx.fillText('  alt.games.homebrew   rec.music.makers   comp.archives   alt.memories   ', 0, 44); });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.4, 32, 1, true), glow(ringTex ? 0xffffff : 0x8a9cff, { map: ringTex, additive: true, opacity: 0.9, side: THREE.DoubleSide })); ring.position.y = 2.6; beacon.add(ring);
  // ---- newsgroup towers ---------------------------------------------------------------------------------
  const towers = {};
  TOWERS.forEach((tw) => {
    const g = new THREE.Group(); g.position.set(tw.x, 0, tw.z); scene.add(g);
    g.add(cyl(1.5, 1.7, 0.5, 8, 0x22285a, 0, 0, 0));
    const body = mesh(new THREE.CylinderGeometry(0.9, 1.25, tw.h, 8), mat(0x1c2258, { rough: 0.4, metal: 0.3 }), 0, 0.5 + tw.h / 2, 0); g.add(body); blockers.push(body);
    const bands = [];
    for (let b = 0; b < 5; b++) {
      const y = 1.2 + b * (tw.h / 5.4);
      const rad = 1.25 - (0.35 * (y - 0.5)) / tw.h + 0.02;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.12, 8, 1, true), glow(tw.color, { additive: true, opacity: 0.8, side: THREE.DoubleSide }));
      band.position.y = y; g.add(band); bands.push(band);
    }
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), glow(tw.color)); cap.position.y = tw.h + 1.6; g.add(cap);
    const capGlow = glowSprite(tw.color, 5, 0.6); capGlow.position.y = tw.h + 1.6; g.add(capGlow);
    const lab = label(tw.name, { color: tw.css, glowColor: tw.css, w: 6, fallback: tw.color }); lab.position.y = tw.h + 3.0; g.add(lab);
    const light = new THREE.PointLight(tw.color, 6, 12, 1.6); light.position.set(0, 2.5, 0); g.add(light);
    towers[tw.id] = { g, bands, cap, capGlow, light, color: tw.color };
  });
  // ---- message stones with floating posts ----------------------------------------------------------------
  const L = o.levels;
  const stones = {};
  Object.keys(POSTS).forEach((id) => {
    const pt = L.INTERACT.archive.find((p) => p.id === id);
    const info = POSTS[id];
    const tw = info.tower ? TOWERS.find((t) => t.id === info.tower) : null;
    const accent = info.special ? '#ffd27a' : (tw ? tw.css : '#8ff0ff');
    const color = info.special ? 0xffd27a : (tw ? tw.color : 0x5fe0f0);
    const g = new THREE.Group(); g.position.set(pt.x, 0, pt.z); scene.add(g);
    g.add(cyl(0.22, 0.3, 0.9, 6, 0x2a3270, 0, 0, 0));
    g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glow(color))); g.children[g.children.length - 1].position.y = 1.05;
    const tex = canvasTex(512, 220, postDraw(info.user, info.group, info.lines, accent));
    const pan = panel(1.5, 0.64, tex, color, { opacity: info.special ? 0.95 : 0.85, side: THREE.DoubleSide }); pan.position.y = 1.75; g.add(pan);
    const sp = glowSprite(color, info.special ? 3.2 : 1.6, info.special ? 0.55 : 0.3); sp.position.y = 1.4; g.add(sp);
    stones[id] = { g, pan, sp, special: !!info.special };
    anchors[id] = g;
  });
  // ---- path to the gate and skylark's gate --------------------------------------------------------------
  const posts2 = bridge(-41, -32, 3.4);
  const gatePad = disc(0, -43.5, 3.6, 0x8a9cff);
  const gate = new THREE.Group(); gate.position.set(0, 0, -45.4); scene.add(gate);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.22, 6, 24, Math.PI), mat(0x2a3270, { rough: 0.4, metal: 0.3 })); arch.position.y = 1.2; gate.add(arch);
  gate.add(box(0.44, 1.2, 0.44, 0x2a3270, -2.1, 0, 0), box(0.44, 1.2, 0.44, 0x2a3270, 2.1, 0, 0));
  const archGlow = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.06, 4, 32, Math.PI), glow(0x6a7ad8, { additive: true, opacity: 0.8 })); archGlow.position.y = 1.2; gate.add(archGlow);
  const portalTex = canvasTex(256, 256, (ctx, w, h) => { const g2 = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); g2.addColorStop(0, '#fff2c0'); g2.addColorStop(0.45, '#ff9a5e'); g2.addColorStop(0.8, '#c46aa0'); g2.addColorStop(1, 'rgba(90,74,168,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h); });
  const portal = new THREE.Mesh(new THREE.CircleGeometry(2.0, 40), glow(portalTex ? 0xffffff : 0xff9a5e, { map: portalTex, opacity: 0.0, side: THREE.DoubleSide }));
  portal.position.y = 1.2; gate.add(portal);
  const gateStatic = new THREE.Mesh(new THREE.CircleGeometry(2.0, 40), glow(0x3a4a8a, { opacity: 0.35, side: THREE.DoubleSide })); gateStatic.position.y = 1.2; gate.add(gateStatic);
  const gateLight = new THREE.PointLight(0xffa868, 0, 14, 1.4); gateLight.position.set(0, 1.6, 1.2); gate.add(gateLight);
  const gateLabel = label('summer98.net/~skylark', { color: '#ffd27a', glowColor: '#ff9a5e', w: 5.5, fallback: 0xffd27a, opacity: 0 }); gateLabel.position.y = 4.1; gate.add(gateLabel);
  anchors.gate = gate;

  // ---- data rain, floating fragments, distant grid -------------------------------------------------------
  const rainN = o.low ? 160 : 360;
  const rainPos = new Float32Array(rainN * 6); const rainSpeed = new Float32Array(rainN);
  for (let i = 0; i < rainN; i++) {
    const a = R() * Math.PI * 2, d = 9 + R() * 40;
    const x = Math.cos(a) * d, z = -22 + Math.sin(a) * d * 1.3, y = -10 + R() * 34, len = 0.6 + R() * 2.2;
    rainPos.set([x, y, z, x, y - len, z], i * 6); rainSpeed[i] = 1.5 + R() * 4;
  }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x5fa0ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(rain);
  const fragN = 70;
  const frags = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.5, 0), mat(0x2a3270, { emissive: 0x3a4aa0, ei: 0.7 }), fragN);
  const fragData = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  for (let i = 0; i < fragN; i++) {
    const a = R() * Math.PI * 2, d = 14 + R() * 30;
    fragData.push({ x: Math.cos(a) * d, y: -8 + R() * 22, z: -22 + Math.sin(a) * d, s: 0.3 + R() * 1.4, r: R() * 6, sp: 0.1 + R() * 0.4 });
  }
  scene.add(frags);
  const deepGrid = new THREE.GridHelper(260, 60, 0x2a3a90, 0x1a2260); deepGrid.position.y = -18; deepGrid.material.transparent = true; deepGrid.material.opacity = 0.5; scene.add(deepGrid);
  // floating old web pages, far away
  const pageCols = [0x3a4aa0, 0x5a3a8a, 0x2a6a8a];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + R() * 0.3, d = 26 + R() * 14;
    const pg = panel(3 + R() * 3, 2 + R() * 2, null, pageCols[i % 3], { opacity: 0.35, additive: true });
    pg.position.set(Math.cos(a) * d, 4 + R() * 10, -22 + Math.sin(a) * d); pg.lookAt(0, 6, -22); scene.add(pg);
  }

  // ---- behaviour ----------------------------------------------------------------------------------------
  let gateOpen = false, gateT = 0;
  const allPosts = posts1.concat(posts2);
  const api = {
    scene, anchors, blockers, stones, towers,
    openGate(instant) {
      gateOpen = true; gateT = instant ? 10 : 0;
      archGlow.material.color.set(0xffc46a);
      allPosts.forEach((p) => { if (p.userData.z < -31) { p.userData.bulb.material.color.set(0xffc46a); p.userData.sp.material.color.set(0xffc46a); } });
    },
    plazaCentre: { x: 0, z: -22, r: 11 },
    update(dt, t, reduce, player, targetId) {
      // bridge lights run in a wave toward where the story points
      const toward = player && player.z < -31 ? -1 : -1;
      allPosts.forEach((p) => {
        const k = reduce ? 0.6 : 0.35 + 0.65 * Math.max(0, Math.sin(t * 3 + p.userData.z * 0.55 * -toward));
        p.userData.sp.material.opacity = 0.2 + 0.5 * k; p.userData.bulb.scale.setScalar(0.8 + 0.4 * k);
      });
      if (!reduce) { ring.rotation.y = t * 0.15; beacon.children.forEach(() => {}); }
      // the homebrew tower calls loudest until the account is found
      Object.keys(towers).forEach((id) => {
        const tw = towers[id];
        const hot = id === 'homebrew' && !gateOpen;
        const k = hot ? 0.55 + 0.45 * Math.sin(t * 2.6) : 0.5;
        tw.bands.forEach((b, i) => { b.material.opacity = reduce ? 0.7 : 0.35 + 0.55 * Math.max(0, Math.sin(t * (hot ? 3 : 1) - i * 0.7)); });
        tw.light.intensity = hot ? 6 + 6 * k : 4;
        tw.capGlow.material.opacity = hot ? 0.5 + 0.4 * k : 0.4;
        if (!reduce) { tw.cap.rotation.y = t * 0.6; }
      });
      Object.keys(stones).forEach((id) => {
        const s = stones[id];
        if (!reduce) { s.pan.position.y = 1.75 + Math.sin(t * 1.4 + s.g.position.x) * 0.06; }
        if (player) { s.pan.lookAt(player.x, 1.75, player.z); }
        if (s.special) { s.sp.material.opacity = 0.35 + 0.3 * (reduce ? 0.5 : (Math.sin(t * 2.2) + 1) / 2); }
      });
      if (gateOpen) {
        gateT += dt;
        const k = Math.min(1, gateT / 1.6);
        portal.material.opacity = k * 0.95; gateStatic.material.opacity = 0.35 * (1 - k);
        gateLight.intensity = 9 * k; gateLabel.material.opacity = k;
        if (!reduce) { portal.rotation.z = t * 0.4; }
      } else {
        gateStatic.material.opacity = 0.25 + (reduce ? 0 : 0.1 * Math.sin(t * 13));
      }
      if (!reduce) {
        const p = rain.geometry.attributes.position;
        for (let i = 0; i < rainN; i++) {
          let y0 = p.getY(i * 2) - rainSpeed[i] * dt, y1 = p.getY(i * 2 + 1) - rainSpeed[i] * dt;
          if (y1 < -14) { const len = y0 - y1; y0 = 24; y1 = 24 - len; }
          p.setY(i * 2, y0); p.setY(i * 2 + 1, y1);
        }
        p.needsUpdate = true;
      }
      for (let i = 0; i < fragN; i++) {
        const f = fragData[i];
        e.set(t * f.sp + f.r, t * f.sp * 0.7, 0); q.setFromEuler(e); sc.setScalar(f.s);
        pv.set(f.x, f.y + (reduce ? 0 : Math.sin(t * 0.3 + f.r) * 0.8), f.z);
        m4.compose(pv, q, sc); frags.setMatrixAt(i, m4);
      }
      frags.instanceMatrix.needsUpdate = true;
    }
  };
  api.update(0, 0, true, null);
  return api;
}
