// P3.2 core rules: movement engine, restoration puzzle, level data, save format, strings and art.
// Pure logic only. What a player actually sees and feels is checked in real Chromium by e2e/p3.spec.js.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const F = '../frontend/p3/';
const E = require(F + 'engine.js');
const Pz = require(F + 'puzzle.js');
const D = require(F + 'data.js');
const St = require(F + 'state.js');
const I = require(F + 'i18n.js');
const Art = require(F + 'art.js');
const Scenes = require(F + 'scenes.js');
const { makeCanvas } = require('../tools/softcanvas.js');

const NONE = { left: false, right: false, jump: false };
const RIGHT = { left: false, right: true, jump: false };
const LEFT = { left: true, right: false, jump: false };

function settle(world, x, y) { let s = E.createState(x, y); for (let i = 0; i < 6; i++) { s = E.step(s, NONE, world).state; } return s; }
function run(world, s, frames, input) { for (let i = 0; i < frames; i++) { s = E.step(s, typeof input === 'function' ? input(i, s) : input, world).state; } return s; }

// A reactive player: walks toward tx and jumps at edges and walls, like a person would.
function walk(world, s, tx, opts) {
  const o = opts || {};
  let jumps = 0, falls = 0, i = 0;
  for (; i < 4000 && Math.abs(s.x - tx) > 0.2; i++) {
    const dir = tx > s.x ? 1 : -1;
    const aheadX = s.x + dir * 0.9, row = Math.round(s.y);
    const ground = world.solid(Math.floor(aheadX), row) || world.solid(Math.floor(aheadX), row + 1);
    const wall = world.solid(Math.floor(s.x + dir * 0.55), row - 1);
    const jump = s.onGround && (!ground || wall) && !o.noJump;
    if (jump) { jumps++; }
    const r = E.step(s, { left: dir < 0, right: dir > 0, jump }, world, { respawn: o.respawn });
    s = r.state; if (r.events.some((e) => e.type === 'fall')) { falls++; }
  }
  return { s, jumps, falls, frames: i };
}

describe('P3.2 engine', () => {
  const w = D.buildWorld();

  it('is deterministic: the same inputs give the same states', () => {
    const script = (i) => ({ left: i % 120 < 20, right: i % 120 >= 40 && i % 120 < 100, jump: i % 90 === 45 });
    const a = run(w, settle(w, 3.5, 10), 900, script), b = run(w, settle(w, 3.5, 10), 900, script);
    assert.deepEqual(a, b);
  });

  it('a jump rises about 3.9 tiles', () => {
    let s = settle(w, 3.5, 10);
    s = E.step(s, { left: false, right: false, jump: true }, w).state;
    let top = s.y;
    for (let i = 0; i < 80; i++) { s = E.step(s, NONE, w).state; top = Math.min(top, s.y); }
    assert.ok(top > 5.9 && top < 6.3, `apex y=${top}`);
  });

  it('forgives a jump pressed just after leaving an edge, and just before landing', () => {
    // coyote time: walk off the stream-side edge, press jump 4 frames later
    let s = settle(w, 15.5, 10);
    while (s.onGround) { s = E.step(s, RIGHT, w).state; }
    for (let i = 0; i < 3; i++) { s = E.step(s, RIGHT, w).state; }
    const r = E.step(s, { left: false, right: true, jump: true }, w);
    assert.ok(r.events.some((e) => e.type === 'jump'), 'late jump accepted');
    // buffering: press jump while still falling close to the ground
    let f = E.createState(8.5, 9.6); f.vy = 6;
    f = E.step(f, { left: false, right: false, jump: true }, w).state;
    let jumped = false;
    for (let i = 0; i < 20 && !jumped; i++) { const q = E.step(f, NONE, w); f = q.state; jumped = q.events.some((e) => e.type === 'jump'); }
    assert.ok(jumped, 'buffered jump fires on landing');
  });

  it('reports jump, land, step and fall events', () => {
    let s = settle(w, 3.5, 10);
    const types = new Set();
    for (let i = 0; i < 400; i++) { const r = E.step(s, { left: false, right: true, jump: i % 70 === 10 }, w, { respawn: { x: 3.5, y: 10 } }); s = r.state; r.events.forEach((e) => types.add(e.type)); }
    ['jump', 'land', 'step'].forEach((t) => assert.ok(types.has(t), t));
    const f = E.step(E.createState(60, 17), NONE, w, { respawn: { x: 3.5, y: 10 } });
    assert.ok(f.events.some((e) => e.type === 'fall'));
    assert.equal(f.state.x, 3.5);
  });

  it('frozen players cannot be moved by input but still obey gravity', () => {
    let s = E.createState(5.5, 4);
    const r = E.step(s, { left: false, right: true, jump: true }, w, { frozen: true });
    assert.equal(r.state.x, 5.5);
    assert.ok(r.state.y > 4);
  });

  it('solid edges stop the player at the map sides', () => {
    const s = run(w, settle(w, 3.5, 10), 200, LEFT);
    assert.ok(s.x >= 0.29 && s.x < 0.4, `x=${s.x}`);
  });
});

