// P5 core rules: USENET parsing, archive-driven restoration, the two builds, walkable layout and switching,
// the light trail, the quest state machine, saves, and strings. Pure logic plus scene construction in Node.
// Whether the slice is understandable and fun is a human question; real-browser behaviour is in e2e/p5.spec.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as U from '../frontend/p5/js/usenet.js';
import * as Ar from '../frontend/p5/js/archive.js';
import * as Lv from '../frontend/p5/js/levels.js';
import * as St from '../frontend/p5/js/story.js';
import { dictionaries, t } from '../frontend/p5/js/i18n.js';
import { buildTown } from '../frontend/p5/js/world-town.js';
import { buildStudy } from '../frontend/p5/js/world-study.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'frontend', 'p5', 'data');
const TEXTS = {}; for (const s of Ar.SOURCES) { TEXTS[s.id] = fs.readFileSync(path.join(dataDir, s.file), 'utf8'); }
const archive = Ar.createArchive(TEXTS);
const facts = (disk, build) => Ar.facts(archive, { disk }, build || '2004');
const ctxFor = (disk, build, bridgeLen) => ({ assets: Ar.buildAssets(archive.view({ disk }), build), bridgeLen: bridgeLen || 0 });
const BRIDGE_ID = '<junebug.19980814.2@inkwell.example>';

// Walks toward each point with sliding collisions, like a player holding one direction.
function walk(scene, from, points, ctx) {
  let p = { x: from.x, z: from.z };
  for (const [tx, tz] of points) {
    for (let i = 0; i < 5000 && Math.hypot(tx - p.x, tz - p.z) > 0.1; i++) {
      const d = Math.hypot(tx - p.x, tz - p.z), step = Math.min(d, 0.04);
      const np = Lv.move(scene, p.x, p.z, ((tx - p.x) / d) * step, ((tz - p.z) / d) * step, ctx);
      if (np.x === p.x && np.z === p.z) { break; }
      p = np;
    }
  }
  return p;
}

