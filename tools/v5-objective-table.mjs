// Prints the goal and step coverage of all seven chapters as a Markdown table, from a real playthrough of the core:
// for every beat, the goal, each step with the state it is read from, whether it was seen done, and where the marker
// points. Used for docs/V5-RC2-REPORT.md.   node tools/v5-objective-table.mjs [--lang zh]
import * as Gm from '../frontend/v5/core/game.js';
import { objective } from '../frontend/v5/core/objectives.js';
import { fragments } from '../frontend/v5/core/journal.js';
import { t } from '../frontend/v5/core/i18n.js';
import { playThrough, DT } from '../test/v5-bot.mjs';
import { loadArchive } from './v5-playthrough.mjs';

const lang = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'en';
const g = Gm.createGame(loadArchive()); const by = {}; const order = [];
await playThrough(g, { step: (input) => {
  const ev = Gm.tick(g, DT, input); const o = objective(g); if (!o) { return ev; }
  if (!by[o.beat]) { by[o.beat] = { o, done: {}, targets: 0, frames: 0 }; order.push(o.beat); }
  const r = by[o.beat]; r.frames += 1; if (o.target) { r.targets += 1; } o.steps.forEach((x) => { if (x.done) { r.done[x.id] = true; } });
  return ev;
} });
const L = ['| Ch | Beat | Goal | Steps (✓ = seen done in the playthrough; the last step of a beat is done by moving on) | Marker |', '|---|---|---|---|---|'];
for (const b of order) {
  const r = by[b]; const o = r.o;
  const steps = o.steps.map((x) => `${r.done[x.id] ? '✓' : '→'} ${t(lang, x.key)}${x.optional ? ' *(optional)*' : ''}`).join('<br>');
  L.push(`| ${o.chapter} | ${b} | ${t(lang, o.goal)} | ${steps} | ${r.targets ? Math.round((r.targets / r.frames) * 100) + '% of the time' : 'none (seated / camera)'} |`);
}
const fr = fragments(g);
L.push('', `Memories found in this playthrough: ${fr.filter((f) => f.found).length} of ${fr.length} (${fr.filter((f) => f.optional).length} optional).`);
console.log(L.join('\n'));
