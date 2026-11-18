// Low-poly characters built from primitives, with simple procedural animation.
// Mara: yellow jacket, red scarf, purple ponytail. Theo: old lighthouse keeper, navy coat, white beard, cap.
import { THREE, mat, PAL } from './kit.js';

function part(geo, color, x, y, z, opts) {
  const m = new THREE.Mesh(geo, mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false;
  return m;
}

// A limb that swings from its top end: returns { pivot, mesh }.
function limb(len, rTop, rBot, color, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = part(new THREE.CylinderGeometry(rTop, rBot, len, 6), color, 0, -len / 2, 0);
  pivot.add(m);
  return { pivot, mesh: m };
}

export function makeMara() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  // legs and boots
  const legL = limb(0.72, 0.085, 0.07, PAL.pants, -0.1, 0.8, 0), legR = limb(0.72, 0.085, 0.07, PAL.pants, 0.1, 0.8, 0);
  legL.pivot.add(part(new THREE.BoxGeometry(0.15, 0.1, 0.24), PAL.shoe, 0, -0.74, 0.04));
  legR.pivot.add(part(new THREE.BoxGeometry(0.15, 0.1, 0.24), PAL.shoe, 0, -0.74, 0.04));
  body.add(legL.pivot, legR.pivot);
  // torso: jacket, open front, belt
  const torso = new THREE.Group(); torso.position.y = 0.8; body.add(torso);
  torso.add(part(new THREE.CylinderGeometry(0.2, 0.24, 0.62, 8), PAL.jacket, 0, 0.31, 0));
  torso.add(part(new THREE.BoxGeometry(0.16, 0.5, 0.02), 0xfff3dc, 0, 0.3, 0.215));
  torso.add(part(new THREE.CylinderGeometry(0.245, 0.245, 0.06, 8), PAL.jacketD, 0, 0.03, 0));
  // pockets
  torso.add(part(new THREE.BoxGeometry(0.1, 0.08, 0.02), PAL.jacketD, -0.13, 0.15, 0.2));
  torso.add(part(new THREE.BoxGeometry(0.1, 0.08, 0.02), PAL.jacketD, 0.13, 0.15, 0.2));
  // scarf: a ring and a hanging tail
  const scarf = part(new THREE.TorusGeometry(0.15, 0.06, 5, 10), PAL.scarf, 0, 0.62, 0);
  scarf.rotation.x = Math.PI / 2; torso.add(scarf);
  const tail = part(new THREE.BoxGeometry(0.09, 0.32, 0.04), PAL.scarf, 0.08, 0.45, 0.2); tail.rotation.z = 0.12; torso.add(tail);
  // arms
  const armL = limb(0.6, 0.065, 0.055, PAL.jacket, -0.27, 0.58, 0), armR = limb(0.6, 0.065, 0.055, PAL.jacket, 0.27, 0.58, 0);
  armL.pivot.add(part(new THREE.IcosahedronGeometry(0.06, 0), PAL.skin, 0, -0.63, 0));
  armR.pivot.add(part(new THREE.IcosahedronGeometry(0.06, 0), PAL.skin, 0, -0.63, 0));
  torso.add(armL.pivot, armR.pivot);
  // head
  const head = new THREE.Group(); head.position.y = 0.82; torso.add(head);
  head.add(part(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 6), PAL.skin, 0, 0, 0));
  head.add(part(new THREE.IcosahedronGeometry(0.19, 1), PAL.skin, 0, 0.18, 0.01));
  // eyes and cheeks
  head.add(part(new THREE.BoxGeometry(0.035, 0.05, 0.02), PAL.ink, -0.065, 0.2, 0.175));
  head.add(part(new THREE.BoxGeometry(0.035, 0.05, 0.02), PAL.ink, 0.065, 0.2, 0.175));
  head.add(part(new THREE.BoxGeometry(0.05, 0.025, 0.02), 0xf29a8c, -0.1, 0.14, 0.16));
  head.add(part(new THREE.BoxGeometry(0.05, 0.025, 0.02), 0xf29a8c, 0.1, 0.14, 0.16));
  // hair: cap over the head, fringe, ponytail
  const hairCap = part(new THREE.SphereGeometry(0.205, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), PAL.hair, 0, 0.2, -0.01);
  hairCap.rotation.x = -0.25; head.add(hairCap);
  const fringe = part(new THREE.BoxGeometry(0.34, 0.08, 0.08), PAL.hair, 0, 0.32, 0.12); fringe.rotation.x = 0.35; head.add(fringe);
  const tieTo = new THREE.Group(); tieTo.position.set(0, 0.28, -0.17); head.add(tieTo);
  tieTo.add(part(new THREE.TorusGeometry(0.035, 0.015, 4, 8), PAL.scarf, 0, 0, 0));
  const pony = part(new THREE.ConeGeometry(0.09, 0.42, 6), PAL.hair, 0, -0.2, -0.04); pony.rotation.x = Math.PI - 0.3; tieTo.add(pony);

  root.userData = { legL: legL.pivot, legR: legR.pivot, armL: armL.pivot, armR: armR.pivot, torso, head, pony: tieTo, body };
  return root;
}

