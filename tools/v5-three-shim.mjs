// Three.js for tools/v5-shell-run.mjs: the real vendored library with WebGLRenderer replaced by a recorder, so the
// browser shell (frontend/v5/main.js) can run in Node without a GPU. It draws nothing; it checks every frame that
// the scene graph and the camera are finite and keeps statistics for the harness.
export * from '../frontend/p4/vendor/three.module.min.js';
import * as THREE from '../frontend/p4/vendor/three.module.min.js';

export const RENDER_LOG = { frames: 0, problems: [], last: null };
const finite = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

export class WebGLRenderer {
  constructor() {
    this.domElement = globalThis.document ? globalThis.document.createElement('canvas') : {};
    this.shadowMap = { enabled: false, type: 0 };
    this.outputColorSpace = ''; this.toneMapping = 0; this.toneMappingExposure = 1; this.info = { render: {} };
  }
  getContext() { return { fake: true }; }
  setPixelRatio(r) { this.pixelRatio = r; }
  setSize(w, h) { this.size = [w, h]; }
  render(scene, camera) {
    RENDER_LOG.frames += 1;
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    let meshes = 0, bad = null;
    scene.traverseVisible((o) => { if (o.isMesh) { meshes += 1; } if (!bad && !finite(o.position)) { bad = o.name || o.type; } });
    if (!finite(camera.position)) { RENDER_LOG.problems.push({ frame: RENDER_LOG.frames, what: 'camera position not finite' }); }
    if (bad) { RENDER_LOG.problems.push({ frame: RENDER_LOG.frames, what: 'object position not finite: ' + bad }); }
    if (!meshes) { RENDER_LOG.problems.push({ frame: RENDER_LOG.frames, what: 'nothing visible' }); }
    RENDER_LOG.last = { scene, camera, meshes };
  }
  dispose() {}
}
export { THREE as REAL };
// lets a bundled copy (tools/v5-bundle.mjs, run by tools/v5-shell-run.mjs --bundle) hand its own instance to the harness
globalThis.__V5_SHIM__ = { RENDER_LOG, REAL: THREE };