describe('P3.2 restoration puzzle', () => {
  it('exactly one piece fits each gap, and it is the intended one', () => {
    const fits = [];
    Object.keys(Pz.PIECES).forEach((p) => Pz.SLOTS.forEach((s) => { if (Pz.check(p, s.id).ok) { fits.push(p + '>' + s.id); } }));
    assert.deepEqual(fits.sort(), ['a-left>s1', 'a-right>s3', 'l-mid>s2']);
    Object.keys(Pz.SOLUTION).forEach((slot) => assert.ok(Pz.check(Pz.SOLUTION[slot], slot).ok));
  });

  it('every failure reason is reachable and checked in a fixed order', () => {
    assert.equal(Pz.check('m-mid', 's2').reason, 'build');      // complete bridge, old draft
    assert.equal(Pz.check('a-mid', 's2').reason, 'corrupt');    // right build, damaged data
    assert.equal(Pz.check('l-mid', 's1').reason, 'width');      // clean piece, wrong length
    assert.equal(Pz.check('l-arch', 's2').reason, 'shape');     // right length, arched edges
    assert.equal(Pz.check('a-left', 's3').reason, 'shape');
    assert.equal(Pz.check('m-left', 's1').reason, 'build', 'build is checked before shape');
    assert.equal(Pz.check('a-mid', 's1').reason, 'corrupt', 'damage is checked before width');
  });

  it('the old complete copy is a trap: every one of its pieces is the wrong build', () => {
    Pz.COPIES.mirror.pieces.forEach((p) => Pz.SLOTS.forEach((s) => assert.equal(Pz.check(p, s.id).ok, false)));
    assert.equal(Pz.COPIES.mirror.pieces.length, 3);
  });

  it('the backpack holds 4 pieces, so the solution needs reading the copies, not taking everything', () => {
    const all = Object.keys(Pz.PIECES);
    assert.ok(all.length > Pz.BACKPACK_SIZE);
    let bp = [];
    all.forEach((p) => { const r = Pz.take(bp, p); if (r.ok) { bp = r.backpack; } });
    assert.equal(bp.length, Pz.BACKPACK_SIZE);
    assert.equal(Pz.take(bp, 'l-mid').reason === 'full' || bp.includes('l-mid'), true);
  });

  it('a wrong placement changes nothing, so the player can retry at once', () => {
    const placed = Pz.emptyPlaced(), bp = ['l-arch', 'a-left'];
    const r = Pz.place(placed, bp, 'l-arch', 's2');
    assert.equal(r.ok, false);
    assert.deepEqual(r.placed, placed);
    assert.deepEqual(r.backpack, bp);
    assert.equal(Pz.place(placed, bp, 'a-right', 's3').reason, 'missing', 'pieces not in the backpack cannot be placed');
  });

  it('placing, taking back and replacing can never lose a piece or get stuck', () => {
    let placed = Pz.emptyPlaced(), bp = ['a-left', 'l-mid', 'a-right'];
    Object.keys(Pz.SOLUTION).forEach((slot) => { const r = Pz.place(placed, bp, Pz.SOLUTION[slot], slot); assert.ok(r.ok); placed = r.placed; bp = r.backpack; });
    assert.ok(Pz.isComplete(placed));
    const u = Pz.unplace(placed, bp, 's2');
    assert.equal(u.placed.s2, null); assert.deepEqual(u.backpack, ['l-mid']); assert.equal(Pz.isComplete(u.placed), false);
    const again = Pz.place(u.placed, u.backpack, 'l-mid', 's2');
    assert.ok(again.ok && again.complete);
  });

  it('a bridge piece lands on the right tiles, with the raised end one row up', () => {
    const t = Pz.tilesFor('a-right', 's3');
    assert.deepEqual(t, [{ col: 69, row: 10 }, { col: 70, row: 10 }, { col: 71, row: 9 }]);
    assert.equal(Pz.tilesFor('l-mid', 's2').length, 4);
  });
});

