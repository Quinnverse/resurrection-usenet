// V5 characters: one stylized low-poly body plan for everyone (same proportions and material language), varied by
// clothes, hair and props, with a simple readable face: eyes, brows, mouth shapes, blush. Procedural animation for
// the beats the story needs: walk, run, wait, look, reach, wave, camera, hide face, pose, sit, play guitar, hum,
// hold, turn away. Nothing is downloaded and no real person is depicted.
import { THREE, mat, PAL } from './kit.js';
export { makeTheo } from './people-p4.js';

function part(geo, color, x, y, z, opts) { const m = new THREE.Mesh(geo, mat(color, opts)); m.position.set(x, y, z); m.castShadow = true; return m; }
function limb(len, rTop, rBot, color, x, y, z) { const pivot = new THREE.Group(); pivot.position.set(x, y, z); const m = part(new THREE.CylinderGeometry(rTop, rBot, len, 6), color, 0, -len / 2, 0); pivot.add(m); return { pivot, mesh: m }; }

// spec: { coat, coatD, shirt, pants, shoe, skin, hair, hairStyle: 'pony'|'bob'|'short'|'bun'|'long', height, scarf, prop: 'camera'|'sketchbook'|'none', glasses }
export function makePerson(spec) {
  const s = Object.assign({ coat: PAL.jacket, coatD: PAL.jacketD, shirt: 0xfff3dc, pants: PAL.pants, shoe: PAL.shoe, skin: PAL.skin, hair: PAL.hair, hairStyle: 'pony', height: 1, scarf: null, prop: 'none' }, spec || {});
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body); body.scale.setScalar(s.height);
  const legL = limb(0.72, 0.085, 0.07, s.pants, -0.1, 0.8, 0), legR = limb(0.72, 0.085, 0.07, s.pants, 0.1, 0.8, 0);
  [legL, legR].forEach((l) => { l.mesh.material = mat(s.pants, { flat: false }); });
  [legL, legR].forEach((l) => l.pivot.add(part(new THREE.BoxGeometry(0.15, 0.1, 0.24), s.shoe, 0, -0.74, 0.04)));
  body.add(legL.pivot, legR.pivot);
  const torso = new THREE.Group(); torso.position.y = 0.8; body.add(torso);
  const chest = part(new THREE.CylinderGeometry(0.2, 0.24, 0.62, 14), s.coat, 0, 0.31, 0, { flat: false }); torso.add(chest); const shoulders = part(new THREE.SphereGeometry(0.205, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), s.coat, 0, 0.6, 0, { flat: false }); shoulders.scale.y = 0.3; torso.add(shoulders);
  torso.add(part(new THREE.BoxGeometry(0.16, 0.5, 0.02), s.shirt, 0, 0.3, 0.215));
  torso.add(part(new THREE.CylinderGeometry(0.245, 0.245, 0.06, 8), s.coatD, 0, 0.03, 0));
  if (s.scarf) { const sc = part(new THREE.TorusGeometry(0.15, 0.06, 5, 10), s.scarf, 0, 0.62, 0); sc.rotation.x = Math.PI / 2; torso.add(sc); }
  else { torso.add(part(new THREE.CylinderGeometry(0.13, 0.16, 0.07, 8), s.shirt, 0, 0.63, 0)); }
  const armL = limb(0.6, 0.065, 0.055, s.coat, -0.27, 0.58, 0), armR = limb(0.6, 0.065, 0.055, s.coat, 0.27, 0.58, 0);
  [armL, armR].forEach((a) => { a.mesh.material = mat(s.coat, { flat: false }); });
  const handL = part(new THREE.SphereGeometry(0.058, 10, 8), s.skin, 0, -0.63, 0, { flat: false }), handR = part(new THREE.SphereGeometry(0.058, 10, 8), s.skin, 0, -0.63, 0, { flat: false });
  armL.pivot.add(handL); armR.pivot.add(handR); torso.add(armL.pivot, armR.pivot);
  // head and face
  const head = new THREE.Group(); head.position.y = 0.73; head.scale.setScalar(1.1); torso.add(head);
  head.add(part(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 6), s.skin, 0, 0, 0));
  const skull = part(new THREE.SphereGeometry(0.19, 18, 14), s.skin, 0, 0.18, 0.01, { flat: false, rough: 0.7 }); skull.scale.set(1, 1.08, 0.97); head.add(skull);
  head.add(part(new THREE.SphereGeometry(0.045, 8, 6), s.skin, -0.185, 0.17, 0.0, { flat: false }), part(new THREE.SphereGeometry(0.045, 8, 6), s.skin, 0.185, 0.17, 0.0, { flat: false }));   // ears
  const nose = part(new THREE.ConeGeometry(0.022, 0.06, 6), s.skin, 0, 0.15, 0.2, { flat: false }); nose.rotation.x = Math.PI / 2 + 0.25; head.add(nose);
  const face = new THREE.Group(); face.position.set(0, 0.18, 0.192); head.add(face);
  const ink = mat(PAL.ink);
  const white = mat(0xfffaf2, { flat: false, rough: 0.4 }), irisM = mat(s.eyes || 0x3a2a24, { flat: false, rough: 0.3 }), shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eye = (x) => {
    const e = new THREE.Group(); e.position.set(x, 0.02, 0.0); face.add(e);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), white); w.scale.set(1.15, 1.25, 0.5); e.add(w);
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), irisM); ir.position.z = 0.012; ir.scale.set(1, 1.15, 0.5); e.add(ir);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), ink); pu.position.z = 0.019; pu.scale.z = 0.4; e.add(pu);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 6, 4), shine); hl.position.set(0.007, 0.009, 0.022); e.add(hl);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(s.skin, { flat: false })); lid.scale.set(1.18, 1.3, 0.62); lid.position.y = 0.002; lid.rotation.x = -0.15; lid.visible = false; e.add(lid);
    e.scale.setScalar(1.3); e.userData.lid = lid; return e;
  };
  const eyeL = eye(-0.065), eyeR = eye(0.065);
  const brow = (x) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.02), mat(s.hair)); b.position.set(x, 0.075, 0.0); face.add(b); return b; };
  const browL = brow(-0.065), browR = brow(0.065);
  const mouthMat = mat(0x9a3a4a);
  const mouths = {
    neutral: new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.02), mouthMat),
    smile: new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 3, 8, Math.PI), mouthMat),
    grin: new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.02), mat(0xffffff)),
    open: new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), mouthMat),
    frown: new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 3, 8, Math.PI), mouthMat)
  };
  mouths.smile.rotation.z = Math.PI; mouths.smile.position.y = -0.04; mouths.frown.position.y = -0.07; mouths.neutral.position.y = -0.055; mouths.grin.position.y = -0.055; mouths.open.position.y = -0.055;
  Object.values(mouths).forEach((m) => { m.visible = false; face.add(m); }); mouths.neutral.visible = true;
  const blushMat = new THREE.MeshBasicMaterial({ color: 0xf29a8c, transparent: true, opacity: 0.0 });
  const blushL = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), blushMat), blushR = blushL.clone(); blushL.position.set(-0.1, -0.03, 0.0); blushR.position.set(0.1, -0.03, 0.0); face.add(blushL, blushR);
  if (s.glasses) { [-0.065, 0.065].forEach((x) => { const g = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 3, 10), mat(0x2a2a30)); g.position.set(x, 0.02, 0.012); face.add(g); }); }
  // hair
  const hairMat = s.hair;
  const cap = part(new THREE.SphereGeometry(0.212, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat, 0, 0.2, -0.01, { flat: false, rough: 0.6 }); cap.rotation.x = -0.25; head.add(cap);
  const fringe = part(new THREE.SphereGeometry(0.16, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.4), hairMat, 0, 0.27, 0.07, { flat: false, rough: 0.6 }); fringe.scale.set(1.15, 0.7, 0.9); fringe.rotation.x = 0.9; head.add(fringe);
  [-1, 1].forEach((sd) => { const lock = part(new THREE.CapsuleGeometry(0.035, 0.12, 3, 6), hairMat, sd * 0.17, 0.12, 0.08, { flat: false }); lock.rotation.z = sd * 0.15; head.add(lock); });
  let pony = null;
  if (s.hairStyle === 'pony') { pony = new THREE.Group(); pony.position.set(0, 0.28, -0.17); head.add(pony); const p = part(new THREE.ConeGeometry(0.09, 0.42, 6), hairMat, 0, -0.2, -0.04); p.rotation.x = Math.PI - 0.3; pony.add(p); }
  if (s.hairStyle === 'bob') { head.add(part(new THREE.CylinderGeometry(0.22, 0.25, 0.24, 16, 1, true, 0.85, Math.PI * 2 - 1.7), hairMat, 0, 0.12, -0.02, { side: THREE.DoubleSide, flat: false })); }
  if (s.hairStyle === 'long') { const l = part(new THREE.BoxGeometry(0.34, 0.45, 0.1), hairMat, 0, -0.02, -0.15); head.add(l); }
  if (s.hairStyle === 'bun') { head.add(part(new THREE.IcosahedronGeometry(0.1, 0), hairMat, 0, 0.36, -0.12)); }
  // props
  const props = {};
  props.camera = new THREE.Group(); props.camera.add(part(new THREE.BoxGeometry(0.16, 0.1, 0.07), 0x2a2a30, 0, 0, 0), part(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), 0x4a4a55, 0, 0, 0.06, { rx: Math.PI / 2 }));
  props.camera.children[1].rotation.x = Math.PI / 2; props.camera.position.set(0, -0.62, 0.08); armR.pivot.add(props.camera); props.camera.visible = s.prop === 'camera';
  props.sketch = part(new THREE.BoxGeometry(0.2, 0.26, 0.03), 0xd8c8a0, 0, -0.6, 0.06); armL.pivot.add(props.sketch); props.sketch.visible = s.prop === 'sketchbook';
  props.suitcase = new THREE.Group(); props.suitcase.add(part(new THREE.BoxGeometry(0.42, 0.3, 0.14), 0x8a4a3a, 0, -0.18, 0), part(new THREE.BoxGeometry(0.12, 0.04, 0.03), 0x2a2a30, 0, 0.0, 0)); props.suitcase.position.set(0, -0.68, 0); armL.pivot.add(props.suitcase); props.suitcase.visible = false;
  props.guitar = new THREE.Group(); const gb = part(new THREE.CylinderGeometry(0.2, 0.2, 0.09, 12), 0xc08040, 0, 0, 0); gb.rotation.x = Math.PI / 2; props.guitar.add(gb, part(new THREE.BoxGeometry(0.05, 0.5, 0.03), 0x6b4128, 0, 0.32, 0)); props.guitar.position.set(0.02, 0.18, 0.28); props.guitar.rotation.z = 1.15; torso.add(props.guitar); props.guitar.visible = false;
  props.box = new THREE.Group(); props.box.add(part(new THREE.BoxGeometry(0.55, 0.4, 0.4), 0xb08a5a, 0, 0, 0), part(new THREE.BoxGeometry(0.56, 0.04, 0.12), 0xd8c8a0, 0, 0.2, 0)); props.box.position.set(0, 0.25, 0.38); torso.add(props.box); props.box.visible = false;
  props.window = new THREE.Group(); props.window.add(part(new THREE.BoxGeometry(0.9, 1.1, 0.06), 0xfff4d6, 0, 0, 0)); props.window.position.set(0, 0.35, 0.42); torso.add(props.window); props.window.visible = false;
  root.userData = { blinkAt: Math.random() * 3, lookAt: null, chest, legL: legL.pivot, legR: legR.pivot, armL: armL.pivot, armR: armR.pivot, torso, head, body, pony, eyeL, eyeR, browL, browR, mouths, blushMat, props, expr: 'neutral', spec: s };
  return root;
}

