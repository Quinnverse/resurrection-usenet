// R4: the prologue, the epilogue, the chapter echoes and the blocker fixes, checked in the Node simulation (seconds).
// What a real browser shows is checked by tools/r4-browser.mjs; this file is the cheap part that runs on every push.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Ar from '../frontend/v5/core/archive.js';
import * as Gm from '../frontend/v5/core/game.js';
import { dictionaries } from '../frontend/v5/core/i18n.js';
import { EN_R4, ZH_R4 } from '../frontend/v5/core/i18n-r4.js';
import { playThrough, makeBot } from './v5-bot.mjs';

const read = (f) => fs.readFileSync(new URL('../frontend/v5/data/' + f, import.meta.url), 'utf8');
const texts = {}; for (const s of Ar.SOURCES) { texts[s.id] = read(s.file); } texts.edition = read('edition-present.txt'); texts.drafts = read('drafts-unsent.txt');
const ar = Ar.createArchive(texts);
const SAVES = JSON.parse(read('preview-saves.json')).saves;
const from = (beat) => Gm.createGame(ar, Gm.parseSave(JSON.parse(JSON.stringify(SAVES[beat])), ar));
const ph = (s) => (s.match(/\{[\w:]+\}/g) || []).sort().join();

test('R4 texts: same keys and placeholders in English and Chinese, every prologue and epilogue line has text', () => {
  assert.deepEqual(Object.keys(EN_R4).sort(), Object.keys(ZH_R4).sort());
  Object.keys(EN_R4).forEach((k) => assert.equal(ph(EN_R4[k]), ph(ZH_R4[k]), k));
  for (const lang of ['en', 'zh']) {
    const d = dictionaries[lang];
    Object.entries(Gm.DIALOGS).filter(([id]) => /^p\.[kherse]\./.test(id)).forEach(([id, lines]) => lines.forEach((ln) => {
      if (Array.isArray(ln)) { if (ln[0] !== 'pause') { assert.ok(d[ln[1]], `${lang} ${id} ${ln[1]}`); assert.ok(ln[0] === 'screen' || d['sp.' + ln[0]] !== undefined, `${lang} speaker ${ln[0]}`); } }
      else { ln.options.forEach((o) => assert.ok(d[o], `${lang} choice ${o}`)); }
    }));
    ['chap.0', 'chap.8'].forEach((k) => assert.ok(d[k], `${lang} ${k}`));
  }
});

test('R4: the prologue choices change words and expressions, never what happened', async () => {
  const run = async (choices) => {
    const g = Gm.createGame(ar); const heard = new Set();
    await playThrough(g, { choices: Object.assign({ train: 1, parting: 0, finish: 1, closer: 0, defend: 0, offer: 0, letter: 0 }, choices), step: (i) => { const ev = Gm.tick(g, 1 / 30, i); const s = Gm.snapshot(g); if (s.dialog && Array.isArray(s.dialog.line)) { heard.add(s.dialog.line[1]); } return ev; } });
    return { g, heard };
  };
  const a = await run({ pk1: 0, pk2: 0, pk3: 0, ps: 0 }); const b = await run({ pk1: 1, pk2: 1, pk3: 1, ps: 1 });
  for (const r of [a, b]) {
    assert.equal(r.g.s.beat, 'end'); ['kArgued', 'kLeft', 'machine', 'keys', 'mounted', 'repaired', 'ranSummer', 'summerBroke', 'unfolded', 'letterM', 'epilogue'].forEach((f) => assert.ok(r.g.s.flags[f], f));
    ['p.k.e6', 'p.k.careful', 'p.h.m3', 'p.r.q3', 'p.s.err', 'p.e.l1', 'p.e.f4'].forEach((k) => assert.ok(r.heard.has(k), 'both hear ' + k));
  }
  // what differs is only the wording that answers the choice
  assert.ok(a.heard.has('p.k.a1') && !a.heard.has('p.k.b1') && b.heard.has('p.k.b1') && !b.heard.has('p.k.a1'));
  assert.ok(a.heard.has('p.k.bye') && !b.heard.has('p.k.bye'), 'Mara says goodbye only if she chose to');
  assert.ok(a.heard.has('p.h.m.byeA') && b.heard.has('p.h.m.byeB') && a.heard.has('r4.c5.lastA') && b.heard.has('r4.c5.lastB') && a.heard.has('p.e.f5a') && b.heard.has('p.e.f5b'), 'the last words come back in the house, chapter 5 and the epilogue');
  assert.ok(a.heard.has('r4.c6.harm') && b.heard.has('r4.c6.harm'), 'understanding Elena is not excusing her, whatever was chosen');
});