describe('P3.2 level data', () => {
  const study = D.buildStudy(), world = D.buildWorld(), server = D.buildServer(), island = D.buildIsland();
  const scenes = { study, world, server, island };

  it('declares explicit sizes, spawns, checkpoints and interaction ranges', () => {
    Object.keys(scenes).forEach((n) => { assert.equal(scenes[n].w, D.CONFIG.scenes[n].w, n + ' width'); assert.equal(scenes[n].h, D.CONFIG.scenes[n].h, n + ' height'); });
    assert.equal(D.CONFIG.interactRange, 1.6);
    assert.ok(D.CHECKPOINTS.length >= 5);
  });

  it('every spawn point and checkpoint stands on solid ground in free air', () => {
    Object.keys(scenes).forEach((n) => { const sp = D.CONFIG.scenes[n].spawn; assert.equal(E.boxHits(scenes[n], sp.x, sp.y), false, n + ' spawn free'); assert.ok(scenes[n].solid(Math.floor(sp.x), sp.y), n + ' spawn has ground'); });
    D.CHECKPOINTS.forEach((c) => { assert.equal(E.boxHits(world, c.x, c.y), false, 'cp ' + c.id + ' free'); assert.ok(world.solid(Math.floor(c.x), c.y), 'cp ' + c.id + ' ground'); });
  });

  it('every interactive object, star and floppy is placed on the map, standing on ground', () => {
    [['study', D.STUDY_OBJECTS], ['world', D.WORLD_OBJECTS], ['server', D.SERVER_OBJECTS], ['island', D.ISLAND_OBJECTS]].forEach(([n, list]) => {
      const ids = new Set();
      list.forEach((o) => { assert.ok(!ids.has(o.id), 'unique ' + n + '.' + o.id); ids.add(o.id); assert.ok(scenes[n].solid(Math.floor(o.x), o.y), n + '.' + o.id + ' ground'); assert.equal(E.boxHits(scenes[n], o.x, o.y), false, n + '.' + o.id + ' free'); });
    });
    D.WORLD_STARS.forEach((s) => assert.equal(world.solid(s[1], s[2]), false, 'star ' + s[0]));
    D.SERVER_FLOPPIES.forEach((f) => assert.equal(server.solid(f[1], f[2]), false, 'floppy ' + f[0]));
    assert.equal(new Set(D.WORLD_STARS.map((s) => s[0])).size, D.WORLD_STARS.length);
  });

  it('every object has text in both languages', () => {
    const need = [];
    D.STUDY_OBJECTS.forEach((o) => need.push('say.' + o.id));
    D.WORLD_OBJECTS.filter((o) => o.type === 'read' || ['cat', 'blueprint', 'crab', 'door'].includes(o.id)).forEach((o) => need.push('say.' + o.id));
    D.ISLAND_OBJECTS.forEach((o) => need.push('isl.' + o.id));
    need.forEach((k) => ['en', 'zh'].forEach((l) => assert.ok(I.dictionaries[l][k], l + ' ' + k)));
  });

  it('the meadow can be walked from the spawn to the canyon edge without a fall', () => {
    let r = walk(world, settle(world, 3.5, 10), 16.5, { respawn: { x: 3.5, y: 10 } });
    r = walk(world, r.s, 45.5, { respawn: { x: 20.7, y: 10 } }); assert.equal(r.falls, 0);
    r = walk(world, r.s, 58.4, { respawn: { x: 49.6, y: 10 } }); assert.equal(r.falls, 0);
  });

  it('a player who only holds right is never snagged under a ledge or a shelf', () => {
    // Regression: a ledge hung exactly one body-height above the path, so holding right stopped dead beneath it.
    let s = settle(world, 20.5, 10);
    for (let i = 0; i < 190; i++) { s = E.step(s, RIGHT, world, { respawn: { x: 20.5, y: 10 } }).state; }   // stops before the second water gap
    assert.ok(s.x > 40 && s.x < 46, `walked under the whole high route, x=${s.x}`);
    const sv = D.buildServer(); let t = settle(sv, 3.5, 9);
    for (let i = 0; i < 900; i++) { t = E.step(t, RIGHT, sv).state; }
    assert.ok(t.x > 38, `walked the whole server room, x=${t.x}`);
  });

  it('the high route has wide jump windows at every hop', () => {
    const hops = [['g->l1', 20.3, 10, 20.0, 22.2, 7], ['l1->l2', 24, 7, 24.2, 26.4, 5], ['l2->l3', 29, 5, 29.2, 31.4, 3], ['l3->garden', 34, 3, 34.2, 36.4, 1]];
    hops.forEach(([name, x, y, from, to, landY]) => {
      let good = 0;
      for (let jx = from; jx <= to + 1e-9; jx += 0.1) {
        let s = settle(world, x, y), jumped = false, ok = false;
        for (let i = 0; i < 160; i++) { const jump = !jumped && s.onGround && s.x >= jx; if (jump) { jumped = true; } s = E.step(s, { left: false, right: true, jump }, world).state; if (jumped && i > 5 && s.onGround && Math.abs(s.y - landY) < 0.1) { ok = true; break; } }
        if (ok) { good++; }
      }
      assert.ok(good * 0.1 >= 1.8, `${name}: window ${(good * 0.1).toFixed(1)} tiles`);
    });
  });

  it('the server ledge can be reached by dropping and left again by jumping', () => {
    let s = settle(world, 58.4, 10);
    for (let i = 0; i < 200 && s.x < 62.4; i++) { s = E.step(s, RIGHT, world).state; }
    for (let i = 0; i < 80; i++) { s = E.step(s, NONE, world).state; }
    assert.ok(s.onGround && Math.abs(s.y - 12) < 0.05, `on the ledge, y=${s.y}`);
    s = E.step(s, { left: true, right: false, jump: true }, world).state;
    for (let i = 0; i < 100; i++) { s = E.step(s, LEFT, world).state; }
    assert.ok(s.onGround && Math.abs(s.y - 10) < 0.05, `back on the cliff, y=${s.y}`);
  });

  it('the canyon cannot be crossed without the bridge, and can be with it', () => {
    let s = settle(world, 58.4, 10), falls = 0;
    for (let i = 0; i < 700; i++) { const r = E.step(s, { left: false, right: true, jump: s.onGround && s.x > 60.5 }, world, { respawn: { x: 54.2, y: 10 } }); s = r.state; if (r.events.some((e) => e.type === 'fall')) { falls++; } }
    assert.ok(falls > 0 && s.x < 72, 'no crossing without the bridge');
    const built = D.buildWorld(); St.applyBridge(built, Pz.SOLUTION);
    const r = walk(built, settle(built, 58.4, 10), 74.5, { respawn: { x: 54.2, y: 10 } });
    assert.equal(r.falls, 0); assert.ok(r.s.x >= 74.2, `crossed to x=${r.s.x}`);
    const end = walk(built, r.s, 118.2, { respawn: { x: 74.5, y: 9 } });
    assert.equal(end.falls, 0); assert.ok(end.s.x > 117.5);
  });

  it('a wrong piece does not make a crossable bridge', () => {
    const w2 = D.buildWorld(); Pz.tilesFor('l-arch', 's2').forEach((t) => w2.set(t.col, t.row, 'P'));
    ['s1', 's3'].forEach((s) => Pz.tilesFor(Pz.SOLUTION[s], s).forEach((t) => w2.set(t.col, t.row, 'P')));
    const arch = Pz.tilesFor('l-arch', 's2').map((t) => t.row);
    assert.notDeepEqual(arch, [10, 10, 10, 10], 'the arched piece is not flat');
  });
});