describe('P5 USENET parsing', () => {
  it('splits the rnews batches and the mbox export into the right number of articles', () => {
    assert.equal(U.splitSpool(TEXTS.mirror).length, 9);
    assert.equal(U.splitSpool(TEXTS.disk).length, 6);
    assert.equal(U.splitSpool(TEXTS.groups).length, 10);
    // every rnews byte count is exact: re-joining reproduces the file
    const parts = U.splitSpool(TEXTS.disk);
    assert.equal(parts.map((a) => `#! rnews ${a.length}\n${a}`).join(''), TEXTS.disk);
  });

  it('reads headers, folded References, Path and validates Message-ID', () => {
    const arts = U.splitSpool(TEXTS.disk).map((r) => U.parseArticle(r, 'disk'));
    const deal = arts.find((a) => a.messageId === '<ll-0012.skylark@summer98.example>');
    assert.deepEqual(deal.references, ['<ll-0001.skylark@summer98.example>', '<junebug.19980419.1@inkwell.example>']);
    assert.equal(deal.parent, '<junebug.19980419.1@inkwell.example>');
    assert.deepEqual(deal.path, ['summer98.example', 'not-for-mail']);
    assert.ok(deal.time > 0);
    const bad = U.parseArticle('From: x\nMessage-ID: not-an-id\nSubject: s\n\nbody\n', 't');
    assert.equal(bad.messageId, null); assert.equal(bad.problem, 'bad-message-id');
    const none = U.parseArticle('From: x\nSubject: s\n\nbody\n', 't');
    assert.equal(none.problem, 'no-message-id');
    const idx = U.buildIndex([{ id: 't', text: '#! rnews 38\nFrom: x\nMessage-ID: broken\nSubject: s\n\nb\n' }]);
    assert.equal(idx.messages.size, 0); assert.equal(idx.rejected.length, 1);
  });

  it('decodes the uuencoded bridge and checks it with CRC-32', () => {
    const idx = archive.view({ disk: true });
    const m = idx.messages.get(BRIDGE_ID);
    const disk = m.copies.find((c) => c.source === 'disk');
    const dec = U.uudecode(disk.body);
    assert.equal(dec.name, 'bridge.ll'); assert.equal(dec.complete, true);
    const entry = Ar.manifests(idx)['2004'].manifest.assets.find((a) => a.id === 'bridge');
    assert.equal(dec.bytes.length, entry.size);
    assert.equal(U.crc32(dec.bytes), entry.crc);
    assert.equal(U.crc32(Uint8Array.from([...'123456789'].map((c) => c.charCodeAt(0)))), 'cbf43926');   // the standard check value
    assert.ok(U.bytesToText(dec.bytes).startsWith('LLASSET 1 bridge'));
  });

  it('merges copies of one Message-ID from different sources and keeps each copy', () => {
    const idx = archive.view({ disk: true });
    const m = idx.messages.get(BRIDGE_ID);
    assert.deepEqual(m.copies.map((c) => c.source).sort(), ['disk', 'groups', 'mirror']);
    assert.equal(idx.messages.get('<ll-0001.skylark@summer98.example>').copies.length, 3);
    // a source that lists the same article twice still counts once
    const twice = U.buildIndex([{ id: 'a', text: TEXTS.disk + TEXTS.disk }]);
    assert.equal(twice.messages.get(BRIDGE_ID).copies.length, 1);
  });

  it('builds the reply graph and notices referenced messages that no source holds', () => {
    const pub = archive.view({ disk: false });
    assert.ok(pub.children.get('<ll-0001.skylark@summer98.example>').includes('<junebug.19980419.1@inkwell.example>'));
    // the summer build manifest was cancelled on both public servers: only References remember it
    assert.equal(pub.messages.has('<ll-0815.skylark@summer98.example>'), false);
    assert.ok(pub.missing.has('<ll-0815.skylark@summer98.example>'));
    assert.deepEqual(pub.cancelledIds, ['<ll-0815.skylark@summer98.example>']);
    const all = archive.view({ disk: true });
    assert.ok(all.messages.has('<ll-0815.skylark@summer98.example>'));
    assert.deepEqual(all.messages.get('<ll-0815.skylark@summer98.example>').copies.map((c) => c.source), ['disk']);
    assert.deepEqual(U.thread(all, BRIDGE_ID).map((x) => x.present), [true, true, true]);
  });

  it('applies a cancel only on the server that carried it', () => {
    const idx = archive.view({ disk: true });
    const m = idx.messages.get('<ll-0815.skylark@summer98.example>');
    assert.deepEqual(m.cancelledOn.sort(), ['groups', 'mirror']);
    assert.equal(idx.cancels.length, 2);
  });
});

