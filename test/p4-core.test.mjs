// P4 core rules: walkable layout, the story from start to end, save parsing, strings, and scene building.
// Pure logic only. Whether the game is actually understandable and fun is a human question; real-browser
// behaviour is checked in e2e/p4.spec.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Lv from '../frontend/p4/js/levels.js';
import * as St from '../frontend/p4/js/story.js';
import { dictionaries, t } from '../frontend/p4/js/i18n.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SPAWNS = { study: Lv.SCENES.study.spawn, archive: Lv.SCENES.archive.spawn, town: Lv.SCENES.town.spawn };

// Walks a waypoint list with sliding collisions, like a player holding a direction. Returns the end position.
function walkRoute(scene, from, points, extra) {
  let p = { x: from.x, z: from.z };
  for (const [tx, tz] of points) {
    for (let i = 0; i < 4000 && Math.hypot(tx - p.x, tz - p.z) > 0.12; i++) {
      const d = Math.hypot(tx - p.x, tz - p.z); const step = Math.min(d, 0.04);
      p = Lv.move(scene, p.x, p.z, ((tx - p.x) / d) * step, ((tz - p.z) / d) * step, extra);
    }
  }
  return p;
}

describe('P4 layout', () => {
  it('every spawn is standable and every interaction point can be reached on foot', () => {
    for (const scene of Object.keys(Lv.SCENES)) {
      const sp = Lv.SCENES[scene].spawn;
      assert.ok(Lv.canStand(scene, sp.x, sp.z), scene + ' spawn');
    }
    for (const [scene, routes] of Object.entries(Lv.ROUTES)) {
      for (const [id, pts] of Object.entries(routes)) {
        const end = walkRoute(scene, Lv.SCENES[scene].spawn, pts);
        const last = pts[pts.length - 1];
        assert.ok(Math.hypot(end.x - last[0], end.z - last[1]) < 0.3, `${scene}.${id}: stopped at ${end.x.toFixed(2)},${end.z.toFixed(2)}`);
        const pt = Lv.point(scene, id);
        if (pt) { assert.ok(Math.hypot(pt.x - end.x, pt.z - end.z) <= pt.r, `${scene}.${id}: route ends out of reach (${Math.hypot(pt.x - end.x, pt.z - end.z).toFixed(2)} > ${pt.r})`); }
      }
    }
  });

  it('every interaction point has at least one standable spot within reach', () => {
    for (const [scene, list] of Object.entries(Lv.INTERACT)) {
      for (const o of list) {
        let ok = false;
        for (let a = 0; a < 32 && !ok; a++) { for (let r = 0.3; r <= o.r && !ok; r += 0.1) { ok = Lv.canStand(scene, o.x + Math.cos(a / 32 * Math.PI * 2) * r, o.z + Math.sin(a / 32 * Math.PI * 2) * r); } }
        assert.ok(ok, `${scene}.${o.id} unreachable`);
      }
    }
  });

  it('walls and obstacles stop the player; sliding keeps movement along walls', () => {
    const p = Lv.move('study', 0, 0, 0, -10);
    assert.ok(p.z > -3.15 && p.z < -2.7, `stopped at the back wall z=${p.z}`);
    const s = Lv.move('study', 0, -2.75, 3, -0.3);
    assert.ok(s.x > 0.5, 'slides along the wall');
    assert.equal(Lv.canStand('town', 0, 0), false, 'fountain blocks');
    assert.equal(Lv.canStand('archive', 5, -5), false, 'the void is not floor');
  });

  it('the archive path forms one connected walk from the landing to the gate', () => {
    const end = walkRoute('archive', SPAWNS.archive, [[0, -6], [0, -12.5], [-3, -20], [0, -31], [0, -40.5], [0, -43]]);
    assert.ok(end.z < -42.5, `reached z=${end.z}`);
  });

  it('the town lets the player walk from the arrival lane to the lighthouse point and onto the pier', () => {
    const lh = walkRoute('town', SPAWNS.town, Lv.ROUTES.town.lighthouse.map((p) => p));
    assert.ok(Math.hypot(lh.x - 16.0, lh.z - 16.6) < 0.3);
    assert.equal(Lv.nearest('town', lh.x, lh.z).id, 'lighthouse', 'at the lighthouse spot the lighthouse wins over Theo');
    const th = walkRoute('town', SPAWNS.town, Lv.ROUTES.town.theo);
    assert.equal(Lv.nearest('town', th.x, th.z).id, 'theo');
    const pier = walkRoute('town', SPAWNS.town, [[0, -6.5], [3.4, -1.5], [3.2, 4.2], [1.6, 9], [1.6, 12.6], [0, 13], [0, 24.4]]);
    assert.ok(pier.z > 24, `pier z=${pier.z}`);
  });
});