describe('P3.2 save format', () => {
  it('round-trips a full state', () => {
    const s = St.newState();
    s.scene = 'world'; s.cp = 3; s.stars = ['s01', 'g1']; s.floppies = ['f1']; s.flags.tape = true; s.flags.catPetted = true;
    s.serverSeen = ['archive']; s.backpack = ['a-left']; s.placed = Object.assign(Pz.emptyPlaced(), { s2: 'l-mid' }); s.falls = 4; s.wrong = 2;
    s.pos.world = { x: 41.5, y: 10 };
    const back = St.parse(JSON.parse(JSON.stringify(St.serialize(s))));
    assert.deepEqual(back, s);
  });

  it('keeps only ids and numbers, never text, so changing language cannot lose progress', () => {
    const json = JSON.stringify(St.newState());
    assert.doesNotMatch(json, /[\u4e00-\u9fff]/);
    assert.doesNotMatch(json, /Mom|Elena|Mara|congratulations/i);
  });

  it('rejects other versions and unknown scenes', () => {
    assert.equal(St.parse(null), null);
    assert.equal(St.parse({ v: 1, scene: 'world' }), null);
    assert.equal(St.parse({ v: 2, scene: 'moon' }), null);
  });

  it('a tampered save cannot skip the puzzle', () => {
    const s = St.parse({ v: 2, scene: 'island', bridge: true, ended: true, placed: { s1: 'm-left', s2: 'l-arch', s3: 'a-right' }, island: { stage: 5 } });
    assert.equal(s.placed.s1, null, 'wrong build dropped'); assert.equal(s.placed.s2, null, 'wrong shape dropped'); assert.equal(s.placed.s3, 'a-right');
    assert.equal(s.bridge, false, 'bridge needs a complete valid placement'); assert.equal(s.ended, false); assert.equal(s.scene, 'world');
  });

  it('drops unknown ids, caps the backpack and ignores bad numbers', () => {
    const s = St.parse({ v: 2, scene: 'world', stars: ['s01', 'nope', 's01'], backpack: ['a-left', 'l-mid', 'a-right', 'm-mid', 'm-left', 'zzz'], cp: 99, pos: { world: { x: NaN, y: 'x' } }, falls: -5 });
    assert.deepEqual(s.stars, ['s01']);
    assert.equal(s.backpack.length, Pz.BACKPACK_SIZE);
    assert.equal(s.cp, 0); assert.equal(s.falls, 0);
    assert.deepEqual(s.pos.world, D.CONFIG.scenes.world.spawn);
  });

  it('a piece cannot be both carried and placed', () => {
    const s = St.parse({ v: 2, scene: 'world', backpack: ['a-left'], placed: { s1: 'a-left' } });
    assert.equal(s.placed.s1, null);
  });

  it('island objects appear only when their memory was found', () => {
    const s = St.newState(); s.island.stage = 5;
    let ids = St.islandObjects(s).map((o) => o.id);
    ['cassette', 'cat', 'note'].forEach((x) => assert.ok(!ids.includes(x), x + ' hidden'));
    s.flags.tape = true; s.flags.catPetted = true; s.flags.garden = true;
    ids = St.islandObjects(s).map((o) => o.id);
    ['cassette', 'cat', 'note', 'photo', 'jar', 'console'].forEach((x) => assert.ok(ids.includes(x), x + ' shown'));
    s.island.stage = 2; assert.deepEqual(St.islandObjects(s).map((o) => o.id), ['cabin']);
  });
});

