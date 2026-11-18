// Developer tool: a tiny software rasterizer for Three.js scenes, so P4 scene composition can be reviewed in Node
// without a GPU or browser. It is an approximation: flat Lambert shading from the scene's lights, material colour
// and emissive, linear or exp2 fog, z-buffer, additive glow for sprites and additive materials. No textures,
// no shadows, no tone mapping. Real renders come from Chromium in CI.
import zlib from 'node:zlib';
import { THREE } from '../frontend/p4/js/kit.js';

function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
export function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w * 3; x++) { raw[y * (w * 3 + 1) + 1 + x] = rgb[y * w * 3 + x]; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const srgb = (v) => { v = Math.max(0, v); const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.min(255, Math.round(c * 255)); };
// Simple ACES-like curve so bright scenes do not clip flat.
const tone = (v) => { const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return Math.max(0, (v * (a * v + b)) / (v * (c * v + d) + e)); };

export function render(scene, camera, W, H, opts) {
  const o = opts || {};
  const exposure = o.exposure || 1;
  scene.updateMatrixWorld(true);
  camera.aspect = W / H; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const col = new Float32Array(W * H * 3);
  const zb = new Float32Array(W * H).fill(Infinity);
  // background
  const bg = scene.background && scene.background.isColor ? scene.background : new THREE.Color(0x101018);
  const sky = [];
  scene.traverse((ob) => { if (ob.userData && ob.userData.isSky && ob.visible) { sky.push(ob); } });
  for (let i = 0; i < W * H; i++) { col[i * 3] = bg.r; col[i * 3 + 1] = bg.g; col[i * 3 + 2] = bg.b; }
  // lights
  const dirs = [], points = [], hemis = []; let amb = new THREE.Color(0, 0, 0);
  scene.traverse((ob) => {
    if (!ob.visible || !ob.isLight) { return; }
    let vis = true; let p = ob.parent; while (p) { if (!p.visible) { vis = false; } p = p.parent; } if (!vis) { return; }
    if (ob.isAmbientLight) { amb.add(ob.color.clone().multiplyScalar(ob.intensity)); }
    else if (ob.isHemisphereLight) { hemis.push(ob); }
    else if (ob.isDirectionalLight) { const d = new THREE.Vector3().setFromMatrixPosition(ob.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(ob.target.matrixWorld)).normalize(); dirs.push({ d, c: ob.color.clone().multiplyScalar(ob.intensity) }); }
    else if (ob.isPointLight || ob.isSpotLight) { points.push({ p: new THREE.Vector3().setFromMatrixPosition(ob.matrixWorld), c: ob.color.clone().multiplyScalar(ob.intensity), dist: ob.distance || 0, decay: ob.decay }); }
  });
  const fog = scene.fog;
  const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);

  const transparent = [];
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), cen = new THREE.Vector3();
  const tmpM = new THREE.Matrix4(), instM = new THREE.Matrix4();

  function shade(material, normal, centre) {
    const base = material.color ? material.color : new THREE.Color(1, 1, 1);
    let r, g, b;
    if (material.isMeshBasicMaterial || material.isSpriteMaterial || material.isLineBasicMaterial || material.isPointsMaterial) { r = base.r; g = base.g; b = base.b; }
    else {
      let lr = amb.r, lg = amb.g, lb = amb.b;
      for (const h of hemis) { const k = (normal.y + 1) / 2; lr += (h.color.r * k + h.groundColor.r * (1 - k)) * h.intensity; lg += (h.color.g * k + h.groundColor.g * (1 - k)) * h.intensity; lb += (h.color.b * k + h.groundColor.b * (1 - k)) * h.intensity; }
      for (const d of dirs) { const k = Math.max(0, normal.dot(d.d)); lr += d.c.r * k; lg += d.c.g * k; lb += d.c.b * k; }
      for (const p of points) {
        const L = p.p.clone().sub(centre); const dist = L.length(); L.normalize();
        let att = 1 / Math.max(1, dist * dist); if (p.dist > 0) { att *= Math.pow(Math.max(0, 1 - Math.pow(dist / p.dist, 4)), 2); }
        const k = Math.max(0, normal.dot(L)) * att; lr += p.c.r * k; lg += p.c.g * k; lb += p.c.b * k;
      }
      r = base.r * lr; g = base.g * lg; b = base.b * lb;
      if (material.emissive) { const ei = material.emissiveIntensity || 0; r += material.emissive.r * ei; g += material.emissive.g * ei; b += material.emissive.b * ei; }
    }
    if (fog && material.fog !== false) {
      const dist = centre.distanceTo(camPos);
      const f = fog.isFogExp2 ? 1 - Math.exp(-(fog.density * dist) * (fog.density * dist)) : Math.min(1, Math.max(0, (dist - fog.near) / (fog.far - fog.near)));
      r = r * (1 - f) + fog.color.r * f; g = g * (1 - f) + fog.color.g * f; b = b * (1 - f) + fog.color.b * f;
    }
    return [r, g, b];
  }

  function project(v) { const p = v.clone().applyMatrix4(vp); return p; }
  function rasterTri(a, b, c, color, alpha, additive, depthTest) {
    const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), maxX = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), maxY = Math.min(H - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(area) < 1e-9) { return; }
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((b.x - px) * (c.y - py) - (b.y - py) * (c.x - px)) / area;
        const w1 = ((c.x - px) * (a.y - py) - (c.y - py) * (a.x - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) { continue; }
        const z = w0 * a.z + w1 * b.z + w2 * c.z;
        const i = y * W + x;
        if (depthTest !== false && z >= zb[i]) { continue; }
        if (alpha >= 0.999 && !additive) { zb[i] = z; col[i * 3] = color[0]; col[i * 3 + 1] = color[1]; col[i * 3 + 2] = color[2]; }
        else if (additive) { col[i * 3] += color[0] * alpha; col[i * 3 + 1] += color[1] * alpha; col[i * 3 + 2] += color[2] * alpha; }
        else { col[i * 3] = col[i * 3] * (1 - alpha) + color[0] * alpha; col[i * 3 + 1] = col[i * 3 + 1] * (1 - alpha) + color[1] * alpha; col[i * 3 + 2] = col[i * 3 + 2] * (1 - alpha) + color[2] * alpha; }
      }
    }
  }
  function toScreen(p) { return { x: (p.x * 0.5 + 0.5) * W, y: (1 - (p.y * 0.5 + 0.5)) * H, z: p.z }; }

  function drawMesh(ob, matrix) {
    const geo = ob.geometry; const pos = geo.attributes.position; if (!pos) { return; }
    const material = Array.isArray(ob.material) ? ob.material[0] : ob.material;
    if (!material || material.visible === false) { return; }
    const idx = geo.index;
    const triCount = idx ? idx.count / 3 : pos.count / 3;
    const additive = material.blending === THREE.AdditiveBlending;
    const alpha = material.transparent ? (material.opacity !== undefined ? material.opacity : 1) : 1;
    const doubleSided = material.side === THREE.DoubleSide || material.side === THREE.BackSide;
    for (let t = 0; t < triCount; t++) {
      const ia = idx ? idx.getX(t * 3) : t * 3, ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      v0.fromBufferAttribute(pos, ia).applyMatrix4(matrix); v1.fromBufferAttribute(pos, ib).applyMatrix4(matrix); v2.fromBufferAttribute(pos, ic).applyMatrix4(matrix);
      e1.subVectors(v1, v0); e2.subVectors(v2, v0); n.crossVectors(e1, e2).normalize();
      cen.copy(v0).add(v1).add(v2).multiplyScalar(1 / 3);
      const toCam = camPos.clone().sub(cen);
      if (n.dot(toCam) < 0) { if (!doubleSided) { continue; } n.negate(); }
      if (material.side === THREE.BackSide) { /* sky: lit as basic anyway */ }
      const color = shade(material, n, cen);
      // homogeneous clip against the near plane (z > -w), then perspective divide
      const poly = [v0, v1, v2].map((v) => new THREE.Vector4(v.x, v.y, v.z, 1).applyMatrix4(vp));
      const clipped = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const da = a.z + a.w, db = b.z + b.w;
        if (da >= 0) { clipped.push(a); }
        if ((da >= 0) !== (db >= 0)) { const k = da / (da - db); clipped.push(a.clone().lerp(b, k)); }
      }
      if (clipped.length < 3) { continue; }
      const scr = clipped.map((c) => ({ x: (c.x / c.w * 0.5 + 0.5) * W, y: (1 - (c.y / c.w * 0.5 + 0.5)) * H, z: c.z / c.w }));
      if (scr.every((q) => q.z > 1)) { continue; }
      for (let i = 1; i < scr.length - 1; i++) {
        const tri = [scr[0], scr[i], scr[i + 1]];
        if (alpha < 0.999 || additive) { transparent.push({ tri, color, alpha, additive, depth: (tri[0].z + tri[1].z + tri[2].z) / 3, depthTest: material.depthTest }); }
        else { rasterTri(tri[0], tri[1], tri[2], color, 1, false, true); }
      }
    }
  }

  // sky first (no depth)
  for (const s of sky) {
    s.updateMatrixWorld(true);
    const m = new THREE.Matrix4().copy(s.matrixWorld); m.setPosition(camPos);
    const save = zb.slice(); drawMesh(s, m); zb.set(save);
  }
  scene.traverse((ob) => {
    if (!ob.visible || (ob.userData && ob.userData.isSky)) { return; }
    let p = ob.parent; while (p) { if (!p.visible) { return; } p = p.parent; }
    if (ob.isInstancedMesh) {
      for (let i = 0; i < ob.count; i++) { ob.getMatrixAt(i, instM); tmpM.multiplyMatrices(ob.matrixWorld, instM); drawMesh(ob, tmpM); }
    } else if (ob.isMesh) { drawMesh(ob, ob.matrixWorld); }
    else if (ob.isSprite) {
      const c = new THREE.Vector3().setFromMatrixPosition(ob.matrixWorld);
      const p = project(c); if (p.z < -1 || p.z > 1) { return; }
      const s = toScreen(p);
      const dist = c.distanceTo(camPos);
      const radius = (ob.scale.x * 0.5) / (dist * Math.tan((camera.fov * Math.PI) / 360)) * (H / 2);
      const m = ob.material; const base = m.color; const add = m.blending === THREE.AdditiveBlending;
      transparent.push({ sprite: { x: s.x, y: s.y, z: p.z, r: Math.max(0.5, radius) }, color: [base.r, base.g, base.b], alpha: m.opacity, additive: add, depth: p.z, isLabel: !add });
    }
  });
  transparent.sort((a, b) => b.depth - a.depth);
  for (const tr of transparent) {
    if (tr.tri) { rasterTri(tr.tri[0], tr.tri[1], tr.tri[2], tr.color, tr.alpha, tr.additive, tr.depthTest); continue; }
    const s = tr.sprite; if (tr.isLabel) { continue; }
    const r = s.r;
    for (let y = Math.max(0, Math.floor(s.y - r)); y <= Math.min(H - 1, Math.ceil(s.y + r)); y++) {
      for (let x = Math.max(0, Math.floor(s.x - r)); x <= Math.min(W - 1, Math.ceil(s.x + r)); x++) {
        const d = Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) / r; if (d > 1) { continue; }
        const i = y * W + x; if (s.z >= zb[i]) { continue; }
        const k = tr.alpha * Math.pow(1 - d, 2);
        col[i * 3] += tr.color[0] * k; col[i * 3 + 1] += tr.color[1] * k; col[i * 3 + 2] += tr.color[2] * k;
      }
    }
  }
  const out = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H * 3; i++) { out[i] = srgb(tone(col[i] * exposure)); }
  return out;
}

// Upscales by an integer factor (nearest), for easier viewing.
export function upscale(rgb, W, H, k) {
  const out = Buffer.alloc(W * k * H * k * 3);
  for (let y = 0; y < H * k; y++) { for (let x = 0; x < W * k; x++) { const si = (Math.floor(y / k) * W + Math.floor(x / k)) * 3, di = (y * W * k + x) * 3; out[di] = rgb[si]; out[di + 1] = rgb[si + 1]; out[di + 2] = rgb[si + 2]; } }
  return out;
}