describe('P4 town walking graph', () => {
  it('every edge is a clear walk, every goal is reachable from every node, and goals are in reach of their point', () => {
    const G = Lv.PATHS.town;
    for (const [a, b] of G.edges) {
      const end = walkRoute('town', { x: G.nodes[a][0], z: G.nodes[a][1] }, [G.nodes[b]]);
      assert.ok(Math.hypot(end.x - G.nodes[b][0], end.z - G.nodes[b][1]) < 0.2, `edge ${a}-${b} blocked at ${end.x.toFixed(2)},${end.z.toFixed(2)}`);
    }
    for (const n of Object.keys(G.nodes)) { assert.ok(Lv.canStand('town', ...G.nodes[n]), 'node ' + n); }
    for (const [id, goal] of Object.entries(Lv.GOALS.town)) {
      for (const n of Object.keys(G.nodes)) {
        const path = Lv.plan('town', G.nodes[n][0], G.nodes[n][1], goal);
        assert.ok(path, `${n} -> ${goal}`);
        const end = walkRoute('town', { x: G.nodes[n][0], z: G.nodes[n][1] }, path);
        assert.ok(Math.hypot(end.x - G.nodes[goal][0], end.z - G.nodes[goal][1]) < 0.25, `${n} -> ${goal} ended at ${end.x.toFixed(2)},${end.z.toFixed(2)}`);
      }
      const pt = Lv.point('town', id);
      if (pt) { const nn = Lv.nearest('town', G.nodes[goal][0], G.nodes[goal][1]); assert.equal(nn && nn.id, id, `${goal} node selects ${id}`); }
    }
  });
});