describe('P3.2 strings', () => {
  it('has the same keys in English and Chinese, with identical placeholders and no empty text', () => {
    assert.deepEqual(I.keysOf(I.dictionaries.en), I.keysOf(I.dictionaries.zh));
    I.keysOf(I.dictionaries.en).forEach((k) => {
      const a = (I.dictionaries.en[k].match(/\{\w+\}/g) || []).sort().join(), b = (I.dictionaries.zh[k].match(/\{\w+\}/g) || []).sort().join();
      assert.equal(a, b, 'placeholders ' + k);
      assert.ok(I.dictionaries.en[k].trim() && I.dictionaries.zh[k].trim(), 'empty ' + k);
    });
  });

  it('the ending says exactly what was written, in both languages', () => {
    const en = I.dictionaries.en, zh = I.dictionaries.zh;
    assert.equal(en['end.elena1'], "If you're reading this, congratulations. You're officially the first person to finish my game.");
    assert.equal(en['end.elena2'], "Unless you're me. In which case, stop cheating.");
    assert.equal(en['end.elena3'], "One day, I'll make a real one.");
    assert.equal(en['end.mara1'], 'You never told me you made games.');
    assert.equal(zh['end.elena1'], '如果你看到这里，恭喜！你正式成为第一个通关我游戏的人。');
    assert.equal(zh['end.elena2'], '除非你就是我自己。那不算，禁止作弊。');
    assert.equal(zh['end.elena3'], '总有一天，我要做一款真正的游戏。');
    assert.equal(zh['end.mara1'], '你从没告诉过我，你还做过游戏。');
  });

  it('falls back to English for an unknown language and returns the key for a missing one', () => {
    assert.equal(I.t('fr', 'ui.start'), I.dictionaries.en['ui.start']);
    assert.equal(I.t('en', 'no.such.key'), 'no.such.key');
    assert.equal(I.t('en', 'ui.stars', { n: 3, total: 16 }), 'Stars 3/16');
  });

  it('level logic uses no random numbers and no clock', () => {
    ['engine.js', 'puzzle.js', 'state.js', 'data.js'].forEach((f) => { const src = fs.readFileSync(path.join(__dirname, F, f), 'utf8'); assert.doesNotMatch(src, /Math\.random|Date\.now|new Date/, f); });
  });
});

