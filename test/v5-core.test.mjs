// Resurrection V5 core: USENET parsing, the archive -> scene pipeline, physics, the chapter toys, the whole game
// played headlessly from the study to the credits, saves, and text. Automated checks of logic only: they do not show
// that the game is fun or that it renders in a browser (see e2e/v5.spec.js and docs/V5-TEST-REPORT.md).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as U from '../frontend/v5/core/usenet.js';
import * as Ar from '../frontend/v5/core/archive.js';
import * as Ph from '../frontend/v5/core/physics.js';
import * as Toys from '../frontend/v5/core/toys.js';
import * as Gm from '../frontend/v5/core/game.js';
import { LAYOUTS, bridgeFloors, BRIDGE, CANAL } from '../frontend/v5/core/layout.js';
import { dictionaries, t } from '../frontend/v5/core/i18n.js';
import { playThrough, makeBot } from './v5-bot.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, '..', 'frontend', 'v5', 'data');
const read = (f) => fs.readFileSync(path.join(DATA, f), 'utf8');
function texts(over) { const t0 = {}; for (const s of Ar.SOURCES) { t0[s.id] = read(s.file); } t0.edition = read('edition-present.txt'); t0.drafts = read('drafts-unsent.txt'); return Object.assign(t0, over || {}); }
const AR = Ar.createArchive(texts());
const BRIDGE_ID = '<junebug.19980814.2@inkwell.example>';

