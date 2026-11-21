// Builds the RC2 playtest package for the owner (chapter 1 retest first), from the same single-file builds as RC1:
//   node tools/v5-rc2-pack.mjs   ->  dist/resurrection-v5-rc2/ and dist/resurrection-v5-rc2.zip
// Run `npm run v5:rc` first (it builds dist/resurrection-v5-rc1/ and the playtest folder from the current commit), or just
//   npm run v5:rc2     (build, pack, then verify the zip from a fresh folder: tools/v5-verify-package.mjs)
// Needs a clean tree (see below). The zip holds the single-file pages, the review screenshots, docs/ and two plain-text sheets.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'dist', 'resurrection-v5-rc1');
if (!fs.existsSync(path.join(src, 'Resurrection-V5.html'))) { console.error('run  npm run v5:rc  first'); process.exit(1); }
const build = (fs.readFileSync(path.join(src, 'START-HERE.txt'), 'utf8').match(/build (\w+)/) || [])[1] || 'unknown';
const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim();
if (build !== head) { console.error(`dist/ is from ${build}, HEAD is ${head}: run  npm run v5:rc  again`); process.exit(1); }
// the build id in the pages is only the commit hash: a package made from a modified tree would look clean and not be
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'frontend', 'combined-server', 'docs', 'tools', 'test', 'e2e', 'package.json'], { cwd: root }).toString().trim();
if (dirty) { console.error('uncommitted changes in the game, docs or tools; commit them first so the build id says what is inside:\n' + dirty); process.exit(1); }
const out = path.join(root, 'dist', 'resurrection-v5-rc2');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });
['V5-RC2-REPORT.md', 'V5-LOCAL-TESTING.md'].forEach((d) => fs.copyFileSync(path.join(root, 'docs', d), path.join(out, 'docs', d)));
fs.writeFileSync(path.join(out, 'START-HERE.txt'), `Resurrection V5 — RC2 playtest package (build ${build})

What to do first: replay CHAPTER 1 as if you had never seen the game (about 5–10 minutes).
  1. Double-click  Resurrection-V5.html  (Chrome, Edge, Firefox or Safari on a computer; no install, no internet).
     If an old save from RC1 is offered, choose New game.
  2. Do not read anything else first. Play until June's train leaves.
  3. Then answer the questions in CHAPTER-1-RETEST.txt (write them in any file, or tell the developer).

Everything else (as in RC1): Resurrection-V5-Start.html has the six doors (start, continue, technical demo, music, key
scenes, feedback). docs/V5-RC2-REPORT.md says what changed, what passed and what is not tested.
Phone or tablet: these files cannot be opened from a phone directly; in the repository run  npm run v5:lan.
`);
fs.writeFileSync(path.join(out, 'CHAPTER-1-RETEST.txt'), `Chapter 1 retest (RC2, build ${build})

Before RC2 you got stuck twice: E at the computer did nothing useful, and after the first Tab you did not know where to go.
Please play chapter 1 fresh and note, honestly, for each point: clear / took a while / stuck, and roughly how long.

 1. The first minute: did you know how to move and look without being told by anyone?
 2. The computer: when it asked for a disk, did you know where to find it?
 3. The task bar (top left): did you notice it? Did "Next:" tell you the right thing?
 4. The canal and the bridge: did you know you had to HOLD E?
 5. The pier: did you understand that you must switch years halfway out (1998 deck, 2004 middle part, 1998 far end)?
    Who or what told you: Theo, Mara's remarks at the edges, the task bar, the help arrow or marker, H?
 6. Did the automatic help (an arrow after ~30 s, a spoken hint after ~60 s, a marker after ~90 s) come too early,
    too late, or about right? (It can be turned off in Settings.)
 7. The memory journal (J, or the pause menu): did you open it? Was it worth opening?
 8. Anything on screen that looked broken, covered something, or stayed too long?
 9. Air particles in the study and the snow: still distracting?
10. In one sentence: could a friend who never heard of the game finish chapter 1 alone?

Optional: the playtest build (Resurrection-V5-Playtest.html) records your play on this computer only, if you agree on
its first screen; you can download the record from the pause menu and send it.
`);
const zip = path.join(root, 'dist', 'resurrection-v5-rc2.zip'); fs.rmSync(zip, { force: true });
try { execFileSync('zip', ['-qrX', zip, 'resurrection-v5-rc2'], { cwd: path.join(root, 'dist') }); console.log('wrote', path.relative(root, zip)); } catch (e) { console.log('zip not available; folder only'); }
console.log('wrote', path.relative(root, out), 'build', build);