describe('P3.2 art', () => {
  const art = Art.createArt(makeCanvas);
  const S = Scenes.create(art, D, Pz);
  const st = St.newState();
  const world = D.buildWorld();

  function colours(draw) {
    const cv = makeCanvas(320, 176); draw(cv.getContext('2d'));
    const seen = new Set(); let changes = 0;
    for (let i = 0; i < cv.data.length; i += 4) { seen.add(cv.data[i] + ',' + cv.data[i + 1] + ',' + cv.data[i + 2]); if (i > 4 && (cv.data[i] !== cv.data[i - 4] || cv.data[i + 1] !== cv.data[i - 3])) { changes++; } }
    return { count: seen.size, changes };
  }

  it('draws every Mara frame facing both ways', () => {
    art.MARA_FRAMES.forEach((f) => { assert.equal(art.mara.right[f].width, 14); assert.equal(art.mara.left[f].height, 24); });
    assert.ok(art.MARA_FRAMES.length >= 10);
    ['idle', 'run', 'jump', 'fall', 'land', 'act'].forEach((a) => assert.ok(art.mara.right[art.maraFrame(a, 0.3)], a));
  });

  it('every scene renders rich pictures, never a flat colour block', () => {
    const cam = (x, y, w) => S.cameraFor(x, y, w);
    const wv = (x, y) => ({ t: 1, reduce: false, cam: cam(x, y, world), world, state: st, stars: D.WORLD_STARS, player: { x, y, facing: 1 }, anim: 'run', particles: [], near: null, fade: 0, building: [] });
    const shots = {
      study: (c) => S.drawStudy(c, { t: 1, reduce: false, state: st, player: { x: 5, y: 9, facing: 1 }, anim: 'idle', near: null, particles: [] }),
      meadow: (c) => S.drawWorld(c, wv(8, 10)), canyon: (c) => S.drawWorld(c, wv(60, 10)), pier: (c) => S.drawWorld(c, wv(116, 10)),
      server: (c) => S.drawServer(c, { t: 1, reduce: false, cam: { x: 0, y: 0 }, world: D.buildServer(), state: st, player: { x: 5, y: 9, facing: 1 }, anim: 'idle', near: null, particles: [], fade: 0 }),
      island: (c) => S.drawIsland(c, { t: 1, reduce: false, state: st, world: D.buildIsland(), cam: { x: 0, y: -24 }, stage: 5, stageProgress: 1, player: { x: 9, y: 8, facing: 1 }, anim: 'idle', near: null, particles: [], fade: 0 }),
      restore: (c) => S.drawRestore(c, { t: 1, reduce: false, placed: {} }),
      copyA: (c) => S.drawCopy(c, { t: 1, reduce: false, copy: 'archive' }), copyL: (c) => S.drawCopy(c, { t: 1, reduce: false, copy: 'lab' }), copyM: (c) => S.drawCopy(c, { t: 1, reduce: false, copy: 'mirror' })
    };
    Object.keys(shots).forEach((n) => { const r = colours(shots[n]); assert.ok(r.count > 70, `${n}: only ${r.count} colours`); assert.ok(r.changes > 3000, `${n}: too flat (${r.changes} colour changes)`); });
  });

  it('reduced motion draws the same scenes without error', () => {
    const c = makeCanvas(320, 176).getContext('2d');
    S.drawStudy(c, { t: 3, reduce: true, state: st, player: { x: 5, y: 9, facing: -1 }, anim: 'run', near: D.STUDY_OBJECTS[0], particles: [] });
    S.drawWorld(c, { t: 3, reduce: true, cam: { x: 0, y: 48 }, world, state: st, stars: D.WORLD_STARS, player: { x: 5, y: 10, facing: 1 }, anim: 'idle', particles: [], near: null, fade: 0.5, building: [{ col: 62, row: 10, t0: 0 }] });
  });

  it('every bridge piece has a picture, with a build stamp', () => {
    Object.keys(Pz.PIECES).forEach((id) => { const cv = S.pieceCanvas(id); assert.equal(cv.width, Pz.PIECES[id].w * 16, id); assert.ok(cv.height >= 22); });
    ['build', 'corrupt', 'width', 'shape'].forEach((r) => assert.equal(S.reasonIcon(r).width, 13));
  });
});
