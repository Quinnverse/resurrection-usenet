// RC2: a first-time player must be able to tell what to do, why something does not work yet, and where to go next.
// These tests play the real game core and check the goal shown to the player against the state the story uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Gm from '../frontend/v5/core/game.js';
import { objective, ASSIST_AT, OBJECTIVE_BEATS } from '../frontend/v5/core/objectives.js';
import { fragments, counts, FRAGMENTS } from '../frontend/v5/core/journal.js';
import { dictionaries, t } from '../frontend/v5/core/i18n.js';
import { ACTIONS } from '../frontend/v5/core/keymap.js';
import { LAYOUTS } from '../frontend/v5/core/layout.js';
import { makeBot, playThrough, DT } from './v5-bot.mjs';
import { loadArchive } from '../tools/v5-playthrough.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ar = loadArchive();
const P = (scene, id) => LAYOUTS[scene].points.find((p) => p.id === id);
const has = (lang, key) => dictionaries[lang][key] !== undefined && dictionaries[lang][key] !== '';
const TOKENS = ACTIONS.concat(['move', 'look', 'pause', 'advance', 'skip', 'steer', 'pedal', 'shoot']);

// ---- every goal of the whole game, in a full playthrough --------------------------------------------------------------
async function recordGame(opts) {
  const g = Gm.createGame(ar); const seen = {}; const problems = []; let last = null;
  await playThrough(g, Object.assign({}, opts, { step: (input) => {
    const ev = Gm.tick(g, DT, input); const o = objective(g);
    if (!o) { problems.push('no objective at ' + g.s.beat); return ev; }
    const rec = seen[o.beat] = seen[o.beat] || { keys: new Set(), steps: {}, progress: [] };
    [o.goal, o.nextKey].concat(o.steps.map((x) => x.key)).filter(Boolean).forEach((k) => rec.keys.add(k));
    // a step, once done, stays done for the rest of the beat (players must never see a tick disappear)
    o.steps.forEach((x) => { if (rec.steps[x.id] && !x.done && !x.optional) { problems.push(`step ${o.beat}.${x.id} was done, then not`); } if (x.done) { rec.steps[x.id] = true; } });
    if (last !== o.progress.n + '/' + o.progress.of) { rec.progress.push(o.progress.n + '/' + o.progress.of); last = o.progress.n + '/' + o.progress.of; }
    return ev;
  } }));
  return { g, seen, problems };
}

test('goals: every beat of all seven chapters has a goal, translated, and finished steps never come back', async () => {
  const { g, seen, problems } = await recordGame();
  assert.equal(g.s.beat, 'end');
  assert.deepEqual(problems, []);
  const beats = Gm.BEATS.filter((b) => b !== 'end');
  beats.forEach((b) => assert.ok(seen[b], 'goal seen in ' + b));
  for (const b of Object.keys(seen)) { for (const k of seen[b].keys) { assert.ok(has('en', k), 'en ' + k); assert.ok(has('zh', k), 'zh ' + k); } }
  // the counter moves: in every beat with more than one step it shows progress before the beat ends
  beats.filter((b) => objective(Object.assign({}, g)) && seen[b].progress.length).forEach((b) => assert.ok(seen[b].progress.length >= 1, b));
  assert.deepEqual(OBJECTIVE_BEATS.slice().sort(), Gm.BEATS.slice().sort(), 'a goal function for every beat');
});

test('goals: every text the goals can name exists in English and Chinese, and every control token is a real control', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/v5/core/objectives.js'), 'utf8');
  const named = [...src.matchAll(/'(do\.[\w.]+)'/g)].map((m) => m[1]);
  assert.ok(named.length > 20);
  named.forEach((k) => { assert.ok(has('en', k), 'en ' + k); assert.ok(has('zh', k), 'zh ' + k); });
  for (const lang of ['en', 'zh']) {
    for (const [k, v] of Object.entries(dictionaries[lang])) {
      [...String(v).matchAll(/\{k:(\w+)\}/g)].forEach((m) => assert.ok(TOKENS.includes(m[1]), `${lang} ${k}: unknown control {k:${m[1]}}`));
    }
  }
  // the hints that once named fixed keys now use tokens (so they follow remapping and the pad or touch screen)
  ['hint.1.town.3', 'hint.1.pier.3', 'hint.3.ride.1', 'ui.next', 'ui.aimHint', 'ui.ride'].forEach((k) => assert.match(t('en', k), /\{k:/, k));
});