// Character presets with one shared silhouette language.
export const CAST = {
  mara: { coat: 0x3f6f8a, coatD: 0x2f5468, shirt: 0xf0ece4, pants: 0x2f3442, shoe: 0x22222a, hair: 0x3a2a24, hairStyle: 'bob', skin: 0xf2c8a2 },
  elena17: { coat: 0xf2ad3d, coatD: 0xc9801f, shirt: 0xfff3dc, pants: 0x41529a, shoe: 0x2d2444, hair: 0x4b3568, hairStyle: 'pony', scarf: 0xe4506f },
  elena23: { coat: 0x5a6a80, coatD: 0x46546a, shirt: 0xe8e4dc, pants: 0x2a3040, shoe: 0x22222a, hair: 0x4b3568, hairStyle: 'pony', scarf: 0x8a6a7a },
  june17: { coat: 0x6fb8a8, coatD: 0x4f9888, shirt: 0xfff8e8, pants: 0xd9b678, shoe: 0x6b4128, hair: 0xc0602a, hairStyle: 'short', skin: 0xf6d2aa, prop: 'camera' },
  june23: { coat: 0x2f3a5a, coatD: 0x232c46, shirt: 0xe8e0d0, pants: 0x2a2a34, shoe: 0x1a1a22, hair: 0xa8502a, hairStyle: 'bun', skin: 0xf6d2aa },
  iris: { coat: 0xffffff, coatD: 0xe8dcc8, shirt: 0xf4a8b8, pants: 0x7a5a8a, shoe: 0x4a2c1d, hair: 0x2a1a14, hairStyle: 'long', skin: 0xd9a47a }
};
export const makeCast = (id) => makePerson(CAST[id]);