describe('P4 story', () => {
  function play(state, ids) { let s = state; const all = []; for (const id of ids) { const r = St.interact(s, id); s = r.state; all.push(...r.events); } return { s, all }; }
  const types = (ev) => ev.map((e) => e.type);

  it('the first item looked at wakes the computer and makes the goal explicit', () => {
    const s0 = St.newState(SPAWNS);
    assert.equal(St.objective(s0).key, 'obj.A1');
    assert.equal(St.target(s0), 'keepbox');
    const { s, all } = play(s0, ['keepbox']);
    assert.deepEqual(types(all), ['say', 'sfx', 'crtWake', 'objective']);
    assert.equal(s.step, 'A2'); assert.equal(St.target(s), 'computer');
  });

  it('the computer does nothing before it wakes, then opens the archive', () => {
    const s0 = St.newState(SPAWNS);
    assert.equal(St.interact(s0, 'computer').events[0].key, 'say.computerOff');
    const { s, all } = play(s0, ['photo', 'computer']);
    assert.ok(all.some((e) => e.type === 'scene' && e.to === 'archive'));
    assert.equal(s.step, 'B1');
  });

  it('the gate stays shut until skylark is found; other posts are clues, not keys', () => {
    let s = St.enterScene(play(St.newState(SPAWNS), ['photo', 'computer']).s, 'archive');
    assert.equal(St.available(s, 'archive', 'gate'), false);
    s = play(s, ['pete', 'owl', 'june', 'mirrorbot', 'notice']).s;
    assert.equal(s.flags.account, false); assert.equal(s.step, 'B1');
    const r = play(s, ['sky']);
    assert.ok(r.all.some((e) => e.type === 'gateOpen'));
    assert.equal(r.s.step, 'B2'); assert.equal(St.available(r.s, 'archive', 'gate'), true);
  });

  function toTown() {
    let s = St.enterScene(play(St.newState(SPAWNS), ['keepbox', 'computer']).s, 'archive');
    s = play(s, ['sky', 'gate']).s;
    return St.enterScene(s, 'town');
  }

  it('Theo explains the problem, and the copies must both be seen before restoring', () => {
    let s = toTown();
    assert.equal(s.step, 'C1'); assert.equal(St.target(s), 'theo');
    s = play(s, ['theo']).s; assert.equal(s.step, 'C2');
    assert.equal(St.objective(s).vars.n, 0);
    let r = play(s, ['booth98']); s = r.s;
    assert.equal(s.view, '98'); assert.equal(St.objective(s).vars.n, 1);
    r = play(s, ['lighthouse']); assert.equal(r.all[0].key, 'say.lhNeedCopies'); assert.equal(r.s.flags.restored, false);
    s = play(s, ['booth04']).s; assert.equal(s.view, '04'); assert.equal(s.step, 'C3');
  });

  it('the newer copy cannot restore the lamp; the 1998 copy can, and that changes the world', () => {
    let s = play(toTown(), ['theo', 'booth98', 'booth04']).s;
    let r = play(s, ['lighthouse']); assert.equal(r.all[0].key, 'say.lh04'); assert.equal(r.s.flags.restored, false);
    s = play(s, ['booth04']).s; assert.equal(s.view, null);
    assert.equal(play(s, ['lighthouse']).all[0].key, 'say.lhPresent');
    s = play(s, ['booth98']).s;
    assert.equal(St.target(s), 'lighthouse');
    assert.equal(St.verbFor(s, 'town', Lv.point('town', 'lighthouse')), 'verb.restore');
    r = play(s, ['lighthouse']);
    assert.ok(r.all.some((e) => e.type === 'restore')); assert.equal(r.s.flags.restored, true); assert.equal(r.s.view, null); assert.equal(r.s.step, 'C4');
  });

  it('Theo can only light the lamp after it is restored, then gives the lead to June and the ending', () => {
    let s = play(toTown(), ['theo', 'booth98', 'booth04', 'booth04', 'booth98', 'lighthouse']).s;
    let r = play(s, ['theo']); assert.ok(r.all.some((e) => e.type === 'theoLight'));
    s = St.lightDone(r.s).state; assert.equal(s.step, 'C5'); assert.equal(s.flags.lit, true);
    r = play(s, ['theo']);
    const lines = r.all.find((e) => e.type === 'dialog').lines.map((l) => l[1]);
    assert.ok(lines.includes('theo.9') && lines.includes('theo.11'));
    assert.ok(r.all.some((e) => e.type === 'ending')); assert.equal(r.s.step, 'END');
  });

  it('copies show different details: the bakery and mural change with the copy being viewed', () => {
    let s = play(toTown(), ['bakery', 'mural']); assert.deepEqual(s.all.map((e) => e.key), ['say.bakery', 'say.mural']);
    s = play(s.s, ['booth98', 'bakery', 'mural']); assert.deepEqual(s.all.filter((e) => e.type === 'say').map((e) => e.key).slice(1), ['say.bakery98', 'say.mural98']);
  });

  it('leaving a copy view from the HUD works anywhere', () => {
    const s = play(toTown(), ['booth98']).s;
    const r = St.leaveView(s); assert.equal(r.state.view, null); assert.deepEqual(r.events, [{ type: 'view', copy: null }]);
  });
});