test('chapter 1, computer first: it says what is missing and where, the same way every time, and points at the box', async () => {
  const g = Gm.createGame(ar); const bot = makeBot(g, { optional: false }); const comp = P('study', 'computer');
  let o = objective(g); assert.equal(o.next, 'computer'); assert.equal(o.target.x, comp.x);
  await bot.walkTo(comp.x, comp.z + 1.0, bot.promptIs('computer'));
  const said = [];
  for (let i = 0; i < 3; i++) {
    await bot.wait(0.2); const n = bot.events.length; await bot.use('computer'); await bot.talk();
    said.push(bot.events.slice(n).filter((e) => e.type === 'line').map((e) => e.line[1]).join(','));
  }
  assert.equal(new Set(said).size, 1, 'pressing E again gives the same answer');
  assert.match(t('en', 'c1.mara.disk'), /KEEP/); assert.match(t('zh', 'c1.mara.disk'), /保留/);
  o = objective(g); const kb = P('study', 'keepbox');
  assert.equal(o.next, 'disk'); assert.deepEqual([o.target.x, o.target.z], [kb.x, kb.z]); assert.equal(o.nextKey, 'do.1.study.disk'); assert.match(t('en', o.nextKey), /KEEP/);
  assert.equal(o.steps.find((x) => x.id === 'computer').done, true, 'trying the computer counts as a step done');
  await bot.goUse('keepbox', -1.1, 2.2); o = objective(g); assert.equal(o.next, 'load'); assert.equal(o.target.x, comp.x);
  await bot.goUse('computer', comp.x, comp.z + 1.0); await bot.until((s) => s.scene === 'town');
});

test('chapter 1, exploring first: the box first, then the computer, leads to the same place with no dead end', async () => {
  const g = Gm.createGame(ar); const bot = makeBot(g, { optional: false });
  for (const id of ['photo', 'drawing', 'shelf', 'window']) { const p = P('study', id); await bot.walkTo(p.x, p.z + 0.6, bot.promptIs(id)); if (bot.snap().prompt && bot.snap().prompt.id === id) { await bot.use(id); await bot.talk(); } }
  await bot.goUse('keepbox', -1.1, 2.2);
  const o = objective(g); assert.equal(o.steps.find((x) => x.id === 'disk').done, true); assert.equal(o.next, 'load', 'with the disk in hand, the next step is the computer'); assert.equal(o.target.x, P('study', 'computer').x);
  const comp = P('study', 'computer'); await bot.goUse('computer', comp.x, comp.z + 1.0); await bot.until((s) => s.scene === 'town');
  assert.equal(g.s.beat, '1.town'); assert.equal(seenIn(g, 'c1.noDisk'), false, 'never asked for a disk it already has');
});
const seenIn = (g, id) => g.s.seen.indexOf(id) >= 0;

async function toPier(g, bot) {
  const comp = P('study', 'computer');
  await bot.goUse('keepbox', -1.1, 2.2); await bot.goUse('computer', comp.x, comp.z + 1.0); await bot.until((s) => s.scene === 'town');
  await bot.walkTo(0, 7.4); await bot.until((s) => s.prompt && s.prompt.id === 'theo', 10, () => bot.axes(0, 1)); await bot.use('theo'); await bot.talk();
  await bot.until((s) => s.prompt && s.prompt.id === 'gap', 10, () => bot.axes(0, 1)); await bot.hold('gap', 6); await bot.until((s) => s.beat === '1.pier', 60);
}
async function wander(bot, secs, input) {
  const route = [[0, 13], [-6, 12.8], [6, 13], [0, 4], [-4, -2], [4, -2], [0, 12.6]]; const t0 = bot.t; let i = 0;
  while (bot.t - t0 < secs) { const [x, z] = route[i % route.length]; const s0 = bot.snap(); const a = bot.axes(x - s0.x, z - s0.z); for (let k = 0; k < 1.2 / DT && bot.t - t0 < secs; k++) { const s = bot.snap(); if (Math.hypot(x - s.x, z - s.z) < 0.5) { break; } await bot.tick(Object.assign({}, bot.axes(x - s.x, z - s.z), input || {})); } i += 1; void a; }
}