describe('P5 restoration is driven by the archive data', () => {
  it('each copy of the bridge reports what is wrong with it', () => {
    const r = Ar.resolveAsset(archive.view({ disk: true }), '2004', 'bridge');
    const by = Object.fromEntries(r.copies.map((c) => [c.source, c.status]));
    assert.deepEqual(by, { mirror: 'truncated', groups: 'stripped', disk: 'ok' });
    assert.equal(r.use.source, 'disk');
  });

  it('without Mom\u2019s disk the bridge cannot be restored; adding it restores the ability; removing it takes it away again', () => {
    assert.equal(facts(false).bridgeOk, false);
    assert.equal(facts(true).bridgeOk, true);
    assert.equal(facts(false).bridgeOk, false);
    assert.equal(Ar.resolveAsset(archive.view({ disk: false }), '2004', 'bridge').status, 'damaged');
  });

  it('a cut-off copy yields only the planks that survived; the complete copy yields all of them', () => {
    const bad = Ar.resolveAsset(archive.view({ disk: false }), '2004', 'bridge');
    const part = Ar.parseBridge(bad.partial);
    const full = Ar.parseBridge(Ar.resolveAsset(archive.view({ disk: true }), '2004', 'bridge').data);
    assert.equal(full.complete, true); assert.equal(full.planks.length, 15); assert.equal(full.by, 'junebug');
    assert.equal(part.complete, false); assert.ok(part.planks.length > 0 && part.planks.length < full.planks.length);
    assert.ok(full.planks[full.planks.length - 1].z + full.planks[full.planks.length - 1].d <= Lv.BRIDGE.span + 1e-6);
  });

  it('a single altered byte in the good copy makes the restore impossible', () => {
    const lines = TEXTS.disk.split('\n');
    const i = lines.findIndex((l) => l.startsWith('begin 644 bridge.ll')) + 3;
    const ch = lines[i][10]; lines[i] = lines[i].slice(0, 10) + (ch === 'A' ? 'B' : 'A') + lines[i].slice(11);
    const tampered = Ar.createArchive(Object.assign({}, TEXTS, { disk: lines.join('\n') }));
    // the rnews byte counts still match because the length did not change
    const r = Ar.resolveAsset(tampered.view({ disk: true }), '2004', 'bridge');
    assert.equal(r.copies.find((c) => c.source === 'disk').status, 'corrupt');
    assert.equal(r.status, 'damaged');
  });

  it('the summer build exists only with the disk; the public build is always there', () => {
    assert.deepEqual(Object.keys(Ar.manifests(archive.view({ disk: false }))), ['2004']);
    assert.deepEqual(Object.keys(Ar.manifests(archive.view({ disk: true }))).sort(), ['1998', '2004']);
    const m98 = Ar.manifests(archive.view({ disk: true }))['1998'].manifest, m04 = Ar.manifests(archive.view({ disk: true }))['2004'].manifest;
    assert.deepEqual(m98.credits.map((c) => c.who), ['skylark', 'junebug']);
    assert.deepEqual(m04.credits.map((c) => c.who), ['skylark']);
  });

  it('the summer build waits for a lighthouse rule that survives only as an envelope', () => {
    const w = Ar.resolveWanted(archive.view({ disk: true }), '1998', 'lighthouse_rule');
    assert.equal(w.status, 'envelope'); assert.equal(w.entry.trigger, 'pier_end');
    assert.equal(w.article.from, 'junebug <june@inkwell.example>');
    assert.ok(w.article.date.includes('2005'));
    assert.deepEqual(w.sources, ['groups']);
  });

  it('every asset the town shows comes from a manifest, and every manifest asset is represented', () => {
    const w = buildTown({});
    const all = new Set([...Ar.buildAssets(archive.view({ disk: true }), '1998'), ...Ar.buildAssets(archive.view({ disk: true }), '2004')]);
    const shapes = new Set(['town', 'plaza', 'bridge', 'lighthouse_rule', 'bakery_sign_1998', 'bakery_sign_2004', 'mural_1998', 'mural_2004', 'notice_1998', 'notice_2004']);   // drawn by setBuild, built from data, or a rule
    for (const id of w.assetTags) { assert.ok(all.has(id), `world tag ${id} is in a manifest`); }
    for (const id of all) { assert.ok(w.assetTags.includes(id) || shapes.has(id), `manifest asset ${id} is shown`); }
    for (const sc of Object.values(Lv.SCENES)) { for (const s of sc.walk.concat(sc.block)) { if (s.asset) { assert.ok(all.has(s.asset), `level shape asset ${s.asset} is in a manifest`); } } }
  });
});

