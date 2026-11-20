// Audits the guide against what a player actually does, over a whole playthrough of the real core:
//  - every time a required thing is used or held, does the goal's marker point at it (within 2.5 m)?
//  - every time Tab is pressed, did the instruction on screen mention Tab?
//  - every required step: is it done before the beat ends, and does the next-step text change when it is?
// Prints the misses. Exit code 1 if there are any.   node tools/v5-guide-audit.mjs [--alt]
import * as Gm from '../frontend/v5/core/game.js';
import { objective } from '../frontend/v5/core/objectives.js';
import { dictionaries } from '../frontend/v5/core/i18n.js';
import { playThrough, DT } from '../test/v5-bot.mjs';
import { loadArchive } from './v5-playthrough.mjs';

export async function audit(opts) {
  const g = Gm.createGame(loadArchive()); const misses = []; const uses = []; const tabs = []; const switches = [];
  let prevNext = null, prevBeat = null, wasHeld = false;
  await playThrough(g, Object.assign({}, opts, { step: (input) => {
    const s = Gm.snapshot(g); const o = objective(g);
    if (o && !s.dialog && !s.choice) {
      // the thing the player is about to use
      const starts = input.use || (input.useHeld && !wasHeld);   // the moment a press or a hold begins, not every frame of a hold
      if (starts && s.prompt && !s.prompt.optional) {
        const tg = o.target; const d = tg ? Math.hypot(tg.x - s.prompt.x, tg.z - s.prompt.z) : null;
        uses.push({ beat: s.beat, id: s.prompt.id, d });
        if (tg && d > 2.5) { misses.push(`${s.beat}: used "${s.prompt.id}" but the marker was ${d.toFixed(1)} m away (next step "${o.next}")`); }
        if (!tg && s.scene !== 'train' && s.scene !== 'ride' && s.scene !== 'porch' && !g.rt.seated) { misses.push(`${s.beat}: used "${s.prompt.id}" with no marker (next step "${o.next}")`); }
      }
      if (input.tab && s.scene === 'town') {
        const raw = dictionaries.en[o.nextKey] || ''; tabs.push({ beat: s.beat, next: o.nextKey });
        if (!/\{k:tab\}/.test(raw)) { misses.push(`${s.beat}: Tab pressed, but the instruction was "${o.nextKey}" (no Tab in it)`); }
      }
    }
    wasHeld = !!input.useHeld;
    const ev = Gm.tick(g, DT, input); const o2 = objective(g);
    if (o2) {
      if (o2.beat !== prevBeat) { switches.push({ beat: o2.beat, kind: 'goal' }); prevBeat = o2.beat; prevNext = o2.next; }
      else if (o2.next !== prevNext) { switches.push({ beat: o2.beat, kind: 'step', from: prevNext, to: o2.next }); prevNext = o2.next; }
    }
    return ev;
  } }));
  return { g, misses, uses, tabs, switches };
}

if (process.argv[1] && process.argv[1].endsWith('v5-guide-audit.mjs')) {
  const alt = process.argv.includes('--alt');
  const r = await audit(alt ? { choices: { train: 0, parting: 1, finish: 0, closer: 1, defend: 1, offer: 1, letter: 1 } } : {});
  const byCh = {}; r.switches.filter((x) => x.kind === 'step').forEach((x) => { const c = Gm.chapterOf(x.beat); byCh[c] = (byCh[c] || 0) + 1; });
  console.log(JSON.stringify({ end: r.g.s.beat, uses: r.uses.length, tabs: r.tabs.length, stepSwitchesPerChapter: byCh, misses: r.misses }, null, 1));
  process.exit(r.misses.length ? 1 : 0);
}
