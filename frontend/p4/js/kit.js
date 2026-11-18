// Shared low-poly building blocks: palette, flat-shaded materials, primitive helpers and canvas textures.
// All art is generated here in code. Nothing is downloaded. Canvas textures fall back to plain colour when there
// is no DOM (Node tests and the software preview), so the same scene code runs everywhere.
import * as THREE from '../vendor/three.module.min.js';

export { THREE };

export const PAL = {
  ink: 0x241a3a, cream: 0xfff0d6, paper: 0xf3e6c9,
  wood: 0x9a6340, woodL: 0xc08655, woodD: 0x6b4128, woodDD: 0x4a2c1d,
  wallWarm: 0xe9cfa6, wallLow: 0x8e5a3c, ceiling: 0xd9bf98,
  rug: 0xb8434e, rugL: 0xe0806a, card: 0xc89a62, cardD: 0x9e7444,
  crt: 0xe8dcc0, crtD: 0xb7aa8c, screenOff: 0x1b2a2a, screenOn: 0x5fe0c0,
  jacket: 0xf2ad3d, jacketD: 0xc9801f, scarf: 0xe4506f, hair: 0x4b3568, skin: 0xf6d2aa, pants: 0x41529a, shoe: 0x2d2444,
  coat: 0x2f5d8a, coatD: 0x23476a, beard: 0xe8e2d6, cap: 0x1f3550,
  grass: 0x6fbf63, grassD: 0x4e9a52, sand: 0xf0d39a, sandD: 0xd9b678, stone: 0xc9bfae, stoneD: 0x9f9483,
  sea: 0x3f8fd0, seaD: 0x2a62a8, roofA: 0xd9534f, roofB: 0x3f7cc4, roofC: 0x4fa36b, roofD: 0xe39b3a,
  houseA: 0xfff3dc, houseB: 0xf7d9b0, houseC: 0xd8ecf2, houseD: 0xf6e3e8,
  white: 0xfdf8ef, red: 0xd6443c, gold: 0xffd27a, amber: 0xffb347, cyan: 0x5fe0f0, green: 0x6fe0a0, violet: 0x7a5ad0,
  night: 0x120e2a, voidA: 0x0d1028, voidB: 0x1c1846
};

const matCache = new Map();
// Flat-shaded standard material, cached by colour and options.
export function mat(color, opts) {
  const o = opts || {};
  const key = color + '|' + JSON.stringify(o);
  if (matCache.has(key) && !o.unique) { return matCache.get(key); }
  const m = new THREE.MeshStandardMaterial({
    color, flatShading: o.flat !== false, roughness: o.rough !== undefined ? o.rough : 0.85, metalness: o.metal || 0,
    emissive: o.emissive !== undefined ? o.emissive : 0x000000, emissiveIntensity: o.ei !== undefined ? o.ei : 1,
    transparent: !!o.transparent, opacity: o.opacity !== undefined ? o.opacity : 1, side: o.side || THREE.FrontSide,
    map: o.map || null, depthWrite: o.depthWrite !== undefined ? o.depthWrite : true
  });
  if (!o.unique) { matCache.set(key, m); }
  return m;
}

// Unlit material for glows, screens and sky.
export function glow(color, opts) {
  const o = opts || {};
  return new THREE.MeshBasicMaterial({
    color, transparent: o.opacity !== undefined || !!o.additive, opacity: o.opacity !== undefined ? o.opacity : 1,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: o.depthWrite !== undefined ? o.depthWrite : !o.additive,
    side: o.side || THREE.FrontSide, map: o.map || null, fog: o.fog !== undefined ? o.fog : true
  });
}

export function mesh(geo, material, x, y, z, opts) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x || 0, y || 0, z || 0);
  const o = opts || {};
  if (o.ry) { m.rotation.y = o.ry; }
  if (o.rx) { m.rotation.x = o.rx; }
  if (o.rz) { m.rotation.z = o.rz; }
  if (o.s) { m.scale.setScalar(o.s); }
  m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false;
  if (o.name) { m.name = o.name; }
  return m;
}