describe('P4 save', () => {
  it('round-trips progress and drops the copy view', () => {
    const s = St.newState(SPAWNS); s.step = 'C3'; s.scene = 'town'; s.view = '98';
    Object.assign(s.flags, { crtOn: true, account: true, theoMet: true, copy98: true, copy04: true });
    s.pos.town = { x: 3, z: 4, yaw: 1 }; s.seen = ['photo', 'sky'];
    const back = St.parse(JSON.parse(JSON.stringify(St.serialize(s))), SPAWNS);
    assert.equal(back.step, 'C3'); assert.equal(back.scene, 'town'); assert.equal(back.view, null); assert.deepEqual(back.pos.town, { x: 3, z: 4, yaw: 1 });
  });
  it('a tampered save cannot skip the restoration or the ending', () => {
    const s = St.parse({ v: 1, scene: 'town', step: 'END', flags: { crtOn: true, account: true, theoMet: true, ended: true, lit: true }, pos: {} }, SPAWNS);
    assert.equal(s.flags.lit, false); assert.equal(s.flags.ended, false); assert.equal(s.step, 'C3');
    const s2 = St.parse({ v: 1, scene: 'town', step: 'C1', flags: {}, pos: {} }, SPAWNS);
    assert.equal(s2.scene, 'archive', 'no account: back to the archive'); assert.equal(s2.step, 'B1');
    const s3 = St.parse({ v: 1, scene: 'archive', step: 'B1', flags: {}, pos: {} }, SPAWNS);
    assert.equal(s3.flags.crtOn, true, 'being in the archive implies the computer woke');
    assert.equal(St.parse({ v: 9 }, SPAWNS), null); assert.equal(St.parse({ v: 1, scene: 'moon', step: 'A1' }, SPAWNS), null);
  });
  it('stores ids and numbers only, so switching language loses nothing', () => {
    const json = JSON.stringify(St.serialize(St.newState(SPAWNS)));
    assert.doesNotMatch(json, /[\u4e00-\u9fff]/);
    for (const v of Object.values(dictionaries.en)) { if (v.length > 6) { assert.equal(json.includes(v), false, v); } }
  });
  it('story logic has no randomness or clock', () => {
    ['story.js', 'levels.js'].forEach((f) => assert.doesNotMatch(fs.readFileSync(path.join(here, '../frontend/p4/js', f), 'utf8'), /Math\.random|Date\.now|new Date/));
  });
});

describe('P4 strings', () => {
  it('English and Chinese have the same keys and placeholders, none empty', () => {
    const en = dictionaries.en, zh = dictionaries.zh;
    assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
    for (const k of Object.keys(en)) {
      assert.ok(en[k].trim() && zh[k].trim(), k);
      assert.equal((en[k].match(/\{\w+\}/g) || []).sort().join(), (zh[k].match(/\{\w+\}/g) || []).sort().join(), k);
    }
  });
  it('every interaction point, objective and verb has text', () => {
    for (const list of Object.values(Lv.INTERACT)) { for (const o of list) { assert.ok(dictionaries.en['name.' + o.id], 'name.' + o.id); assert.ok(dictionaries.en[o.verb], o.verb); } }
    for (const step of St.STEPS) { assert.ok(dictionaries.en['obj.' + step], 'obj.' + step); }
    assert.equal(t('zh', 'obj.C2', { n: 1 }), '查看小镇的两个副本（1/2）。');
  });
});

describe('P4 scenes build without a browser', () => {
  it('study, archive and town build with a reasonable triangle budget', async () => {
    const { buildStudy } = await import('../frontend/p4/js/world-study.js');
    const { buildArchive } = await import('../frontend/p4/js/world-archive.js');
    const { buildTown } = await import('../frontend/p4/js/world-town.js');
    for (const [name, w, budget] of [['study', buildStudy({}), 60000], ['archive', buildArchive({ levels: Lv }), 60000], ['town', buildTown({}), 120000]]) {
      let tris = 0, meshes = 0;
      w.scene.traverse((o) => { if (o.isMesh) { meshes++; const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3; tris += o.isInstancedMesh ? n * o.count : n; } });
      assert.ok(tris < budget, `${name}: ${tris} triangles`);
      assert.ok(meshes > 100, `${name}: only ${meshes} meshes, too sparse`);
      w.update(0.016, 1, false, name === 'archive' ? { x: 0, z: 0 } : undefined);
    }
  });
  it('the town really changes between the present, the 1998 copy, the 2004 copy, and after restoring', async () => {
    const { buildTown } = await import('../frontend/p4/js/world-town.js');
    const w = buildTown({});
    const lh = w.anchors.lighthouse; const lampRoom = lh.children.find((c) => c.isGroup && c.children.length > 10 && c.position.y > 8);
    assert.equal(lampRoom.visible, false, 'present: no lamp');
    w.setView('98'); assert.equal(lampRoom.visible, true, '1998 copy: lamp'); const fog98 = w.scene.fog.color.getHex();
    w.setView('04'); assert.equal(lampRoom.visible, false, '2004 copy: no lamp'); assert.notEqual(w.scene.fog.color.getHex(), fog98);
    w.setView(null); w.setRestored(true, false); assert.equal(lampRoom.visible, true, 'restored: lamp');
  });
});
