// Developer tool: renders key scenes to PNG with the Node software canvas, for visual review without a browser.
//   node tools/render-shots.js <outdir> [scale]
const fs = require('fs');
const path = require('path');
const { makeCanvas, toPNG } = require('./softcanvas.js');
const F = '../frontend/p3/';
const Art = require(F + 'art.js'), Scenes = require(F + 'scenes.js'), D = require(F + 'data.js'), Pz = require(F + 'puzzle.js'), St = require(F + 'state.js');
const out = process.argv[2] || '/projects/sandbox/review/shots';
const scale = Number(process.argv[3] || 3);
fs.mkdirSync(out, { recursive: true });
const art = Art.createArt(makeCanvas);
const S = Scenes.create(art, D, Pz);

function frame(name, draw) {
  const cv = makeCanvas(320, 176);
  draw(cv.getContext('2d'));
  fs.writeFileSync(path.join(out, name + '.png'), toPNG(cv, scale));
}
const stars = D.WORLD_STARS;
const world = D.buildWorld();
const stBase = St.newState();
function worldView(px, py, extra = {}) {
  const cam = S.cameraFor(px, py, world);
  return Object.assign({ t: 1.3, reduce: false, cam, world, state: stBase, stars, player: { x: px, y: py, facing: 1 }, anim: 'idle', particles: [], near: null, fade: 0 }, extra);
}

const study = D.buildStudy();
frame('01-study', (c) => S.drawStudy(c, { t: 1.3, reduce: false, state: Object.assign({}, stBase), player: { x: 12.0, y: 9, facing: 1 }, anim: 'idle', near: D.STUDY_OBJECTS[4], particles: [] }));
frame('02-meadow-start', (c) => S.drawWorld(c, worldView(5.5, 10, { near: D.WORLD_OBJECTS[0], anim: 'run' })));
frame('03-meadow-ledges', (c) => S.drawWorld(c, worldView(26.5, 6)));
frame('04-garden', (c) => S.drawWorld(c, worldView(39, 1, { anim: 'jump' })));
frame('05-canyon-edge', (c) => S.drawWorld(c, worldView(58, 10, { near: D.WORLD_OBJECTS[7] })));
frame('06-server-door', (c) => S.drawWorld(c, worldView(62.8, 12, { near: D.WORLD_OBJECTS[8], anim: 'idle' })));
const wb = D.buildWorld(); St.applyBridge(wb, Pz.SOLUTION && { s1: 'a-left', s2: 'l-mid', s3: 'a-right' });
frame('07-bridge-built', (c) => S.drawWorld(c, Object.assign(worldView(67, 10, { anim: 'run' }), { world: wb, cam: S.cameraFor(67, 10, wb) })));
frame('08-farside', (c) => S.drawWorld(c, Object.assign(worldView(86, 9, { near: D.WORLD_OBJECTS[10] }), { world: wb, cam: S.cameraFor(86, 9, wb) })));
frame('09-pier', (c) => S.drawWorld(c, Object.assign(worldView(116, 10, { near: D.WORLD_OBJECTS[12] }), { world: wb, cam: S.cameraFor(116, 10, wb) })));
const sw = D.buildServer();
frame('10-server', (c) => S.drawServer(c, { t: 1.3, reduce: false, cam: { x: 0, y: 0 }, world: sw, state: stBase, player: { x: 7.0, y: 9, facing: 1 }, anim: 'run', near: D.SERVER_OBJECTS[1], particles: [], fade: 0 }));
frame('11-server-mid', (c) => S.drawServer(c, { t: 1.3, reduce: false, cam: { x: 160, y: 0 }, world: sw, state: stBase, player: { x: 19.0, y: 9, facing: 1 }, anim: 'idle', near: D.SERVER_OBJECTS[2], particles: [], fade: 0 }));
frame('12-restore-empty', (c) => S.drawRestore(c, { t: 1.3, reduce: false, placed: {} }));
frame('13-restore-partial', (c) => S.drawRestore(c, { t: 1.3, reduce: false, placed: { s1: 'a-left', s3: 'a-right' } }));
frame('14-restore-done', (c) => S.drawRestore(c, { t: 1.3, reduce: false, placed: Pz.SOLUTION }));
['archive', 'lab', 'mirror'].forEach((id, i) => frame('15-copy-' + id, (c) => S.drawCopy(c, { t: 1.3, reduce: false, copy: id })));
const iw = D.buildIsland();
const stIsl = St.newState(); stIsl.flags.tape = true; stIsl.flags.catPetted = true; stIsl.flags.garden = true; stIsl.stars = ['s01', 's02', 's03', 's04', 's05', 's06', 'g1'];
[1, 2, 4, 5].forEach((stage) => frame('16-island-stage' + stage, (c) => S.drawIsland(c, { t: 1.3, reduce: false, state: stIsl, world: iw, cam: { x: 0, y: -24 }, stage, stageProgress: 0.6, player: { x: 11, y: 8, facing: 1 }, anim: 'idle', near: stage === 5 ? D.ISLAND_OBJECTS[3] : null, particles: [], fade: 0 })));
frame('17-title', (c) => S.drawTitle(c, { t: 1.3, reduce: false, world, state: stBase }));
console.log('rendered to', out);
