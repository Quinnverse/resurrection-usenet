// Reproduces the chapter 1 first-play problems in the real game core, the way a new player meets them:
//   A  straight to the computer, pressing E again and again
//   B  exploring the room first, then the computer
//   C  the pier: Tab, talk to both people, wander, try to walk out along the pier
// Prints what the game did at each step (dialogues, flags, prompts, hints) so the causes can be read off.
//   node tools/v5-repro-ch1.mjs [--json]
import * as Gm from '../frontend/v5/core/game.js';
import { makeBot, DT } from '../test/v5-bot.mjs';
import { loadArchive } from './v5-playthrough.mjs';
import { LAYOUTS } from '../frontend/v5/core/layout.js';
import { t } from '../frontend/v5/core/i18n.js';

const P = (scene, id) => LAYOUTS[scene].points.find((p) => p.id === id);
const ar = loadArchive();
const report = {};
const lines = (bot, from) => bot.events.slice(from).filter((e) => e.type === 'line' && Array.isArray(e.line)).map((e) => `${e.line[0]}: ${t('en', e.line[1])}`);
const hints = (bot, from) => bot.events.slice(from).filter((e) => e.type === 'hint' || (e.type === 'caption' && /^hint\./.test(e.key))).map((e) => e.key || ('hint level ' + e.level));