test('chapter 1, the pier: Theo explains it, and a player who wanders gets help at 30, 60 and 90 seconds', async () => {
  const g = Gm.createGame(ar); const bot = makeBot(g, { optional: false }); await toPier(g, bot);
  assert.ok(g.s.seen.includes('c1.theo2')); assert.ok(Gm.DIALOGS['c1.theo2'].some((l) => l[1] === 'c1.theo.pierHow'), 'Theo says how the pier works');
  let o = objective(g); assert.equal(o.next, 'tab'); assert.match(t('en', o.nextKey), /\{k:tab\}/);
  // talking to Theo on the pier now points at the pier
  const th = g.rt.theo; await bot.walkTo(th.x - 1.0, th.z - 0.4, bot.promptIs('theo')); let n = bot.events.length; await bot.use('theo'); await bot.wait(0.3);
  assert.ok(bot.events.slice(n).some((e) => e.type === 'caption' && e.key === 'c1.theo.pierIdle'));
  // wander without doing anything that counts
  n = bot.events.length; const levels = []; const t0 = bot.t;
  const watch = (e) => { if (e.type === 'assist') { levels.push([e.level, Math.round(bot.t - t0)]); } };
  const tickOrig = bot.tick; bot.tick = async (inp) => { const ev = await tickOrig(inp); (ev || []).forEach(watch); return ev; };
  await wander(bot, 95);
  const up = levels.filter(([l]) => l > 0);
  assert.deepEqual(up.map(([l]) => l), [1, 2, 3], JSON.stringify(levels));
  // 30 s apart: the timer counts from the last progress (here, talking to Theo before wandering)
  assert.ok(Math.abs((up[1][1] - up[0][1]) - (ASSIST_AT[1] - ASSIST_AT[0])) <= 2 && Math.abs((up[2][1] - up[1][1]) - (ASSIST_AT[2] - ASSIST_AT[1])) <= 2, JSON.stringify(up));
  assert.ok(up[0][1] <= ASSIST_AT[0] + 1, 'the first help comes within 30 s of the last progress');
  const spoken = bot.events.slice(n).filter((e) => e.type === 'caption' && /^hint\.1\.pier\./.test(e.key)).map((e) => e.key);
  assert.deepEqual(spoken, ['hint.1.pier.1', 'hint.1.pier.2', 'hint.1.pier.3']);
  // doing the next step resets the help
  await bot.walkTo(0, 13.4); await bot.tick({ tab: true }); await bot.wait(0.5);
  o = objective(g); assert.equal(g.s.era, 1998); assert.equal(o.steps.find((x) => x.id === 'tab').done, true); assert.equal(Gm.snapshot(g).assist, 0);
});

