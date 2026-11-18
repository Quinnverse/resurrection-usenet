// Developer tool: renders P4 scenes with the software preview rasterizer. Usage: node tools/p4-shots.mjs <outdir> [scene]
import fs from 'node:fs';
import path from 'node:path';
import { THREE } from '../frontend/p4/js/kit.js';
import { render, png, upscale } from './p4-preview.mjs';
import { makeMara, makeTheo, animate } from '../frontend/p4/js/people.js';
const out = process.argv[2] || '/projects/sandbox/review/p4';
const only = process.argv[3] || null;
fs.mkdirSync(out, { recursive: true });
const W = 480, H = 270;
function shot(name, scene, eye, look, fov) {
  const cam = new THREE.PerspectiveCamera(fov || 55, W / H, 0.05, 400);
  cam.position.set(...eye); cam.lookAt(new THREE.Vector3(...look));
  const rgb = render(scene, cam, W, H);
  fs.writeFileSync(path.join(out, name + '.png'), png(W * 2, H * 2, upscale(rgb, W, H, 2)));
  console.log('wrote', name);
}
function addMara(scene, x, z, yaw, mode) { const m = makeMara(); m.position.set(x, 0, z); m.rotation.y = yaw; animate(m, 1, 0.7, mode === 'walk' ? 2.5 : 0, mode || 'idle', false); scene.add(m); return m; }
const scenes = {
  async study() {
    const { buildStudy } = await import('../frontend/p4/js/world-study.js');
    const w = buildStudy({}); addMara(w.scene, 0.2, 0.9, 0.25 + Math.PI, 'idle');
    shot('study-01-start', w.scene, [0.2 + Math.sin(0.25) * 3.0, 2.1, 0.9 + Math.cos(0.25) * 3.0], [0.0, 1.0, -0.5]);
    shot('study-02-desk', w.scene, [-0.5, 1.9, 1.6], [3.0, 0.9, -2.6]);
    w.setCrt(true); shot('study-03-crt-on', w.scene, [1.2, 1.6, -0.6], [3.0, 1.0, -2.9]);
    shot('study-04-wide', w.scene, [3.6, 2.5, 2.9], [-2.0, 0.6, -1.8], 70);
  },
  async archive() {
    const L = await import('../frontend/p4/js/levels.js');
    const { buildArchive } = await import('../frontend/p4/js/world-archive.js');
    const w = buildArchive({ levels: L }); addMara(w.scene, 0, 0.8, Math.PI, 'idle');
    w.update(0.016, 2, false, { x: 0, z: 0.8 });
    shot('archive-01-landing', w.scene, [0, 2.6, 5.6], [0, 1.2, -8]);
    const m2 = addMara(w.scene, -3, -19.5, Math.PI * 1.2, 'walk');
    w.update(0.016, 2.5, false, { x: -3, z: -19.5 });
    shot('archive-02-plaza', w.scene, [1.0, 3.2, -14.5], [-5, 1.5, -24]);
    w.openGate(true); w.update(0.016, 3, false, { x: 0, z: -40 });
    addMara(w.scene, 0, -40.5, Math.PI, 'walk');
    shot('archive-03-gate', w.scene, [0, 2.8, -35.5], [0, 1.6, -45]);
  },
  async town() {
    const { buildTown } = await import('../frontend/p4/js/world-town.js');
    const w = buildTown({}); w.update(0.016, 1, false);
    addMara(w.scene, 0, -9, Math.PI, 'walk');
    shot('town-01-arrival', w.scene, [0, 3.6, -15.2], [0, 1.0, 2]);
    addMara(w.scene, 12.6, 14.6, 0.6, 'idle');
    shot('town-02-theo', w.scene, [9.6, 3.2, 9.6], [15.5, 2.5, 18.5]);
    shot('town-03-plaza', w.scene, [0, 4.5, 9], [0, 1.0, -2]);
    w.setView('98'); shot('town-04-view98', w.scene, [9.6, 3.2, 9.6], [15.5, 3.5, 18.5]);
    shot('town-05-plaza98', w.scene, [0, 4.5, 9], [0, 1.0, -2]);
    w.setView('04'); shot('town-06-view04', w.scene, [9.6, 3.2, 9.6], [15.5, 3.5, 18.5]);
    w.setView(null); w.setRestored(true, false); w.setLit(true, false); w.update(0.016, 3, false);
    shot('town-07-lit', w.scene, [1.0, 3.2, 23.5], [17, 6.5, 19.5]);
    w.setView('04'); shot('town-08-plaza04', w.scene, [0, 4.5, 9], [0, 1.0, -2]);
  }
};
for (const [k, fn] of Object.entries(scenes)) { if (!only || only === k) { await fn(); } }