export function setExpression(p, expr) {
  const u = p.userData; if (!u.mouths || u.expr === expr) { return; }
  u.expr = expr;
  const m = { neutral: 'neutral', smile: 'smile', grin: 'grin', shy: 'smile', tease: 'smile', surprise: 'open', hurt: 'frown', quiet: 'neutral', angry: 'frown' }[expr] || 'neutral';
  Object.entries(u.mouths).forEach(([k, v]) => { v.visible = k === m; });
  const brows = { neutral: [0, 0], smile: [0.1, -0.1], grin: [0.15, -0.15], shy: [-0.25, 0.25], tease: [0.3, -0.05], surprise: [0, 0, 0.02], hurt: [-0.35, 0.35], quiet: [-0.1, 0.1], angry: [0.4, -0.4] }[expr] || [0, 0];
  u.browL.rotation.z = brows[0]; u.browR.rotation.z = brows[1]; u.browL.position.y = u.browR.position.y = 0.075 + (brows[2] || 0) + (expr === 'hurt' ? -0.01 : 0);
  u.blushMat.opacity = expr === 'shy' ? 0.85 : expr === 'grin' ? 0.3 : 0;
  u.eyeL.scale.y = u.eyeR.scale.y = expr === 'grin' || expr === 'smile' ? 0.45 : expr === 'surprise' ? 1.3 : expr === 'quiet' || expr === 'hurt' ? 0.7 : 1;
}
export function showProp(p, name, on) { const pr = p.userData.props && p.userData.props[name]; if (pr) { pr.visible = !!on; } }