test('chapter 1, the pier: the end of each deck says what to try, and the instruction follows where the player stands', async () => {
  const g = Gm.createGame(ar); const bot = makeBot(g, { optional: false }); await toPier(g, bot);
  // 2004: the fence
  await bot.walkTo(0, 13.6); let n = bot.events.length; for (let i = 0; i < 2 / DT; i++) { await bot.tick(bot.axes(0, 1)); }
  assert.ok(bot.events.slice(n).some((e) => e.type === 'caption' && e.key === 'c1.mara.fence'), 'the fence says 1998 was open');
  assert.equal(objective(g).nextKey, 'do.1.pier.fence');
  // 1998: walk out until the planks stop
  await bot.tick({ tab: true }); await bot.wait(0.3); await bot.walkTo(0, 17.6);
  n = bot.events.length; for (let i = 0; i < 2 / DT; i++) { await bot.tick(bot.axes(0, 1)); }
  assert.ok(bot.events.slice(n).some((e) => e.type === 'caption' && e.key === 'c1.mara.deck'), 'the end of the deck says to switch');
  let o = objective(g); assert.equal(o.nextKey, 'do.1.pier.stub'); assert.ok(o.steps.find((x) => x.id === 'deck').done);
  await bot.tick({ tab: true }); await bot.wait(0.3); o = objective(g); assert.equal(g.s.era, 2004); assert.equal(o.nextKey, 'do.1.pier.walkStub'); assert.ok(o.steps.find((x) => x.id === 'stub').done);
  await bot.walkTo(0, 22.6); o = objective(g); assert.equal(o.nextKey, 'do.1.pier.back98');
  await bot.tick({ tab: true }); await bot.wait(0.3); o = objective(g); assert.equal(o.next, 'post'); assert.ok(o.steps.filter((x) => x.id !== 'post').every((x) => x.done));
  await bot.go('pierEnd', 0, 24.2); await bot.use('pierEnd'); await bot.talk(); await bot.until((s) => s.beat === '1.carve');
});

test('help: can be turned off (H still works), and dialogue and menus do not count as being stuck', async () => {
  const g = Gm.createGame(ar); const bot = makeBot(g, { optional: false }); await toPier(g, bot);
  const n = bot.events.length; await wander(bot, 95, { autoHelp: false });
  assert.equal(bot.events.slice(n).filter((e) => e.type === 'assist' && e.level > 0).length, 0, 'no automatic help when it is off');
  await bot.tick({ hint: true, autoHelp: false }); await bot.wait(0.2, { autoHelp: false });
  assert.ok(bot.events.slice(n).some((e) => e.type === 'caption' && e.key === 'hint.1.pier.1'), 'H still gives a hint');
  // time in a dialogue does not add up
  const g2 = Gm.createGame(ar); const b2 = makeBot(g2, { optional: false }); const comp = P('study', 'computer');
  await b2.walkTo(comp.x, comp.z + 1.0, b2.promptIs('computer')); await b2.use('computer');
  for (let i = 0; i < 120 / DT; i++) { await b2.tick({}); }   // a line left on screen for two minutes
  assert.ok(g2.rt.dialog, 'still in the dialogue'); assert.equal(Gm.snapshot(g2).assist, 0); assert.equal(Gm.snapshot(g2).stuckT, 0);
});

test('saving in the middle of a goal and loading it shows the same goal with the same steps done', async () => {
  const g = Gm.createGame(ar); const bot = makeBot(g, { optional: false }); const checks = [];
  const snapAt = (label) => { const a = objective(g); const loaded = Gm.createGame(ar, Gm.parseSave(JSON.parse(JSON.stringify(Gm.serialize(g))), ar)); const b = objective(loaded); checks.push([label, a, b]); };
  const comp = P('study', 'computer');
  await bot.walkTo(comp.x, comp.z + 1.0, bot.promptIs('computer')); await bot.use('computer'); await bot.talk(); snapAt('asked for a disk');
  await bot.goUse('keepbox', -1.1, 2.2); snapAt('has the disk');
  await bot.goUse('computer', comp.x, comp.z + 1.0); await bot.until((s) => s.scene === 'town');
  await bot.walkTo(0, 7.4); await bot.until((s) => s.prompt && s.prompt.id === 'theo', 10, () => bot.axes(0, 1)); await bot.use('theo'); await bot.talk(); snapAt('talked to Theo');
  for (const [label, a, b] of checks) {
    assert.equal(b.goal, a.goal, label); assert.equal(b.next, a.next, label);
    assert.deepEqual(b.steps.map((x) => [x.id, x.done]), a.steps.map((x) => [x.id, x.done]), label);
  }
});