export function makeTheo() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const legL = limb(0.7, 0.09, 0.08, 0x3b3a48, -0.11, 0.78, 0), legR = limb(0.7, 0.09, 0.08, 0x3b3a48, 0.11, 0.78, 0);
  legL.pivot.add(part(new THREE.BoxGeometry(0.17, 0.11, 0.27), 0x2a2018, 0, -0.72, 0.04));
  legR.pivot.add(part(new THREE.BoxGeometry(0.17, 0.11, 0.27), 0x2a2018, 0, -0.72, 0.04));
  body.add(legL.pivot, legR.pivot);
  const torso = new THREE.Group(); torso.position.y = 0.78; body.add(torso);
  // long coat with brass buttons, a little belly
  torso.add(part(new THREE.CylinderGeometry(0.25, 0.31, 0.72, 8), PAL.coat, 0, 0.32, 0));
  torso.add(part(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 8), PAL.coatD, 0, -0.08, 0));
  for (let i = 0; i < 3; i++) { torso.add(part(new THREE.IcosahedronGeometry(0.025, 0), PAL.gold, 0.06, 0.12 + i * 0.16, 0.27 - i * 0.015)); torso.add(part(new THREE.IcosahedronGeometry(0.025, 0), PAL.gold, -0.06, 0.12 + i * 0.16, 0.27 - i * 0.015)); }
  const collar = part(new THREE.CylinderGeometry(0.19, 0.24, 0.1, 8), PAL.coatD, 0, 0.7, 0); torso.add(collar);
  const armL = limb(0.62, 0.075, 0.065, PAL.coat, -0.32, 0.64, 0), armR = limb(0.62, 0.075, 0.065, PAL.coat, 0.32, 0.64, 0);
  armL.pivot.add(part(new THREE.IcosahedronGeometry(0.07, 0), 0xe8b896, 0, -0.66, 0));
  armR.pivot.add(part(new THREE.IcosahedronGeometry(0.07, 0), 0xe8b896, 0, -0.66, 0));
  torso.add(armL.pivot, armR.pivot);
  const head = new THREE.Group(); head.position.y = 0.86; torso.add(head);
  head.add(part(new THREE.IcosahedronGeometry(0.2, 1), 0xe8b896, 0, 0.16, 0));
  head.add(part(new THREE.IcosahedronGeometry(0.05, 0), 0xd99a7a, 0, 0.14, 0.2));             // nose
  head.add(part(new THREE.BoxGeometry(0.035, 0.03, 0.02), PAL.ink, -0.07, 0.21, 0.18));
  head.add(part(new THREE.BoxGeometry(0.035, 0.03, 0.02), PAL.ink, 0.07, 0.21, 0.18));
  head.add(part(new THREE.BoxGeometry(0.08, 0.025, 0.02), PAL.beard, -0.07, 0.25, 0.18));    // eyebrows
  head.add(part(new THREE.BoxGeometry(0.08, 0.025, 0.02), PAL.beard, 0.07, 0.25, 0.18));
  const beard = part(new THREE.ConeGeometry(0.19, 0.3, 7), PAL.beard, 0, -0.02, 0.07); beard.rotation.x = Math.PI; head.add(beard);
  head.add(part(new THREE.BoxGeometry(0.2, 0.05, 0.06), PAL.beard, 0, 0.1, 0.18));            // moustache
  // captain's cap
  head.add(part(new THREE.CylinderGeometry(0.2, 0.21, 0.13, 10), PAL.cap, 0, 0.36, 0));
  head.add(part(new THREE.CylinderGeometry(0.235, 0.235, 0.03, 10), PAL.cap, 0, 0.31, 0));
  const peak = part(new THREE.BoxGeometry(0.24, 0.025, 0.12), 0x111a28, 0, 0.31, 0.2); peak.rotation.x = 0.2; head.add(peak);
  head.add(part(new THREE.BoxGeometry(0.06, 0.04, 0.02), PAL.gold, 0, 0.38, 0.2));
  // lantern in his left hand
  const lantern = new THREE.Group(); lantern.position.set(0, -0.72, 0.06); armL.pivot.add(lantern);
  lantern.add(part(new THREE.BoxGeometry(0.12, 0.16, 0.12), 0x6a4b2a, 0, -0.08, 0));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.09), new THREE.MeshBasicMaterial({ color: 0x5a4a3a }));
  glass.position.y = -0.08; lantern.add(glass);
  root.userData = { legL: legL.pivot, legR: legR.pivot, armL: armL.pivot, armR: armR.pivot, torso, head, body, lanternGlass: glass };
  return root;
}

// Procedural animation. phase advances with distance walked. speed in m/s. mode: idle | walk | talk | reach | wave.
export function animate(person, t, phase, speed, mode, reduce) {
  const u = person.userData;
  const moving = speed > 0.15;
  const k = Math.min(1, speed / 3);
  const swing = moving ? Math.sin(phase) * (0.35 + 0.35 * k) : 0;
  u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.9; u.armR.rotation.x = swing * 0.9;
  u.armL.rotation.z = 0.08; u.armR.rotation.z = -0.08;
  const bob = moving ? Math.abs(Math.cos(phase)) * 0.04 * (0.5 + k) : (reduce ? 0 : Math.sin(t * 1.8) * 0.008);
  u.body.position.y = bob;
  u.torso.rotation.x = moving ? 0.06 + 0.05 * k : 0;
  u.head.rotation.y = 0; u.head.rotation.x = 0;
  if (mode === 'talk') {
    u.head.rotation.x = reduce ? 0 : Math.sin(t * 3.1) * 0.05;
    u.armR.rotation.x = -0.5 + (reduce ? 0 : Math.sin(t * 2.3) * 0.12); u.armR.rotation.z = -0.25;
  } else if (mode === 'reach') {
    u.armR.rotation.x = -1.35; u.armL.rotation.x = -1.1; u.head.rotation.x = 0.25;
  } else if (mode === 'wave') {
    u.armR.rotation.x = -2.6; u.armR.rotation.z = -0.4 + (reduce ? 0 : Math.sin(t * 9) * 0.35);
  } else if (mode === 'look') {
    u.head.rotation.x = -0.35;
  }
  if (u.pony) { u.pony.rotation.x = moving ? Math.sin(phase * 2) * 0.12 - 0.1 * k : (reduce ? 0 : Math.sin(t * 1.3) * 0.04); }
}