// mode: idle walk run look reach wave camera hideface pose sit guitar hum hold turnaway
export function animate(p, t, phase, speed, mode, reduce) {
  const u = p.userData; const moving = speed > 0.15; const k = Math.min(1, speed / 4);
  const swing = moving ? Math.sin(phase) * (0.35 + 0.45 * k) : 0;
  u.legL.rotation.set(swing, 0, 0); u.legR.rotation.set(-swing, 0, 0);
  u.armL.rotation.set(-swing * 0.9, 0, 0.08); u.armR.rotation.set(swing * 0.9, 0, -0.08);
  u.body.position.y = moving ? Math.abs(Math.cos(phase)) * 0.04 * (0.5 + k) : (reduce ? 0 : Math.sin(t * 1.8) * 0.008);
  u.body.position.z = 0; u.torso.rotation.set(moving ? 0.06 + 0.12 * k : 0, 0, 0); u.head.rotation.set(0, 0, 0);
  const w = reduce ? 0 : 1;
  switch (mode) {
    case 'look': u.head.rotation.y = Math.sin(t * 0.7) * 0.5 * w; break;
    case 'reach': u.armR.rotation.x = -1.5; u.armR.rotation.z = -0.2; u.head.rotation.x = 0.1; u.torso.rotation.x = -0.12; break;
    case 'wave': u.armR.rotation.x = -2.6; u.armR.rotation.z = -0.4 + Math.sin(t * 9) * 0.35 * w; break;
    case 'camera': u.armR.rotation.x = -1.9; u.armL.rotation.x = -1.7; u.armR.rotation.z = 0.35; u.armL.rotation.z = -0.35; u.head.rotation.x = 0.05; break;
    case 'hideface': u.armR.rotation.x = -2.3; u.armL.rotation.x = -2.3; u.armR.rotation.z = 0.5; u.armL.rotation.z = -0.5; u.head.rotation.x = 0.35; u.torso.rotation.x = 0.15; break;
    case 'pose': u.armR.rotation.x = -2.9; u.armR.rotation.z = -0.6; u.armL.rotation.z = 0.9; u.head.rotation.z = 0.2; u.torso.rotation.z = -0.08; break;
    case 'sit': u.legL.rotation.x = -1.5; u.legR.rotation.x = -1.5; u.body.position.y = -0.36; u.body.position.z = 0.1; u.armL.rotation.x = -0.6; u.armR.rotation.x = -0.6; break;
    case 'guitar': u.legL.rotation.x = -1.5; u.legR.rotation.x = -1.4; u.body.position.y = -0.36; u.armL.rotation.set(-1.0, 0, 0.6); u.armR.rotation.set(-0.9 + Math.sin(t * 6) * 0.15 * w, 0, -0.3); u.head.rotation.x = 0.25; break;
    case 'hum': u.legL.rotation.x = -1.5; u.legR.rotation.x = -1.5; u.body.position.y = -0.36; u.head.rotation.z = Math.sin(t * 1.6) * 0.12 * w; u.head.rotation.x = -0.1; break;
    case 'hold': u.armL.rotation.x = -0.15; u.armR.rotation.x = -1.2; u.armR.rotation.z = -0.15; break;
    case 'turnaway': u.head.rotation.y = 0.6; u.armL.rotation.set(-0.3, 0, 0.3); u.armR.rotation.set(-0.3, 0, -0.3); break;
    case 'carry': u.armL.rotation.set(-1.25, 0, 0.25); u.armR.rotation.set(-1.25, 0, -0.25); break;
    case 'sleep': u.legL.rotation.x = -1.5; u.legR.rotation.x = -1.5; u.body.position.y = -0.36; u.body.position.z = 0.1; u.armL.rotation.x = -0.5; u.armR.rotation.x = -0.5; u.head.rotation.z = 0.42; u.head.rotation.x = 0.25 + Math.sin(t * 0.9) * 0.02 * w; u.torso.rotation.z = 0.08; break;
    case 'sketch': u.legL.rotation.x = -1.5; u.legR.rotation.x = -1.5; u.body.position.y = -0.36; u.body.position.z = 0.1; u.armL.rotation.set(-1.2, 0, -0.2); u.armR.rotation.set(-1.0 + Math.sin(t * 7) * 0.12 * w, 0, 0.25); u.head.rotation.x = 0.2 - Math.abs(Math.sin(t * 0.8)) * 0.25 * w; break;
    case 'climb': u.armL.rotation.x = -2.6 + Math.sin(t * 5) * 0.4 * w; u.armR.rotation.x = -2.6 - Math.sin(t * 5) * 0.4 * w; u.legL.rotation.x = -0.6 + Math.sin(t * 5) * 0.4 * w; u.legR.rotation.x = -0.6 - Math.sin(t * 5) * 0.4 * w; break;
    case 'talk': u.armR.rotation.set(-0.5 + Math.sin(t * 2.2) * 0.25 * w, 0, -0.2); u.head.rotation.x = Math.sin(t * 3) * 0.04 * w; break;
    case 'bike': u.legL.rotation.x = -1.2 + Math.sin(phase) * 0.5; u.legR.rotation.x = -1.2 - Math.sin(phase) * 0.5; u.body.position.y = -0.18; u.armL.rotation.x = -1.1; u.armR.rotation.x = -1.1; u.torso.rotation.x = 0.25; break;
    case 'nohands': u.legL.rotation.x = -1.2 + Math.sin(phase) * 0.5; u.legR.rotation.x = -1.2 - Math.sin(phase) * 0.5; u.body.position.y = -0.18; u.armL.rotation.set(-2.8, 0, 0.5); u.armR.rotation.set(-2.8, 0, -0.5); u.torso.rotation.x = -0.05; break;
    default: break;
  }
  if (u.pony) { u.pony.rotation.x = moving ? Math.sin(phase * 2) * 0.14 - 0.12 * k : Math.sin(t * 1.3) * 0.04 * w; }
  // alive: breathing, a blink every few seconds, and the head turning toward whoever she is looking at
  if (u.chest && !moving) { u.chest.scale.set(1 + Math.sin(t * 1.7) * 0.012 * w, 1, 1 + Math.sin(t * 1.7) * 0.02 * w); }
  if (t > u.blinkAt + 0.13) { u.blinkAt = t + 2.2 + ((Math.sin(t * 12.9898) * 43758.5453) % 1 + 1) % 1 * 3.2; }
  const shut = t > u.blinkAt && t < u.blinkAt + 0.13 && mode !== 'sleep';
  [u.eyeL, u.eyeR].forEach((e) => { if (e && e.userData && e.userData.lid) { e.userData.lid.visible = shut || mode === 'sleep' || u.expr === 'quiet'; e.userData.lid.rotation.x = mode === 'sleep' || shut ? 0.6 : -0.45; } });
  if (u.lookAt && !['sleep', 'hideface', 'turnaway', 'camera'].includes(mode)) {
    p.updateMatrixWorld(); const local = p.worldToLocal(u.lookAt.clone());
    const yaw = Math.max(-0.75, Math.min(0.75, Math.atan2(local.x, local.z))); const pitch = Math.max(-0.35, Math.min(0.35, -Math.atan2(local.y - 1.55, Math.hypot(local.x, local.z))));
    u.head.rotation.y += yaw * 0.85; u.head.rotation.x += pitch * 0.6;
  }
}