// Box whose bottom sits at y (handy for furniture).
export function box(w, h, d, color, x, y, z, opts) {
  const material = typeof color === 'number' ? mat(color, opts && opts.mat) : color;
  return mesh(new THREE.BoxGeometry(w, h, d), material, x, (y || 0) + h / 2, z, opts);
}
export function cyl(rt, rb, h, seg, color, x, y, z, opts) {
  const material = typeof color === 'number' ? mat(color, opts && opts.mat) : color;
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 8), material, x, (y || 0) + h / 2, z, opts);
}
export function cone(r, h, seg, color, x, y, z, opts) {
  const material = typeof color === 'number' ? mat(color, opts && opts.mat) : color;
  return mesh(new THREE.ConeGeometry(r, h, seg || 6), material, x, (y || 0) + h / 2, z, opts);
}
export function ball(r, detail, color, x, y, z, opts) {
  const material = typeof color === 'number' ? mat(color, opts && opts.mat) : color;
  return mesh(new THREE.IcosahedronGeometry(r, detail || 0), material, x, y, z, opts);
}

// Deterministic pseudo-random numbers, so every build of a scene looks the same.
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- canvas textures ---------------------------------------------------------------------------------

export function hasDOM() { return typeof document !== 'undefined' && !!document.createElement; }

// Draws into a canvas and returns a texture, or null when there is no DOM.
export function canvasTex(w, h, draw, opts) {
  if (!hasDOM()) { return null; }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) { return null; }
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (opts && opts.nearest) { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; }
  if (opts && opts.repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(opts.repeat[0], opts.repeat[1]); }
  tex.userData.canvas = c; tex.userData.draw = draw;
  return tex;
}

// Re-renders a canvas texture with a new drawing function (screens, signs that change).
export function redraw(tex, draw) {
  if (!tex || !tex.userData.canvas) { return; }
  const c = tex.userData.canvas; const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height); draw(ctx, c.width, c.height); tex.needsUpdate = true;
}

export const FONT = '"Courier New", "Noto Sans Mono CJK SC", "Microsoft YaHei", monospace';

// A flat panel showing a texture (or a colour when there is no DOM).
export function panel(w, h, tex, fallback, opts) {
  const o = opts || {};
  const material = o.lit
    ? new THREE.MeshStandardMaterial({ color: tex ? 0xffffff : fallback, map: tex || null, roughness: 0.9, flatShading: false, emissive: o.emissive || 0x000000, emissiveMap: o.emissive ? (tex || null) : null, emissiveIntensity: o.ei || 1, transparent: !!o.transparent })
    : glow(tex ? 0xffffff : fallback, { map: tex || null, opacity: o.opacity, additive: o.additive, side: o.side || THREE.DoubleSide, fog: o.fog });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.castShadow = false; m.receiveShadow = !!o.lit;
  return m;
}

// Soft round glow sprite (additive), for lamps, beacons and particles.
let glowTex = null;
export function glowSprite(color, size, opacity) {
  if (!glowTex && hasDOM()) {
    glowTex = canvasTex(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    });
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: opacity !== undefined ? opacity : 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}

// Text label sprite that always faces the camera.
export function label(text, opts) {
  const o = opts || {};
  const tex = canvasTex(512, 128, (ctx, w, h) => {
    ctx.font = `bold ${o.size || 46}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, w, h); }
    ctx.shadowColor = o.glowColor || 'rgba(0,0,0,0)'; ctx.shadowBlur = o.glowColor ? 18 : 0;
    ctx.fillStyle = o.color || '#ffffff'; ctx.fillText(text, w / 2, h / 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: tex ? 0xffffff : (o.fallback || 0xffffff), transparent: true, depthWrite: false, opacity: o.opacity !== undefined ? o.opacity : 1 }));
  s.scale.set(o.w || 4, (o.w || 4) / 4, 1);
  return s;
}

// Vertical sky gradient on a large inverted sphere.
export function skyDome(colors, radius) {
  const tex = canvasTex(4, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius || 300, 24, 12), new THREE.MeshBasicMaterial({ color: tex ? 0xffffff : new THREE.Color(colors[Math.floor(colors.length / 2)]), map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10;
  m.userData.isSky = true;
  return m;
}

// A pulsing ring on the floor that marks the current objective target.
export function targetRing(color) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 40), glow(color, { additive: true, opacity: 0.75, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.55, 40), glow(color, { additive: true, opacity: 0.12, side: THREE.DoubleSide }));
  inner.rotation.x = -Math.PI / 2; inner.position.y = 0.025;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 3.2, 24, 1, true), glow(color, { additive: true, opacity: 0.08, side: THREE.DoubleSide }));
  beam.position.y = 1.6;
  g.add(ring, inner, beam);
  g.userData.ring = ring; g.userData.beam = beam;
  return g;
}