describe('P5 layout, bridge collision and build switching', () => {
  it('every spawn is standable and every interaction point can be reached where it exists', () => {
    assert.ok(Lv.canStand('study', Lv.SCENES.study.spawn.x, Lv.SCENES.study.spawn.z, null));
    for (const p of Lv.INTERACT.study) { assert.ok(Lv.findPath('study', Lv.SCENES.study.spawn, p, null, { reach: p.r - 0.2 }), `study ${p.id}`); }
    for (const build of ['1998', '2004']) {
      const ctx = ctxFor(true, build, Lv.BRIDGE.span);
      assert.ok(Lv.canStand('town', Lv.SCENES.town.spawn.x, Lv.SCENES.town.spawn.z, ctx));
      for (const p of Lv.INTERACT.town) {
        if (p.asset && !ctx.assets.has(p.asset)) { continue; }
        const path = Lv.findPath('town', Lv.SCENES.town.spawn, p, ctx, { reach: p.r - 0.15 });
        assert.ok(path, `${build} ${p.id} reachable`);
        const end = path[path.length - 1]; assert.ok(Math.hypot(end[0] - p.x, end[1] - p.z) <= p.r, `${build} ${p.id} within reach`);
      }
    }
  });

  it('the canal cannot be crossed without the bridge; a half bridge ends over the water; the full bridge crosses', () => {
    const ctx0 = ctxFor(false, '2004', 0);
    const end0 = walk('town', { x: 0, z: 7.5 }, [[0, 13]], ctx0);
    assert.ok(end0.z < Lv.CANAL.z0, 'stopped at the near bank');
    const half = walk('town', { x: 0, z: 7.5 }, [[0, 13]], ctxFor(true, '2004', 1.6));
    assert.ok(half.z > Lv.CANAL.z0 + 0.8 && half.z < Lv.CANAL.z0 + 1.6, `stopped at the end of the built part (${half.z})`);
    const full = walk('town', { x: 0, z: 7.5 }, [[0, 13]], ctxFor(true, '2004', Lv.BRIDGE.span));
    assert.ok(full.z > 12.9, 'crossed');
    // and nowhere else along the canal
    for (let x = -11; x <= 12; x += 1) { if (Math.abs(x) < 1.5) { continue; } assert.equal(Lv.canStand('town', x, (Lv.CANAL.z0 + Lv.CANAL.z1) / 2, ctxFor(true, '2004', Lv.BRIDGE.span)), false, `canal at x=${x}`); }
  });

  it('the old pier is walkable only in 1998, the lighthouse point only in 2004', () => {
    const c98 = ctxFor(true, '1998', Lv.BRIDGE.span), c04 = ctxFor(true, '2004', Lv.BRIDGE.span);
    assert.ok(walk('town', { x: 0, z: 13 }, [[0, 24.3]], c98).z > 24);
    assert.ok(walk('town', { x: 0, z: 13 }, [[0, 24.3]], c04).z < 14.7);
    assert.ok(Lv.findPath('town', { x: 0, z: 13 }, { x: 15.6, z: 18.1 }, c04, { reach: 1.7 }));
    const p98 = Lv.findPath('town', { x: 0, z: 13 }, { x: 15.6, z: 18.1 }, c98, { reach: 1.7 });
    assert.equal(p98, null);
  });

  it('after a switch nobody is left inside a wall or over water, from anywhere', () => {
    let moved = 0;
    for (const [from, to] of [['1998', '2004'], ['2004', '1998']]) {
      const a = ctxFor(true, from, Lv.BRIDGE.span), b = ctxFor(true, to, Lv.BRIDGE.span);
      for (let x = -12; x <= 20; x += 0.5) {
        for (let z = -15; z <= 25; z += 0.5) {
          if (!Lv.canStand('town', x, z, a)) { continue; }
          const s = Lv.safeSpot('town', x, z, b);
          assert.ok(Lv.canStand('town', s.x, s.z, b), `${from}->${to} at ${x},${z}`);
          if (s.moved) { moved += 1; assert.ok(Math.hypot(s.x - x, s.z - z) < 12, `moved a short way from ${x},${z}`); }
        }
      }
    }
    assert.ok(moved > 20, 'the pier and the point really do change');
  });

  it('the light trail for every objective follows walkable floor in the current build', () => {
    const cases = [
      ['study', null, { x: 0.2, z: 0.9 }, ['computer', 'photo', 'keepbox', 'postcard']],
      ['town', ctxFor(false, '2004', 0), { x: 0, z: -9.2 }, ['gap']],
      ['town', ctxFor(true, '2004', Lv.BRIDGE.span), { x: 0, z: 7.4 }, ['pierGate', 'lighthouse']],
      ['town', ctxFor(true, '1998', Lv.BRIDGE.span), { x: 0, z: 13.2 }, ['pierEnd', 'notice']],
      ['town', ctxFor(true, '1998', Lv.BRIDGE.span), { x: 6, z: -4 }, ['pierEnd']]
    ];
    for (const [scene, ctx, from, ids] of cases) {
      for (const id of ids) {
        const p = Lv.point(scene, id);
        const path = Lv.findPath(scene, from, p, ctx, { reach: 2.4 });
        assert.ok(path && path.length >= 2, `${scene} ${id} path`);
        for (let i = 1; i < path.length; i++) {
          assert.ok(Lv.clearLine(scene, path[i - 1][0], path[i - 1][1], path[i][0], path[i][1], ctx, null, Lv.PLAYER_RADIUS - 0.02), `${scene} ${id} segment ${i} stays on the floor`);
        }
      }
    }
    // before the bridge the trail never offers a way across the water
    assert.equal(Lv.findPath('town', { x: 0, z: -9.2 }, { x: 0, z: 13 }, ctxFor(false, '2004', 0), { reach: 0.5 }), null);
  });
});