describe('V5 USENET parsing', () => {
  it('checksums match the standard test vectors', () => {
    assert.equal(U.sha256(U.bytes('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(U.sha256(U.bytes('')), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(U.crc32(U.bytes('123456789')), 'cbf43926');
    assert.deepEqual([...U.base64('aGVsbG8=')], [...U.bytes('hello')]); assert.equal(U.base64('a$b'), null);
  });
  it('splits rnews batches and the mbox export exactly', () => {
    assert.equal(U.splitSpool(read('skylark-backup.spool')).length, 9);
    assert.equal(U.splitSpool(read('mirror.oldnet.example.spool')).length, 11);
    assert.equal(U.splitSpool(read('groups.archive.example.mbox')).length, 9);
    const parts = U.splitSpool(read('skylark-backup.spool'));
    assert.equal(parts.map((a) => `#! rnews ${a.length}\n${a}`).join(''), read('skylark-backup.spool'));
  });
  it('reads folded headers, References, Path and rejects bad Message-IDs', () => {
    const a = U.parseArticle(U.splitSpool(read('skylark-backup.spool')).find((x) => x.includes('<ll-0730')), 'disk');
    assert.deepEqual(a.references, ['<ll-0001.skylark@summer98.example>', '<junebug.19980721.1@inkwell.example>']);
    assert.equal(a.parent, '<junebug.19980721.1@inkwell.example>'); assert.match(a.fixture, /fictional/);
    assert.equal(U.parseArticle('From: x\nMessage-ID: nope\n\nb\n', 't').problem, 'bad-message-id');
  });
  it('decodes the 2004 MIME post: multipart, base64 part, filename, media type', () => {
    const idx = AR.all(); const pub = idx.messages.get('<lastlight-1.0.evance@oldnet.example>');
    const att = U.attachments(pub.copies[0]);
    assert.equal(att.length, 1); assert.equal(att[0].name, 'iris-2004.npc'); assert.equal(att[0].mediaType, 'application/x-lastlight'); assert.equal(att[0].encoding, 'base64'); assert.equal(att[0].complete, true);
    assert.ok(U.text(att[0].bytes).includes('loop'));
  });
  it('rejects unsafe attachments: wrong type, unsafe name, broken base64', () => {
    const mk = (type, name, data) => U.parseArticle(`From: x\nMessage-ID: <a@b.example>\nContent-Type: multipart/mixed; boundary="B"\n\n--B\nContent-Type: text/plain\n\nhi\n--B\nContent-Type: ${type}\nContent-Transfer-Encoding: base64\nContent-Disposition: attachment; filename="${name}"\n\n${data}\n--B--\n`, 't');
    assert.equal(U.attachments(mk('application/x-msdownload', 'run.exe', 'aGk='))[0].problem, 'type-not-allowed');
    assert.equal(U.attachments(mk('application/x-lastlight', '../../etc', 'aGk='))[0].problem, 'unsafe-name');
    assert.equal(U.attachments(mk('application/x-lastlight', 'ok.ll', 'a$$'))[0].problem, 'bad-encoding');
    const r = U.checkCopy(mk('application/x-msdownload', 'run.exe', 'aGk='), { file: 'run.exe', size: 2, crc: U.crc32(U.bytes('hi')) });
    assert.equal(r.status, 'rejected');
  });
  it('keeps divergent copies of one Message-ID side by side and reports them', () => {
    const idx = AR.all(); const hello = idx.messages.get('<ll-0001.skylark@summer98.example>');
    assert.equal(hello.copies.length, 3); assert.equal(hello.conflict, true);
    assert.ok(idx.conflicts.some((c) => c.id === '<ll-0001.skylark@summer98.example>'));
    assert.ok(idx.conflicts.some((c) => c.id === BRIDGE_ID && c.variants === 3));
  });
  it('applies a cancel only on the servers that carried it', () => {
    const idx = AR.all(); const m = idx.messages.get('<ll-0815.skylark@summer98.example>');
    assert.deepEqual(m.copies.map((c) => c.source), ['disk']); assert.deepEqual(m.cancelledOn.sort(), ['groups', 'mirror']);
    assert.equal(AR.publicView().messages.has('<ll-0815.skylark@summer98.example>'), false);
  });
  it('every article in the fixture is labelled fictional', () => { assert.equal(Ar.fixtureLabelled(AR), true); });
});

describe('V5 archive -> scene pipeline', () => {
  it('builds both eras from their manifests, with different objects and credits', () => {
    const a = Ar.sceneGraph(AR, 1998), b = Ar.sceneGraph(AR, 2004);
    assert.equal(a.build, 'summer-0.9'); assert.equal(b.build, 'public-1.0');
    assert.ok(a.assets.has('pier_old') && !b.assets.has('pier_old')); assert.ok(b.assets.has('pier_closed') && !a.assets.has('pier_closed'));
    assert.deepEqual(a.credits.map((c) => c.who), ['skylark', 'junebug']); assert.deepEqual(b.credits.map((c) => c.who), ['skylark']);
  });
  it('the public 2004 build has no usable bridge; restoring finds the intact copy on Elena’s disk', () => {
    const b = Ar.sceneGraph(AR, 2004).objects.find((o) => o.id === 'bridge');
    assert.equal(b.state, 'missing'); assert.deepEqual(b.damage.map((d) => d.status).sort(), ['stripped', 'truncated']);
    const c = Ar.restoreCandidate(AR, 'bridge'); assert.equal(c.ok, true); assert.equal(c.provenance.source, 'disk'); assert.equal(c.provenance.status, 'RESTORED');
    const after = Ar.sceneGraph(AR, 2004, { bridge: c.provenance }).objects.find((o) => o.id === 'bridge');
    assert.equal(after.state, 'restored'); assert.equal(after.data.planks.length, 15);
  });
  it('without the disk the bridge cannot be restored at all', () => {
    const noDisk = Ar.createArchive(texts({ disk: undefined }));
    assert.equal(Ar.restoreCandidate(noDisk, 'bridge').ok, false);
    assert.equal(Ar.buildFor(noDisk.all(), 1998), null, 'and the summer build exists only on the disk');
  });
  it('changing the archive input changes the scene: one plank left out leaves a hole you cannot walk across', () => {
    const v = Ar.createArchive(texts({ disk: read('variant-missing-plank.spool') }));
    // the variant disk's own 1998 manifest describes 14 planks: the summer build now has a hole
    const b98 = Ar.sceneGraph(v, 1998).objects.find((o) => o.id === 'bridge'); assert.equal(b98.state, 'present');
    const data = b98.data; assert.equal(data.planks.length, 14);
    const full = Ar.parseBridge(Ar.restoreCandidate(AR, 'bridge').res.data);
    assert.notEqual(b98.provenance.sha256, Ar.restoreCandidate(AR, 'bridge').provenance.sha256);
    // and the 2004 build refuses the altered copy: it does not match what that build lists
    const c = Ar.restoreCandidate(v, 'bridge'); assert.equal(c.ok, false); assert.equal(c.res.copies.find((x) => x.source === 'disk').status, 'corrupt');
    const lay = LAYOUTS.town, assets = Ar.sceneGraph(AR, 2004).assets;
    const walkAcross = (d) => { const w = Ph.makeWorld(lay, { assets, floors: bridgeFloors(d, 1) }); const b = Ph.newBody(0, 7.6, 0); for (let i = 0; i < 300; i++) { Ph.stepBody(b, { dx: 0, dz: 1 }, 1 / 30, w); } return b.z; };
    assert.ok(walkAcross(full) > CANAL.z1 + 0.3, 'the full bridge crosses');
    assert.ok(walkAcross(data) < BRIDGE.z0 + full.planks[7].z + 0.1, 'the hole stops you');
    // and a jump clears it
    const w = Ph.makeWorld(lay, { assets, floors: bridgeFloors(data, 1) }); const b = Ph.newBody(0, BRIDGE.z0 + data.planks[6].z, 0);
    for (let i = 0; i < 90; i++) { Ph.stepBody(b, { dx: 0, dz: 1, jump: i === 2, sprint: true }, 1 / 30, w); }
    assert.ok(b.z > CANAL.z1, 'jumping the gap works');
  });
  it('June’s window is the same bytes in 1998 and 2004: Elena never changed it', () => {
    const a = Ar.sceneGraph(AR, 1998).objects.find((o) => o.id === 'window'), b = Ar.sceneGraph(AR, 2004).objects.find((o) => o.id === 'window');
    assert.equal(a.provenance.sha256, b.provenance.sha256); assert.equal(a.data.points.length, 4); assert.deepEqual(a.data.finishes, ['sea', 'honey', 'chalk']);
  });
  it('Iris loops in 2004 and leaves in 1998; Revive takes her own ending from the 1998 record', () => {
    assert.equal(Ar.sceneGraph(AR, 2004).objects.find((o) => o.id === 'iris').data.loops, true);
    const r = Ar.reviveCandidate(AR, 'iris'); assert.equal(r.script.loops, false); assert.equal(r.script.ending, 'leaves'); assert.equal(r.script.by, 'junebug');
    const present = Ar.sceneGraph(AR, 2004, { iris: Object.assign({}, r.provenance, { era: 1998 }) });
    assert.equal(present.objects.find((o) => o.id === 'iris').data.ending, 'leaves');
  });
  it('historical builds stay immutable; new work is CREATED and only in the present edition', () => {
    const before98 = JSON.stringify(Ar.sceneGraph(AR, 1998).objects.map((o) => [o.id, o.state, o.provenance && o.provenance.sha256]));
    const restored = { bridge: Ar.restoreCandidate(AR, 'bridge').provenance, lamp: Object.assign({}, Ar.restoreCandidate(AR, 'lamp', 1998).provenance, { era: 1998 }) };
    const present = Ar.sceneGraph(AR, 2004, restored, { credits_restored: true, seasons: true, snow: true });
    assert.equal(JSON.stringify(Ar.sceneGraph(AR, 1998, restored, { seasons: true }).objects.map((o) => [o.id, o.state, o.provenance && o.provenance.sha256])), before98);
    assert.equal(Ar.sceneGraph(AR, 2004).objects.find((o) => o.id === 'bridge').state, 'missing', 'the 2004 snapshot itself is unchanged');
    const created = present.objects.filter((o) => o.kind === 'created');
    assert.deepEqual(created.map((o) => o.id).sort(), ['credits_restored', 'seasons', 'snow']);
    assert.ok(created.every((o) => o.provenance.status === 'CREATED'));
    assert.ok(!Ar.sceneGraph(AR, 1998, null, { seasons: true }).objects.some((o) => o.id === 'seasons'), 'no winter in 1998');
    assert.deepEqual(present.credits.slice(0, 2).map((c) => [c.who, c.roles.join(' ')]), [['skylark', 'programming music'], ['junebug', 'art story']]);
  });
  it('a saved provenance reference must still match real bytes', () => {
    const p = Ar.restoreCandidate(AR, 'bridge').provenance;
    assert.equal(Ar.verifyProvenance(AR, p), true); assert.equal(Ar.verifyProvenance(AR, Object.assign({}, p, { sha256: 'f'.repeat(64) })), false);
  });
});

describe('V5 physics', () => {
  const station = Ph.makeWorld(LAYOUTS.station, { assets: new Set() });
  it('a sprint and a jump clear the luggage cart; walking into it does not', () => {
    const run = (jump) => { const b = Ph.newBody(-2.0, 0, 0); for (let i = 0; i < 120; i++) { Ph.stepBody(b, { dx: 1, dz: 0, sprint: true, jump: jump && b.x > 2.2 && b.x < 3.2 && b.grounded }, 1 / 30, station); } return b.x; };
    assert.ok(run(false) < 4.0); assert.ok(run(true) > 6.0);
  });
  it('the edge guard keeps you on the platform, the canal edge, and in rooms', () => {
    const b = Ph.newBody(0, 1.5, 0); for (let i = 0; i < 90; i++) { Ph.stepBody(b, { dx: 0, dz: 1 }, 1 / 30, station); } assert.ok(b.z <= 2.0 && b.y === 0);
    const town = Ph.makeWorld(LAYOUTS.town, { assets: Ar.sceneGraph(AR, 2004).assets });
    const c = Ph.newBody(4.0, 6.8, 0); for (let i = 0; i < 90; i++) { Ph.stepBody(c, { dx: 0, dz: 1 }, 1 / 30, town); } assert.ok(c.z < CANAL.z0 && c.grounded);
  });
  it('gliding from the windy ledge carries you further than falling', () => {
    const coast = Ph.makeWorld(LAYOUTS.coast, { assets: new Set() });
    const fly = (glide) => { const b = Ph.newBody(273.2, 28, 0); for (let i = 0; i < 400; i++) { Ph.stepBody(b, { dx: 1, dz: 0, jump: i === 0, jumpHeld: glide, glide: true }, 1 / 30, coast); if (b.grounded && i > 5) { break; } } return b; };
    const a = fly(false), g = fly(true); assert.ok(a.y < -4.9 && g.y < -4.9); assert.ok(g.x > a.x + 1.5, `glide ${g.x.toFixed(1)} vs fall ${a.x.toFixed(1)}`);
  });
  it('falling into the void returns you to the last safe spot', () => {
    const coast = Ph.makeWorld(Object.assign({}, LAYOUTS.coast, { floors: [{ k: 'rect', x0: 0, x1: 2, z0: 0, z1: 2, y: 0, ledge: true }] }), { assets: new Set() });
    const b = Ph.newBody(1, 1, 0); let fell = false; for (let i = 0; i < 200; i++) { if (Ph.stepBody(b, { dx: 1, dz: 0 }, 1 / 30, coast).includes('fall')) { fell = true; break; } }
    assert.ok(fell); assert.ok(b.x <= 2 && b.y === 0);
  });
});

describe('V5 toys', () => {
  it('the ride always reaches the lighthouse, June overtakes once and waits for a slow rider', () => {
    const r = Toys.newRide(); let saidWait = false;
    for (let i = 0; i < 30 * 8; i++) { Toys.tickRide(r, 1 / 30, { throttle: 0 }).forEach((e) => { if (e.type === 'june-say') { saidWait = true; } }); }
    assert.ok(saidWait); assert.ok(r.june.s < r.s + 6);
    let arrived = false; for (let i = 0; i < 30 * 120 && !arrived; i++) { Toys.tickRide(r, 1 / 30, { throttle: 1, steer: -r.d }).forEach((e) => { if (e.type === 'arrive') { arrived = true; } }); }
    assert.ok(arrived); assert.ok(r.overtook);
  });
  it('the duet comes from Elena’s tune in the archive and never blocks on misses', () => {
    const tune = Ar.sceneGraph(AR, 1998).objects.find((o) => o.id === 'tune').data;
    assert.equal(tune.phrases.length, 4); assert.equal(tune.tempo, 88);
    const m = Toys.newDuet(tune); let notes = 0, done = false;
    for (let i = 0; i < 30 * 60 && !done; i++) { Toys.tickDuet(m, 1 / 30, false).forEach((e) => { if (e.type === 'note') { notes += 1; } if (e.type === 'duet-done') { done = true; } }); }
    assert.ok(done); assert.equal(notes, tune.phrases.flat().length); assert.equal(m.misses, 4); assert.equal(m.layers, 0);
    const h = Toys.newDuet(tune); for (let i = 0; i < 30 * 60 && !h.done; i++) { Toys.tickDuet(h, 1 / 30, h.cueIn !== null && h.cueIn !== undefined && Math.abs(h.cueIn) < 0.04); }
    assert.equal(h.hits, 4); assert.equal(h.layers, 3);
  });
  it('June reacts to photos by what she is doing, not by a score', () => {
    const lay = LAYOUTS.train; const yaw = Math.atan2(-(lay.june.x - lay.seat.x), -(lay.june.z - lay.seat.z));
    const cam = { x: lay.seat.x, y: lay.seat.y, z: lay.seat.z, yaw, pitch: 0, fov: 40, aspect: 1.5 }, face = { x: lay.june.x, y: 1.15, z: lay.june.z };
    assert.equal(Toys.frame(cam, face).inFrame, true);
    assert.equal(Toys.takePhoto(cam, face, 1, 0).reaction, 'candid'); assert.equal(Toys.takePhoto(cam, face, 7, 0).reaction, 'duel');
    assert.equal(Toys.takePhoto(Object.assign({}, cam, { yaw: yaw + Math.PI }), face, 1, 0).reaction, 'missed');
    assert.deepEqual(['shy', 'pose', 'smile'], [0, 1, 2].map((n) => Toys.takePhoto(cam, face, 5, n).reaction));
  });
});

describe('V5 the whole game, played headlessly', () => {
  it('plays from the study to the credits, all seven chapters, with no stuck moments', () => {
    const g = Gm.createGame(AR); const bot = playThrough(g);
    assert.deepEqual([...new Set(bot.beats)], Gm.BEATS.slice(1));
    assert.equal(g.s.beat, 'end'); assert.equal(bot.stuck.length, 0, JSON.stringify(bot.stuck));
    assert.deepEqual(Object.keys(g.s.restored).sort(), ['bridge', 'credits', 'iris', 'lamp']);
    assert.ok(g.s.photos.length >= 2 && g.s.photos.some((p) => p.id === 'june-elena'));
    assert.equal(g.s.window.placed, true); assert.ok(g.s.edition.seasons && g.s.edition.snow);
    assert.equal(g.s.season, 'winter');
    for (let c = 1; c <= 7; c++) { assert.ok(bot.events.some((e) => e.type === 'beat' && e.chapter === c), `chapter ${c}`); }
    // events raised when a dialogue ends must reach the shell (the rebuild screen, the memory card, the carry)
    for (const type of ['rebuild', 'memory', 'carry', 'fade', 'letter', 'credits-roll', 'years-later', 'placed', 'lit']) { assert.ok(bot.events.some((e) => e.type === type), `event ${type}`); }
    for (const id of ['c1.hand', 'c2.backs', 'c3.listen', 'c4.after', 'c5.news', 'c6.talk', 'c6.leave', 'c7.snow']) { assert.ok(g.s.seen.includes(id), id); }
  });
  it('the other choices change words and expressions, never what happens', () => {
    const g = Gm.createGame(AR); const bot = playThrough(g, { choices: { train: 0, parting: 1, finish: 0 }, glide: false });
    assert.equal(g.s.beat, 'end'); assert.equal(g.s.choices.train, 'c2.choice.playful'); assert.equal(g.s.choices.parting, 'c5.choice.miss'); assert.equal(g.s.window.finish, 'sea');
    assert.ok(g.s.seen.includes('c2.playful') && g.s.seen.includes('c5.miss')); assert.ok(g.s.seen.includes('c6.talk'), 'June still leaves; 2004 still happens');
    assert.equal(bot.stuck.length, 0);
  });
  it('with an altered archive the restore is refused safely in play, and the 1998 bridge shows the hole', () => {
    const v = Ar.createArchive(texts({ disk: read('variant-missing-plank.spool') }));
    const s = Gm.newSave(); s.beat = '1.town';
    const g = Gm.createGame(v, s); const b = makeBot(g);
    b.walkTo(0, 7.4); b.until((q) => q.prompt && q.prompt.id === 'theo', 10, () => b.axes(0, 1)); b.use('theo'); b.talk();
    b.until((q) => q.prompt && q.prompt.id === 'gap', 10, () => b.axes(0, 1)); b.hold('gap', 6);
    assert.ok(b.events.some((e) => e.type === 'restore-failed')); assert.equal(g.s.bridge, 0); assert.equal(g.s.restored.bridge, undefined);
    const w98 = Gm.worldFor(g, 'town', 1998); assert.equal(w98.floors.filter((f) => f.plank !== undefined).length, 14);
    const w = Gm.worldFor(Gm.createGame(AR, s), 'town', 1998); assert.equal(w.floors.filter((f) => f.plank !== undefined).length, 15);
  });
  it('the train never fails you: standing still makes June wait and the chase restarts at once', () => {
    const s = Gm.newSave(); s.beat = '1.chase'; const g = Gm.createGame(AR, s); const bot = makeBot(g);
    bot.wait(60);
    const retries = bot.events.filter((e) => e.type === 'retry');
    assert.ok(retries.length >= 1); assert.equal(g.s.beat, '1.chase'); assert.ok(bot.events.some((e) => e.type === 'caption' && e.key === 'c1.june.wait'));
  });
  it('Tab is safe: denied where the other era has no floor, never strands the player', () => {
    const s = Gm.newSave(); s.beat = '1.pier'; s.restored.bridge = Ar.restoreCandidate(AR, 'bridge').provenance; s.bridge = 1; s.era = 1998; s.flags.tab = true; s.pos.town = { x: 0, z: 15.8, y: 0, yaw: Math.PI };
    const g = Gm.createGame(AR, s); const bot = makeBot(g);
    bot.tick({ tab: true }); assert.equal(g.s.era, 1998); assert.ok(bot.events.some((e) => e.type === 'tab-denied'));
    // from every standable point in either era the switch either lands on floor or is refused
    for (const era of [1998, 2004]) {
      for (let x = -10; x <= 18; x += 1.5) {
        for (let z = -12; z <= 25; z += 1.5) {
          g.s.era = era; g.rt.world = Gm.worldFor(g, 'town', era);
          if (!Ph.standable(g.rt.world, x, z, 0)) { continue; }
          Object.assign(g.rt.body, { x, z, y: 0, vx: 0, vz: 0, grounded: true });
          Gm.tick(g, 1 / 30, { tab: true });
          assert.ok(Ph.standable(g.rt.world, g.rt.body.x, g.rt.body.z, g.rt.body.y), `era ${era} at ${x},${z}`);
        }
      }
    }
  });
  it('seen dialogue can be skipped and still moves the story on; unseen cannot', () => {
    const s = Gm.newSave(); s.beat = '1.study'; s.seen = ['c1.computer']; const g = Gm.createGame(AR, s); const bot = makeBot(g);
    bot.go('computer', 3.0, -1.7); bot.use('computer'); assert.equal(bot.snap().dialog.seen, true);
    bot.tick({ skip: true }); assert.equal(g.s.beat, '1.town');
    const g2 = Gm.createGame(AR); const b2 = makeBot(g2); b2.go('computer', 3.0, -1.7); b2.use('computer'); b2.tick({ skip: true }); assert.ok(b2.snap().dialog, 'not skippable the first time');
  });
  it('saves round-trip, and an edited save cannot claim a restoration without real bytes', () => {
    const g = Gm.createGame(AR); playThrough(g);
    const back = Gm.parseSave(JSON.parse(JSON.stringify(Gm.serialize(g))), AR);
    assert.equal(back.beat, 'end'); assert.deepEqual(Object.keys(back.restored).sort(), ['bridge', 'credits', 'iris', 'lamp']); assert.equal(back.window.placed, true);
    const forged = Gm.serialize(g); forged.restored.bridge.sha256 = '0'.repeat(64); forged.beat = '3.yard';
    const f = Gm.parseSave(JSON.parse(JSON.stringify(forged)), AR); assert.equal(f.beat, '1.town'); assert.equal(f.bridge, 0);
    const early = Gm.parseSave({ schemaVersion: 1, beat: 'end', edition: { seasons: true }, restored: {} }, AR); assert.equal(early.beat, '1.town');
    const noWindow = Gm.parseSave(Object.assign(Gm.serialize(g), { beat: '4.duet', window: { placed: false } }), AR); assert.equal(noWindow.beat, '3.yard');
    assert.equal(Gm.parseSave({ schemaVersion: 99 }, AR), null); assert.equal(Gm.parseSave('x', AR), null);
    const g3 = Gm.createGame(AR, back); assert.equal(g3.rt.scene, 'town'); assert.equal(Gm.snapshot(g3).season, 'winter');
  });
});

describe('V5 text', () => {
  it('English and Chinese have the same keys, placeholders, and no empty lines (except the screen speaker)', () => {
    const en = Object.keys(dictionaries.en).sort(), zh = Object.keys(dictionaries.zh).sort();
    assert.deepEqual(zh, en);
    for (const k of en) { if (k === 'sp.screen') { continue; } assert.ok(dictionaries.en[k].trim() && dictionaries.zh[k].trim(), k); const v = (x) => (x.match(/\{\w+\}/g) || []).sort().join(); assert.equal(v(dictionaries.zh[k]), v(dictionaries.en[k]), k); }
  });
  it('every line in every dialogue, every hint and every reaction exists in both languages', () => {
    const need = new Set();
    for (const lines of Object.values(Gm.DIALOGS)) { for (const ln of lines) { if (Array.isArray(ln)) { if (ln[0] !== 'pause') { need.add(ln[1]); need.add('sp.' + ln[0]); } } else { ln.options.forEach((o) => need.add(o)); } } }
    for (const b of Gm.BEATS) { for (let l = 1; l <= 3; l++) { need.add(`hint.${b}.${l}`); } }
    Object.keys(Toys.REACTIONS).forEach((r) => need.add('c2.react.' + r));
    ['photo', 'keepbox', 'drawing', 'shelf', 'window'].forEach((id) => { need.add('look.' + id); need.add('look.' + id + '7'); });
    ['2004', '1998', 'restored'].forEach((e) => need.add('look.notice.' + e));
    for (let i = 1; i <= 3; i++) { need.add('june.nudge' + i); need.add('june.idle' + i); }
    const src = fs.readFileSync(path.join(here, '..', 'frontend', 'v5', 'core', 'game.js'), 'utf8');
    (src.match(/'(?:c[1-7]|verb|june)\.[A-Za-z0-9.]+'/g) || []).map((x) => x.slice(1, -1)).filter((k) => !k.endsWith('.') && !Gm.DIALOGS[k]).forEach((k) => need.add(k));
    for (const k of need) { assert.ok(k in dictionaries.en, 'missing ' + k); }
    for (let c = 1; c <= 7; c++) { assert.ok(`chap.${c}` in dictionaries.en); }
    assert.equal(t('zh', 'c2.june.youreTheView'), '你就是风景。'); assert.equal(t('zh', 'c5.june.dontStay'), '但不要把自己留在这里。'); assert.equal(t('zh', 'c7.mara.summerEnd'), '因为有人终于允许夏天结束了。');
  });
});