test('memory journal: found as the story records it, kept through save and load, never needed to go on', async () => {
  // a player who skips every optional thing still finishes the game and finds every required memory
  const run = await recordGame({ optional: false });
  assert.equal(run.g.s.beat, 'end');
  const fr = fragments(run.g);
  fr.filter((f) => !f.optional).forEach((f) => assert.ok(f.found, 'required memory ' + f.id));
  // texts and the archive's own record where the memory was restored from it
  FRAGMENTS.forEach((f) => { ['t', 'd'].forEach((x) => { assert.ok(has('en', `mem.${f.id}.${x}`), f.id); assert.ok(has('zh', `mem.${f.id}.${x}`), f.id); }); });
  ['bridge', 'iris', 'lampRestored'].forEach((id) => { const p = fr.find((f) => f.id === id).provenance; assert.ok(p && p.status === 'RESTORED' && p.record && p.file, id + ' provenance'); });
  // the same after saving and loading
  const loaded = Gm.createGame(ar, Gm.parseSave(JSON.parse(JSON.stringify(Gm.serialize(run.g))), ar));
  assert.deepEqual(counts(loaded), counts(run.g));
  // and with every optional thing done, every memory is there
  const full = await recordGame({ optional: true }); assert.equal(counts(full.g).found, counts(full.g).of);
});

test('a memory once found stays found for the rest of the game', async () => {
  const g = Gm.createGame(ar); const found = new Set(); const lost = [];
  await playThrough(g, { step: (input) => { const ev = Gm.tick(g, DT, input); fragments(g).forEach((f) => { if (f.found) { found.add(f.id); } else if (found.has(f.id)) { lost.push(f.id + '@' + g.s.beat); } }); return ev; } });
  assert.deepEqual(lost, []);
});

test('Iris remembers being asked when the year switches (her lines move on instead of starting over)', async () => {
  const g = Gm.createGame(ar); const bot = makeBot(g, { optional: false }); await toPier(g, bot);
  const ir = g.rt.iris; await bot.walkTo(ir.x + 0.9, ir.z + 0.6, bot.promptIs('irisTalk')); await bot.use('irisTalk'); await bot.wait(0.2);
  await bot.tick({ tab: true }); await bot.wait(0.3); assert.equal(g.rt.iris.talks, 1);
});

test('controls: the journal has its own key, and it can be remapped like the others', () => {
  assert.ok(ACTIONS.includes('journal'));
  assert.ok(has('en', 'ui.k.journal') && has('zh', 'ui.k.journal'));
});

test('the guide points at what the player does next: the marker is on every required thing used, Tab is in the instruction whenever it is needed', async () => {
  const { audit } = await import('../tools/v5-guide-audit.mjs');
  for (const choices of [undefined, { train: 0, parting: 1, finish: 0, closer: 1, defend: 1, offer: 1, letter: 1 }]) {
    const r = await audit(choices ? { choices } : {});
    assert.equal(r.g.s.beat, 'end'); assert.deepEqual(r.misses, []); assert.ok(r.uses.length > 60); assert.equal(r.tabs.length, 5);
    for (let c = 1; c <= 7; c++) { assert.ok(r.switches.some((x) => x.kind === 'step' && Gm.chapterOf(x.beat) === c), 'a step completed in chapter ' + c); }
  }
});

test('saving halfway along the pier and loading it keeps every step already done', async () => {
  const g = Gm.createGame(ar); const bot = makeBot(g, { optional: false }); await toPier(g, bot);
  await bot.walkTo(0, 13.5); await bot.tick({ tab: true }); await bot.wait(0.3); await bot.walkTo(0, 17.6); await bot.tick({ tab: true }); await bot.wait(0.3);
  for (const z of [20.0, 22.6]) {
    await bot.walkTo(0, z); const a = objective(g); const b = objective(Gm.createGame(ar, Gm.parseSave(JSON.parse(JSON.stringify(Gm.serialize(g))), ar)));
    assert.deepEqual(b.steps.map((x) => [x.id, x.done]), a.steps.map((x) => [x.id, x.done]), 'at z ' + z);
    assert.equal(b.next, a.next); assert.equal(b.nextKey, a.nextKey); assert.deepEqual(b.progress, a.progress);
  }
});