describe('P5 quest state machine', () => {
  function play(s, id, f) { return St.interact(s, id, f).state; }
  it('runs the whole slice in order with one objective at a time', () => {
    let s = St.newState(); const seen = [];
    const note = (f) => { const k = St.step(s, f); if (seen[seen.length - 1] !== k) { seen.push(k); } };
    let f = facts(false); note(f);
    s = play(s, 'photo', f); note(f);
    s = play(s, 'computer', f); note(f);
    assert.equal(St.step(s, f), 'A2');
    s = play(s, 'keepbox', f); note(f);
    assert.equal(s.flags.deduced, true);
    let r = St.interact(s, 'computer', f); s = r.state;
    assert.ok(r.events.some((e) => e.type === 'enterTown'));
    s = St.enterScene(s, 'town'); s = St.arrive(s, f).state; note(f);
    s = play(s, 'theo', f); note(f);
    r = St.interact(s, 'gap', f); s = r.state; note(f);
    assert.ok(r.events.some((e) => e.type === 'reader' && e.topic === 'bridge'));
    assert.equal(St.step(s, f), 'B3');
    assert.equal(St.buildTick(s, 0.5, f).refused, true, 'no building from damaged copies');
    const f1 = facts(true);
    r = St.setDisk(s, true, f, f1); s = r.state; f = f1; note(f);
    assert.equal(St.step(s, f), 'B4');
    assert.equal(St.isHold(s, 'gap', f), true);
    for (let i = 0; i < 10 && s.bridge < 1; i++) { r = St.buildTick(s, 0.13, f, { messageId: BRIDGE_ID, source: 'disk', crc: '118ca1f9' }); s = r.state; }
    assert.equal(s.bridge, 1); assert.equal(s.bridgeFrom.source, 'disk'); note(f);
    assert.equal(St.step(s, f), 'B5');
    assert.equal(St.switchBuild(s, f).ok, false, 'switch locked until Theo explains');
    r = St.interact(s, 'theo', f); s = r.state; note(f);
    assert.ok(r.events.some((e) => e.type === 'unlockSwitch'));
    assert.equal(St.step(s, f), 'C1');
    assert.equal(St.onPier(s, f).events.length, 0, 'no pier in 2004');
    r = St.switchBuild(s, facts(true, '2004')); s = r.state; f = facts(true, '1998');
    assert.equal(s.build, '1998');
    s = St.onPier(s, f).state; note(f);
    assert.equal(St.step(s, f), 'C2');
    r = St.atPierEnd(s, f); s = r.state; note(f);
    assert.ok(r.events.some((e) => e.type === 'anomaly')); assert.ok(r.events.some((e) => e.type === 'ending'));
    assert.deepEqual(seen, ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'END']);
    // the switch stays free and repeatable
    for (let i = 0; i < 6; i++) { const rr = St.switchBuild(s, facts(true, s.build)); assert.equal(rr.ok, true); s = rr.state; }
  });

  it('removing the disk before the bridge is built sends the objective back, and adding it brings it forward', () => {
    let s = St.newState(); s.scene = 'town'; Object.assign(s.flags, { computer: true, deduced: true, opened: true, theoMet: true, gapSeen: true });
    s = St.setDisk(s, true, facts(false), facts(true)).state; assert.equal(St.step(s, facts(true)), 'B4');
    s = St.buildTick(s, 0.4, facts(true), { messageId: BRIDGE_ID, source: 'disk', crc: '118ca1f9' }).state;
    const r = St.setDisk(s, false, facts(true), facts(false)); s = r.state;
    assert.equal(St.step(s, facts(false)), 'B3'); assert.ok(r.events.some((e) => e.type === 'objective' && e.to === 'B3'));
    assert.equal(St.buildTick(s, 0.4, facts(false)).refused, true);
    assert.equal(s.bridge, 0.4, 'planks already built stay');
    s = St.setDisk(s, true, facts(false), facts(true)).state; assert.equal(St.step(s, facts(true)), 'B4');
  });

  it('cannot switch to 1998 without the disk, and says why', () => {
    let s = St.newState(); s.scene = 'town'; Object.assign(s.flags, { computer: true, deduced: true, opened: true, theoMet: true, gapSeen: true, theoCrossed: true, theoTalked: true, switchUnlocked: true }); s.bridge = 1;
    const r = St.switchBuild(s, facts(false));
    assert.equal(r.ok, false); assert.ok(r.events.some((e) => e.key === 'say.no1998'));
  });

  it('a second visit to Theo never loops the meeting; seen dialogues have ids', () => {
    let s = St.newState(); s.scene = 'town'; Object.assign(s.flags, { computer: true, deduced: true, opened: true });
    const a = St.interact(s, 'theo', facts(false)); s = a.state;
    assert.equal(a.events.find((e) => e.type === 'dialog').id, 'theoMeet');
    const b = St.interact(s, 'theo', facts(false));
    assert.equal(b.events.some((e) => e.type === 'dialog'), false);
  });

  it('hints have three levels after the light line and stop at the third', () => {
    let s = St.newState(); const f = facts(false);
    assert.equal(St.hintKey(s, f), 'hint.A1.0');
    for (let i = 1; i <= 5; i++) { s = St.nextHint(s, f); }
    assert.equal(St.hintKey(s, f), 'hint.A1.3');
    s = St.interact(s, 'computer', f).state;
    assert.equal(St.hintKey(s, f), 'hint.A2.0', 'a new objective starts with the light line again');
  });

  it('the light trail points at a place to investigate, never the answer', () => {
    let s = St.newState(); s.scene = 'town'; Object.assign(s.flags, { computer: true, deduced: true, opened: true, theoMet: true, gapSeen: true });
    assert.deepEqual(St.navTarget(s, facts(false)).ids, ['gap']);         // not "the disk"
    Object.assign(s.flags, { theoCrossed: true, theoTalked: true, switchUnlocked: true }); s.bridge = 1;
    assert.deepEqual(St.navTarget(s, facts(true)).ids, ['pierGate']);     // not "press V"
  });

  it('saves round-trip, and an edited save can never skip the bridge', () => {
    const ok = (p) => p.messageId === BRIDGE_ID && p.crc === '118ca1f9';
    let s = St.newState(); s.scene = 'town'; Object.assign(s.flags, { computer: true, deduced: true, opened: true, theoMet: true, gapSeen: true, theoCrossed: true, theoTalked: true, switchUnlocked: true, switched: true, pierReached: true }); s.bridge = 1; s.bridgeFrom = { messageId: BRIDGE_ID, source: 'disk', crc: '118ca1f9' }; s.build = '1998'; s.clues = ['photo', 'keepbox'];
    const back = St.parse(JSON.parse(JSON.stringify(St.serialize(s))), ok);
    assert.deepEqual(back.flags, s.flags); assert.equal(back.build, '1998'); assert.equal(back.bridge, 1);
    // bridge claimed without a real provenance: back to the gap, and nothing after it survives
    const forged = St.parse(Object.assign({}, St.serialize(s), { bridgeFrom: { messageId: '<fake@x>', source: 'disk', crc: '00000000' } }), ok);
    assert.equal(forged.bridge, 0); assert.equal(forged.flags.theoTalked, false); assert.equal(forged.flags.pierReached, false); assert.equal(forged.build, '2004');
    assert.equal(St.step(forged, facts(false)), 'B3');
    // town without having opened the game: back to the study
    const early = St.parse({ v: 1, scene: 'town', flags: { anomaly: true, ended: true }, bridge: 1 }, ok);
    assert.equal(early.scene, 'study'); assert.equal(early.flags.anomaly, false); assert.equal(early.bridge, 0);
    assert.equal(St.parse({ v: 2 }), null); assert.equal(St.parse('nonsense'), null);
    const junk = St.parse({ v: 1, clues: ['photo', 'photo', 'x'], pos: { town: { x: 'a' } }, bridge: 9, hint: { step: 'B3', level: 99 } }, ok);
    assert.deepEqual(junk.clues, ['photo']); assert.equal(junk.pos.town, undefined); assert.equal(junk.bridge, 0); assert.equal(junk.hint.level, 3);
  });
});

