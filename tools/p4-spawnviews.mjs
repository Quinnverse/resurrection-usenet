// Developer tool: renders what the in-game camera shows at each scene's spawn (same formula as main.js).
import fs from 'node:fs';
import { THREE } from '../frontend/p4/js/kit.js';
import * as Lv from '../frontend/p4/js/levels.js';
import { render, png, upscale } from './p4-preview.mjs';
import { makeMara, makeTheo, animate } from '../frontend/p4/js/people.js';
import { buildStudy } from '../frontend/p4/js/world-study.js';
import { buildArchive } from '../frontend/p4/js/world-archive.js';
import { buildTown } from '../frontend/p4/js/world-town.js';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const W = 480, H = 270;
function view(name, w, sceneId, px, pz, yaw, pitch, dist, extra) {
  const m = makeMara(); m.position.set(px, 0, pz); m.rotation.y = yaw + Math.PI; animate(m, 1, 0, 0, 'idle', false); w.scene.add(m);
  const c = Lv.SCENES[sceneId].camera; pitch = pitch ?? c.pitch; dist = dist ?? c.dist;
  const target = new THREE.Vector3(px, 1.35, pz);
  const want = new THREE.Vector3(px + Math.sin(yaw) * Math.cos(pitch) * dist, 1.35 + Math.sin(pitch) * dist, pz + Math.cos(yaw) * Math.cos(pitch) * dist);
  if (c.room) { want.x = Math.max(c.room.x0 + .15, Math.min(c.room.x1 - .15, want.x)); want.z = Math.max(c.room.z0 + .15, Math.min(c.room.z1 - .15, want.z)); want.y = Math.min(c.room.y1 - .1, want.y); }
  else if (w.blockers.length) { const dir = want.clone().sub(target); const len = dir.length(); dir.normalize(); const rc = new THREE.Raycaster(target, dir, 0, len); const hit = rc.intersectObjects(w.blockers, false)[0]; if (hit) { want.copy(target).addScaledVector(dir, Math.max(0.6, hit.distance - 0.35)); } }
  const cam = new THREE.PerspectiveCamera(55, W / H, 0.05, 600); cam.position.copy(want); cam.lookAt(target);
  if (extra) { extra(w); }
  fs.writeFileSync(`${out}/${name}.png`, png(W * 2, H * 2, upscale(render(w.scene, cam, W, H), W, H, 2)));
  w.scene.remove(m); console.log('wrote', name, want.toArray().map((v) => v.toFixed(2)).join(','));
}
const s = buildStudy({}); const sp = Lv.SCENES.study.spawn;
view('A-spawn', s, 'study', sp.x, sp.z, sp.yaw);
view('A-at-keepbox', s, 'study', -0.6, 0.9, 0.9);
view('A-at-computer', s, 'study', 3.0, -1.75, 0.6);
const a = buildArchive({ levels: Lv }); a.update(0.016, 2, false, { x: 0, z: 0.8 }); const ap = Lv.SCENES.archive.spawn;
view('B-spawn', a, 'archive', ap.x, ap.z, ap.yaw);
view('B-at-sky', a, 'archive', -6.0, -22.2, 0.6);
const t = buildTown({}); t.update(0.016, 1, false); const tp = Lv.SCENES.town.spawn;
view('C-spawn', t, 'town', tp.x, tp.z, tp.yaw);
view('C-at-theo', t, 'town', 13.0, 15.0, 3.6);
view('C-at-kiosk98', t, 'town', -3.3, 3.0, 2.6);
