// Headless playthrough of Resurrection V5: plays the real game core from the study to the credits with the scripted
// bot in test/v5-bot.mjs and prints a timeline. Automated simulation, not a browser and not a human playtest.
//   node tools/v5-playthrough.mjs [--variant] [--no-glide] [--quiet]
import fs from 'node:fs';
import path from 'node:path';
import * as Ar from '../frontend/v5/core/archive.js';
import * as Gm from '../frontend/v5/core/game.js';
import { playThrough } from '../test/v5-bot.mjs';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const data = (f) => fs.readFileSync(path.join(root, 'frontend', 'v5', 'data', f), 'utf8');
export function loadArchive(variant) {
  const t = {}; for (const s of Ar.SOURCES) { t[s.id] = data(s.file); }
  if (variant) { t.disk = data('variant-missing-plank.spool'); }
  t.edition = data(Ar.EXTRA_FILES.edition); t.drafts = data(Ar.EXTRA_FILES.drafts);
  return Ar.createArchive(t);
}
if (process.argv[1] && process.argv[1].endsWith('v5-playthrough.mjs')) {
  const args = process.argv.slice(2);
  const g = Gm.createGame(loadArchive(args.includes('--variant')));
  try {
    const bot = playThrough(g, { log: !args.includes('--quiet'), glide: !args.includes('--no-glide') });
    console.log('COMPLETE in', bot.t.toFixed(1), 's of game time');
    console.log('marks', JSON.stringify(Object.fromEntries(Object.entries(bot.marks).map(([k, v]) => [k, Math.round(v)]))));
    console.log('photos', JSON.stringify(g.s.photos.map((p) => p.reaction)), 'choices', JSON.stringify(g.s.choices), 'window', JSON.stringify(g.s.window));
    console.log('restored', Object.keys(g.s.restored).join(','), 'edition', JSON.stringify(g.s.edition));
    console.log('stuck moments', bot.stuck.length, JSON.stringify(bot.stuck.slice(0, 5)));
  } catch (e) {
    const s = Gm.snapshot(g);
    console.log('FAIL', e.message);
    console.log(JSON.stringify({ beat: s.beat, x: s.x, y: s.y, z: s.z, era: s.era, prompt: s.prompt, dialog: s.dialog, choice: s.choice, train: s.train, ride: s.ride, duet: s.duet, june: s.june }));
    process.exitCode = 1;
  }
}
