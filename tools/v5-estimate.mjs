// ESTIMATE of first-play time for Resurrection V5. Not a measurement: nobody has played the game.
// Plays the core with the scripted bot (test/v5-bot.mjs), then models a first-time player per chapter:
//   reading  = for every dialogue line shown: 1.2 s + characters / reading speed (EN 14 chars/s, ZH 6 chars/s),
//              silences as written, 4 s per choice, plus 30% of each caption's reading time
//   playing  = the bot's time outside dialogue x F, where F is how much longer a first-time player takes than a
//              bot that walks straight to every target (low 1.6, mid 2.2, high 2.8)
//   node tools/v5-estimate.mjs [--lang zh] [--json]
import * as Gm from '../frontend/v5/core/game.js';
import { t } from '../frontend/v5/core/i18n.js';
import { loadArchive } from './v5-playthrough.mjs';
import { playThrough, DT } from '../test/v5-bot.mjs';

const args = process.argv.slice(2); const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'en';
const CPS = lang === 'zh' ? 6 : 14, F = { low: 1.6, mid: 2.2, high: 2.8 };
const g = Gm.createGame(loadArchive());
const per = {}; const at = () => { const c = Gm.chapterOf(g.s.beat); return (per[c] = per[c] || { play: 0, read: 0, lines: 0, captions: 0 }); };
const readT = (key) => 1.2 + t(lang, key).length / CPS;
const step = (input) => {
  const s0 = Gm.snapshot(g); const inD = !!(s0.dialog || s0.choice);
  const ev = Gm.tick(g, DT, input);
  if (!inD) { at().play += DT; }
  ev.forEach((e) => {
    const c = at();
    if (e.type === 'line') { const ln = e.line; if (Array.isArray(ln)) { if (ln[0] === 'pause') { c.read += ln[1]; } else { c.read += readT(ln[1]); c.lines += 1; } } else { c.read += 4; } }
    if (e.type === 'choose') { c.read += 4; }
    if (e.type === 'caption') { c.read += 0.3 * readT(e.key); c.captions += 1; }
  });
  return ev;
};
const bot = await playThrough(g, { step });
const rows = Object.entries(per).map(([c, v]) => ({ chapter: +c, lines: v.lines, captions: v.captions, readMin: v.read / 60, botPlayMin: v.play / 60,
  low: (v.read + v.play * F.low) / 60, mid: (v.read + v.play * F.mid) / 60, high: (v.read + v.play * F.high) / 60 }));
const tot = (k) => rows.reduce((a, r) => a + r[k], 0);
if (args.includes('--json')) { console.log(JSON.stringify({ lang, botGameSeconds: Math.round(bot.t), rows, total: { low: tot('low'), mid: tot('mid'), high: tot('high') } })); }
else {
  console.log(`ESTIMATE (${lang}), not measured. Bot game time ${Math.round(bot.t)} s.`);
  console.log('ch  lines caps  read  botplay   low   mid  high  (minutes)');
  rows.forEach((r) => console.log(`${r.chapter}   ${String(r.lines).padStart(5)} ${String(r.captions).padStart(4)} ${r.readMin.toFixed(1).padStart(5)} ${r.botPlayMin.toFixed(1).padStart(8)} ${r.low.toFixed(1).padStart(5)} ${r.mid.toFixed(1).padStart(5)} ${r.high.toFixed(1).padStart(5)}`));
  console.log(`all ${String(tot('lines')).padStart(5)} ${String(tot('captions')).padStart(4)} ${tot('readMin').toFixed(1).padStart(5)} ${tot('botPlayMin').toFixed(1).padStart(8)} ${tot('low').toFixed(1).padStart(5)} ${tot('mid').toFixed(1).padStart(5)} ${tot('high').toFixed(1).padStart(5)}`);
}