describe('P5 strings and scenes', () => {
  it('English and Chinese have the same keys and no empty strings', () => {
    const en = Object.keys(dictionaries.en).sort(), zh = Object.keys(dictionaries.zh).sort();
    assert.deepEqual(zh, en);
    for (const l of ['en', 'zh']) { for (const k of en) { assert.ok(dictionaries[l][k].trim().length > 0, `${l} ${k}`); } }
    for (const k of en) { const v = (x) => (x.match(/\{\w+\}/g) || []).sort().join(); assert.equal(v(dictionaries.zh[k]), v(dictionaries.en[k]), `placeholders in ${k}`); }
  });

  it('every text key the code uses exists, including every hint level and objective', () => {
    const src = ['story.js', 'main.js'].map((f) => fs.readFileSync(path.join(here, '..', 'frontend', 'p5', 'js', f), 'utf8')).join('\n');
    const used = new Set((src.match(/'((?:say|theo|mara|scr|obj|hint|tip|ui|rd|verb|chap|tut|name|sp)\.[A-Za-z0-9.]+)'/g) || []).map((x) => x.slice(1, -1)));
    for (const k of used) { if (/\.$/.test(k)) { continue; } assert.ok(k in dictionaries.en, `missing ${k}`); }
    for (const s of St.STEPS) { assert.ok(`obj.${s}` in dictionaries.en); for (let l = 0; l <= St.HINT_LEVELS; l++) { assert.ok(`hint.${s}.${l}` in dictionaries.en, `hint.${s}.${l}`); } }
    for (const sc of ['study', 'town']) { for (const p of Lv.INTERACT[sc]) { assert.ok(`name.${p.id}` in dictionaries.en, `name.${p.id}`); } }
    for (const id of ['notice', 'bakery', 'mural']) { for (const b of ['98', '04']) { assert.ok(`say.${id}.${b}` in dictionaries.en); } }
    for (const st of ['ok', 'truncated', 'stripped', 'corrupt']) { assert.ok(`rd.status.${st}` in dictionaries.en); }
    assert.equal(t('zh', 'ui.build', { b: '1998' }), '1998 \u7248');
  });

  it('both scenes build without a browser and the town shows exactly each build\u2019s assets', () => {
    const s = buildStudy({}); s.setCrt(true); s.update(0.016, 1, false);
    const w = buildTown({});
    for (const b of ['1998', '2004']) {
      const assets = Ar.buildAssets(archive.view({ disk: true }), b);
      w.setBuild(b, assets);
      w.setBridgeData(Ar.parseBridge(Ar.resolveAsset(archive.view({ disk: true }), b, 'bridge').data));
      assert.equal(w.setBridgeProgress(1, 0, false), 15);
      assert.ok(Math.abs(w.builtLength() - Lv.BRIDGE.span) < 1e-6);
      for (let i = 0; i < 20; i++) { w.update(0.05, i * 0.05, false); }
    }
    w.setBridgeProgress(0.4, 0, false);
    assert.ok(w.builtLength() > 1 && w.builtLength() < 1.6);
  });
});