async function scenarioA() {
  const g = Gm.createGame(ar); const bot = makeBot(g, { optional: false }); const comp = P('study', 'computer'); const out = { presses: [] };
  await bot.walkTo(comp.x, comp.z + 1.0, bot.promptIs('computer'));
  for (let i = 0; i < 3; i++) {
    await bot.wait(0.2); const n = bot.events.length; await bot.use('computer'); await bot.talk();
    const s = bot.snap(); out.presses.push({ press: i + 1, beat: s.beat, said: lines(bot, n), needDisk: !!g.s.flags.needDisk, disk: !!g.s.flags.disk, promptAfter: s.prompt && s.prompt.id });
  }
  // what tells the player where the disk is? the KEEP box: is it marked, and how far is it?
  const kb = P('study', 'keepbox'); const s = bot.snap();
  out.keepbox = { distanceFromComputer: +Math.hypot(kb.x - s.x, kb.z - s.z).toFixed(2), promptVisibleFromComputer: false };
  // stand still: does the game help?
  const n = bot.events.length; await bot.wait(70); out.hintsAfter70sStill = hints(bot, n);
  report.A_computerFirst = out;
}
async function scenarioB() {
  const g = Gm.createGame(ar); const bot = makeBot(g, { optional: false }); const out = { steps: [] };
  for (const [id, x, z] of [['photo', 3.2, 0.7], ['drawing', null, null], ['shelf', null, null], ['window', null, null], ['keepbox', -1.1, 2.2]]) {
    const p = P('study', id); const n = bot.events.length;
    await bot.walkTo(x === null ? p.x : x, z === null ? p.z + 0.6 : z, bot.promptIs(id));
    const s0 = bot.snap(); if (!s0.prompt || s0.prompt.id !== id) { out.steps.push({ id, reached: false, prompt: s0.prompt && s0.prompt.id }); continue; }
    await bot.use(id); await bot.talk(); await bot.wait(0.2);
    out.steps.push({ id, said: lines(bot, n).concat(bot.events.slice(n).filter((e) => e.type === 'caption').map((e) => `${e.who}: ${t('en', e.key)}`)), disk: !!g.s.flags.disk });
  }
  const comp = P('study', 'computer'); const n = bot.events.length;
  await bot.walkTo(comp.x, comp.z + 1.0, bot.promptIs('computer')); await bot.use('computer'); await bot.talk(); await bot.wait(0.5);
  out.computer = { said: lines(bot, n), beatAfter: g.s.beat };
  report.B_exploreFirst = out;
}
async function scenarioC() {
  // reach the pier the normal way
  const g = Gm.createGame(ar); const bot = makeBot(g, { optional: false }); const comp = P('study', 'computer');
  await bot.goUse('keepbox', -1.1, 2.2); await bot.goUse('computer', comp.x, comp.z + 1.0); await bot.until((s) => s.scene === 'town');
  await bot.walkTo(0, 7.4); await bot.until((s) => s.prompt && s.prompt.id === 'theo', 10, () => bot.axes(0, 1)); await bot.use('theo'); await bot.talk();
  await bot.until((s) => s.prompt && s.prompt.id === 'gap', 10, () => bot.axes(0, 1));
  let n0 = bot.events.length; await bot.hold('gap', 6); await bot.until((s) => s.beat === '1.pier', 60);
  const out = { theoOnArrival: lines(bot, n0) };
  // 1 press Tab on the promenade
  let n = bot.events.length; await bot.tick({ tab: true }); await bot.wait(0.5); out.tab1 = { era: g.s.era, events: bot.events.slice(n).map((e) => e.type).filter((x) => /tab|world/.test(x)) };
  // 2 talk to Theo, then to Iris, in both years
  const talk = async (id, x, z) => { await bot.walkTo(x, z, bot.promptIs(id)); const s = bot.snap(); if (!s.prompt || s.prompt.id !== id) { return { id, reached: false, prompt: s.prompt && s.prompt.id }; } const k = bot.events.length; await bot.use(id); await bot.talk(); await bot.wait(0.2); return { id, era: g.s.era, said: lines(bot, k).concat(bot.events.slice(k).filter((e) => e.type === 'caption').map((e) => `${e.who}: ${t('en', e.key)}`)) }; };
  out.talks = [];
  for (let k = 0; k < 2; k++) {
    out.talks.push(await talk('theo', g.rt.theo.x - 1.0, g.rt.theo.z - 0.4));
    out.talks.push(await talk('irisTalk', g.rt.iris.x + 0.9, g.rt.iris.z + 0.6));
    await bot.tick({ tab: true }); await bot.wait(0.3);
  }
  // 3 wander about the plaza and the promenade for 90 s, as a lost player does. Does the game step in?
  n = bot.events.length; const route = [[0, 13], [-6, 12.8], [6, 13], [0, 4], [-4, -2], [4, -2], [0, 12.6]];
  const t0 = bot.t; let i = 0; while (bot.t - t0 < 90) { const [x, z] = route[i % route.length]; await bot.walkTo(x, z); i += 1; }
  out.wander90s = { hintsShown: hints(bot, n), idleTimerAtEnd: +g.rt.idleT.toFixed(1), hintLevel: g.rt.hintLevel, beat: g.s.beat };
  // 4 walk straight out along the pier in each year
  const straight = async () => { await bot.walkTo(0, 13.4); const k = bot.events.length; for (let j = 0; j < 9 / DT; j++) { await bot.tick(bot.axes(0, 1)); } const s = bot.snap(); return { era: g.s.era, endedAt: [+s.x.toFixed(2), +s.z.toFixed(2)], fell: bot.events.slice(k).some((e) => e.type === 'retry'), prompt: s.prompt && s.prompt.id }; };
  if (g.s.era !== 1998) { await bot.tick({ tab: true }); await bot.wait(0.3); } out.straight1998 = await straight();
  await bot.tick({ tab: true }); await bot.wait(0.3); out.straight2004 = await straight();
  // 5 pressing H: what does the game say?
  n = bot.events.length; for (let k = 0; k < 3; k++) { await bot.tick({ hint: true }); await bot.wait(5); } out.pressH = hints(bot, n).map((k) => `${k}: ${t('en', k)}`);
  report.C_pier = out;
}
await scenarioA(); await scenarioB(); await scenarioC();
console.log(process.argv.includes('--json') ? JSON.stringify(report) : JSON.stringify(report, null, 1));