test('R4: the epilogue letter agrees with chapter 6 (the harm is named, nothing is excused) and the photo is unfolded only there', async () => {
  const g = Gm.createGame(ar); const order = [];
  await playThrough(g, { step: (i) => { const ev = Gm.tick(g, 1 / 30, i); const s = Gm.snapshot(g); if (s.dialog && Array.isArray(s.dialog.line) && s.dialog.line[0] !== 'pause') { order.push(s.dialog.line[1]); } return ev; } });
  const at = (k) => order.indexOf(k);
  assert.ok(at('c6.elena.admit') >= 0 || at('c6.elena.studio') >= 0, 'chapter 6 has her motive');
  assert.ok(at('c7.mara.unfolded') < 0 && at('r4.c7.notYet') > 0 && at('p.e.ph2') > at('r4.c7.notYet'), 'unfolded in the epilogue, not before');
  assert.ok(at('p.e.l2') > at('p.e.ph2') && /cost her a job/.test(EN_R4['p.e.l2']) && /不是为了瞒着你|不必去看我做过的事/.test(ZH_R4['p.e.l3']), 'the letter names the harm');
  assert.ok(!/not guilty|没有错|无罪|forgive me|原谅我/.test(EN_R4['p.e.l1'] + EN_R4['p.e.l2'] + EN_R4['p.e.l3'] + ZH_R4['p.e.l1'] + ZH_R4['p.e.l2'] + ZH_R4['p.e.l3']), 'the letter does not ask for or claim absolution');
});

test('R4 beam (RC3 blocker): the key the screen names always brings the light to June, then the cottage, and holding it is enough', () => {
  for (const startA of [1.7, 0.2, 4.0, 5.9]) {
    const g = from('3.beam'); g.rt.beam.a = startA; const keys = new Set(); let guard = 0;
    for (let i = 0; i < 30 * 8; i++) { Gm.tick(g, 1 / 30, { advance: !!Gm.snapshot(g).dialog }); if (g.rt.beam.ready) { break; } }
    while (!g.s.flags.beamDone && g.s.beat === '3.beam' && guard++ < 30 * 90) {
      const s = Gm.snapshot(g); if (s.dialog) { Gm.tick(g, 1 / 30, { advance: true }); continue; }
      const mx = s.beam.onTarget ? 0 : (s.beam.dir > 0 ? -1 : 1); if (mx) { keys.add(mx); }
      Gm.tick(g, 1 / 30, { mx });
    }
    assert.ok(g.s.flags.foundJune && (g.s.flags.beamDone || g.s.beat === '3.cliff'), `from ${startA} rad: found June ${!!g.s.flags.foundJune}`);
    assert.ok(guard < 30 * 40, `from ${startA} rad it took ${(guard / 30).toFixed(0)} s`);
  }
});

test('R4: a conversation stops the body (the chase kept its sprint speed and ran on the spot)', () => {
  const g = from('1.study'); const b = g.rt.body; const c = Ar && { x: 3.0, z: -1.7 };
  b.x = c.x; b.z = c.z; b.vx = 3.1; b.vz = -0.4;
  Gm.tick(g, 1 / 30, { use: true }); const s = Gm.snapshot(g);
  assert.ok(s.dialog, 'a dialogue started'); assert.ok(Math.hypot(g.rt.body.vx, g.rt.body.vz) < 0.01, 'the body is still');
});

test('R4: saves from before R4 still load and play on, and an unknown beat falls back safely', async () => {
  const old = Gm.parseSave(JSON.parse(JSON.stringify(SAVES['5.depart'])), ar); assert.equal(old.beat, '5.depart');
  const g = Gm.createGame(ar, old); assert.equal(g.s.beat, '5.depart');
  const bogus = Gm.parseSave(Object.assign(JSON.parse(JSON.stringify(SAVES['1.study'])), { beat: 'nonsense' }), ar); assert.ok(Gm.BEATS.includes(bogus.beat));
  // a save made in RC3 at the study has none of the prologue flags: Mom's study is still playable and leads to the restore tool
  const s = Gm.newSave(); s.beat = '1.study'; s.flags.disk = true; const h = Gm.createGame(ar, s); const bot = makeBot(h, { optional: false });
  await bot.go('computer', 3.0, -1.7); await bot.use('computer'); await bot.talk(); assert.equal(h.s.beat, 'P.restore');
});

test('R4: every beat has a chapter, a scene, an objective with steps and its three hints in both languages', async () => {
  const { OBJECTIVE_BEATS } = await import('../frontend/v5/core/objectives.js');
  assert.deepEqual([...OBJECTIVE_BEATS].sort(), [...Gm.BEATS].sort());
  for (const b of Gm.BEATS) { assert.ok(Number.isInteger(Gm.chapterOf(b)), b); ['en', 'zh'].forEach((l) => [1, 2, 3].forEach((n) => assert.ok(dictionaries[l][`hint.${b}.${n}`], `${l} hint.${b}.${n}`))); }
  assert.equal(Gm.chapterOf('P.kitchen'), 0); assert.equal(Gm.chapterOf('1.study'), 0); assert.equal(Gm.chapterOf('1.town'), 1); assert.equal(Gm.chapterOf('end'), 7); assert.equal(Gm.chapterOf('E.study'), 8);
});
